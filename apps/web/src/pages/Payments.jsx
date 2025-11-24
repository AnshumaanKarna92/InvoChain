import { useState, useEffect } from 'react';
import { paymentService, invoiceService } from '../services/api';

export default function Payments() {
    const [payments, setPayments] = useState([]); // In a real app, we might list recent payments
    const [invoices, setInvoices] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        invoice_id: '',
        amount: '',
        method: 'BANK_TRANSFER',
        reference_id: '',
        notes: '',
    });
    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        fetchInvoices();
        fetchAnalytics();
    }, []);

    const fetchInvoices = async () => {
        try {
            const response = await invoiceService.getInvoices();
            setInvoices(response.data.invoices || []);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const response = await paymentService.getAnalytics();
            setAnalytics(response.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await paymentService.recordPayment(formData);
            alert('Payment recorded successfully!');
            setShowCreateForm(false);
            setFormData({
                invoice_id: '',
                amount: '',
                method: 'BANK_TRANSFER',
                reference_id: '',
                notes: '',
            });
            fetchAnalytics();
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700"
                >
                    {showCreateForm ? 'Cancel' : 'Record Payment'}
                </button>
            </div>

            {/* Analytics Cards */}
            {analytics && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
                    <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Collected</dt>
                        <dd className="text-2xl font-semibold text-green-600">₹{analytics.total_collected.toLocaleString()}</dd>
                    </div>
                    <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Outstanding Receivables</dt>
                        <dd className="text-2xl font-semibold text-red-600">₹{analytics.outstanding.toLocaleString()}</dd>
                    </div>
                    <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                        <dt className="text-sm font-medium text-gray-500 truncate">Transactions</dt>
                        <dd className="text-2xl font-semibold text-gray-900">{analytics.transaction_count}</dd>
                    </div>
                </div>
            )}

            {showCreateForm && (
                <div className="bg-white shadow sm:rounded-lg mb-6">
                    <div className="px-4 py-5 sm:p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Record New Payment</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Invoice</label>
                                    <select
                                        required
                                        value={formData.invoice_id}
                                        onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Select Invoice</option>
                                        {invoices.map(inv => (
                                            <option key={inv.id} value={inv.id}>{inv.invoice_number} - ₹{inv.total_amount}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                                    <select
                                        value={formData.method}
                                        onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="CREDIT_CARD">Credit Card</option>
                                        <option value="CASH">Cash</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Reference ID</label>
                                    <input
                                        type="text"
                                        value={formData.reference_id}
                                        onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                                    <textarea
                                        rows={3}
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? 'Recording...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
