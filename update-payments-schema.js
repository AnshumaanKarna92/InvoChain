const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function addNotesColumn() {
    const client = await pool.connect();
    try {
        console.log('Checking if notes column exists in payments table...');
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='payments' AND column_name='notes';
        `);

        if (res.rows.length === 0) {
            console.log('Adding notes column to payments table...');
            await client.query('ALTER TABLE payments ADD COLUMN notes TEXT;');
            console.log('Column added successfully.');
        } else {
            console.log('Column notes already exists.');
        }
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        client.release();
        pool.end();
    }
}

addNotesColumn();
