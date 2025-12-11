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

app.use(cors());
app.use(bodyParser.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// --- Routes ---

// Record a payment
app.post('/payments', async (req, res) => {
    const client = await pool.connect();
    try {
        const { invoice_id, amount, method, reference_id, notes } = req.body;

        if (!invoice_id || !amount || !method) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = uuidv4();
        await client.query(
            'INSERT INTO payments (id, invoice_id, amount, method, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, invoice_id, amount, method, reference_id, notes]
        );

        console.log(`Payment recorded: ${id} for Invoice: ${invoice_id}`);

        // TODO: Notify Invoice Service to update status (e.g., PARTIALLY_PAID, PAID)
        // For now, we just record it.

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

// Get all payments
app.get('/payments', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM payments ORDER BY payment_date DESC');
        res.json({ payments: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get Analytics
app.get('/payments/analytics', async (req, res) => {
    const client = await pool.connect();
    try {
        // Calculate total collected
        const collectedRes = await client.query('SELECT SUM(amount) as total FROM payments');
        const totalCollected = parseFloat(collectedRes.rows[0].total || 0);

        // Calculate total receivables (from Invoice Service)
        let totalReceivables = 0;
        try {
            const invRes = await axios.get(`${INVOICE_SERVICE_URL}/invoices/analytics`);
            if (invRes.data.success) {
                totalReceivables = invRes.data.total_receivables;
            }
        } catch (invError) {
            console.error('Error fetching invoice analytics:', invError.message);
            // We continue with 0 receivables if service is down, but ideally we should cache or error.
        }

        const outstanding = totalReceivables - totalCollected;

        const countRes = await client.query('SELECT COUNT(*) as count FROM payments');

        res.json({
            total_collected: totalCollected,
            total_receivables: totalReceivables,
            outstanding: outstanding,
            transaction_count: parseInt(countRes.rows[0].count)
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
