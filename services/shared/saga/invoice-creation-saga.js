// services/shared/saga/invoice-creation-saga.js
// Saga orchestrator for invoice creation with compensating transactions

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Saga Orchestrator for Invoice Creation
 * 
 * Implements the Saga pattern with compensating transactions to ensure
 * data consistency across microservices.
 * 
 * Flow:
 * 1. Reserve Inventory (Inventory Service)
 * 2. Create Invoice (Invoice Service DB)
 * 3. Log Audit Event (Audit Service)
 * 4. Publish Event (Kafka)
 * 
 * On failure: Execute compensating transactions in reverse order
 */
class InvoiceCreationSaga {
    constructor(config = {}) {
        this.inventoryServiceUrl = config.inventoryServiceUrl || process.env.INVENTORY_SERVICE_URL;
        this.auditServiceUrl = config.auditServiceUrl || process.env.AUDIT_SERVICE_URL;
        this.kafkaProducer = config.kafkaProducer;
        this.dbPool = config.dbPool;
        this.logger = config.logger || console;

        // Saga state
        this.sagaId = uuidv4();
        this.completedSteps = [];
        this.sagaData = {};
    }

    /**
     * Execute the saga
     * @param {Object} invoiceData - Invoice creation data
     * @returns {Object} - Created invoice or error
     */
    async execute(invoiceData) {
        this.logger.info(`[Saga ${this.sagaId}] Starting invoice creation saga`, {
            sagaId: this.sagaId,
            merchantId: invoiceData.seller_merchant_id,
            invoiceNumber: invoiceData.invoice_number
        });

        try {
            // Step 1: Reserve Inventory
            await this.reserveInventory(invoiceData);

            // Step 2: Create Invoice in DB
            await this.createInvoice(invoiceData);

            // Step 3: Log Audit Event
            await this.logAuditEvent(invoiceData);

            // Step 4: Publish Event to Kafka
            await this.publishEvent(invoiceData);

            this.logger.info(`[Saga ${this.sagaId}] Saga completed successfully`);

            return {
                success: true,
                invoice: this.sagaData.invoice,
                sagaId: this.sagaId
            };

        } catch (error) {
            this.logger.error(`[Saga ${this.sagaId}] Saga failed at step: ${error.step}`, {
                sagaId: this.sagaId,
                error: error.message,
                stack: error.stack
            });

            // Execute compensating transactions
            await this.compensate(error);

            return {
                success: false,
                error: error.message,
                failedStep: error.step,
                sagaId: this.sagaId
            };
        }
    }

    /**
     * Step 1: Reserve Inventory
     */
    async reserveInventory(invoiceData) {
        const stepName = 'RESERVE_INVENTORY';
        this.logger.info(`[Saga ${this.sagaId}] Step 1: Reserving inventory`);

        try {
            const response = await axios.post(
                `${this.inventoryServiceUrl}/inventory/reserve`,
                {
                    merchant_id: invoiceData.seller_merchant_id,
                    items: invoiceData.items.map(item => ({
                        sku: item.sku,
                        quantity: item.quantity
                    })),
                    invoice_id: null, // Will be set after invoice creation
                    saga_id: this.sagaId
                },
                {
                    timeout: 5000,
                    headers: {
                        'X-Saga-Id': this.sagaId,
                        'X-Idempotency-Key': `${this.sagaId}-reserve`
                    }
                }
            );

            if (!response.data.success) {
                throw new Error(response.data.error || 'Inventory reservation failed');
            }

            this.completedSteps.push(stepName);
            this.sagaData.reservedItems = invoiceData.items;

            this.logger.info(`[Saga ${this.sagaId}] Step 1: Inventory reserved successfully`);

        } catch (error) {
            const sagaError = new Error(error.response?.data?.error || error.message);
            sagaError.step = stepName;
            throw sagaError;
        }
    }

