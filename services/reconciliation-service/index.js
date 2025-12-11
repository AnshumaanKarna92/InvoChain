const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3006;

app.use(cors());
app.use(helmet());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Reconciliation Service' });
});

// Run Reconciliation
app.post('/reconciliation/run', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { period_start, period_end } = req.body;

        // Fetch all invoices for the period (Mocking "Issued" vs "Received" by just using the same table for now)
        // In a real scenario, "Received" would come from GSTR-2A API or Buyer's upload.
        // Here we simulate that "System Invoices" are "Issued" and we check if they are "Accepted" by buyer.

        const invoicesRes = await client.query('SELECT * FROM invoices');
        const invoices = invoicesRes.rows;

        const reportId = uuidv4();
        let matchedCount = 0;
        let discrepanciesCount = 0;

        for (const invoice of invoices) {
            // Logic: If status is ISSUED but not ACCEPTED after due date, flag it?
            // Or simple check: Does every invoice have a valid buyer?

            if (!invoice.buyer_gstin) {
                await client.query(
                    'INSERT INTO discrepancies (id, report_id, invoice_id, invoice_number, type, details, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [uuidv4(), reportId, invoice.id, invoice.invoice_number, 'MISSING_BUYER', 'Buyer GSTIN missing', 'OPEN']
                );
                discrepanciesCount++;
            } else if (invoice.status === 'REJECTED') {
                await client.query(
                    'INSERT INTO discrepancies (id, report_id, invoice_id, invoice_number, type, details, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [uuidv4(), reportId, invoice.id, invoice.invoice_number, 'REJECTED_INVOICE', 'Invoice rejected by buyer', 'OPEN']
                );
                discrepanciesCount++;
            } else {
                matchedCount++;
            }
        }

        await client.query(
            'INSERT INTO reconciliation_reports (id, period_start, period_end, total_invoices, matched_invoices, discrepancies_count, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [reportId, period_start || null, period_end || null, invoices.length, matchedCount, discrepanciesCount, 'COMPLETED']
        );

        await client.query('COMMIT');

        const report = {
            id: reportId,
            total_invoices: invoices.length,
            matched_invoices: matchedCount,
            discrepancies_count: discrepanciesCount,
            status: 'COMPLETED'
        };

        res.json({
            success: true,
            report,
            message: 'Reconciliation completed'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error running reconciliation:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get Reconciliation Report
app.get('/reconciliation/report/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const reportRes = await client.query('SELECT * FROM reconciliation_reports WHERE id = $1', [req.params.id]);
        if (reportRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        const discrepanciesRes = await client.query('SELECT * FROM discrepancies WHERE report_id = $1', [req.params.id]);

        res.json({
            success: true,
            report: reportRes.rows[0],
            discrepancies: discrepanciesRes.rows
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get All Discrepancies
app.get('/reconciliation/discrepancies', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM discrepancies WHERE status = \'OPEN\' ORDER BY created_at DESC');
        res.json({
            success: true,
            discrepancies: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get All Reports
app.get('/reconciliation/reports', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM reconciliation_reports ORDER BY created_at DESC');
        res.json({
            success: true,
            reports: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Resolve Discrepancy
app.patch('/reconciliation/discrepancy/:id/resolve', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'UPDATE discrepancies SET status = \'RESOLVED\', resolved_at = NOW() WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Discrepancy not found' });
        }

        res.json({
            success: true,
            discrepancy: result.rows[0],
            message: 'Discrepancy resolved'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Reconciliation Service running on port ${PORT}`);
});
