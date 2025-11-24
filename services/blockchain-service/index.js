const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// In-memory blockchain ledger (mock)
const blockchainLedger = [];

// Helper: Generate mock transaction hash
function generateTxHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
}

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Blockchain Service (Mock)' });
});

// Register Invoice on Blockchain
app.post('/blockchain/register', (req, res) => {
    try {
        const { invoiceId, invoiceHash, buyer } = req.body;

        if (!invoiceId || !invoiceHash) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const txHash = generateTxHash();
        const blockNumber = blockchainLedger.length + 1;

        const record = {
            invoiceId,
            invoiceHash,
            buyer,
            status: 'ISSUED',
            txHash,
            blockNumber,
            timestamp: new Date().toISOString()
        };

        blockchainLedger.push(record);

        res.json({
            success: true,
            txHash,
            blockNumber,
            message: 'Invoice registered on blockchain'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Invoice Status on Blockchain
app.post('/blockchain/update-status', (req, res) => {
    try {
        const { invoiceId, status } = req.body;

        const record = blockchainLedger.find(r => r.invoiceId === invoiceId);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Invoice not found on blockchain' });
        }

        record.status = status;
        record.updatedAt = new Date().toISOString();

        const txHash = generateTxHash();

        res.json({
            success: true,
            txHash,
            message: 'Status updated on blockchain'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify Invoice Hash
app.post('/blockchain/verify', (req, res) => {
    const { invoiceId, hashToVerify } = req.body;

    const record = blockchainLedger.find(r => r.invoiceId === invoiceId);
    if (!record) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const isValid = record.invoiceHash === hashToVerify;

    res.json({
        success: true,
        isValid,
        storedHash: record.invoiceHash,
        message: isValid ? 'Hash verified' : 'Hash mismatch'
    });
});

// Get Blockchain Ledger (for debugging)
app.get('/blockchain/ledger', (req, res) => {
    res.json({ success: true, ledger: blockchainLedger, count: blockchainLedger.length });
});

app.listen(PORT, () => {
    console.log(`Blockchain Service (Mock) running on port ${PORT}`);
});