    /**
     * Step 2: Create Invoice in Database
     */
    async createInvoice(invoiceData) {
        const stepName = 'CREATE_INVOICE';
        this.logger.info(`[Saga ${this.sagaId}] Step 2: Creating invoice in database`);

        const client = await this.dbPool.connect();

        try {
            await client.query('BEGIN');

            const invoiceId = uuidv4();

            // Insert invoice
            const invoiceQuery = `
        INSERT INTO invoices (
          id, invoice_number, seller_merchant_id, buyer_gstin,
          invoice_date, due_date, total_amount, status, file_url,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ISSUED', $8, NOW(), NOW())
        RETURNING *;
      `;

            const invoiceValues = [
                invoiceId,
                invoiceData.invoice_number,
                invoiceData.seller_merchant_id,
                invoiceData.buyer_gstin,
                invoiceData.invoice_date,
                invoiceData.due_date,
                invoiceData.total_amount,
                invoiceData.file_url || null
            ];

            const invoiceResult = await client.query(invoiceQuery, invoiceValues);
            const invoice = invoiceResult.rows[0];

            // Insert invoice items
            if (invoiceData.items && invoiceData.items.length > 0) {
                const itemValues = [];
                const itemPlaceholders = invoiceData.items.map((item, i) => {
                    const offset = i * 9;
                    itemValues.push(
                        invoiceId,
                        item.sku,
                        item.description,
                        item.hsn_code,
                        item.quantity,
                        item.unit_price,
                        item.taxable_value,
                        item.gst_rate,
                        item.total_item_amount
                    );
                    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
                }).join(', ');

                await client.query(`
          INSERT INTO invoice_items (
            invoice_id, sku, description, hsn_code, quantity,
            unit_price, taxable_value, gst_rate, total_item_amount
          ) VALUES ${itemPlaceholders}
        `, itemValues);
            }

            await client.query('COMMIT');

            this.completedSteps.push(stepName);
            this.sagaData.invoice = invoice;
            this.sagaData.invoiceId = invoiceId;

            this.logger.info(`[Saga ${this.sagaId}] Step 2: Invoice created successfully`, {
                invoiceId: invoiceId
            });

        } catch (error) {
            await client.query('ROLLBACK');

            const sagaError = new Error(`Database error: ${error.message}`);
            sagaError.step = stepName;
            throw sagaError;

        } finally {
            client.release();
        }
    }

    /**
     * Step 3: Log Audit Event
     */
    async logAuditEvent(invoiceData) {
        const stepName = 'LOG_AUDIT';
        this.logger.info(`[Saga ${this.sagaId}] Step 3: Logging audit event`);

        try {
            // Non-critical step: If audit service is down, log to DLQ but don't fail saga
            const response = await axios.post(
                `${this.auditServiceUrl}/audit/log`,
                {
                    entity_type: 'INVOICE',
                    entity_id: this.sagaData.invoiceId,
                    action: 'CREATED',
                    actor_id: invoiceData.created_by || null,
                    payload: {
                        invoice: this.sagaData.invoice,
                        saga_id: this.sagaId
                    }
                },
                {
                    timeout: 3000,
                    headers: {
                        'X-Saga-Id': this.sagaId
                    }
                }
            );

            this.completedSteps.push(stepName);
            this.sagaData.auditLogId = response.data.audit_log_id;

            this.logger.info(`[Saga ${this.sagaId}] Step 3: Audit event logged successfully`);

        } catch (error) {
            // Non-critical: Log error but continue
            this.logger.warn(`[Saga ${this.sagaId}] Step 3: Audit logging failed (non-critical)`, {
                error: error.message
            });

            // Send to DLQ for async retry
            await this.sendToDLQ({
                type: 'AUDIT_LOG_FAILED',
                sagaId: this.sagaId,
                invoiceId: this.sagaData.invoiceId,
                error: error.message,
                payload: invoiceData
            });

            // Don't fail the saga for audit failures
            this.completedSteps.push(stepName);
        }
    }

    /**
     * Step 4: Publish Event to Kafka
     */
    async publishEvent(invoiceData) {
        const stepName = 'PUBLISH_EVENT';
        this.logger.info(`[Saga ${this.sagaId}] Step 4: Publishing event to Kafka`);

        try {
            if (!this.kafkaProducer) {
                this.logger.warn(`[Saga ${this.sagaId}] Kafka producer not configured, skipping event publish`);
                return;
            }

            await this.kafkaProducer.send({
                topic: 'invoice.events',
                messages: [{
                    key: this.sagaData.invoiceId,
                    value: JSON.stringify({
                        event_type: 'INVOICE_CREATED',
                        invoice_id: this.sagaData.invoiceId,
                        merchant_id: invoiceData.seller_merchant_id,
                        total_amount: invoiceData.total_amount,
                        saga_id: this.sagaId,
                        timestamp: new Date().toISOString()
                    }),
                    headers: {
                        'saga-id': this.sagaId,
                        'event-type': 'INVOICE_CREATED'
                    }
                }]
            });

            this.completedSteps.push(stepName);

            this.logger.info(`[Saga ${this.sagaId}] Step 4: Event published successfully`);

        } catch (error) {
            // Non-critical: Log error but don't fail saga
            this.logger.warn(`[Saga ${this.sagaId}] Step 4: Event publish failed (non-critical)`, {
                error: error.message
            });

            this.completedSteps.push(stepName);
        }
    }

