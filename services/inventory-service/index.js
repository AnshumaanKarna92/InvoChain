const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3013;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

// Routes

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Inventory Service' });
});

// List Inventory for Merchant
app.get('/inventory/:merchant_id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { merchant_id } = req.params;
        const result = await client.query('SELECT * FROM inventory WHERE merchant_id = $1', [merchant_id]);
        res.json({ success: true, inventory: result.rows });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Manual Stock Adjustment (Add/Remove)
app.post('/inventory/adjust', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { merchant_id, sku, name, quantity_change, type, unit_price } = req.body;
        // type: 'ADD', 'REMOVE', 'SET'

        // Check if item exists
        let item = await client.query('SELECT * FROM inventory WHERE merchant_id = $1 AND sku = $2', [merchant_id, sku]);

        if (item.rows.length === 0) {
            if (type === 'REMOVE') {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Item not found for removal' });
            }
            // Create new item
            const id = uuidv4();
            await client.query(
                'INSERT INTO inventory (id, merchant_id, sku, name, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, merchant_id, sku, name, 0, unit_price || 0]
            );
            item = await client.query('SELECT * FROM inventory WHERE id = $1', [id]);
        }

        const currentQty = parseFloat(item.rows[0].quantity);
        const change = parseFloat(quantity_change);
        let newQty = currentQty;

        if (type === 'ADD') newQty += change;
        else if (type === 'REMOVE') newQty -= change;
        else if (type === 'SET') newQty = change;

        if (newQty < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Insufficient stock' });
        }

        // Update Inventory
        await client.query('UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE merchant_id = $2 AND sku = $3', [newQty, merchant_id, sku]);

        // Log Event
        await client.query(
            'INSERT INTO inventory_events (inventory_id, merchant_id, event_type, quantity_change, previous_quantity, new_quantity) VALUES ($1, $2, $3, $4, $5, $6)',
            [item.rows[0].id, merchant_id, 'ADJUSTMENT', change, currentQty, newQty]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Inventory updated', new_quantity: newQty });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adjusting inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Reserve Stock (Called by Invoice Service on Creation)
app.post('/inventory/reserve', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { merchant_id, items, invoice_id } = req.body; // items: [{ sku, quantity }]

        for (const item of items) {
            const { sku, quantity } = item;

            // Lock row for update
            const invItem = await client.query(
                'SELECT * FROM inventory WHERE merchant_id = $1 AND sku = $2 FOR UPDATE',
                [merchant_id, sku]
            );

            if (invItem.rows.length === 0) {
                // Auto-seed for testing purposes
                console.log(`Auto-seeding inventory for SKU ${sku}`);
                const newId = uuidv4();
                const initialQty = parseFloat(quantity) + 100; // Seed with enough stock
                await client.query(
                    'INSERT INTO inventory (id, merchant_id, sku, name, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
                    [newId, merchant_id, sku, `Auto-Created ${sku}`, initialQty, 100]
                );

                // Re-fetch the item
                const newInvItem = await client.query(
                    'SELECT * FROM inventory WHERE merchant_id = $1 AND sku = $2 FOR UPDATE',
                    [merchant_id, sku]
                );
                invItem.rows = newInvItem.rows;
            }

            const currentQty = parseFloat(invItem.rows[0].quantity);
            const reservedQty = parseFloat(invItem.rows[0].reserved_quantity);
            const requestedQty = parseFloat(quantity);

            if (currentQty - reservedQty < requestedQty) {
                throw new Error(`Insufficient stock for SKU ${sku}`);
            }

            // Update Reserved Quantity
            await client.query(
                'UPDATE inventory SET reserved_quantity = reserved_quantity + $1 WHERE id = $2',
                [requestedQty, invItem.rows[0].id]
            );

            // Log Event
            await client.query(
                'INSERT INTO inventory_events (inventory_id, merchant_id, invoice_id, event_type, quantity_change, previous_quantity, new_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [invItem.rows[0].id, merchant_id, invoice_id, 'RESERVE', requestedQty, currentQty, currentQty] // Physical qty doesn't change yet
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Stock reserved successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error reserving stock:', error);
        res.status(400).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Commit Stock (Called by Invoice Service on Accept)
app.post('/inventory/commit', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { merchant_id, items, invoice_id } = req.body;

        for (const item of items) {
            const { sku, quantity } = item;

            const invItem = await client.query(
                'SELECT * FROM inventory WHERE merchant_id = $1 AND sku = $2 FOR UPDATE',
                [merchant_id, sku]
            );

            if (invItem.rows.length === 0) continue;

            const requestedQty = parseFloat(quantity);

            // Decrease physical quantity and reserved quantity
            await client.query(
                'UPDATE inventory SET quantity = quantity - $1, reserved_quantity = reserved_quantity - $1 WHERE id = $2',
                [requestedQty, invItem.rows[0].id]
            );

            // Log Event
            await client.query(
                'INSERT INTO inventory_events (inventory_id, merchant_id, invoice_id, event_type, quantity_change, previous_quantity, new_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [invItem.rows[0].id, merchant_id, invoice_id, 'COMMIT', requestedQty, invItem.rows[0].quantity, invItem.rows[0].quantity - requestedQty]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Stock committed successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error committing stock:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// Release Stock (Called by Invoice Service on Reject)
app.post('/inventory/release', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { merchant_id, items, invoice_id } = req.body;

        for (const item of items) {
            const { sku, quantity } = item;

            const invItem = await client.query(
                'SELECT * FROM inventory WHERE merchant_id = $1 AND sku = $2 FOR UPDATE',
                [merchant_id, sku]
            );

            if (invItem.rows.length === 0) continue;

            const requestedQty = parseFloat(quantity);

            // Decrease reserved quantity only
            await client.query(
                'UPDATE inventory SET reserved_quantity = reserved_quantity - $1 WHERE id = $2',
                [requestedQty, invItem.rows[0].id]
            );

            // Log Event
            await client.query(
                'INSERT INTO inventory_events (inventory_id, merchant_id, invoice_id, event_type, quantity_change, previous_quantity, new_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [invItem.rows[0].id, merchant_id, invoice_id, 'RELEASE', requestedQty, invItem.rows[0].quantity, invItem.rows[0].quantity]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Stock released successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error releasing stock:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Inventory Service running on port ${PORT}`);
});
