-- 1. Users (Authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'buyer', 'seller'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Merchants (Registry)
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id), -- Admin user for this merchant
    gstin VARCHAR(15) UNIQUE NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    address TEXT NOT NULL,
    city VARCHAR(100),
    state_code VARCHAR(2), -- GST State Code (e.g., '27' for Maharashtra)
    pincode VARCHAR(6),
    phone VARCHAR(15),
    email VARCHAR(255),
    kyc_status VARCHAR(20) DEFAULT 'PENDING', -- VERIFIED, REJECTED
    is_unregistered BOOLEAN DEFAULT FALSE, -- For Grace Mode
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventory
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id),
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    hsn_code VARCHAR(10),
    unit VARCHAR(20), -- pcs, kg, ltr
    quantity DECIMAL(15, 2) DEFAULT 0, -- Available physical stock
    reserved_quantity DECIMAL(15, 2) DEFAULT 0, -- Locked for pending invoices
    unit_price DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(merchant_id, sku)
);

-- 4. Inventory Events (Audit Trail for Stock)
CREATE TABLE inventory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES inventory(id),
    merchant_id UUID REFERENCES merchants(id),
    invoice_id UUID, -- Nullable if manual adjustment
    event_type VARCHAR(20) NOT NULL, -- 'RESERVE', 'RELEASE', 'COMMIT', 'ADJUSTMENT'
    quantity_change DECIMAL(15, 2) NOT NULL,
    previous_quantity DECIMAL(15, 2) NOT NULL,
    new_quantity DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Invoices (Enhanced)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL,
    seller_merchant_id UUID REFERENCES merchants(id),
    buyer_merchant_id UUID REFERENCES merchants(id), -- Can be null if unregistered
    buyer_gstin VARCHAR(15), -- Captured even if merchant record doesn't exist yet
    invoice_date DATE NOT NULL,
    due_date DATE,
    invoice_type VARCHAR(20) DEFAULT 'B2B', -- B2B, B2C, EXPORT
    place_of_supply VARCHAR(2), -- State Code
    
    -- Amounts
    total_taxable_value DECIMAL(15, 2) DEFAULT 0,
    total_cgst DECIMAL(15, 2) DEFAULT 0,
    total_sgst DECIMAL(15, 2) DEFAULT 0,
    total_igst DECIMAL(15, 2) DEFAULT 0,
    total_cess DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    
    status VARCHAR(20) DEFAULT 'ISSUED', -- ISSUED, ACCEPTED, REJECTED, EDIT_REQUESTED
    compliance_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED
    
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_merchant_id, invoice_number)
);

-- 6. Invoice Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    sku VARCHAR(50), -- Link to inventory
    description TEXT NOT NULL,
    hsn_code VARCHAR(10),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    
    taxable_value DECIMAL(15, 2) NOT NULL,
    gst_rate DECIMAL(5, 2) NOT NULL, -- 5, 12, 18, 28
    cgst_amount DECIMAL(15, 2) DEFAULT 0,
    sgst_amount DECIMAL(15, 2) DEFAULT 0,
    igst_amount DECIMAL(15, 2) DEFAULT 0,
    cess_amount DECIMAL(15, 2) DEFAULT 0,
    
    total_item_amount DECIMAL(15, 2) NOT NULL
);

-- 7. Audit Logs (Blockchain Anchored)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'INVENTORY', 'MERCHANT'
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATED', 'STATUS_CHANGE', 'EDITED'
    actor_id UUID, -- User who performed action
    payload JSONB, -- Snapshot of data
    prev_hash VARCHAR(66),
    current_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Invoice Hashes (Legacy/Specific Blockchain Anchor)
CREATE TABLE invoice_hashes (
    invoice_id UUID PRIMARY KEY REFERENCES invoices(id),
    invoice_hash VARCHAR(66) NOT NULL, -- SHA-256 Hash
    tx_hash VARCHAR(66), -- Blockchain Transaction Hash
    block_number INTEGER,
    anchored_at TIMESTAMP WITH TIME ZONE
);
