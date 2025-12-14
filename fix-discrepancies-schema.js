const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function fixDiscrepanciesSchema() {
    const client = await pool.connect();
    try {
        console.log('Fixing discrepancies table schema...');

        // Add missing columns
        await client.query(`
            ALTER TABLE discrepancies 
            ADD COLUMN IF NOT EXISTS report_id UUID,
            ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS details TEXT;
        `);
        console.log('✓ Added missing columns to discrepancies table');

        // Rename description to details if it exists
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='discrepancies' AND column_name='description') THEN
                    ALTER TABLE discrepancies RENAME COLUMN description TO details;
                END IF;
            END $$;
        `);
        console.log('✓ Renamed description column to details');

        // Rename discrepancy_type to type if it exists
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='discrepancies' AND column_name='discrepancy_type') THEN
                    ALTER TABLE discrepancies RENAME COLUMN discrepancy_type TO type;
                END IF;
            END $$;
        `);
        console.log('✓ Renamed discrepancy_type column to type');

        console.log('✅ Schema fix completed successfully!');

    } catch (error) {
        console.error('❌ Schema fix failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixDiscrepanciesSchema();