    /**
     * Compensate: Execute compensating transactions in reverse order
     */
    async compensate(originalError) {
        this.logger.warn(`[Saga ${this.sagaId}] Starting compensation`, {
            completedSteps: this.completedSteps
        });

        const compensationResults = [];

        // Compensate in reverse order
        for (let i = this.completedSteps.length - 1; i >= 0; i--) {
            const step = this.completedSteps[i];

            try {
                switch (step) {
                    case 'RESERVE_INVENTORY':
                        await this.compensateInventoryReservation();
                        compensationResults.push({ step, status: 'SUCCESS' });
                        break;

                    case 'CREATE_INVOICE':
                        await this.compensateInvoiceCreation();
                        compensationResults.push({ step, status: 'SUCCESS' });
                        break;

                    case 'LOG_AUDIT':
                        // Audit logs are append-only, no compensation needed
                        compensationResults.push({ step, status: 'SKIPPED' });
                        break;

                    case 'PUBLISH_EVENT':
                        // Events are immutable, publish compensation event instead
                        await this.publishCompensationEvent(originalError);
                        compensationResults.push({ step, status: 'SUCCESS' });
                        break;
                }

            } catch (compensationError) {
                this.logger.error(`[Saga ${this.sagaId}] CRITICAL: Compensation failed for step ${step}`, {
                    error: compensationError.message,
                    stack: compensationError.stack
                });

                compensationResults.push({
                    step,
                    status: 'FAILED',
                    error: compensationError.message
                });

                // Send to DLQ for manual intervention
                await this.sendToDLQ({
                    type: 'COMPENSATION_FAILED',
                    sagaId: this.sagaId,
                    step: step,
                    error: compensationError.message,
                    originalError: originalError.message,
                    sagaData: this.sagaData
                });
            }
        }

        this.logger.info(`[Saga ${this.sagaId}] Compensation completed`, {
            results: compensationResults
        });
    }

    /**
     * Compensate: Release reserved inventory
     */
    async compensateInventoryReservation() {
        this.logger.info(`[Saga ${this.sagaId}] Compensating: Releasing inventory`);

        try {
            await axios.post(
                `${this.inventoryServiceUrl}/inventory/release`,
                {
                    merchant_id: this.sagaData.invoice?.seller_merchant_id,
                    items: this.sagaData.reservedItems,
                    invoice_id: this.sagaData.invoiceId || null,
                    saga_id: this.sagaId,
                    reason: 'SAGA_COMPENSATION'
                },
                {
                    timeout: 5000,
                    headers: {
                        'X-Saga-Id': this.sagaId,
                        'X-Compensation': 'true'
                    }
                }
            );

            this.logger.info(`[Saga ${this.sagaId}] Inventory released successfully`);

        } catch (error) {
            throw new Error(`Failed to release inventory: ${error.message}`);
        }
    }

    /**
     * Compensate: Delete created invoice
     */
    async compensateInvoiceCreation() {
        this.logger.info(`[Saga ${this.sagaId}] Compensating: Deleting invoice`);

        const client = await this.dbPool.connect();

        try {
            await client.query('BEGIN');

            // Soft delete: Mark as CANCELLED instead of hard delete (for audit trail)
            await client.query(
                `UPDATE invoices SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
                [this.sagaData.invoiceId]
            );

            // Also mark invoice items
            await client.query(
                `DELETE FROM invoice_items WHERE invoice_id = $1`,
                [this.sagaData.invoiceId]
            );

            await client.query('COMMIT');

            this.logger.info(`[Saga ${this.sagaId}] Invoice deleted successfully`);

        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to delete invoice: ${error.message}`);

        } finally {
            client.release();
        }
    }

    /**
     * Publish compensation event to Kafka
     */
    async publishCompensationEvent(originalError) {
        if (!this.kafkaProducer) return;

        try {
            await this.kafkaProducer.send({
                topic: 'invoice.events',
                messages: [{
                    key: this.sagaData.invoiceId || this.sagaId,
                    value: JSON.stringify({
                        event_type: 'INVOICE_CREATION_FAILED',
                        saga_id: this.sagaId,
                        invoice_id: this.sagaData.invoiceId,
                        error: originalError.message,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
        } catch (error) {
            this.logger.error(`[Saga ${this.sagaId}] Failed to publish compensation event`, {
                error: error.message
            });
        }
    }

    /**
     * Send failed operation to Dead Letter Queue
     */
    async sendToDLQ(payload) {
        if (!this.kafkaProducer) {
            this.logger.error('Cannot send to DLQ: Kafka producer not configured');
            return;
        }

        try {
            await this.kafkaProducer.send({
                topic: 'invoice.dlq',
                messages: [{
                    key: this.sagaId,
                    value: JSON.stringify({
                        ...payload,
                        timestamp: new Date().toISOString()
                    })
                }]
            });

            this.logger.info(`[Saga ${this.sagaId}] Sent to DLQ`, { type: payload.type });

        } catch (error) {
            this.logger.error(`[Saga ${this.sagaId}] CRITICAL: Failed to send to DLQ`, {
                error: error.message,
                payload: payload
            });
        }
    }
}

module.exports = InvoiceCreationSaga;
