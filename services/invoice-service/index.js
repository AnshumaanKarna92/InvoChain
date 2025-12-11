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
        const invoiceQuery = `
            INSERT INTO invoices (
                id, invoice_number, seller_merchant_id, buyer_gstin, 
                invoice_date, due_date, total_amount, 
                status, file_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ISSUED', $8)
            RETURNING *;
        `;
        const invoiceValues = [
            invoiceId, invoice_number, seller_merchant_id, buyer_gstin,
            invoice_date, due_date, total_amount, fileUrl
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
        const { action, reason } = req.body; // ACCEPT, REJECT

        const invResult = await client.query('SELECT * FROM invoices WHERE id = $1', [id]);
        if (invResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        const invoice = invResult.rows[0];

        // Get Items
        const itemsResult = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
        const items = itemsResult.rows;

        if (action === 'ACCEPT') {
            // Commit Stock
            await axios.post(`${INVENTORY_SERVICE_URL}/inventory/commit`, {
                merchant_id: invoice.seller_merchant_id,
                items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
                invoice_id: id
            });

            await client.query("UPDATE invoices SET status = 'ACCEPTED' WHERE id = $1", [id]);

        } else if (action === 'REJECT') {
            // Release Stock
            await axios.post(`${INVENTORY_SERVICE_URL}/inventory/release`, {
                merchant_id: invoice.seller_merchant_id,
                items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
                invoice_id: id
            });

            await client.query("UPDATE invoices SET status = 'REJECTED' WHERE id = $1", [id]);
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

// Invoice Analytics (Internal)
app.get('/invoices/analytics', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT SUM(total_amount) as total FROM invoices WHERE status != 'REJECTED'");
        res.json({ success: true, total_receivables: parseFloat(result.rows[0].total || 0) });
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
        const { merchant_id } = req.query;
        let query = 'SELECT * FROM invoices';
        const params = [];

        if (merchant_id) {
            query += ' WHERE seller_merchant_id = $1';
            params.push(merchant_id);
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

app.listen(PORT, () => {
    logger.info(`Invoice Service running on port ${PORT}`);
});
