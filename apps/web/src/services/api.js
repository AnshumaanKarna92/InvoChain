import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.method === 'post' && !config.headers['idempotency-key']) {
        // Use crypto.randomUUID() if available, otherwise fallback (though modern browsers support it)
        if (self.crypto && self.crypto.randomUUID) {
            config.headers['idempotency-key'] = self.crypto.randomUUID();
        } else {
            // Simple fallback for older environments if needed
            config.headers['idempotency-key'] = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    }

    return config;
});

// Auth Service
export const authService = {
    register: (data) => api.post('/auth/register', data),
    login: (credentials) => api.post('/auth/login', credentials),
    getMerchants: () => api.get('/auth/merchants'),
    lookupMerchant: (gstin) => api.get(`/auth/merchants/lookup`, { params: { gstin } }),
};

// Invoice Service
export const invoiceService = {
    createInvoice: (formData) => api.post('/invoices', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getInvoices: (merchantId, gstin = null) => {
        const params = {};
        if (merchantId) params.merchant_id = merchantId;
        if (gstin) params.gstin = gstin;
        return api.get('/invoices', { params });
    },
    getInvoice: (id) => api.get(`/invoices/${id}`),
    updateInvoiceStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
    performAction: (id, action, reason) => api.post(`/invoices/${id}/action`, { action, reason }),
    getAnalytics: (merchantId) => api.get('/invoices/analytics', { params: { merchant_id: merchantId } }),
    // E-Invoice methods
    getEligibleForEInvoice: (merchantId) => api.get('/invoices/e-invoice/eligible', { params: { merchant_id: merchantId } }),
    generateEInvoice: (invoiceId) => api.post(`/invoices/${invoiceId}/e-invoice/generate`),
    getEInvoices: (merchantId) => api.get('/invoices/e-invoice/list', { params: { merchant_id: merchantId } }),
    cancelEInvoice: (invoiceId, reason) => api.post(`/invoices/${invoiceId}/e-invoice/cancel`, { reason }),
};


// Inventory Service
export const inventoryService = {
    getInventory: (merchantId) => api.get(`/inventory/${merchantId}`),
    adjustStock: (data) => api.post('/inventory/adjust', data),
};

// Blockchain Service
export const blockchainService = {
    registerInvoice: (data) => api.post('/blockchain/register', data),
    updateStatus: (data) => api.post('/blockchain/update-status', data),
    verifyInvoice: (data) => api.post('/blockchain/verify', data),
    getLedger: () => api.get('/blockchain/ledger'),
    // New Anchor Methods
    getAnchors: (recordType, recordId) => api.get(`/blockchain/anchor/${recordType}/${recordId}`),
    verifyAnchor: (data) => api.post('/blockchain/verify', data),
    getMerchantAnchors: (merchantId, recordType) => api.get('/blockchain/anchors', { params: { merchant_id: merchantId, record_type: recordType } }),
};

// Buyer Action Service
export const buyerActionService = {
    acceptInvoice: (invoiceId) => api.post(`/buyer/accept/${invoiceId}`),
    rejectInvoice: (invoiceId, reason) => api.post(`/buyer/reject/${invoiceId}`, { reason }),
    requestMissing: (data) => api.post('/buyer/request-missing', data),
    getActions: () => api.get('/buyer/actions'),
};

// Notification Service
export const notificationService = {
    getNotifications: (merchantId) => api.get('/notifications', { params: { merchant_id: merchantId } }),
    markAsRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllAsRead: (merchantId) => api.patch('/notifications/read-all', { merchant_id: merchantId }),
    deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

// Reconciliation Service
export const reconciliationService = {
    runReconciliation: (data) => api.post('/reconciliation/run', data),
    getReport: (id) => api.get(`/reconciliation/report/${id}`),
    getDiscrepancies: () => api.get('/reconciliation/discrepancies'),
    resolveDiscrepancy: (id) => api.patch(`/reconciliation/discrepancy/${id}/resolve`),
    getReports: () => api.get('/reconciliation/reports'),
};

// Credit/Debit Note Service
export const noteService = {
    createCreditNote: (data) => api.post('/notes/credit', data),
    createDebitNote: (data) => api.post('/notes/debit', data),
    getNotesForInvoice: (invoiceId) => api.get(`/notes/invoice/${invoiceId}`),
    getAllNotes: (merchant_id, type) => api.get('/notes', { params: { merchant_id, type } }),
    getNoteDetail: (id) => api.get(`/notes/detail/${id}`),
    deleteNote: (id) => api.delete(`/notes/${id}`),
};

// GST Return Service
export const gstReturnService = {
    generateGSTR1: (data) => api.post('/gst/generate/gstr1', data),
    generateGSTR3B: (data) => api.post('/gst/generate/gstr3b', data),
    getReturn: (id) => api.get(`/gst/returns/${id}`),
    getReturns: (type, merchant_id) => api.get('/gst/returns', { params: { type, merchant_id } }),
    updateReturnStatus: (id, status) => api.patch(`/gst/returns/${id}/status`, { status }),
    deleteReturn: (id) => api.delete(`/gst/returns/${id}`),
};

// GST Adapter Service
export const gstAdapterService = {
    generateEInvoice: (data) => api.post('/gst-adapter/gst/e-invoice/generate', data),
    cancelEInvoice: (data) => api.post('/gst-adapter/gst/e-invoice/cancel', data),
    getEInvoiceStatus: (irn) => api.get(`/gst-adapter/gst/e-invoice/status/${irn}`),
    listEInvoices: () => api.get('/gst-adapter/gst/e-invoice/list'),
    pushGSTR1: (data) => api.post('/gst-adapter/gst/gstr1/push', data),
    getGSTR1Status: (gstin, month, year) => api.get(`/gst-adapter/gst/gstr1/status/${gstin}/${month}/${year}`),
    getAuthToken: (credentials) => api.post('/gst-adapter/gst/auth/token', credentials),
};

// Payment Service
export const paymentService = {
    recordPayment: (data) => api.post('/payments', data), // Gateway: POST /api/payments -> Service: POST /payments
    getPayments: (merchantId) => api.get('/payments', { params: { merchant_id: merchantId } }),
    getPaymentsForInvoice: (invoiceId) => api.get(`/payments/invoice/${invoiceId}`),
    confirmPayment: (id) => api.post(`/payments/${id}/confirm`),
    getAnalytics: (merchantId) => api.get('/payments/analytics', { params: { merchant_id: merchantId } }),
};



export default api;
