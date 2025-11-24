const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { formatEInvoice } = require('./utils/einvoice-formatter');
const gstnMock = require('./mock/gstn-mock');

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(helmet());
app.use(express.json());

// In-memory storage
const einvoiceRecords = [];
const gstnSubmissions = [];
const authTokens = [];

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'GST Adapter Service' });
});

// ==================== E-INVOICE ENDPOINTS ====================

// Generate E-Invoice
app.post('/gst/e-invoice/generate', async (req, res) => {
    try {
        const { invoice } = req.body;

        if (!invoice) {
            return res.status(400).json({ success: false, message: 'Invoice data is required' });
        }

        // Convert to GSTN e-invoice format
        const einvoiceData = formatEInvoice(invoice);

        // Submit to GSTN (mock)
        const gstnResponse = await gstnMock.generateEInvoice(einvoiceData);

        if (!gstnResponse.success) {
            return res.status(400).json({
                success: false,
                error: gstnResponse.error_message
            });
        }

        // Store e-invoice record
        const record = {
            id: uuidv4(),
            invoice_id: invoice.id,
            irn: gstnResponse.Irn,
            ack_no: gstnResponse.AckNo,
            ack_date: gstnResponse.AckDt,
            signed_invoice: gstnResponse.SignedInvoice,
            signed_qr_code: gstnResponse.SignedQRCode,
            status: 'GENERATED',
            created_at: new Date().toISOString()
        };

        einvoiceRecords.push(record);

        res.json({
            success: true,
            einvoice: record,
            message: 'E-Invoice generated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel E-Invoice
app.post('/gst/e-invoice/cancel', async (req, res) => {
    try {
        const { irn, cancel_reason, cancel_remarks } = req.body;

        if (!irn) {
            return res.status(400).json({ success: false, message: 'IRN is required' });
        }

        const gstnResponse = await gstnMock.cancelEInvoice(irn, cancel_reason, cancel_remarks);

        if (!gstnResponse.success) {
            return res.status(400).json({
                success: false,
                error: gstnResponse.error_message
            });
        }

        // Update local record
        const record = einvoiceRecords.find(r => r.irn === irn);
        if (record) {
            record.status = 'CANCELLED';
            record.cancelled_at = new Date().toISOString();
        }

        res.json({
            success: true,
            message: 'E-Invoice cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get E-Invoice Status
app.get('/gst/e-invoice/status/:irn', async (req, res) => {
    try {
        const { irn } = req.params;

        const gstnResponse = await gstnMock.getEInvoiceStatus(irn);

        if (!gstnResponse.success) {
            return res.status(404).json({
                success: false,
                error: gstnResponse.error_message
            });
        }

        res.json({
            success: true,
            status: gstnResponse
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get All E-Invoices
app.get('/gst/e-invoice/list', (req, res) => {
    res.json({
        success: true,
        einvoices: einvoiceRecords,
        count: einvoiceRecords.length
    });
});

// ==================== GSTR-1 ENDPOINTS ====================

// Push GSTR-1 Data to GSTN
app.post('/gst/gstr1/push', async (req, res) => {
    try {
        const { gstin, period, gstr1_data } = req.body;

        if (!gstin || !period || !gstr1_data) {
            return res.status(400).json({
                success: false,
                message: 'GSTIN, period, and GSTR-1 data are required'
            });
        }

        const gstnResponse = await gstnMock.pushGSTR1({
            gstin,
            period,
            data: gstr1_data
        });

        if (!gstnResponse.success) {
            return res.status(400).json({
                success: false,
                error: gstnResponse.error_message
            });
        }

        // Store submission record
        const submission = {
            id: uuidv4(),
            submission_type: 'GSTR1',
            gstin,
            period,
            reference_no: gstnResponse.reference_no,
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString()
        };

        gstnSubmissions.push(submission);

        res.json({
            success: true,
            submission,
            message: 'GSTR-1 data pushed successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get GSTR-1 Filing Status
app.get('/gst/gstr1/status/:gstin/:month/:year', async (req, res) => {
    try {
        const { gstin, month, year } = req.params;

        const gstnResponse = await gstnMock.getGSTR1Status(gstin, {
            month: parseInt(month),
            year: parseInt(year)
        });

        if (!gstnResponse.success) {
            return res.status(404).json({
                success: false,
                error: gstnResponse.error_message
            });
        }

        res.json({
            success: true,
            status: gstnResponse
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get All GSTN Submissions
app.get('/gst/submissions', (req, res) => {
    res.json({
        success: true,
        submissions: gstnSubmissions,
        count: gstnSubmissions.length
    });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// Get GSTN Auth Token
app.post('/gst/auth/token', async (req, res) => {
    try {
        const { username, password } = req.body;

        const gstnResponse = await gstnMock.getAuthToken(username, password);

        if (!gstnResponse.success) {
            return res.status(401).json({
                success: false,
                error: gstnResponse.error_message
            });
        }

        // Store token
        const tokenRecord = {
            id: uuidv4(),
            access_token: gstnResponse.access_token,
            token_type: gstnResponse.token_type,
            expires_in: gstnResponse.expires_in,
            created_at: new Date().toISOString()
        };

        authTokens.push(tokenRecord);

        res.json({
            success: true,
            token: tokenRecord
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`GST Adapter Service running on port ${PORT}`);
});
