const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// In-memory notification log
const notifications = [];

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Notification Service' });
});

// Send Notification
app.post('/notifications/send', (req, res) => {
    try {
        const { recipient, type, subject, message, metadata } = req.body;

        const notification = {
            id: notifications.length + 1,
            recipient,
            type, // 'EMAIL', 'SMS', 'PUSH'
            subject,
            message,
            metadata,
            status: 'SENT',
            timestamp: new Date().toISOString()
        };

        notifications.push(notification);

        // Log to console (placeholder for actual email/SMS)
        console.log(`[NOTIFICATION] ${type} to ${recipient}: ${subject}`);
        console.log(`Message: ${message}`);

        res.json({
            success: true,
            notification,
            message: 'Notification sent'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Notification History
app.get('/notifications', (req, res) => {
    res.json({ success: true, notifications, count: notifications.length });
});

app.listen(PORT, () => {
    console.log(`Notification Service running on port ${PORT}`);
});
