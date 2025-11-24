const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(helmet());
app.use(express.json());

// In-memory storage
const creditDebitNotes = [];

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Credit/Debit Note Service' });
});

// Validation helper
function validateNote(noteData, originalInvoice) {
    const errors = [];

    if (!noteData.amount || noteData.amount <= 0) {
        errors.push('Amount must be greater than 0');
    }

    if (originalInvoice && noteData.amount > originalInvoice.total_amount) {
        errors.push('Note amount cannot exceed original invoice amount');
    }

    if (!noteData.reason || noteData.reason.trim() === '') {
        errors.push('Reason is required');
    }

    return errors;
}

// Create Credit Note
app.post('/notes/credit', (req, res) => {
    try {
        const { original_invoice_id, amount, tax_amount, reason, note_number } = req.body;

        // In real app, fetch original invoice from database
        const originalInvoice = { total_amount: 10000 }; // Mock

        const errors = validateNote({ amount, reason }, originalInvoice);
        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        const creditNote = {
            id: uuidv4(),
            note_type: 'CREDIT',
            note_number: note_number || `CN-${Date.now()}`,
            original_invoice_id,
            amount: parseFloat(amount),
            tax_amount: parseFloat(tax_amount || 0),
            reason,
            created_at: new Date().toISOString()
        };

        creditDebitNotes.push(creditNote);

        res.status(201).json({
            success: true,
            creditNote,
            message: 'Credit note created successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create Debit Note
app.post('/notes/debit', (req, res) => {
    try {
        const { original_invoice_id, amount, tax_amount, reason, note_number } = req.body;

        const errors = validateNote({ amount, reason }, null);
        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        const debitNote = {
            id: uuidv4(),
            note_type: 'DEBIT',
            note_number: note_number || `DN-${Date.now()}`,
            original_invoice_id,
            amount: parseFloat(amount),
            tax_amount: parseFloat(tax_amount || 0),
            reason,
            created_at: new Date().toISOString()
        };

        creditDebitNotes.push(debitNote);

        res.status(201).json({
            success: true,
            debitNote,
            message: 'Debit note created successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Notes for Invoice
app.get('/notes/:invoiceId', (req, res) => {
    const notes = creditDebitNotes.filter(n => n.original_invoice_id === req.params.invoiceId);
    res.json({
        success: true,
        notes,
        count: notes.length
    });
});

// Get All Notes
app.get('/notes', (req, res) => {
    const { type } = req.query;
    let filteredNotes = creditDebitNotes;

    if (type) {
        filteredNotes = creditDebitNotes.filter(n => n.note_type === type.toUpperCase());
    }

    res.json({
        success: true,
        notes: filteredNotes,
        count: filteredNotes.length
    });
});

// Get Note by ID
app.get('/notes/detail/:id', (req, res) => {
    const note = creditDebitNotes.find(n => n.id === req.params.id);
    if (!note) {
        return res.status(404).json({ success: false, message: 'Note not found' });
    }
    res.json({ success: true, note });
});

app.listen(PORT, () => {
    console.log(`Credit/Debit Note Service running on port ${PORT}`);
});
