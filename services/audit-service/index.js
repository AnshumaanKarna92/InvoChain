const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3014;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// Helper: SHA-256
function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// Routes

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Audit Service' });
});

// Log Event
app.post('/audit/log', async (req, res) => {
    const client = await pool.connect();
    try {
        const { entity_type, entity_id, action, actor_id, payload } = req.body;

        // Get Last Hash
        const lastLog = await client.query('SELECT current_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1');
        const prevHash = lastLog.rows.length > 0 ? lastLog.rows[0].current_hash : 'GENESIS_HASH';

        // Create Current Hash
        const timestamp = new Date().toISOString();
        const dataString = JSON.stringify({ entity_type, entity_id, action, actor_id, payload, prevHash, timestamp });
        const currentHash = sha256(dataString);

        const id = uuidv4();

        await client.query(
            'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_id, payload, prev_hash, current_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, entity_type, entity_id, action, actor_id, JSON.stringify(payload), prevHash, currentHash, timestamp]
        );

        res.status(201).json({ success: true, message: 'Audit log created', hash: currentHash });

    } catch (error) {
        console.error('Error creating audit log:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get Audit Trail for Entity
app.get('/audit/:entity_id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { entity_id } = req.params;
        const result = await client.query('SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at ASC', [entity_id]);
        res.json({ success: true, logs: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Audit Service running on port ${PORT}`);
});
