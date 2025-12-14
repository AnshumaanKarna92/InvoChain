const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const axios = require('axios');
const { createInvoiceSchema, validateRequest } = require('./validation');
const logger = require('./logger');
const { idempotencyMiddleware } = require('./shared/middleware/idempotency');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3013';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003';

// Helper: Create Blockchain Anchor
async function createBlockchainAnchor(record_type, record_id, event_type, data, merchant_id, wallet_address = null) {
    try {
        await axios.post(`${BLOCKCHAIN_SERVICE_URL}/blockchain/anchor`, {
            record_type,
            record_id,
            event_type,
            data,
            merchant_id,
            wallet_address
        });
        logger.info(`[Blockchain] Anchored ${record_type}:${event_type} for ${record_id}`);
    } catch (error) {
        logger.error(`Failed to create blockchain anchor: ${error.message}`);
        // Non-blocking - don't throw
    }
}

// Helper: Create Notification
async function createNotification(merchant_id, invoice_id, type, title, message) {
    try {
        await axios.post(`${NOTIFICATION_SERVICE_URL}/notifications`, {
            merchant_id,
            invoice_id,
            type,
            title,
            message
        });
    } catch (error) {
        logger.error(`Failed to create notification: ${error.message}`);
        // Non-blocking - don't throw, just log
    }
}

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
});

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../storage/invoices');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Helper: Generate SHA-256 hash
function generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Invoice Service' });
});

