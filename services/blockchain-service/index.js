const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

app.use(cors());
app.use(express.json());

// Helper: Generate SHA-256 hash of data
function generateDataHash(data) {
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(stringData).digest('hex').toUpperCase();
}

// Helper: Generate mock transaction hash (simulates blockchain tx)
function generateTxHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
}

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Blockchain Anchor Service' });
});

// ==================== BLOCKCHAIN ANCHOR ENDPOINTS ====================

// Create a blockchain anchor for any business event
app.post('/blockchain/anchor', async (req, res) => {
    const client = await pool.connect();
    try {
        const { record_type, record_id, event_type, data, wallet_address, merchant_id } = req.body;

        if (!record_type || !record_id || !event_type || !data) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: record_type, record_id, event_type, data'
            });
        }

        // Generate hash of the data
        const dataHash = generateDataHash(data);
        const txHash = generateTxHash();
        const anchorId = uuidv4();

        // Store anchor in database
        await client.query(`
            INSERT INTO blockchain_anchors 
            (id, record_type, record_id, event_type, data_hash, wallet_address, merchant_id, anchor_timestamp, verified, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), true, $8)
        `, [
            anchorId,
            record_type,
            record_id,
            event_type,
            dataHash,
            wallet_address || null,
            merchant_id || null,
            JSON.stringify({ txHash, original_data_summary: summarizeData(data) })
        ]);

        console.log(`[Blockchain] Anchored ${record_type}/${event_type}: ${dataHash.substring(0, 16)}...`);

        res.status(201).json({
            success: true,
            anchor: {
                id: anchorId,
                record_type,
                record_id,
                event_type,
                data_hash: dataHash,
                wallet_address,
                anchor_timestamp: new Date().toISOString(),
                tx_hash: txHash,
                verified: true
            },
            message: 'Record anchored to blockchain successfully'
        });
    } catch (error) {
        console.error('Error creating anchor:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Helper: Summarize data for metadata storage
function summarizeData(data) {
    if (typeof data !== 'object') return { raw: data };
    const summary = {};
    if (data.invoice_number) summary.invoice_number = data.invoice_number;
    if (data.total_amount) summary.total_amount = data.total_amount;
    if (data.status) summary.status = data.status;
    if (data.note_type) summary.note_type = data.note_type;
    if (data.amount) summary.amount = data.amount;
    return summary;
}

// Get anchors for a specific record
app.get('/blockchain/anchor/:recordType/:recordId', async (req, res) => {
    const client = await pool.connect();
    try {
        const { recordType, recordId } = req.params;

        const result = await client.query(`
            SELECT * FROM blockchain_anchors 
            WHERE record_type = $1 AND record_id = $2
            ORDER BY anchor_timestamp DESC
        `, [recordType, recordId]);

        res.json({
            success: true,
            anchors: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching anchors:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get all anchors for a merchant
app.get('/blockchain/anchors', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id, record_type, limit = 50 } = req.query;

        let query = `
            SELECT ba.*, 
                   CASE 
                       WHEN ba.record_type = 'INVOICE' THEN i.invoice_number
                       WHEN ba.record_type = 'NOTE' THEN n.note_number
                       ELSE NULL
                   END as record_number
            FROM blockchain_anchors ba
            LEFT JOIN invoices i ON ba.record_type = 'INVOICE' AND ba.record_id = i.id
            LEFT JOIN notes n ON ba.record_type = 'NOTE' AND ba.record_id = n.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (merchant_id) {
            query += ` AND ba.merchant_id = $${paramCount}`;
            params.push(merchant_id);
            paramCount++;
        }

        if (record_type) {
            query += ` AND ba.record_type = $${paramCount}`;
            params.push(record_type);
            paramCount++;
        }

        query += ` ORDER BY ba.anchor_timestamp DESC LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        const result = await client.query(query, params);

        res.json({
            success: true,
            anchors: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching anchors:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Verify data against anchor
app.post('/blockchain/verify', async (req, res) => {
    const client = await pool.connect();
    try {
        const { record_type, record_id, data } = req.body;

        if (!record_type || !record_id || !data) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get the anchor
        const anchorRes = await client.query(`
            SELECT * FROM blockchain_anchors 
            WHERE record_type = $1 AND record_id = $2
            ORDER BY anchor_timestamp DESC LIMIT 1
        `, [record_type, record_id]);

        if (anchorRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No anchor found for this record'
            });
        }

        const anchor = anchorRes.rows[0];
        const computedHash = generateDataHash(data);
        const isValid = anchor.data_hash === computedHash;

        res.json({
            success: true,
            verified: isValid,
            anchor: {
                data_hash: anchor.data_hash,
                wallet_address: anchor.wallet_address,
                anchor_timestamp: anchor.anchor_timestamp,
                event_type: anchor.event_type
            },
            computed_hash: computedHash,
            message: isValid ? 'Data integrity verified - no tampering detected' : 'WARNING: Data has been modified since anchoring'
        });
    } catch (error) {
        console.error('Error verifying anchor:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Legacy endpoints for backward compatibility
app.post('/blockchain/register', async (req, res) => {
    const { invoiceId, invoiceHash, buyer } = req.body;

    // Redirect to new anchor system
    const client = await pool.connect();
    try {
        const anchorId = uuidv4();
        const txHash = generateTxHash();

        await client.query(`
            INSERT INTO blockchain_anchors 
            (id, record_type, record_id, event_type, data_hash, metadata)
            VALUES ($1, 'INVOICE', $2, 'REGISTERED', $3, $4)
        `, [anchorId, invoiceId, invoiceHash, JSON.stringify({ buyer, txHash })]);

        res.json({
            success: true,
            txHash,
            blockNumber: Date.now(),
            message: 'Invoice registered on blockchain'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.post('/blockchain/update-status', async (req, res) => {
    const { invoiceId, status } = req.body;
    const txHash = generateTxHash();

    res.json({
        success: true,
        txHash,
        message: 'Status updated on blockchain'
    });
});

app.get('/blockchain/ledger', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM blockchain_anchors ORDER BY anchor_timestamp DESC LIMIT 100');
        res.json({
            success: true,
            ledger: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Blockchain Anchor Service running on port ${PORT}`);
});
