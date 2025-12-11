-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL, -- Link to invoices table (but might be loose coupling if microservice DBs are separate, but here we share)
    amount DECIMAL(15, 2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(50) NOT NULL, -- BANK_TRANSFER, UPI, CASH, CHEQUE
    reference_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reconciliation Reports
CREATE TABLE IF NOT EXISTS reconciliation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE,
    period_end DATE,
    total_invoices INTEGER,
    matched_invoices INTEGER,
    discrepancies_count INTEGER,
    status VARCHAR(20) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Discrepancies
CREATE TABLE IF NOT EXISTS discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reconciliation_reports(id),
    invoice_id UUID,
    invoice_number VARCHAR(50),
    type VARCHAR(50) NOT NULL, -- MISSING, AMOUNT_MISMATCH, DATE_MISMATCH
    details TEXT,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, RESOLVED, IGNORED
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
