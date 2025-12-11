const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3008;

app.use(cors());
app.use(helmet());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'GST Return Service' });
});

// Helper: Generate GSTR-1
function generateGSTR1(invoices, creditNotes, debitNotes, gstin, period) {
    const b2bInvoices = invoices.filter(inv => inv.buyer_gstin); // B2B transactions

    const gstr1 = {
        gstin,
        period_month: period.month,
        period_year: period.year,
        sections: {
            // Table 4: B2B Invoices
            b2b: b2bInvoices.map(inv => ({
                ctin: inv.buyer_gstin || 'UNKNOWN',
                invoice_number: inv.invoice_number,
                invoice_date: inv.invoice_date,
                invoice_value: parseFloat(inv.total_amount),
                place_of_supply: inv.place_of_supply || '00',
                reverse_charge: 'N',
                invoice_type: 'Regular',
                taxable_value: parseFloat(inv.total_taxable_value || inv.total_amount || 0),
                cgst: parseFloat(inv.total_cgst || 0),
                sgst: parseFloat(inv.total_sgst || 0),
                igst: parseFloat(inv.total_igst || 0)
            })),

            // Table 9: Credit/Debit Notes
            cdnr: [
                ...creditNotes.map(cn => ({
                    note_type: 'C',
                    note_number: cn.note_number,
                    note_date: cn.created_at,
                    note_value: parseFloat(cn.amount),
                    reason: cn.reason
                })),
                ...debitNotes.map(dn => ({
                    note_type: 'D',
                    note_number: dn.note_number,
                    note_date: dn.created_at,
                    note_value: parseFloat(dn.amount),
                    reason: dn.reason
                }))
            ]
        },
        summary: {
            total_invoices: b2bInvoices.length,
            total_taxable_value: b2bInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_taxable_value || inv.total_amount || 0), 0),
            total_cgst: b2bInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_cgst || 0), 0),
            total_sgst: b2bInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_sgst || 0), 0),
            total_igst: b2bInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_igst || 0), 0),
            total_tax: b2bInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_cgst || 0) + parseFloat(inv.total_sgst || 0) + parseFloat(inv.total_igst || 0)), 0)
        }
    };

    return gstr1;
}

// Helper: Generate GSTR-3B
function generateGSTR3B(invoices, creditNotes, gstin, period) {
    const totalTaxableValue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_taxable_value || inv.total_amount || 0), 0);
    const totalCGST = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_cgst || 0), 0);
    const totalSGST = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_sgst || 0), 0);
    const totalIGST = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_igst || 0), 0);
    const totalTax = totalCGST + totalSGST + totalIGST;

    const gstr3b = {
        gstin,
        period_month: period.month,
        period_year: period.year,
        sections: {
            // 3.1: Outward taxable supplies
            outward_supplies: {
                taxable_value: totalTaxableValue.toFixed(2),
                integrated_tax: totalIGST.toFixed(2),
                central_tax: totalCGST.toFixed(2),
                state_tax: totalSGST.toFixed(2)
            },

            // 3.2: Inward supplies liable to reverse charge
            inward_reverse_charge: {
                taxable_value: 0,
                integrated_tax: 0,
                central_tax: 0,
                state_tax: 0
            },

            // 4: Input Tax Credit (Simplified - assuming 80% ITC)
            itc: {
                itc_available: (totalTax * 0.8).toFixed(2),
                itc_reversed: 0
            },

            // 5: Tax payable (after ITC)
            tax_payable: {
                integrated_tax: (totalIGST - (totalTax * 0.8 * (totalIGST / totalTax || 0))).toFixed(2),
                central_tax: (totalCGST - (totalTax * 0.8 * (totalCGST / totalTax || 0))).toFixed(2),
                state_tax: (totalSGST - (totalTax * 0.8 * (totalSGST / totalTax || 0))).toFixed(2)
            }
        }
    };

    return gstr3b;
}

