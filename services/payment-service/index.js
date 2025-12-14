const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3010;
const INVOICE_SERVICE_URL = process.env.INVOICE_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003';

app.use(cors());
app.use(bodyParser.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// Helper: Create Notification
async function createNotification(merchantId, invoiceId, type, title, message) {
    try {
        await axios.post(`${NOTIFICATION_SERVICE_URL}/notifications`, {
            merchant_id: merchantId,
            invoice_id: invoiceId,
            type,
            title,
            message
        });
        console.log(`[NOTIFICATION] Sent ${type} to merchant ${merchantId}`);
    } catch (error) {
        console.error(`[NOTIFICATION] Failed to send: ${error.message}`);
    }
}

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
        console.log(`[BLOCKCHAIN] Anchored ${record_type}:${event_type} for ${record_id}`);
    } catch (error) {
        console.error(`[BLOCKCHAIN] Failed to anchor: ${error.message}`);
    }
}

// --- Routes ---

// Record a payment
app.post('/payments', async (req, res) => {
    const client = await pool.connect();
    try {
        const { invoice_id, amount, method, reference_id, notes } = req.body;

        if (!invoice_id || !amount || !method) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get invoice details for notification
        const invoiceRes = await client.query(
            'SELECT i.*, m.legal_name as buyer_name FROM invoices i LEFT JOIN merchants m ON i.buyer_merchant_id = m.id WHERE i.id = $1',
            [invoice_id]
        );

        if (invoiceRes.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceRes.rows[0];

        const id = uuidv4();
        await client.query(
            "INSERT INTO payments (id, invoice_id, amount, payment_method, payment_reference, notes, status) VALUES ($1, $2, $3, $4, $5, $6, 'RECORDED')",
            [id, invoice_id, amount, method, reference_id, notes]
        );

        console.log(`Payment recorded: ${id} for Invoice: ${invoice_id}`);

        // Notify SELLER that a payment has been recorded
        await createNotification(
            invoice.seller_merchant_id,
            invoice_id,
            'PAYMENT_RECORDED',
            'Payment Recorded',
            `A payment of ₹${parseFloat(amount).toLocaleString()} has been recorded for Invoice ${invoice.invoice_number}. Please confirm receipt.`
        );

        res.status(201).json({ message: 'Payment recorded successfully', payment: { id, invoice_id, amount, method } });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Get payments for a specific invoice
app.get('/payments/invoice/:invoiceId', async (req, res) => {
    const client = await pool.connect();
    try {
        const { invoiceId } = req.params;
        const result = await client.query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC', [invoiceId]);
        res.json({ payments: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get all payments (filtered by merchant)
app.get('/payments', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id } = req.query;
        let query = 'SELECT * FROM payments';
        const params = [];

        if (merchant_id) {
            // We need to join with invoices to check seller (receiver) or buyer (payer)
            // But wait, payments table doesn't have payer/receiver columns directly?
            // It has invoice_id.
            // Let's check schema.
            // payments table: id, invoice_id, merchant_id (payer?), amount...
            // Actually, schema says: merchant_id UUID REFERENCES merchants(id).
            // Usually this is the PAYER (the one who made the payment).
            // The RECEIVER is the invoice.seller_merchant_id.

            // Let's fetch payments where user is Payer OR Receiver.
            query = `
                SELECT p.*, i.invoice_number, i.seller_merchant_id as receiver_merchant_id, i.buyer_merchant_id as payer_merchant_id
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE p.merchant_id = $1 OR i.seller_merchant_id = $1
                ORDER BY p.created_at DESC
            `;
            params.push(merchant_id);
        } else {
            query += ' ORDER BY created_at DESC';
        }

        const result = await client.query(query, params);
        res.json({ payments: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Confirm Payment
app.post('/payments/:id/confirm', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { wallet_address } = req.body;

        // Update payment status
        await client.query("UPDATE payments SET status = 'CONFIRMED' WHERE id = $1", [id]);

        // Get payment and invoice details
        const payRes = await client.query(
            `SELECT p.*, i.invoice_number, i.buyer_merchant_id, i.seller_merchant_id, i.total_amount
             FROM payments p
             JOIN invoices i ON p.invoice_id = i.id
             WHERE p.id = $1`,
            [id]
        );

        if (payRes.rows.length > 0) {
            const payment = payRes.rows[0];
            const { invoice_id, amount, invoice_number, buyer_merchant_id, seller_merchant_id } = payment;

            // Update Invoice Status to PAID (or PARTIALLY_PAID)
            await axios.patch(`${INVOICE_SERVICE_URL}/invoices/${invoice_id}/status`, { status: 'PAID' });

            // Notify BUYER that payment has been confirmed
            if (buyer_merchant_id) {
                await createNotification(
                    buyer_merchant_id,
                    invoice_id,
                    'PAYMENT_CONFIRMED',
                    'Payment Confirmed',
                    `Your payment of ₹${parseFloat(amount).toLocaleString()} for Invoice ${invoice_number} has been confirmed by the seller.`
                );
            }

            // Create blockchain anchor for payment confirmation
            await createBlockchainAnchor(
                'PAYMENT',
                id,
                'CONFIRMED',
                {
                    payment_id: id,
                    invoice_id,
                    invoice_number,
                    amount: parseFloat(amount),
                    status: 'CONFIRMED',
                    confirmed_at: new Date().toISOString()
                },
                seller_merchant_id,
                wallet_address
            );
        }

        res.json({ success: true, message: 'Payment confirmed' });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get Analytics
app.get('/payments/analytics', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id } = req.query;
        let totalCollected = 0;
        let totalPaid = 0;
        let transactionCount = 0;

        if (merchant_id) {
            // Calculate total collected (as seller - receiving payments)
            const collectedRes = await client.query(
                `SELECT COALESCE(SUM(p.amount), 0) as total 
                 FROM payments p 
                 JOIN invoices i ON p.invoice_id = i.id 
                 WHERE i.seller_merchant_id = $1 AND p.status = 'CONFIRMED'`,
                [merchant_id]
            );
            totalCollected = parseFloat(collectedRes.rows[0].total || 0);

            // Calculate total paid (as buyer - making payments)
            const paidRes = await client.query(
                `SELECT COALESCE(SUM(p.amount), 0) as total 
                 FROM payments p 
                 JOIN invoices i ON p.invoice_id = i.id 
                 WHERE i.buyer_merchant_id = $1`,
                [merchant_id]
            );
            totalPaid = parseFloat(paidRes.rows[0].total || 0);

            const countRes = await client.query(
                `SELECT COUNT(*) as count 
                 FROM payments p 
                 JOIN invoices i ON p.invoice_id = i.id 
                 WHERE i.seller_merchant_id = $1 OR i.buyer_merchant_id = $1`,
                [merchant_id]
            );
            transactionCount = parseInt(countRes.rows[0].count || 0);
        } else {
            // Global totals
            const collectedRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM payments');
            totalCollected = parseFloat(collectedRes.rows[0].total || 0);
            totalPaid = totalCollected; // Global: paid = collected

            const countRes = await client.query('SELECT COUNT(*) as count FROM payments');
            transactionCount = parseInt(countRes.rows[0].count || 0);
        }

        // Calculate total receivables (from Invoice Service)
        let totalInvoiced = 0;
        try {
            const params = merchant_id ? { merchant_id } : {};
            const invRes = await axios.get(`${INVOICE_SERVICE_URL}/invoices/analytics`, { params });
            if (invRes.data && invRes.data.success) {
                totalInvoiced = parseFloat(invRes.data.total_invoiced || 0);
            }
        } catch (invError) {
            console.error('Error fetching invoice analytics:', invError.message);
        }

        // Outstanding = what's owed TO merchant (receivables) minus what merchant OWES (payables)
        // For simplicity: outstanding = invoiced_as_seller - collected
        const outstanding = totalInvoiced - totalCollected;

        res.json({
            total_collected: totalCollected,
            total_paid: totalPaid,
            total_receivables: outstanding,
            total_invoiced: totalInvoiced,
            outstanding: outstanding,
            transaction_count: transactionCount
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Payment Service' });
});

app.listen(PORT, () => {
    console.log(`Payment Service running on port ${PORT}`);
});
