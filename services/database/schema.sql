-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gstin VARCHAR(15) UNIQUE, -- GST Identification Number
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'buyer', 'seller'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices (Off-chain storage)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL,
    seller_id UUID REFERENCES users(id),
    buyer_id UUID REFERENCES users(id),
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT', -- 'ISSUED', 'ACCEPTED', 'REJECTED'
    file_url TEXT, -- Link to PDF/JSON in S3/MinIO
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_id, invoice_number)
);

-- Invoice Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    description TEXT NOT NULL,
    hsn_code VARCHAR(10),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL, -- GST Rate (e.g., 18.00)
    amount DECIMAL(15, 2) NOT NULL
);

-- Blockchain Anchors
CREATE TABLE invoice_hashes (
    invoice_id UUID PRIMARY KEY REFERENCES invoices(id),
    invoice_hash VARCHAR(66) NOT NULL, -- SHA-256 Hash
    tx_hash VARCHAR(66), -- Blockchain Transaction Hash
    block_number INTEGER,
    anchored_at TIMESTAMP WITH TIME ZONE
);
