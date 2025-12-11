const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function applyAdditionalTables() {
    const client = await pool.connect();
    try {
        console.log('Applying additional database tables...');
        const schemaPath = path.join(__dirname, 'services/database/additional-tables.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await client.query('BEGIN');
        await client.query(schemaSql);
        await client.query('COMMIT');

        console.log('Additional tables applied successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error applying additional tables:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

applyAdditionalTables();
