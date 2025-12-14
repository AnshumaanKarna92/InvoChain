const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

async function applySchema() {
    try {
        const schemaPath = path.join(__dirname, 'services/database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Applying schema...');
        await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await client.query(schemaSql);

        console.log('Schema applied successfully!');
        client.release();
        process.exit(0);
    } catch (error) {
        console.error('Error applying schema:', error);
        process.exit(1);
    }
}

applySchema();
