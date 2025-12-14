const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3007;
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003';

// Database connection - use same format as other services
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Credit/Debit Note Service' });
});

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


// Validation helper
function validateNote(noteData) {
    const errors = [];

    if (!noteData.amount || parseFloat(noteData.amount) <= 0) {
        errors.push('Amount must be greater than 0');
    }

    if (!noteData.reason || noteData.reason.trim() === '') {
        errors.push('Reason is required');
    }

    if (!noteData.invoice_id) {
        errors.push('Invoice ID is required');
    }

    return errors;
}

// Create Credit Note - reduces taxable value and tax liability
app.post('/notes/credit', async (req, res) => {
    const client = await pool.connect();
    try {
        const { invoice_id, amount, reason, merchant_id, wallet_address } = req.body;

        // Validate input
        const errors = validateNote({ amount, reason, invoice_id });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        // Verify invoice exists and is ACCEPTED or PAID
        const invoiceRes = await client.query(
            'SELECT id, invoice_number, status, total_amount, seller_merchant_id FROM invoices WHERE id = $1',
            [invoice_id]
        );

        if (invoiceRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found. Credit notes can only be created for existing invoices.'
            });
        }

        const invoice = invoiceRes.rows[0];

        // Only allow notes for ACCEPTED or PAID invoices
        if (!['ACCEPTED', 'PAID'].includes(invoice.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot create credit note for invoice with status "${invoice.status}". Invoice must be ACCEPTED or PAID.`
            });
        }

        // Check amount doesn't exceed invoice total
        if (parseFloat(amount) > parseFloat(invoice.total_amount)) {
            return res.status(400).json({
                success: false,
                message: `Credit note amount (₹${amount}) cannot exceed invoice total (₹${invoice.total_amount})`
            });
        }

        const noteNumber = `CN-${Date.now()}`;
        const noteId = uuidv4();
        const sellerId = merchant_id || invoice.seller_merchant_id;

        await client.query(
            `INSERT INTO notes (id, note_number, invoice_id, merchant_id, note_type, reason, amount, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [noteId, noteNumber, invoice_id, sellerId, 'CREDIT', reason, parseFloat(amount)]
        );

        console.log(`[Notes] Credit note ${noteNumber} created for invoice ${invoice.invoice_number}`);

        // Create blockchain anchor for audit trail
        await createBlockchainAnchor(
            'NOTE',
            noteId,
            'CREDIT_NOTE_CREATED',
            {
                note_number: noteNumber,
                note_type: 'CREDIT',
                invoice_id,
                invoice_number: invoice.invoice_number,
                amount: parseFloat(amount),
                reason,
                created_at: new Date().toISOString()
            },
            sellerId,
            wallet_address
        );

        res.status(201).json({
            success: true,
            note: {
                id: noteId,
                note_number: noteNumber,
                note_type: 'CREDIT',
                invoice_id,
                invoice_number: invoice.invoice_number,
                amount: parseFloat(amount),
                reason,
                impact: 'Reduces taxable value and tax liability',
                created_at: new Date().toISOString()
            },
            message: 'Credit note created successfully. This will reduce taxable value in GSTR-1.'
        });
    } catch (error) {
        console.error('Error creating credit note:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Create Debit Note - increases taxable value and tax liability
app.post('/notes/debit', async (req, res) => {
    const client = await pool.connect();
    try {
        const { invoice_id, amount, reason, merchant_id, wallet_address } = req.body;

        // Validate input
        const errors = validateNote({ amount, reason, invoice_id });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        // Verify invoice exists and is ACCEPTED or PAID
        const invoiceRes = await client.query(
            'SELECT id, invoice_number, status, total_amount, seller_merchant_id FROM invoices WHERE id = $1',
            [invoice_id]
        );

        if (invoiceRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found. Debit notes can only be created for existing invoices.'
            });
        }

        const invoice = invoiceRes.rows[0];

        // Only allow notes for ACCEPTED or PAID invoices
        if (!['ACCEPTED', 'PAID'].includes(invoice.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot create debit note for invoice with status "${invoice.status}". Invoice must be ACCEPTED or PAID.`
            });
        }

        const noteNumber = `DN-${Date.now()}`;
        const noteId = uuidv4();
        const sellerId = merchant_id || invoice.seller_merchant_id;

        await client.query(
            `INSERT INTO notes (id, note_number, invoice_id, merchant_id, note_type, reason, amount, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [noteId, noteNumber, invoice_id, sellerId, 'DEBIT', reason, parseFloat(amount)]
        );

        console.log(`[Notes] Debit note ${noteNumber} created for invoice ${invoice.invoice_number}`);

        // Create blockchain anchor for audit trail
        await createBlockchainAnchor(
            'NOTE',
            noteId,
            'DEBIT_NOTE_CREATED',
            {
                note_number: noteNumber,
                note_type: 'DEBIT',
                invoice_id,
                invoice_number: invoice.invoice_number,
                amount: parseFloat(amount),
                reason,
                created_at: new Date().toISOString()
            },
            sellerId,
            wallet_address
        );

        res.status(201).json({
            success: true,
            note: {
                id: noteId,
                note_number: noteNumber,
                note_type: 'DEBIT',
                invoice_id,
                invoice_number: invoice.invoice_number,
                amount: parseFloat(amount),
                reason,
                impact: 'Increases taxable value and tax liability',
                created_at: new Date().toISOString()
            },
            message: 'Debit note created successfully. This will increase taxable value in GSTR-1.'
        });
    } catch (error) {
        console.error('Error creating debit note:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get Notes for Invoice
app.get('/notes/invoice/:invoiceId', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT n.*, i.invoice_number 
             FROM notes n 
             LEFT JOIN invoices i ON n.invoice_id = i.id 
             WHERE n.invoice_id = $1 
             ORDER BY n.created_at DESC`,
            [req.params.invoiceId]
        );

        res.json({
            success: true,
            notes: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching notes for invoice:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get All Notes (with optional filtering)
// Notes are visible to BOTH seller and buyer of the linked invoice
app.get('/notes', async (req, res) => {
    const client = await pool.connect();
    try {
        const { type, merchant_id } = req.query;

        // Query notes where the merchant is either seller OR buyer on the linked invoice
        let query = `
            SELECT n.*, 
                   i.invoice_number, 
                   i.seller_merchant_id,
                   i.buyer_merchant_id,
                   seller.legal_name as seller_name,
                   seller.gstin as seller_gstin,
                   buyer.legal_name as buyer_name,
                   buyer.gstin as buyer_gstin,
                   creator.legal_name as created_by_name,
                   CASE 
                       WHEN i.seller_merchant_id = $1 THEN 'seller'
                       WHEN i.buyer_merchant_id = $1 THEN 'buyer'
                       ELSE 'other'
                   END as user_role
            FROM notes n 
            LEFT JOIN invoices i ON n.invoice_id = i.id 
            LEFT JOIN merchants seller ON i.seller_merchant_id = seller.id
            LEFT JOIN merchants buyer ON i.buyer_merchant_id = buyer.id
            LEFT JOIN merchants creator ON n.merchant_id = creator.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // If merchant_id provided, show notes where merchant is either seller or buyer
        if (merchant_id) {
            params.push(merchant_id);
            paramCount++;
            query += ` AND (i.seller_merchant_id = $1 OR i.buyer_merchant_id = $1)`;
        }

        if (type) {
            query += ` AND n.note_type = $${paramCount}`;
            params.push(type.toUpperCase());
            paramCount++;
        }

        query += ' ORDER BY n.created_at DESC';

        const result = await client.query(query, params);

        // Calculate totals
        const creditTotal = result.rows
            .filter(n => n.note_type === 'CREDIT')
            .reduce((sum, n) => sum + parseFloat(n.amount), 0);
        const debitTotal = result.rows
            .filter(n => n.note_type === 'DEBIT')
            .reduce((sum, n) => sum + parseFloat(n.amount), 0);

        res.json({
            success: true,
            notes: result.rows.map(n => ({
                ...n,
                // Include party info for display
                counterparty_name: n.user_role === 'seller' ? n.buyer_name : n.seller_name,
                counterparty_gstin: n.user_role === 'seller' ? n.buyer_gstin : n.seller_gstin
            })),
            count: result.rows.length,
            summary: {
                credit_notes: result.rows.filter(n => n.note_type === 'CREDIT').length,
                debit_notes: result.rows.filter(n => n.note_type === 'DEBIT').length,
                total_credits: creditTotal,
                total_debits: debitTotal,
                net_adjustment: debitTotal - creditTotal
            }
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});


// Get Note by ID
app.get('/notes/detail/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT n.*, i.invoice_number, i.total_amount as invoice_total,
                    m.legal_name as merchant_name
             FROM notes n 
             LEFT JOIN invoices i ON n.invoice_id = i.id 
             LEFT JOIN merchants m ON n.merchant_id = m.id
             WHERE n.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        res.json({ success: true, note: result.rows[0] });
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Delete Note
app.delete('/notes/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'DELETE FROM notes WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        console.log(`[Notes] Note ${result.rows[0].note_number} deleted`);

        res.json({
            success: true,
            message: 'Note deleted successfully',
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Credit/Debit Note Service running on port ${PORT}`);
});
