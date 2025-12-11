const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 Starting Seed...');
        await client.query('BEGIN');

        // Cleanup
        console.log('🧹 Cleaning up old data...');
        // Order matters due to FK constraints
        await client.query('TRUNCATE TABLE payments, invoice_items, invoices, inventory_events, inventory, gst_returns, merchants, users RESTART IDENTITY CASCADE');

        // 1. Create Seller
        const sellerId = uuidv4();
        const sellerPassword = await bcrypt.hash('password123', 10);
        await client.query(
            'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [sellerId, 'seller@demo.com', sellerPassword, 'seller']
        );

        const merchantId = uuidv4();
        await client.query(
            'INSERT INTO merchants (id, user_id, gstin, legal_name, address, phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [merchantId, sellerId, '27ABCDE1234F1Z5', 'Demo Electronics Pvt Ltd', '123 Tech Park, Mumbai', '9876543210', 'seller@demo.com']
        );
        console.log('✅ Created Seller: seller@demo.com / password123');

        // 2. Create Inventory
        const items = [
            { sku: 'LAP-DELL-001', name: 'Dell XPS 13', price: 120000, qty: 50 },
            { sku: 'MOU-LOG-002', name: 'Logitech MX Master 3', price: 8000, qty: 100 },
            { sku: 'MON-LG-003', name: 'LG 27" 4K Monitor', price: 35000, qty: 30 },
            { sku: 'KEY-MEC-004', name: 'Mechanical Keyboard', price: 4500, qty: 75 }
        ];

        for (const item of items) {
            await client.query(
                'INSERT INTO inventory (id, merchant_id, sku, name, quantity, unit_price, reserved_quantity) VALUES ($1, $2, $3, $4, $5, $6, 0)',
                [uuidv4(), merchantId, item.sku, item.name, item.qty, item.price]
            );
        }
        console.log(`✅ Created ${items.length} Inventory Items`);

        // 3. Create a Buyer (User + Merchant Profile)
        const buyerId = uuidv4();
        const buyerPassword = await bcrypt.hash('password123', 10);
        await client.query(
            'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [buyerId, 'buyer@demo.com', buyerPassword, 'buyer']
        );
        const buyerMerchantId = uuidv4();
        await client.query(
            'INSERT INTO merchants (id, user_id, gstin, legal_name, address, phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [buyerMerchantId, buyerId, '29XYZAB5678C1Z3', 'Best Retailers Inc', '456 Market St, Bangalore', '9123456789', 'buyer@demo.com']
        );
        console.log('✅ Created Buyer: buyer@demo.com / password123');

        // 4. Create an Invoice (Issued)
        const invoiceId = uuidv4();
        const invoiceAmount = 141600; // 120000 + 18% GST
        await client.query(
            `INSERT INTO invoices (id, invoice_number, seller_merchant_id, buyer_gstin, invoice_date, due_date, total_amount, status) 
             VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '30 days', $5, 'ISSUED')`,
            [invoiceId, 'INV-2025-001', merchantId, '29XYZAB5678C1Z3', invoiceAmount]
        );

        // Invoice Item
        await client.query(
            `INSERT INTO invoice_items (id, invoice_id, sku, description, quantity, unit_price, taxable_value, gst_rate, total_item_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [uuidv4(), invoiceId, 'LAP-DELL-001', 'Dell XPS 13', 1, 120000, 120000, 18, 141600]
        );
        console.log('✅ Created Sample Invoice: INV-2025-001');

        await client.query('COMMIT');
        console.log('🎉 Seeding Completed Successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding Failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
