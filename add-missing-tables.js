const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Running migrations...');

        // Add payments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID REFERENCES invoices(id),
                merchant_id UUID REFERENCES merchants(id),
                amount DECIMAL(15, 2) NOT NULL,
                payment_method VARCHAR(50),
                payment_reference VARCHAR(100),
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ payments table ready');

        // Add reconciliation_reports table
        await client.query(`
            CREATE TABLE IF NOT EXISTS reconciliation_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                merchant_id UUID REFERENCES merchants(id),
                report_data JSONB,
                status VARCHAR(20) DEFAULT 'COMPLETED',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ reconciliation_reports table ready');

        // Add discrepancies table
        await client.query(`
            CREATE TABLE IF NOT EXISTS discrepancies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                merchant_id UUID REFERENCES merchants(id),
                invoice_id UUID REFERENCES invoices(id),
                discrepancy_type VARCHAR(50),
                description TEXT,
                status VARCHAR(20) DEFAULT 'OPEN',
                resolved_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ discrepancies table ready');

        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
