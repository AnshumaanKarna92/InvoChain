const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function comprehensiveFix() {
    const client = await pool.connect();
    try {
        console.log('🔧 Starting comprehensive database fixes...\n');

        // 1. Fix gst_returns table
        console.log('1️⃣  Fixing gst_returns table...');
        await client.query(`
            ALTER TABLE gst_returns 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS filed_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✓ Added updated_at and filed_at to gst_returns\n');

        // 2. Fix discrepancies table (make sure all columns exist)
        console.log('2️⃣  Fixing discrepancies table...');
        await client.query(`
            ALTER TABLE discrepancies 
            ADD COLUMN IF NOT EXISTS report_id UUID,
            ADD COLUMN IF NOT EXISTS type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS details TEXT;
        `);
        console.log('✓ Ensured all discrepancies columns exist\n');

        // 3. Make sure notes table exists
        console.log('3️⃣  Checking notes table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                merchant_id UUID REFERENCES merchants(id),
                invoice_id UUID REFERENCES invoices(id),
                note_type VARCHAR(20) NOT NULL,
                note_number VARCHAR(100),
                amount DECIMAL(15,2),
                reason TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Notes table ready\n');

        console.log('✅ All database fixes completed successfully!\n');

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        console.error('Details:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

comprehensiveFix();
