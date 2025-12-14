const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5433/invochain',
});

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Notification Service' });
});

// Get notifications for a merchant
app.get('/notifications', async (req, res) => {
    try {
        const { merchant_id } = req.query;

        if (!merchant_id) {
            return res.status(400).json({ success: false, message: 'merchant_id is required' });
        }

        const result = await pool.query(
            `SELECT 
                n.*,
                i.invoice_number,
                i.total_amount,
                i.status as invoice_status
             FROM notifications n
             LEFT JOIN invoices i ON n.invoice_id = i.id
             WHERE n.merchant_id = $1
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [merchant_id]
        );

        const unreadCount = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE merchant_id = $1 AND is_read = false',
            [merchant_id]
        );

        res.json({
            success: true,
            notifications: result.rows,
            unread_count: parseInt(unreadCount.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark notification as read
app.patch('/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1',
            [id]
        );

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all notifications as read for a merchant
app.patch('/notifications/read-all', async (req, res) => {
    try {
        const { merchant_id } = req.body;

        if (!merchant_id) {
            return res.status(400).json({ success: false, message: 'merchant_id is required' });
        }

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE merchant_id = $1 AND is_read = false',
            [merchant_id]
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create notification (internal use by other services)
app.post('/notifications', async (req, res) => {
    try {
        const { merchant_id, invoice_id, type, title, message } = req.body;

        if (!merchant_id || !type || !title || !message) {
            return res.status(400).json({
                success: false,
                message: 'merchant_id, type, title, and message are required'
            });
        }

        const result = await pool.query(
            `INSERT INTO notifications (merchant_id, invoice_id, type, title, message)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [merchant_id, invoice_id || null, type, title, message]
        );

        console.log(`[NOTIFICATION] ${type} created for merchant ${merchant_id}: ${title}`);

        res.json({
            success: true,
            notification: result.rows[0],
            message: 'Notification created'
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete notification
app.delete('/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM notifications WHERE id = $1', [id]);

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Notification Service running on port ${PORT}`);
});
