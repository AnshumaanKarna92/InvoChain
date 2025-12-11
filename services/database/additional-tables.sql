-- GST Returns
CREATE TABLE IF NOT EXISTS gst_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id),
    return_type VARCHAR(20) NOT NULL, -- GSTR1, GSTR3B
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    gstin VARCHAR(15) NOT NULL,
    return_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, FILED, ACCEPTED
    filed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- E-Invoices
CREATE TABLE IF NOT EXISTS e_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    irn VARCHAR(64) UNIQUE NOT NULL,
    ack_number VARCHAR(50),
    ack_date TIMESTAMP WITH TIME ZONE,
    signed_invoice TEXT,
    signed_qr_code TEXT,
    status VARCHAR(20) DEFAULT 'GENERATED', -- GENERATED, CANCELLED
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Credit/Debit Notes
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    note_number VARCHAR(50) NOT NULL,
    note_type VARCHAR(10) NOT NULL, -- CREDIT, DEBIT
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT NOT NULL,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