// Generate GSTR-1
app.post('/gst/generate/gstr1', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id, period } = req.body;

        if (!merchant_id || !period) {
            return res.status(400).json({ success: false, message: 'Missing merchant_id or period' });
        }

        // Fetch merchant's GSTIN
        const merchantRes = await client.query('SELECT gstin FROM merchants WHERE id = $1', [merchant_id]);
        if (merchantRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Merchant not found' });
        }
        const gstin = merchantRes.rows[0].gstin;

        // Fetch invoices for the merchant
        const invoicesRes = await client.query(
            'SELECT * FROM invoices WHERE seller_merchant_id = $1 AND status != \'REJECTED\' ORDER BY invoice_date DESC',
            [merchant_id]
        );
        const invoices = invoicesRes.rows;

        // Fetch credit/debit notes
        const notesRes = await client.query('SELECT * FROM notes');
        const allNotes = notesRes.rows;
        const creditNotes = allNotes.filter(n => n.note_type === 'CREDIT');
        const debitNotes = allNotes.filter(n => n.note_type === 'DEBIT');

        const gstr1Data = generateGSTR1(
            invoices,
            creditNotes,
            debitNotes,
            gstin,
            period
        );

        const returnId = uuidv4();
        await client.query(
            'INSERT INTO gst_returns (id, merchant_id, return_type, period_month, period_year, gstin, return_data, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [returnId, merchant_id, 'GSTR1', period.month, period.year, gstin, JSON.stringify(gstr1Data), 'DRAFT']
        );

        const gstReturn = {
            id: returnId,
            return_type: 'GSTR1',
            period_month: period.month,
            period_year: period.year,
            gstin,
            data: gstr1Data,
            status: 'DRAFT',
            created_at: new Date().toISOString()
        };

        res.json({
            success: true,
            return: gstReturn,
            message: 'GSTR-1 generated successfully'
        });
    } catch (error) {
        console.error('Error generating GSTR-1:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Generate GSTR-3B
app.post('/gst/generate/gstr3b', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id, period } = req.body;

        if (!merchant_id || !period) {
            return res.status(400).json({ success: false, message: 'Missing merchant_id or period' });
        }

        // Fetch merchant's GSTIN
        const merchantRes = await client.query('SELECT gstin FROM merchants WHERE id = $1', [merchant_id]);
        if (merchantRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Merchant not found' });
        }
        const gstin = merchantRes.rows[0].gstin;

        // Fetch invoices for the merchant
        const invoicesRes = await client.query(
            'SELECT * FROM invoices WHERE seller_merchant_id = $1 AND status != \'REJECTED\' ORDER BY invoice_date DESC',
            [merchant_id]
        );
        const invoices = invoicesRes.rows;

        // Fetch credit notes
        const notesRes = await client.query('SELECT * FROM notes WHERE note_type = \'CREDIT\'');
        const credit_notes = notesRes.rows;

        const gstr3bData = generateGSTR3B(
            invoices,
            credit_notes,
            gstin,
            period
        );

        const returnId = uuidv4();
        await client.query(
            'INSERT INTO gst_returns (id, merchant_id, return_type, period_month, period_year, gstin, return_data, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [returnId, merchant_id, 'GSTR3B', period.month, period.year, gstin, JSON.stringify(gstr3bData), 'DRAFT']
        );

        const gstReturn = {
            id: returnId,
            return_type: 'GSTR3B',
            period_month: period.month,
            period_year: period.year,
            gstin,
            data: gstr3bData,
            status: 'DRAFT',
            created_at: new Date().toISOString()
        };

        res.json({
            success: true,
            return: gstReturn,
            message: 'GSTR-3B generated successfully'
        });
    } catch (error) {
        console.error('Error generating GSTR-3B:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get GST Return by ID
app.get('/gst/returns/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM gst_returns WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Return not found' });
        }

        const gstReturn = result.rows[0];
        res.json({
            success: true,
            return: {
                ...gstReturn,
                data: gstReturn.return_data
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Get All Returns
app.get('/gst/returns', async (req, res) => {
    const client = await pool.connect();
    try {
        const { type, merchant_id } = req.query;
        let query = 'SELECT * FROM gst_returns WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (type) {
            query += ` AND return_type = $${paramCount}`;
            params.push(type.toUpperCase());
            paramCount++;
        }

        if (merchant_id) {
            query += ` AND merchant_id = $${paramCount}`;
            params.push(merchant_id);
            paramCount++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await client.query(query, params);

        res.json({
            success: true,
            returns: result.rows.map(r => ({
                ...r,
                data: r.return_data
            })),
            count: result.rows.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Update Return Status
app.patch('/gst/returns/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { status } = req.body;

        const updateFields = ['status = $1', 'updated_at = NOW()'];
        const params = [status, req.params.id];

        if (status === 'FILED') {
            updateFields.push('filed_at = NOW()');
        }

        const query = `UPDATE gst_returns SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING *`;
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Return not found' });
        }

        res.json({
            success: true,
            return: {
                ...result.rows[0],
                data: result.rows[0].return_data
            },
            message: 'Status updated'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Delete Return
app.delete('/gst/returns/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('DELETE FROM gst_returns WHERE id = $1 RETURNING *', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Return not found' });
        }

        res.json({
            success: true,
            message: 'Return deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`GST Return Service running on port ${PORT}`);
});
