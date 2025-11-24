const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(morgan('dev'));

// Service URLs
const INVOICE_SERVICE = process.env.INVOICE_SERVICE_URL || 'http://127.0.0.1:3002';
const BLOCKCHAIN_SERVICE = process.env.BLOCKCHAIN_SERVICE_URL || 'http://127.0.0.1:3003';
const BUYER_ACTION_SERVICE = process.env.BUYER_ACTION_SERVICE_URL || 'http://127.0.0.1:3004';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:3005';
const RECONCILIATION_SERVICE = process.env.RECONCILIATION_SERVICE_URL || 'http://127.0.0.1:3006';
const CREDIT_DEBIT_NOTE_SERVICE = process.env.CREDIT_DEBIT_NOTE_SERVICE_URL || 'http://127.0.0.1:3007';
const GST_RETURN_SERVICE = process.env.GST_RETURN_SERVICE_URL || 'http://127.0.0.1:3008';
const GST_ADAPTER_SERVICE = process.env.GST_ADAPTER_SERVICE_URL || 'http://127.0.0.1:3009';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:3010';

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'API Gateway' });
});

// Proxy Configuration
const proxyOptions = (target, pathRewrite) => ({
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req, res) => {
        // Fix for body-parser issues if used globally (we removed express.json() global middleware for proxies)
        if (req.body && !req.headers['content-type']?.includes('multipart/form-data')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ message: 'Proxy Error', error: err.message });
    }
});

// We need to parse JSON for non-proxy routes or handle it carefully. 
// Since we are a gateway, we can skip global body parsing or apply it only where needed.
// But http-proxy-middleware handles streams better without body-parser interfering.

// Invoice route - must come first and handle multipart form data
app.use('/api/invoices', createProxyMiddleware({
    target: INVOICE_SERVICE + '/invoices',
    changeOrigin: true,
    onError: (err, req, res) => {
        console.error('Proxy Error (Invoice):', err);
        res.status(500).json({ message: 'Proxy Error', error: err.message });
    }
}));

app.use('/api/blockchain', createProxyMiddleware({
    target: BLOCKCHAIN_SERVICE + '/blockchain',
    changeOrigin: true,
}));

app.use('/api/buyer', createProxyMiddleware({
    target: BUYER_ACTION_SERVICE + '/buyer',
    changeOrigin: true,
}));

app.use('/api/notifications', createProxyMiddleware({
    target: NOTIFICATION_SERVICE + '/notifications',
    changeOrigin: true,
}));

app.use('/api/reconciliation', createProxyMiddleware({
    target: RECONCILIATION_SERVICE + '/reconciliation',
    changeOrigin: true,
}));

app.use('/api/notes', createProxyMiddleware({
    target: CREDIT_DEBIT_NOTE_SERVICE + '/notes',
    changeOrigin: true,
}));

app.use('/api/gst', createProxyMiddleware({
    target: GST_RETURN_SERVICE + '/gst',
    changeOrigin: true,
}));

app.use('/api/gst-adapter', createProxyMiddleware({
    target: GST_ADAPTER_SERVICE + '/gst-adapter',
    changeOrigin: true,
}));

app.use('/api/payments', createProxyMiddleware({
    target: PAYMENT_SERVICE + '/payments',
    changeOrigin: true,
}));

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
