const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../storage/invoices');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// In-memory storage (replace with PostgreSQL later)
const invoices = [];

// Helper: Generate SHA-256 hash
function generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Invoice Service' });
});

// Create Invoice
app.post('/invoices', upload.single('file'), (req, res) => {
    try {
        const { invoice_number, seller_id, buyer_id, invoice_date, total_amount, tax_amount, items } = req.body;

        const invoiceId = uuidv4();
        const fileUrl = req.file ? `/storage/invoices/${req.file.filename}` : null;

        const invoice = {
            id: invoiceId,
            invoice_number,
            seller_id,
            buyer_id,
            invoice_date,
            total_amount: parseFloat(total_amount),
            tax_amount: parseFloat(tax_amount),
            status: 'ISSUED',
            file_url: fileUrl,
            items: items ? JSON.parse(items) : [],
            created_at: new Date().toISOString()
        };

        // Generate hash
        const invoiceHash = generateHash(invoice);
        invoice.hash = invoiceHash;

        invoices.push(invoice);

        res.status(201).json({
            success: true,
            invoice,
            message: 'Invoice created successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Invoice by ID
app.get('/invoices/:id', (req, res) => {
    const invoice = invoices.find(inv => inv.id === req.params.id);
    if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, invoice });
});

// List all Invoices
app.get('/invoices', (req, res) => {
    res.json({ success: true, invoices, count: invoices.length });
});

// Update Invoice Status
app.patch('/invoices/:id/status', (req, res) => {
    const { status } = req.body;
    const invoice = invoices.find(inv => inv.id === req.params.id);

    if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    invoice.status = status;
    invoice.updated_at = new Date().toISOString();

    res.json({ success: true, invoice, message: 'Status updated' });
});

app.listen(PORT, () => {
    console.log(`Invoice Service running on port ${PORT}`);
});
