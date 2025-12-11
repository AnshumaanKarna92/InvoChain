const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function applyExtensions() {
    const client = await pool.connect();
    try {
        console.log('Applying database extensions...');
        const schemaPath = path.join(__dirname, 'services/database/extensions.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await client.query('BEGIN');
        await client.query(schemaSql);
        await client.query('COMMIT');

        console.log('Extensions applied successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error applying extensions:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

applyExtensions();
