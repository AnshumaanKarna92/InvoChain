const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3008;

app.use(cors());
app.use(helmet());
app.use(express.json());

// In-memory storage
const gstReturns = [];

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'GST Return Service' });
});

// Helper: Generate GSTR-1
function generateGSTR1(invoices, creditNotes, debitNotes, gstin, period) {
    const b2bInvoices = invoices.filter(inv => inv.buyer_id); // B2B transactions

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
                invoice_value: inv.total_amount,
                place_of_supply: inv.place_of_supply || '00',
                reverse_charge: 'N',
                invoice_type: 'Regular',
                items: inv.items || []
            })),

            // Table 9: Credit/Debit Notes
            cdnr: [
                ...creditNotes.map(cn => ({
                    note_type: 'C',
                    note_number: cn.note_number,
                    note_date: cn.created_at,
                    note_value: cn.amount,
                    reason: cn.reason
                })),
                ...debitNotes.map(dn => ({
                    note_type: 'D',
                    note_number: dn.note_number,
                    note_date: dn.created_at,
                    note_value: dn.amount,
                    reason: dn.reason
                }))
            ]
        },
        summary: {
            total_invoices: b2bInvoices.length,
            total_taxable_value: b2bInvoices.reduce((sum, inv) => sum + (inv.total_amount - inv.tax_amount), 0),
            total_tax: b2bInvoices.reduce((sum, inv) => sum + inv.tax_amount, 0)
        }
    };

    return gstr1;
}

// Helper: Generate GSTR-3B
function generateGSTR3B(invoices, creditNotes, gstin, period) {
    const totalTaxableValue = invoices.reduce((sum, inv) => sum + (inv.total_amount - inv.tax_amount), 0);
    const totalTax = invoices.reduce((sum, inv) => sum + inv.tax_amount, 0);

    const gstr3b = {
        gstin,
        period_month: period.month,
        period_year: period.year,
        sections: {
            // 3.1: Outward taxable supplies
            outward_supplies: {
                taxable_value: totalTaxableValue,
                integrated_tax: totalTax * 0.5, // Simplified: assume 50% IGST
                central_tax: totalTax * 0.25,   // 25% CGST
                state_tax: totalTax * 0.25       // 25% SGST
            },

            // 3.2: Inward supplies liable to reverse charge
            inward_reverse_charge: {
                taxable_value: 0,
                integrated_tax: 0,
                central_tax: 0,
                state_tax: 0
            },

            // 4: Input Tax Credit
            itc: {
                itc_available: totalTax * 0.8, // Simplified: 80% ITC
                itc_reversed: 0
            },

            // 5: Tax payable
            tax_payable: {
                integrated_tax: totalTax * 0.5 - (totalTax * 0.8 * 0.5),
                central_tax: totalTax * 0.25 - (totalTax * 0.8 * 0.25),
                state_tax: totalTax * 0.25 - (totalTax * 0.8 * 0.25)
            }
        }
    };

    return gstr3b;
}

// Generate GSTR-1
app.post('/gst/generate/gstr1', (req, res) => {
    try {
        const { gstin, period, invoices, credit_notes, debit_notes } = req.body;

        if (!gstin || !period || !invoices) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const gstr1Data = generateGSTR1(
            invoices,
            credit_notes || [],
            debit_notes || [],
            gstin,
            period
        );

        const returnId = uuidv4();
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

        gstReturns.push(gstReturn);

        res.json({
            success: true,
            return: gstReturn,
            message: 'GSTR-1 generated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate GSTR-3B
app.post('/gst/generate/gstr3b', (req, res) => {
    try {
        const { gstin, period, invoices, credit_notes } = req.body;

        if (!gstin || !period || !invoices) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const gstr3bData = generateGSTR3B(
            invoices,
            credit_notes || [],
            gstin,
            period
        );

        const returnId = uuidv4();
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

        gstReturns.push(gstReturn);

        res.json({
            success: true,
            return: gstReturn,
            message: 'GSTR-3B generated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get GST Return by ID
app.get('/gst/returns/:id', (req, res) => {
    const gstReturn = gstReturns.find(r => r.id === req.params.id);
    if (!gstReturn) {
        return res.status(404).json({ success: false, message: 'Return not found' });
    }
    res.json({ success: true, return: gstReturn });
});

// Get All Returns
app.get('/gst/returns', (req, res) => {
    const { type } = req.query;
    let filteredReturns = gstReturns;

    if (type) {
        filteredReturns = gstReturns.filter(r => r.return_type === type.toUpperCase());
    }

    res.json({
        success: true,
        returns: filteredReturns,
        count: filteredReturns.length
    });
});

// Update Return Status
app.patch('/gst/returns/:id/status', (req, res) => {
    const { status } = req.body;
    const gstReturn = gstReturns.find(r => r.id === req.params.id);

    if (!gstReturn) {
        return res.status(404).json({ success: false, message: 'Return not found' });
    }

    gstReturn.status = status;
    gstReturn.updated_at = new Date().toISOString();

    res.json({
        success: true,
        return: gstReturn,
        message: 'Status updated'
    });
});

// Delete Return
app.delete('/gst/returns/:id', (req, res) => {
    const index = gstReturns.findIndex(r => r.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Return not found' });
    }

    gstReturns.splice(index, 1);

    res.json({
        success: true,
        message: 'Return deleted successfully'
    });
});

app.listen(PORT, () => {
    console.log(`GST Return Service running on port ${PORT}`);
});
