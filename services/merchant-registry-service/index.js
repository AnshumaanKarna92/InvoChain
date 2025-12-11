const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3012;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// Routes

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Merchant Registry Service' });
});

// Onboard Merchant
app.post('/merchants/onboard', async (req, res) => {
    const client = await pool.connect();
    try {
        const { user_id, gstin, legal_name, trade_name, address, city, state_code, pincode, phone, email } = req.body;

        // Basic Validation
        if (!gstin || !legal_name || !address) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Check if GSTIN already exists
        const existing = await client.query('SELECT id FROM merchants WHERE gstin = $1', [gstin]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Merchant with this GSTIN already exists' });
        }

        const id = uuidv4();
        const query = `
            INSERT INTO merchants (
                id, user_id, gstin, legal_name, trade_name, address, city, state_code, pincode, phone, email, kyc_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
            RETURNING *;
        `;
        const values = [id, user_id, gstin, legal_name, trade_name, address, city, state_code, pincode, phone, email];

        const result = await client.query(query, values);

        res.status(201).json({
            success: true,
            merchant: result.rows[0],
            message: 'Merchant onboarded successfully'
        });
    } catch (error) {
        console.error('Error onboarding merchant:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Lookup Merchant by GSTIN
app.get('/merchants/lookup/:gstin', async (req, res) => {
    const client = await pool.connect();
    try {
        const { gstin } = req.params;
        const result = await client.query('SELECT * FROM merchants WHERE gstin = $1', [gstin]);

        if (result.rows.length === 0) {
            // In a real system, we might query an external GST API here if not found locally
            // For now, return 404 or a "Grace Mode" suggestion
            return res.status(404).json({ success: false, message: 'Merchant not found', grace_mode: true });
        }

        res.json({ success: true, merchant: result.rows[0] });
    } catch (error) {
        console.error('Error looking up merchant:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get Merchant Details by ID
app.get('/merchants/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const result = await client.query('SELECT * FROM merchants WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Merchant not found' });
        }

        res.json({ success: true, merchant: result.rows[0] });
    } catch (error) {
        console.error('Error fetching merchant:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Merchant Registry Service running on port ${PORT}`);
});
