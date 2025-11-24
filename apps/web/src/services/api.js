import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Invoice Service
export const invoiceService = {
    createInvoice: (formData) => api.post('/invoices', formData),
    getInvoices: () => api.get('/invoices'),
    getInvoice: (id) => api.get(`/invoices/${id}`),
    updateInvoiceStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
};

// Blockchain Service
export const blockchainService = {
    registerInvoice: (data) => api.post('/blockchain/register', data),
    updateStatus: (data) => api.post('/blockchain/update-status', data),
    verifyInvoice: (data) => api.post('/blockchain/verify', data),
    getLedger: () => api.get('/blockchain/ledger'),
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
    sendNotification: (data) => api.post('/notifications/send', data),
    getNotifications: () => api.get('/notifications'),
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
    getNotesForInvoice: (invoiceId) => api.get(`/notes/${invoiceId}`),
    getAllNotes: (type) => api.get('/notes', { params: { type } }),
};

// GST Return Service
export const gstReturnService = {
    generateGSTR1: (data) => api.post('/gst/generate/gstr1', data),
    generateGSTR3B: (data) => api.post('/gst/generate/gstr3b', data),
    getReturn: (id) => api.get(`/gst/returns/${id}`),
    getReturns: (type) => api.get('/gst/returns', { params: { type } }),
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
    getPaymentsForInvoice: (invoiceId) => api.get(`/payments/invoice/${invoiceId}`),
    getAnalytics: () => api.get('/payments/analytics'),
};

export default api;
