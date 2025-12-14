
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS & security
app.use(cors({
    origin: '*', // In production, replace with specific domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key']
}));
app.use(helmet());
app.use(morgan('dev')); // Better logging



// Service URLs
const SERVICES = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3011',
    invoice: process.env.INVOICE_SERVICE_URL || 'http://localhost:3002',
    merchant: process.env.MERCHANT_REGISTRY_SERVICE_URL || 'http://localhost:3012',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3013',
    audit: process.env.AUDIT_SERVICE_URL || 'http://localhost:3014',
    blockchain: process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3010',
    buyer: process.env.BUYER_ACTION_SERVICE_URL || 'http://localhost:3004',
    gstReturn: process.env.GST_RETURN_SERVICE_URL || 'http://localhost:3008',
    gstAdapter: process.env.GST_ADAPTER_SERVICE_URL || 'http://localhost:3009',
    reconciliation: process.env.RECONCILIATION_SERVICE_URL || 'http://localhost:3006',
    notes: process.env.NOTE_SERVICE_URL || 'http://localhost:3007'
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'API Gateway', services: SERVICES });
});



// --- Route Mappings ---

// Auth Service
// /api/auth/login -> http://localhost:3011/login
app.use('/api/auth', createProxyMiddleware({
    target: SERVICES.auth,
    changeOrigin: true,
    pathRewrite: {
        '^/api/auth': '', // Strip /api/auth
    }
}));

// Invoice Service
// /api/invoices -> http://localhost:3002/invoices
// Invoice Service
// /api/invoices -> http://localhost:3002/invoices
app.use('/api/invoices', createProxyMiddleware({
    target: SERVICES.invoice,
    changeOrigin: true,
    pathRewrite: {
        '^/$': '/invoices',       // / -> /invoices
        '^/(.+)': '/invoices/$1'  // /123 -> /invoices/123
    },
    onProxyReq: (proxyReq, req, res) => {
        // console.log(`[Proxy] ${req.method} ${req.url} -> ${SERVICES.invoice}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
        res.status(502).json({ success: false, error: 'Proxy error', message: err.message });
    }
}));

// Notifications Service
// /api/notifications -> http://localhost:3005/notifications
app.use('/api/notifications', createProxyMiddleware({
    target: SERVICES.notification,
    changeOrigin: true,
    pathRewrite: (path, req) => {
        // When mounted at /api/notifications, path is relative:
        // / -> /notifications
        // /123 -> /notifications/123
        // /123/read -> /notifications/123/read
        // /read-all -> /notifications/read-all
        const newPath = '/notifications' + path;
        console.log(`[PathRewrite] ${path} -> ${newPath}`);
        return newPath;
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${SERVICES.notification}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error(`[Proxy Error] Notification: ${req.method} ${req.url}:`, err.message);
        res.status(502).json({ success: false, error: 'Notification service unavailable' });
    }
}));

// Merchant Service
// /api/merchants -> http://localhost:3012/merchants
app.use('/api/merchants', createProxyMiddleware({
    target: SERVICES.merchant,
    changeOrigin: true,
    pathRewrite: (path) => '/merchants' + path
}));

// Inventory Service
// /api/inventory -> http://localhost:3013/inventory
app.use('/api/inventory', createProxyMiddleware({
    target: SERVICES.inventory,
    changeOrigin: true,
    pathRewrite: (path, req) => {
        // When mounted at /api/inventory, path is relative:
        // / -> /inventory
        // /123 -> /inventory/123
        // /adjust -> /inventory/adjust
        const newPath = '/inventory' + path;
        console.log(`[PathRewrite Inventory] ${path} -> ${newPath}`);
        return newPath;
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${SERVICES.inventory}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error(`[Proxy Error] Inventory: ${req.method} ${req.url}:`, err.message);
        res.status(502).json({ success: false, error: 'Inventory service unavailable' });
    }
}));

// Audit Service
// /api/audit -> http://localhost:3014/audit
app.use('/api/audit', createProxyMiddleware({
    target: SERVICES.audit,
    changeOrigin: true,
    pathRewrite: (path) => '/audit' + path
}));

// Blockchain Service
// /api/blockchain -> http://localhost:3003/blockchain
app.use('/api/blockchain', createProxyMiddleware({
    target: SERVICES.blockchain,
    changeOrigin: true,
    pathRewrite: (path) => '/blockchain' + path
}));

// Payment Service
// /api/payments -> http://localhost:3010/payments
app.use('/api/payments', createProxyMiddleware({
    target: SERVICES.payment,
    changeOrigin: true,
    pathRewrite: (path) => '/payments' + path
}));

// Buyer Action Service
// /api/buyer -> http://localhost:3004/buyer
app.use('/api/buyer', createProxyMiddleware({
    target: SERVICES.buyer,
    changeOrigin: true,
    pathRewrite: (path) => '/buyer' + path
}));

// GST Return Service
// /api/gst -> http://localhost:3008/gst
app.use('/api/gst', createProxyMiddleware({
    target: SERVICES.gstReturn,
    changeOrigin: true,
    pathRewrite: (path) => '/gst' + path
}));

// GST Adapter Service
// /api/gst-adapter -> http://localhost:3009
app.use('/api/gst-adapter', createProxyMiddleware({
    target: SERVICES.gstAdapter,
    changeOrigin: true,
    pathRewrite: (path) => path // No prefix change needed, target root
}));

// Reconciliation Service
// /api/reconciliation -> http://localhost:3006/reconciliation
app.use('/api/reconciliation', createProxyMiddleware({
    target: SERVICES.reconciliation,
    changeOrigin: true,
    pathRewrite: (path) => '/reconciliation' + path
}));

// Credit/Debit Note Service
// /api/notes -> http://localhost:3007/notes
app.use('/api/notes', createProxyMiddleware({
    target: SERVICES.notes,
    changeOrigin: true,
    pathRewrite: (path) => '/notes' + path
}));

// Global proxy error handler
app.use((err, req, res, next) => {
    console.error(`[API Gateway] Error on ${req.method} ${req.originalUrl}:`, err.message);
    res.status(502).json({ success: false, message: 'Bad gateway', error: err.message });
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
