const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = 3010;

app.use(cors());
app.use(bodyParser.json());

// In-memory storage
let payments = [];

// Mock initial data
payments.push({
    id: uuidv4(),
    invoice_id: 'INV-001',
    amount: 5000,
    payment_date: new Date().toISOString(),
    method: 'BANK_TRANSFER',
    reference_id: 'REF123456',
    notes: 'Partial payment'
});

// --- Routes ---

// Record a payment
app.post('/payments', (req, res) => {
    try {
        const { invoice_id, amount, method, reference_id, notes } = req.body;

        if (!invoice_id || !amount || !method) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const payment = {
            id: uuidv4(),
            invoice_id,
            amount: parseFloat(amount),
            payment_date: new Date().toISOString(),
            method,
            reference_id,
            notes
        };

        payments.push(payment);
        console.log(`Payment recorded: ${payment.id} for Invoice: ${invoice_id}`);

        // TODO: Notify Invoice Service to update status (e.g., PARTIALLY_PAID, PAID)
        // For now, we just record it.

        res.status(201).json({ message: 'Payment recorded successfully', payment });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get payments for a specific invoice
app.get('/payments/invoice/:invoiceId', (req, res) => {
    const { invoiceId } = req.params;
    const invoicePayments = payments.filter(p => p.invoice_id === invoiceId);
    res.json({ payments: invoicePayments });
});

// Get all payments
app.get('/payments', (req, res) => {
    res.json({ payments });
});

// Get Analytics
app.get('/payments/analytics', (req, res) => {
    // Calculate total collected
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    // Mock receivables (In a real app, fetch from Invoice Service)
    const totalReceivables = 150000; // Mock total invoice value
    const outstanding = totalReceivables - totalCollected;

    res.json({
        total_collected: totalCollected,
        total_receivables: totalReceivables,
        outstanding: outstanding,
        transaction_count: payments.length
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Payment Service' });
});

app.listen(PORT, () => {
    console.log(`Payment Service running on port ${PORT}`);
});
