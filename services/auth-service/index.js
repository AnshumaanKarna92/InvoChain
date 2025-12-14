const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3011;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

app.use(cors());
app.use(helmet());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// Debug Middleware
app.use((req, res, next) => {
    console.log(`[Auth Service] ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`[Auth Service] Error on ${req.method} ${req.url}:`, err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Auth Service' });
});

// Register
app.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { legalName, tradeName, gstin, email, password, address, phone } = req.body;

        if (!legalName || !tradeName || !gstin || !email || !password) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Check if user exists
        const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'User with this Email already exists' });
        }

        // Check if GSTIN exists
        const existingMerchant = await client.query('SELECT * FROM merchants WHERE gstin = $1', [gstin]);
        if (existingMerchant.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Merchant with this GSTIN already exists' });
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert User
        const userId = uuidv4();
        await client.query(
            'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [userId, email, hashedPassword, 'seller'] // Defaulting to seller for now
        );

        // Insert Merchant Profile (Basic)
        const merchantId = uuidv4();
        await client.query(
            'INSERT INTO merchants (id, user_id, gstin, legal_name, trade_name, address, phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [merchantId, userId, gstin, legalName, tradeName, address, phone, email]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            user: { id: userId, email, legalName, tradeName, merchant_id: merchantId },
            message: 'Registration successful'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Register Error:', error);
        res.status(500).json({ success: false, message: error.message, error: error.message });
    } finally {
        client.release();
    }
});

// Lookup Merchant by GSTIN
app.get('/merchants/lookup', async (req, res) => {
    const client = await pool.connect();
    try {
        const { gstin } = req.query;
        if (!gstin) {
            return res.status(400).json({ success: false, message: 'GSTIN is required' });
        }

        const result = await client.query('SELECT legal_name, trade_name FROM merchants WHERE gstin = $1', [gstin]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Merchant not found' });
        }

        res.json({
            success: true,
            merchant: {
                legal_name: result.rows[0].legal_name,
                trade_name: result.rows[0].trade_name
            }
        });
    } catch (error) {
        console.error('Lookup Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Login
app.post('/login', async (req, res) => {
    const client = await pool.connect();
    try {
        const { email, password } = req.body;

        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Fetch Merchant ID
        const merchantRes = await client.query('SELECT id, gstin, legal_name, trade_name FROM merchants WHERE user_id = $1', [user.id]);
        const merchant = merchantRes.rows[0];

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                merchant_id: merchant ? merchant.id : null
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                merchant_id: merchant ? merchant.id : null,
                gstin: merchant ? merchant.gstin : null,
                legalName: merchant ? merchant.legal_name : null,
                tradeName: merchant ? merchant.trade_name : null
            },
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: error.message, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
