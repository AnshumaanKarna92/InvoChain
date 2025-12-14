import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentService, invoiceService } from '../services/api';
import { useDarkMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Payments() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [payments, setPayments] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        invoice_id: '',
        amount: '',
        method: 'BANK_TRANSFER',
        reference_id: '',
        notes: '',
        payer_gstin: '',
        receiver_gstin: '',
        payment_date: new Date().toISOString().split('T')[0]
    });

    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        let mounted = true;
        if (user?.merchant_id) {
            const loadData = async () => {
                try {
                    setLoading(true);
                    await Promise.all([fetchInvoices(), fetchAnalytics(), fetchPayments()]);
                } catch (err) {
                    console.error("Error loading payment data", err);
                } finally {
                    if (mounted) setLoading(false);
                }
            };
            loadData();
        }
        return () => { mounted = false; };
    }, [user?.merchant_id]);

    // Handle Query Params for "Pay Now" redirection
    const invoiceId = searchParams.get('invoice_id');
    const amount = searchParams.get('amount');

    useEffect(() => {
        if (invoiceId && invoices.length > 0) {
            const selectedInvoice = invoices.find(inv => inv.id === invoiceId);
            if (selectedInvoice) {
                // Check if we already have this data to avoid loop
                setFormData(prev => {
                    if (prev.invoice_id === invoiceId) return prev;
                    return {
                        ...prev,
                        invoice_id: invoiceId,
                        amount: amount || selectedInvoice.total_amount,
                        payer_gstin: selectedInvoice.buyer_gstin,
                        receiver_gstin: selectedInvoice.seller_gstin || ''
                    };
                });
                setShowCreateForm(true);
            }
        }
    }, [invoiceId, amount, invoices]);

    const fetchPayments = async () => {
        try {
            const response = await paymentService.getPayments(user?.merchant_id);
            if (response.data && Array.isArray(response.data.payments)) {
                setPayments(response.data.payments);
            } else {
                setPayments([]);
            }
        } catch (error) {
            console.error('Error fetching payments:', error);
            setPayments([]);
        }
    };

    const fetchInvoices = async () => {
        try {
            const response = await invoiceService.getInvoices(user?.merchant_id, user?.gstin);
            const allInvoices = response.data.invoices || [];
            // Filter: Only ACCEPTED or PARTIALLY_PAID invoices where logged-in user is the BUYER
            const eligibleInvoices = allInvoices.filter(inv =>
                (inv.status === 'ACCEPTED' || inv.status === 'PARTIALLY_PAID') &&
                inv.buyer_gstin === user?.gstin
            );
            setInvoices(eligibleInvoices);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            setInvoices([]);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const response = await paymentService.getAnalytics(user?.merchant_id);
            setAnalytics(response.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    };

    const handleInvoiceSelect = (e) => {
        const invoiceId = e.target.value;
        const selectedInvoice = invoices.find(inv => inv.id === invoiceId);

        if (selectedInvoice) {
            setFormData(prev => ({
                ...prev,
                invoice_id: invoiceId,
                amount: selectedInvoice.total_amount,
                payer_gstin: selectedInvoice.buyer_gstin,
                receiver_gstin: selectedInvoice.seller_gstin || '' // Ensure backend sends seller_gstin
            }));
        } else {
            setFormData(prev => ({ ...prev, invoice_id: invoiceId, amount: '', payer_gstin: '', receiver_gstin: '' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await paymentService.recordPayment(formData);
            alert('Payment recorded successfully! Waiting for confirmation.');
            setShowCreateForm(false);
            setFormData({
                invoice_id: '',
                amount: '',
                method: 'BANK_TRANSFER',
                reference_id: '',
                notes: '',
                payer_gstin: '',
                receiver_gstin: '',
                payment_date: new Date().toISOString().split('T')[0]
            });
            fetchAnalytics();
            fetchPayments();
            // Clear query params
            navigate('/payments');
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPayment = async (paymentId) => {
        if (!window.confirm("Confirm receipt of this payment?")) return;
        try {
            await paymentService.confirmPayment(paymentId);
            fetchPayments();
            fetchAnalytics();
        } catch (error) {
            console.error("Error confirming payment:", error);
            alert("Failed to confirm payment");
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Payments</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700"
                >
                    {showCreateForm ? 'Cancel' : 'Record Payment'}
                </button>
            </div>

            {/* Analytics Cards - Context Aware */}
            {analytics && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
                    <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} overflow-hidden shadow rounded-lg p-5 border`}>
                        <dt className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'} truncate`}>Total Collected (As Seller)</dt>
                        <dd className="text-2xl font-semibold text-green-600">₹{(analytics.total_collected ?? 0).toLocaleString()}</dd>
                    </div>
                    <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} overflow-hidden shadow rounded-lg p-5 border`}>
                        <dt className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'} truncate`}>Total Paid (As Buyer)</dt>
                        <dd className="text-2xl font-semibold text-blue-600">₹{(analytics.total_paid ?? 0).toLocaleString()}</dd>
                    </div>
                    <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} overflow-hidden shadow rounded-lg p-5 border`}>
                        <dt className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'} truncate`}>Outstanding Balance</dt>
                        <dd className={`text-2xl font-semibold ${(analytics.outstanding ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(analytics.outstanding ?? 0) > 0 ? '+' : ''}₹{(analytics.outstanding ?? 0).toLocaleString()}
                        </dd>
                    </div>
                </div>
            )}

            {showCreateForm && (
                <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow sm:rounded-lg mb-6 border`}>
                    <div className="px-4 py-5 sm:p-6">
                        <h2 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Record New Payment</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Invoice (Payable)</label>
                                    <select
                                        required
                                        value={formData.invoice_id}
                                        onChange={handleInvoiceSelect}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'}`}
                                    >
                                        <option value="">Select Invoice to Pay</option>
                                        {invoices.length === 0 && (
                                            <option value="" disabled>No eligible invoices (ACCEPTED/PARTIALLY_PAID)</option>
                                        )}
                                        {invoices.map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.invoice_number} | {inv.seller_trade_name || inv.seller_gstin || 'Seller'} | ₹{inv.total_amount} ({inv.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'border-gray-300'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Payer GSTIN</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.payer_gstin}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 bg-gray-100 dark:bg-slate-600 cursor-not-allowed ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Receiver GSTIN</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.receiver_gstin}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 bg-gray-100 dark:bg-slate-600 cursor-not-allowed ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Payment Method</label>
                                    <select
                                        value={formData.method}
                                        onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'}`}
                                    >
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="CREDIT_CARD">Credit Card</option>
                                        <option value="CASH">Cash</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Reference ID</label>
                                    <input
                                        type="text"
                                        value={formData.reference_id}
                                        onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'border-gray-300'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Date</label>
                                    <input
                                        type="date"
                                        value={formData.payment_date}
                                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'border-gray-300'}`}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Notes</label>
                                    <textarea
                                        rows={3}
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'border-gray-300'}`}
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

            {/* Payments List */}
            <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow overflow-hidden sm:rounded-lg border`}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className={darkMode ? 'bg-slate-900' : 'bg-gray-50'}>
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Invoice</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Method</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                        {payments.map((payment) => (
                            <tr key={payment.id}>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-900'}`}>{new Date(payment.created_at).toLocaleDateString()}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-900'}`}>{payment.invoice_number || 'N/A'}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-900'}`}>₹{payment.amount}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-900'}`}>{payment.payment_method}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payment.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {payment.status || 'RECORDED'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {/* Only Receiver can confirm */}
                                    {payment.status !== 'CONFIRMED' && user?.merchant_id === payment.receiver_merchant_id && (
                                        <button
                                            onClick={() => handleConfirmPayment(payment.id)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            Confirm Receipt
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
