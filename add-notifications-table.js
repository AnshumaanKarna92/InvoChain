const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function addNotificationsTable() {
    const client = await pool.connect();
    try {
        console.log('Adding notifications table...');

        // Create notifications table
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
                invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL, -- 'INVOICE_RECEIVED', 'INVOICE_ACCEPTED', 'INVOICE_REJECTED', 'INVOICE_EDITED'
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ notifications table created');

        // Add index for faster queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_merchant ON notifications(merchant_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
        `);
        console.log('✓ notifications indexes created');

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addNotificationsTable();
