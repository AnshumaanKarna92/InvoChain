const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3006;

app.use(cors());
app.use(helmet());
app.use(express.json());

// In-memory storage
const reconciliationReports = [];
const discrepancies = [];

// Mock invoice data (in real app, fetch from Invoice Service)
let mockIssuedInvoices = [];
let mockReceivedInvoices = [];

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Reconciliation Service' });
});

// Helper: Match invoices
function matchInvoices(issuedInvoices, receivedInvoices) {
    const matched = [];
    const unmatched = [];
    const discrepanciesList = [];

    issuedInvoices.forEach(issued => {
        const received = receivedInvoices.find(r =>
            r.invoice_number === issued.invoice_number &&
            r.seller_id === issued.seller_id &&
            r.buyer_id === issued.buyer_id
        );

        if (!received) {
            discrepanciesList.push({
                id: uuidv4(),
                invoice_id: issued.id,
                discrepancy_type: 'MISSING',
                description: `Invoice ${issued.invoice_number} issued but not received by buyer`,
                resolved: false
            });
            unmatched.push(issued);
        } else {
            // Check for amount mismatch
            if (Math.abs(issued.total_amount - received.total_amount) > 0.01) {
                discrepanciesList.push({
                    id: uuidv4(),
                    invoice_id: issued.id,
                    discrepancy_type: 'AMOUNT_MISMATCH',
                    description: `Amount mismatch: Issued ${issued.total_amount}, Received ${received.total_amount}`,
                    resolved: false
                });
            }

            // Check for date mismatch
            if (issued.invoice_date !== received.invoice_date) {
                discrepanciesList.push({
                    id: uuidv4(),
                    invoice_id: issued.id,
                    discrepancy_type: 'DATE_MISMATCH',
                    description: `Date mismatch: Issued ${issued.invoice_date}, Received ${received.invoice_date}`,
                    resolved: false
                });
            }

            matched.push({ issued, received });
        }
    });

    return { matched, unmatched, discrepancies: discrepanciesList };
}

// Run Reconciliation
app.post('/reconciliation/run', (req, res) => {
    try {
        const { period_start, period_end, issued_invoices, received_invoices } = req.body;

        // Store mock data (in real app, fetch from database)
        mockIssuedInvoices = issued_invoices || [];
        mockReceivedInvoices = received_invoices || [];

        const result = matchInvoices(mockIssuedInvoices, mockReceivedInvoices);

        const reportId = uuidv4();
        const report = {
            id: reportId,
            period_start,
            period_end,
            total_invoices: mockIssuedInvoices.length,
            matched_invoices: result.matched.length,
            discrepancies_count: result.discrepancies.length,
            status: 'COMPLETED',
            created_at: new Date().toISOString()
        };

        reconciliationReports.push(report);

        // Store discrepancies
        result.discrepancies.forEach(d => {
            d.report_id = reportId;
            discrepancies.push(d);
        });

        res.json({
            success: true,
            report,
            matched: result.matched.length,
            unmatched: result.unmatched.length,
            discrepancies: result.discrepancies.length,
            message: 'Reconciliation completed'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Reconciliation Report
app.get('/reconciliation/report/:id', (req, res) => {
    const report = reconciliationReports.find(r => r.id === req.params.id);
    if (!report) {
        return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const reportDiscrepancies = discrepancies.filter(d => d.report_id === req.params.id);

    res.json({
        success: true,
        report,
        discrepancies: reportDiscrepancies
    });
});

// Get All Discrepancies
app.get('/reconciliation/discrepancies', (req, res) => {
    res.json({
        success: true,
        discrepancies,
        count: discrepancies.length
    });
});

// Get All Reports
app.get('/reconciliation/reports', (req, res) => {
    res.json({
        success: true,
        reports: reconciliationReports,
        count: reconciliationReports.length
    });
});

// Resolve Discrepancy
app.patch('/reconciliation/discrepancy/:id/resolve', (req, res) => {
    const discrepancy = discrepancies.find(d => d.id === req.params.id);
    if (!discrepancy) {
        return res.status(404).json({ success: false, message: 'Discrepancy not found' });
    }

    discrepancy.resolved = true;
    discrepancy.resolved_at = new Date().toISOString();

    res.json({
        success: true,
        discrepancy,
        message: 'Discrepancy resolved'
    });
});

app.listen(PORT, () => {
    console.log(`Reconciliation Service running on port ${PORT}`);
});
