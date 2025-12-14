const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');
        await client.query('BEGIN');

        // Check if column exists
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='invoices' AND column_name='seller_gstin';
        `);

        if (res.rows.length === 0) {
            console.log('Adding seller_gstin column to invoices table...');
            await client.query('ALTER TABLE invoices ADD COLUMN seller_gstin VARCHAR(15);');

            // Optional: Backfill seller_gstin from merchants table for existing invoices
            console.log('Backfilling seller_gstin...');
            await client.query(`
                UPDATE invoices 
                SET seller_gstin = m.gstin 
                FROM merchants m 
                WHERE invoices.seller_merchant_id = m.id;
            `);
        } else {
            console.log('seller_gstin column already exists.');
        }

        await client.query('COMMIT');
        console.log('Migration successful');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