// Create Invoice
app.post('/invoices', upload.single('file'), idempotencyMiddleware(), validateRequest(createInvoiceSchema), async (req, res) => {
    const client = await pool.connect();
    let stockReserved = false;
    let reservedItems = [];

    try {
        await client.query('BEGIN');

        // Use validated body
        console.log('Validated Body Keys:', Object.keys(req.validatedBody));
        if (req.validatedBody.items) console.log('Items type:', typeof req.validatedBody.items);
        else console.log('Items is MISSING in validatedBody');

        const {
            invoice_number, seller_merchant_id, buyer_gstin,
            invoice_date, due_date, items, // items is already parsed object array
            total_amount, tax_amount
        } = req.validatedBody;

        reservedItems = items.map(i => ({ sku: i.sku, quantity: i.quantity }));

        // 1. Validate Seller (Optional: Check if exists in Merchant Registry via API or DB)
        // For now, we assume seller_merchant_id is valid or checked by frontend/auth

        // 2. Lookup Buyer (Grace Mode)
        // In a real microservice setup, we'd call Merchant Registry. 
        // Here we can do a quick DB check if we share the DB, or assume logic handles it.
        // We will proceed to create invoice even if buyer is not registered (Grace Mode).

        // 3. Reserve Inventory
        // Call Inventory Service
        try {
            await axios.post(`${INVENTORY_SERVICE_URL}/inventory/reserve`, {
                merchant_id: seller_merchant_id,
                items: reservedItems,
                invoice_id: null // We don't have ID yet
            });
            stockReserved = true;
        } catch (invError) {
            throw new Error(`Inventory Reservation Failed: ${invError.response?.data?.error || invError.response?.data?.message || invError.message}`);
        }

        const invoiceId = uuidv4();
        const fileUrl = req.file ? `/storage/invoices/${req.file.filename}` : null;

        // 4. Insert Invoice
        // Calculate Tax Split
        let total_cgst = 0, total_sgst = 0, total_igst = 0;
        const pos = req.validatedBody.place_of_supply || '29'; // Default to Karnataka for now

        // We need Seller GSTIN to compare state codes accurately, but for now we'll rely on POS logic or assume Intra if POS matches default.
        // Better: Assume Intra (CGST+SGST) if POS == '29' (Seller State), else IGST.
        // Since we don't have Seller State readily available without DB call, let's assume Seller is '29'.

        // Fetch Seller GSTIN
        const sellerRes = await client.query('SELECT gstin FROM merchants WHERE id = $1', [seller_merchant_id]);
        const seller_gstin = sellerRes.rows[0]?.gstin;

        // Lookup Buyer Merchant ID
        let buyer_merchant_id = null;
        const buyerRes = await client.query('SELECT id FROM merchants WHERE gstin = $1', [buyer_gstin]);
        if (buyerRes.rows.length > 0) {
            buyer_merchant_id = buyerRes.rows[0].id;
        }

        if (pos === '29') {
            total_cgst = tax_amount / 2;
            total_sgst = tax_amount / 2;
        } else {
            total_igst = tax_amount;
        }

        const invoiceQuery = `
            INSERT INTO invoices (
                id, invoice_number, seller_merchant_id, seller_gstin, buyer_merchant_id, buyer_gstin, 
                invoice_date, due_date, total_amount, 
                status, file_url,
                place_of_supply, total_cgst, total_sgst, total_igst, total_taxable_value
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ISSUED', $10, $11, $12, $13, $14, $15)
            RETURNING *;
        `;
        const invoiceValues = [
            invoiceId, invoice_number, seller_merchant_id, seller_gstin, buyer_merchant_id, buyer_gstin,
            invoice_date, due_date, total_amount, fileUrl,
            pos, total_cgst, total_sgst, total_igst, total_amount - tax_amount
        ];

        const invoiceResult = await client.query(invoiceQuery, invoiceValues);
        const invoice = invoiceResult.rows[0];

        // 5. Insert Items (Batch Insert)
        if (items.length > 0) {
            const itemValues = [];
            const itemPlaceholders = items.map((item, i) => {
                const offset = i * 9;
                itemValues.push(
                    invoiceId, item.sku, item.description, item.hsn_code, item.quantity,
                    item.unit_price, item.taxable_value, item.gst_rate, item.total_item_amount
                );
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
            }).join(', ');

            await client.query(`
                INSERT INTO invoice_items (
                    invoice_id, sku, description, hsn_code, quantity, unit_price, 
                    taxable_value, gst_rate, total_item_amount
                ) VALUES ${itemPlaceholders}
            `, itemValues);
        }

        // 6. Generate Hash & Audit Log (Mocked for now, or call Audit Service)
        const invoiceHash = generateHash(invoice);
        // await axios.post('http://localhost:3005/audit/log', { ... });

        await client.query('COMMIT');

        logger.info(`Invoice created: ${invoiceId}`);

        // Create notification for buyer
        // Find buyer merchant_id if exists
        try {
            const buyerResult = await pool.query('SELECT id, legal_name FROM merchants WHERE gstin = $1', [buyer_gstin]);
            if (buyerResult.rows.length > 0) {
                const buyerMerchantId = buyerResult.rows[0].id;
                await createNotification(
                    buyerMerchantId,
                    invoiceId,
                    'INVOICE_RECEIVED',
                    'New Invoice Received',
                    `Invoice ${invoice_number} for ₹${total_amount} has been issued to you. Please review and take action.`
                );
            }
        } catch (notifError) {
            logger.error(`Failed to send buyer notification: ${notifError.message}`);
        }

        res.status(201).json({
            success: true,
            invoice,
            message: 'Invoice created and stock reserved'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error creating invoice: ${error.message}`, { stack: error.stack });

        // Compensating Transaction: Release Stock if it was reserved
        if (stockReserved) {
            try {
                logger.info('Rolling back inventory reservation...');
                await axios.post(`${INVENTORY_SERVICE_URL}/inventory/release`, {
                    merchant_id: req.body.seller_merchant_id,
                    items: reservedItems,
                    invoice_id: null
                });
            } catch (releaseError) {
                logger.error(`CRITICAL: Failed to release stock after invoice failure: ${releaseError.message}`);
                // In production, this should be pushed to a Dead Letter Queue (DLQ) for manual intervention
            }
        }

        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Action on Invoice (Accept/Reject)
app.post('/invoices/:id/action', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { action, reason, wallet_address } = req.body; // ACCEPT, REJECT

        const invResult = await client.query('SELECT * FROM invoices WHERE id = $1', [id]);
        if (invResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        const invoice = invResult.rows[0];

        // Get Items
        const itemsResult = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
        const items = itemsResult.rows;

        if (action === 'ACCEPT') {
            // Commit Stock (Seller)
            await axios.post(`${INVENTORY_SERVICE_URL}/inventory/commit`, {
                merchant_id: invoice.seller_merchant_id,
                items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
                invoice_id: id
            });

            // Transfer Stock to Buyer (if registered)
            if (invoice.buyer_merchant_id) {
                try {
                    for (const item of items) {
                        await axios.post(`${INVENTORY_SERVICE_URL}/inventory/adjust`, {
                            merchant_id: invoice.buyer_merchant_id,
                            sku: item.sku,
                            name: item.description,
                            quantity_change: parseFloat(item.quantity),
                            unit_price: parseFloat(item.unit_price),
                            type: 'ADD'
                        });
                    }
                    logger.info(`Stock transferred to buyer ${invoice.buyer_merchant_id}`);
                } catch (transferError) {
                    logger.error(`Failed to transfer stock to buyer: ${transferError.message}`);
                }
            } else if (invoice.buyer_gstin) {
                try {
                    const buyerRes = await client.query('SELECT id FROM merchants WHERE gstin = $1', [invoice.buyer_gstin]);
                    if (buyerRes.rows.length > 0) {
                        const buyerId = buyerRes.rows[0].id;
                        for (const item of items) {
                            await axios.post(`${INVENTORY_SERVICE_URL}/inventory/adjust`, {
                                merchant_id: buyerId,
                                sku: item.sku,
                                name: item.description,
                                quantity_change: parseFloat(item.quantity),
                                unit_price: parseFloat(item.unit_price),
                                type: 'ADD'
                            });
                        }
                        logger.info(`Stock transferred to buyer ${buyerId} (lookup by GSTIN)`);
                    }
                } catch (lookupError) {
                    logger.error(`Failed to lookup buyer for stock transfer: ${lookupError.message}`);
                }
            }

            await client.query("UPDATE invoices SET status = 'ACCEPTED' WHERE id = $1", [id]);

            // Notify seller of acceptance
            await createNotification(
                invoice.seller_merchant_id,
                id,
                'INVOICE_ACCEPTED',
                'Invoice Accepted',
                `Invoice ${invoice.invoice_number} has been accepted by the buyer.`
            );

            // Create blockchain anchor for tamper-evidence
            await createBlockchainAnchor(
                'INVOICE',
                id,
                'ACCEPTED',
                {
                    invoice_number: invoice.invoice_number,
                    total_amount: invoice.total_amount,
                    seller_gstin: invoice.seller_gstin,
                    buyer_gstin: invoice.buyer_gstin,
                    status: 'ACCEPTED',
                    accepted_at: new Date().toISOString()
                },
                invoice.seller_merchant_id,
                wallet_address
            );

        } else if (action === 'REJECT') {
            // Release Stock
            await axios.post(`${INVENTORY_SERVICE_URL}/inventory/release`, {
                merchant_id: invoice.seller_merchant_id,
                items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
                invoice_id: id
            });

            await client.query("UPDATE invoices SET status = 'REJECTED' WHERE id = $1", [id]);

            // Notify seller of rejection
            await createNotification(
                invoice.seller_merchant_id,
                id,
                'INVOICE_REJECTED',
                'Invoice Rejected',
                `Invoice ${invoice.invoice_number} has been rejected${reason ? `: ${reason}` : '.'}`
            );
        } else if (action === 'PAY') {
            // If invoice is already PAID, do nothing
            if (invoice.status === 'PAID') {
                return res.json({ success: true, message: 'Invoice already paid' });
            }

            // Ensure invoice is ACCEPTED before paying (or handle implicit accept if needed, but per requirement we separate)
            if (invoice.status === 'ISSUED') {
                return res.status(400).json({ success: false, message: 'Invoice must be ACCEPTED before payment' });
            }

            // Update status to PAID (or PARTIALLY_PAID logic could go here)
            await client.query("UPDATE invoices SET status = 'PAID' WHERE id = $1", [id]);

            // Notify seller of payment
            await createNotification(
                invoice.seller_merchant_id,
                id,
                'INVOICE_PAID',
                'Invoice Paid',
                `Invoice ${invoice.invoice_number} has been fully paid and settled.`
            );
        }

        logger.info(`Invoice ${id} ${action}ED`);
        res.json({ success: true, message: `Invoice ${action}ED successfully` });

    } catch (error) {
        logger.error(`Error processing invoice action: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Invoice Analytics (Per-Merchant)
app.get('/invoices/analytics', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id } = req.query;

        if (!merchant_id) {
            return res.status(400).json({ success: false, error: 'merchant_id is required' });
        }

        // Get merchant's GSTIN to determine seller vs buyer invoices
        const merchantResult = await client.query('SELECT gstin FROM merchants WHERE id = $1', [merchant_id]);
        const merchantGstin = merchantResult.rows[0]?.gstin;

        // Calculate seller metrics (invoices I issued)
        const sellerInvoicedResult = await client.query(
            "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE seller_merchant_id = $1 AND status IN ('ISSUED', 'ACCEPTED')",
            [merchant_id]
        );

        const sellerAcceptedResult = await client.query(
            "SELECT COalesce(SUM(total_amount), 0) as total FROM invoices WHERE seller_merchant_id = $1 AND status = 'ACCEPTED'",
            [merchant_id]
        );

        // Calculate buyer metrics (invoices issued to me)
        const buyerInvoicedResult = await client.query(
            "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE buyer_gstin = $1 AND status IN ('ISSUED', 'ACCEPTED')",
            [merchantGstin]
        );

        const buyerPaymentsResult = await client.query(
            `SELECT COALESCE(SUM(p.amount), 0) as total 
             FROM payments p 
             JOIN invoices i ON p.invoice_id = i.id 
             WHERE i.buyer_gstin = $1`,
            [merchantGstin]
        );

        // Seller perspective: Receivables = Accepted - Received
        const totalInvoiced = parseFloat(sellerInvoicedResult.rows[0].total || 0);
        const totalAccepted = parseFloat(sellerAcceptedResult.rows[0].total || 0);

        // Get payments received for seller's invoices
        const sellerPaymentsResult = await client.query(
            `SELECT COALESCE(SUM(p.amount), 0) as total 
             FROM payments p 
             JOIN invoices i ON p.invoice_id = i.id 
             WHERE i.seller_merchant_id = $1`,
            [merchant_id]
        );
        const totalReceived = parseFloat(sellerPaymentsResult.rows[0].total || 0);

        // Receivables = Total Invoiced (Issued + Accepted) - Payments received
        const receivables = totalInvoiced - totalReceived;

        // Buyer perspective: Payables = Invoices to pay - Payments made
        const totalPayable = parseFloat(buyerInvoicedResult.rows[0].total || 0);
        const totalPaidByMe = parseFloat(buyerPaymentsResult.rows[0].total || 0);
        const payables = totalPayable - totalPaidByMe;

        res.json({
            success: true,
            // Seller metrics
            total_invoiced: totalInvoiced,
            total_paid: totalReceived,
            total_receivables: receivables,
            // Buyer metrics
            total_payable: totalPayable,
            total_paid_by_me: totalPaidByMe,
            payables: payables
        });
    } catch (error) {
        logger.error(`Error fetching analytics: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get Single Invoice Details
app.get('/invoices/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const invResult = await client.query('SELECT * FROM invoices WHERE id = $1', [id]);

        if (invResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const invoice = invResult.rows[0];
        const itemsResult = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
        const items = itemsResult.rows;

        // Calculate Tax Amount from items
        // Item total = taxable_value + (taxable_value * gst_rate / 100)
        // Tax amount = total_item_amount - taxable_value
        const taxAmount = items.reduce((sum, item) => {
            const tax = parseFloat(item.total_item_amount) - parseFloat(item.taxable_value);
            return sum + tax;
        }, 0);

        res.json({
            success: true,
            invoice: {
                ...invoice,
                items,
                tax_amount: taxAmount.toFixed(2)
            }
        });
    } catch (error) {
        logger.error(`Error fetching invoice details: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// List Invoices
app.get('/invoices', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id, gstin } = req.query;
        let query = 'SELECT * FROM invoices';
        const params = [];

        if (merchant_id && gstin) {
            query += ' WHERE seller_merchant_id = $1 OR buyer_gstin = $2';
            params.push(merchant_id, gstin);
        } else if (merchant_id) {
            query += ' WHERE seller_merchant_id = $1';
            params.push(merchant_id);
        } else if (gstin) {
            query += ' WHERE buyer_gstin = $1';
            params.push(gstin);
        }

        query += ' ORDER BY created_at DESC';

        const result = await client.query(query, params);
        res.json({ success: true, invoices: result.rows });
    } catch (error) {
        logger.error(`Error listing invoices: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// ==================== E-INVOICE ENDPOINTS ====================

// Helper: Generate Mock IRN (Invoice Reference Number)
function generateMockIRN(invoiceId, sellerGstin, invoiceNumber) {
    // Real IRN is 64-char hash, we simulate it
    const data = `${sellerGstin}${invoiceNumber}${Date.now()}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash.substring(0, 64).toUpperCase();
}

// Get E-Invoice eligible invoices (ACCEPTED B2B invoices without IRN)
app.get('/invoices/e-invoice/eligible', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id } = req.query;

        if (!merchant_id) {
            return res.status(400).json({ success: false, message: 'merchant_id is required' });
        }

        // Fetch ACCEPTED B2B invoices that don't have IRN yet
        const result = await client.query(`
            SELECT i.*, 
                   seller.legal_name as seller_name, seller.gstin as seller_gstin,
                   buyer.legal_name as buyer_name
            FROM invoices i
            LEFT JOIN merchants seller ON i.seller_merchant_id = seller.id
            LEFT JOIN merchants buyer ON i.buyer_merchant_id = buyer.id
            WHERE i.seller_merchant_id = $1
            AND i.status IN ('ACCEPTED', 'PAID')
            AND i.buyer_gstin IS NOT NULL
            AND (i.irn IS NULL OR i.e_invoice_status = 'PENDING')
            ORDER BY i.invoice_date DESC
        `, [merchant_id]);

        res.json({
            success: true,
            invoices: result.rows,
            count: result.rows.length,
            message: `${result.rows.length} invoice(s) eligible for e-invoicing`
        });
    } catch (error) {
        logger.error(`Error fetching e-invoice eligible invoices: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Generate E-Invoice (simulate IRP registration)
app.post('/invoices/:id/e-invoice/generate', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // Fetch invoice details
        const invoiceRes = await client.query(`
            SELECT i.*, seller.gstin as seller_gstin, seller.legal_name as seller_name,
                   buyer.legal_name as buyer_name
            FROM invoices i
            LEFT JOIN merchants seller ON i.seller_merchant_id = seller.id
            LEFT JOIN merchants buyer ON i.buyer_merchant_id = buyer.id
            WHERE i.id = $1
        `, [id]);

        if (invoiceRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const invoice = invoiceRes.rows[0];

        // Validation checks
        if (!['ACCEPTED', 'PAID'].includes(invoice.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot generate e-invoice for invoice with status "${invoice.status}". Invoice must be ACCEPTED or PAID.`
            });
        }

        if (!invoice.buyer_gstin) {
            return res.status(400).json({
                success: false,
                message: 'E-Invoice can only be generated for B2B invoices (requires buyer GSTIN)'
            });
        }

        if (invoice.irn && invoice.e_invoice_status === 'GENERATED') {
            return res.status(400).json({
                success: false,
                message: 'E-Invoice already generated for this invoice',
                irn: invoice.irn
            });
        }

        // Generate mock IRN
        const irn = generateMockIRN(id, invoice.seller_gstin, invoice.invoice_number);
        const irnDate = new Date();

        // Update invoice with IRN
        await client.query(`
            UPDATE invoices 
            SET irn = $1, irn_date = $2, e_invoice_status = 'GENERATED', updated_at = NOW()
            WHERE id = $3
        `, [irn, irnDate, id]);

        logger.info(`[E-Invoice] Generated IRN ${irn.substring(0, 10)}... for invoice ${invoice.invoice_number}`);

        // Create notifications for both parties
        await createNotification(
            invoice.seller_merchant_id,
            id,
            'E_INVOICE_GENERATED',
            'E-Invoice Generated',
            `E-Invoice generated for ${invoice.invoice_number}. IRN: ${irn.substring(0, 15)}...`
        );

        if (invoice.buyer_merchant_id) {
            await createNotification(
                invoice.buyer_merchant_id,
                id,
                'E_INVOICE_GENERATED',
                'E-Invoice Received',
                `E-Invoice for ${invoice.invoice_number} has been registered. IRN: ${irn.substring(0, 15)}...`
            );
        }

        res.json({
            success: true,
            message: 'E-Invoice generated successfully',
            eInvoice: {
                invoice_id: id,
                invoice_number: invoice.invoice_number,
                irn: irn,
                irn_date: irnDate.toISOString(),
                seller_gstin: invoice.seller_gstin,
                seller_name: invoice.seller_name,
                buyer_gstin: invoice.buyer_gstin,
                buyer_name: invoice.buyer_name,
                invoice_value: invoice.total_amount,
                status: 'GENERATED',
                // Simulated acknowledgement
                ack_number: `ACK-${Date.now()}`,
                ack_date: irnDate.toISOString()
            }
        });
    } catch (error) {
        logger.error(`Error generating e-invoice: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get all e-invoiced invoices
app.get('/invoices/e-invoice/list', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id } = req.query;

        let query = `
            SELECT i.*, 
                   seller.legal_name as seller_name, seller.gstin as seller_gstin,
                   buyer.legal_name as buyer_name
            FROM invoices i
            LEFT JOIN merchants seller ON i.seller_merchant_id = seller.id
            LEFT JOIN merchants buyer ON i.buyer_merchant_id = buyer.id
            WHERE i.irn IS NOT NULL
            AND i.e_invoice_status = 'GENERATED'
        `;
        const params = [];

        if (merchant_id) {
            query += ` AND (i.seller_merchant_id = $1 OR i.buyer_merchant_id = $1)`;
            params.push(merchant_id);
        }

        query += ' ORDER BY i.irn_date DESC';

        const result = await client.query(query, params);

        res.json({
            success: true,
            eInvoices: result.rows.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                invoice_date: inv.invoice_date,
                irn: inv.irn,
                irn_date: inv.irn_date,
                seller_gstin: inv.seller_gstin,
                seller_name: inv.seller_name,
                buyer_gstin: inv.buyer_gstin,
                buyer_name: inv.buyer_name,
                total_amount: inv.total_amount,
                total_tax: parseFloat(inv.total_cgst || 0) + parseFloat(inv.total_sgst || 0) + parseFloat(inv.total_igst || 0),
                e_invoice_status: inv.e_invoice_status,
                user_role: params[0] === inv.seller_merchant_id ? 'seller' : 'buyer'
            })),
            count: result.rows.length
        });
    } catch (error) {
        logger.error(`Error fetching e-invoices: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Cancel E-Invoice (within 24 hours as per GST rules - simulated)
app.post('/invoices/:id/e-invoice/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const invoiceRes = await client.query('SELECT * FROM invoices WHERE id = $1', [id]);

        if (invoiceRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const invoice = invoiceRes.rows[0];

        if (!invoice.irn || invoice.e_invoice_status !== 'GENERATED') {
            return res.status(400).json({
                success: false,
                message: 'No active e-invoice found for this invoice'
            });
        }

        // Check if within 24 hours (simulated)
        const irnDate = new Date(invoice.irn_date);
        const now = new Date();
        const hoursDiff = (now - irnDate) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            return res.status(400).json({
                success: false,
                message: 'E-Invoice can only be cancelled within 24 hours of generation'
            });
        }

        // Cancel the e-invoice
        await client.query(`
            UPDATE invoices 
            SET e_invoice_status = 'CANCELLED', updated_at = NOW()
            WHERE id = $1
        `, [id]);

        logger.info(`[E-Invoice] Cancelled IRN for invoice ${invoice.invoice_number}`);

        res.json({
            success: true,
            message: 'E-Invoice cancelled successfully',
            reason: reason || 'Cancelled by user'
        });
    } catch (error) {
        logger.error(`Error cancelling e-invoice: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    logger.info(`Invoice Service running on port ${PORT}`);
});

