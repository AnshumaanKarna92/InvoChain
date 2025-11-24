const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(helmet());
app.use(express.json());

// In-memory storage for buyer actions
const buyerActions = [];

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Buyer Action Service' });
});

// Accept Invoice
app.post('/buyer/accept/:invoiceId', (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { buyerId, remarks } = req.body;

        const action = {
            invoiceId,
            buyerId,
            action: 'ACCEPTED',
            remarks,
            timestamp: new Date().toISOString()
        };

        buyerActions.push(action);

        // TODO: Call Invoice Service to update status
        // TODO: Call Blockchain Service to update status

        res.json({
            success: true,
            action,
            message: 'Invoice accepted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject Invoice
app.post('/buyer/reject/:invoiceId', (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { buyerId, reason } = req.body;

        const action = {
            invoiceId,
            buyerId,
            action: 'REJECTED',
            reason,
            timestamp: new Date().toISOString()
        };

        buyerActions.push(action);

        res.json({
            success: true,
            action,
            message: 'Invoice rejected'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Request Missing Invoice
app.post('/buyer/request-missing', (req, res) => {
    try {
        const { buyerId, sellerId, invoiceNumber, expectedDate } = req.body;

        const request = {
            buyerId,
            sellerId,
            invoiceNumber,
            expectedDate,
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };

        buyerActions.push(request);

        res.json({
            success: true,
            request,
            message: 'Missing invoice request submitted'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Buyer Actions
app.get('/buyer/actions', (req, res) => {
    res.json({ success: true, actions: buyerActions, count: buyerActions.length });
});

app.listen(PORT, () => {
    console.log(`Buyer Action Service running on port ${PORT}`);
});
