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
        const { merchant_id, period_start, period_end } = req.body;

        // Fetch invoices - if merchant_id provided, filter by it
        let invoicesQuery = 'SELECT * FROM invoices';
        let invoicesParams = [];

        if (merchant_id) {
            invoicesQuery = 'SELECT * FROM invoices WHERE seller_merchant_id = $1 OR buyer_merchant_id = $1';
            invoicesParams = [merchant_id];
        }

        const invoicesRes = await client.query(invoicesQuery, invoicesParams);
        const invoices = invoicesRes.rows;

        console.log(`[Reconciliation] Processing ${invoices.length} invoices`);

        const reportId = uuidv4();
        let matchedCount = 0;
        let discrepanciesCount = 0;
        const discrepancyDetails = [];

        for (const invoice of invoices) {
            // Logic: Flag invoices with issues
            if (!invoice.buyer_gstin) {
                // Only create discrepancy if it doesn't already exist for this invoice
                const existingDisc = await client.query(
                    'SELECT id FROM discrepancies WHERE invoice_id = $1 AND type = $2 AND status = $3',
                    [invoice.id, 'MISSING_BUYER', 'OPEN']
                );

                if (existingDisc.rows.length === 0) {
                    await client.query(
                        'INSERT INTO discrepancies (id, merchant_id, invoice_id, type, details, status) VALUES ($1, $2, $3, $4, $5, $6)',
                        [uuidv4(), invoice.seller_merchant_id, invoice.id, 'MISSING_BUYER', 'Buyer GSTIN missing', 'OPEN']
                    );
                    discrepanciesCount++;
                    discrepancyDetails.push({ invoice_id: invoice.id, type: 'MISSING_BUYER' });
                }
            } else if (invoice.status === 'REJECTED') {
                const existingDisc = await client.query(
                    'SELECT id FROM discrepancies WHERE invoice_id = $1 AND type = $2 AND status = $3',
                    [invoice.id, 'REJECTED_INVOICE', 'OPEN']
                );

                if (existingDisc.rows.length === 0) {
                    await client.query(
                        'INSERT INTO discrepancies (id, merchant_id, invoice_id, type, details, status) VALUES ($1, $2, $3, $4, $5, $6)',
                        [uuidv4(), invoice.seller_merchant_id, invoice.id, 'REJECTED_INVOICE', 'Invoice rejected by buyer', 'OPEN']
                    );
                    discrepanciesCount++;
                    discrepancyDetails.push({ invoice_id: invoice.id, type: 'REJECTED_INVOICE' });
                }
            } else {
                matchedCount++;
            }
        }

        // Create reconciliation report using JSONB report_data
        const reportData = {
            period_start: period_start || null,
            period_end: period_end || null,
            total_invoices: invoices.length,
            matched_invoices: matchedCount,
            discrepancies_count: discrepanciesCount,
            discrepancy_details: discrepancyDetails,
            completed_at: new Date().toISOString()
        };

        await client.query(
            'INSERT INTO reconciliation_reports (id, merchant_id, report_data, status) VALUES ($1, $2, $3, $4)',
            [reportId, merchant_id || null, JSON.stringify(reportData), 'COMPLETED']
        );

        await client.query('COMMIT');

        const report = {
            id: reportId,
            ...reportData,
            status: 'COMPLETED'
        };

        console.log(`[Reconciliation] Completed - Total: ${invoices.length}, Matched: ${matchedCount}, Discrepancies: ${discrepanciesCount}`);

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
