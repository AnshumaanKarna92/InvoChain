import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';
import { useDarkMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function EInvoice() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('eligible');
    const [eligibleInvoices, setEligibleInvoices] = useState([]);
    const [eInvoices, setEInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchData();
        }
    }, [user?.merchant_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [eligibleRes, eInvoicesRes] = await Promise.all([
                invoiceService.getEligibleForEInvoice(user?.merchant_id),
                invoiceService.getEInvoices(user?.merchant_id)
            ]);
            setEligibleInvoices(eligibleRes.data.invoices || []);
            setEInvoices(eInvoicesRes.data.eInvoices || []);
        } catch (error) {
            console.error('Error fetching e-invoice data:', error);
            toast.error('Failed to load e-invoice data');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateEInvoice = async (invoiceId) => {
        setGenerating(invoiceId);
        try {
            const response = await invoiceService.generateEInvoice(invoiceId);
            toast.success(response.data.message || 'E-Invoice generated successfully!');
            setSelectedInvoice(response.data.eInvoice);
            fetchData();
        } catch (error) {
            console.error('Error generating e-invoice:', error);
            const errorMsg = error.response?.data?.message || 'Failed to generate e-invoice';
            toast.error(errorMsg);
        } finally {
            setGenerating(null);
        }
    };

    const handleCancelEInvoice = async (invoiceId) => {
        if (!confirm('Are you sure you want to cancel this e-invoice? This action cannot be undone.')) return;

        try {
            await invoiceService.cancelEInvoice(invoiceId, 'Cancelled by user');
            toast.success('E-Invoice cancelled successfully');
            fetchData();
        } catch (error) {
            console.error('Error cancelling e-invoice:', error);
            const errorMsg = error.response?.data?.message || 'Failed to cancel e-invoice';
            toast.error(errorMsg);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatGSTIN = (gstin) => {
        if (!gstin) return 'N/A';
        return gstin.length === 15 ? `${gstin.slice(0, 2)}-${gstin.slice(2)}` : gstin;
    };

    return (
        <div className="px-4 py-6 sm:px-0 space-y-6">
            {/* Header with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`p-5 rounded-2xl ${darkMode ? 'bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-700/50' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'} border shadow-lg`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${darkMode ? 'bg-amber-800/50' : 'bg-amber-100'}`}>
                            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className={`text-sm ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Pending E-Invoice</p>
                            <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-amber-900'}`}>{eligibleInvoices.length}</p>
                        </div>
                    </div>
                </div>
                <div className={`p-5 rounded-2xl ${darkMode ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'} border shadow-lg`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${darkMode ? 'bg-emerald-800/50' : 'bg-emerald-100'}`}>
                            <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className={`text-sm ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>E-Invoices Generated</p>
                            <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-emerald-900'}`}>{eInvoices.length}</p>
                        </div>
                    </div>
                </div>
                <div className={`p-5 rounded-2xl ${darkMode ? 'bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/50' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200'} border shadow-lg`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${darkMode ? 'bg-indigo-800/50' : 'bg-indigo-100'}`}>
                            <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <p className={`text-sm ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>IRP Status</p>
                            <p className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Simulated</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className={`flex gap-2 p-1.5 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                <button
                    onClick={() => setActiveTab('eligible')}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'eligible'
                            ? (darkMode ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg' : 'bg-white text-amber-700 shadow-md')
                            : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pending ({eligibleInvoices.length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('generated')}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'generated'
                            ? (darkMode ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'bg-white text-emerald-700 shadow-md')
                            : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Generated ({eInvoices.length})
                    </span>
                </button>
            </div>

            {/* Main Content */}
            <div className={`${darkMode ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50' : 'bg-white border-slate-200'} rounded-2xl shadow-xl border overflow-hidden`}>
                {loading ? (
                    <div className="p-12 text-center">
                        <div className={`animate-spin inline-block w-12 h-12 border-2 border-current border-t-transparent rounded-full ${darkMode ? 'text-indigo-500' : 'text-indigo-600'}`}></div>
                        <p className={`mt-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading e-invoice data...</p>
                    </div>
                ) : activeTab === 'eligible' ? (
                    /* Eligible Invoices Tab */
                    eligibleInvoices.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className={`mx-auto w-20 h-20 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-2xl flex items-center justify-center mb-5`}>
                                <svg className={`h-10 w-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className={`text-lg font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>All caught up!</p>
                            <p className={`mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>No pending invoices for e-invoicing. Only ACCEPTED B2B invoices appear here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className={darkMode ? 'bg-slate-800/80' : 'bg-slate-50'}>
                                    <tr>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Invoice</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Seller GSTIN</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Buyer</th>
                                        <th className={`px-6 py-4 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Value</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Status</th>
                                        <th className={`px-6 py-4 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Action</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                                    {eligibleInvoices.map((inv) => (
                                        <tr key={inv.id} className={`${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                                            <td className="px-6 py-4">
                                                <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{inv.invoice_number}</p>
                                                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</p>
                                            </td>
                                            <td className={`px-6 py-4`}>
                                                <p className={`text-sm font-mono ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formatGSTIN(inv.seller_gstin)}</p>
                                                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{inv.seller_name}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`text-sm font-mono ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formatGSTIN(inv.buyer_gstin)}</p>
                                                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{inv.buyer_name || 'B2B Buyer'}</p>
                                            </td>
                                            <td className={`px-6 py-4 text-right text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                                {formatCurrency(inv.total_amount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${inv.status === 'PAID'
                                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                                                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                                                    }`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleGenerateEInvoice(inv.id)}
                                                    disabled={generating === inv.id}
                                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                                                >
                                                    {generating === inv.id ? (
                                                        <>
                                                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                            </svg>
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                            </svg>
                                                            Generate E-Invoice
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    /* Generated E-Invoices Tab */
                    eInvoices.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className={`mx-auto w-20 h-20 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-2xl flex items-center justify-center mb-5`}>
                                <svg className={`h-10 w-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <p className={`text-lg font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No E-Invoices Yet</p>
                            <p className={`mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Generate e-invoices from the Pending tab to see them here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className={darkMode ? 'bg-slate-800/80' : 'bg-slate-50'}>
                                    <tr>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>IRN</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Invoice</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Seller</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Buyer</th>
                                        <th className={`px-6 py-4 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Value</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Status</th>
                                        <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Generated</th>
                                        <th className={`px-6 py-4 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                                    {eInvoices.map((inv) => (
                                        <tr key={inv.id} className={`${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                                            <td className="px-6 py-4">
                                                <div className={`text-xs font-mono ${darkMode ? 'text-indigo-400' : 'text-indigo-600'} bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded inline-block max-w-[120px] truncate`} title={inv.irn}>
                                                    {inv.irn?.substring(0, 12)}...
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{inv.invoice_number}</p>
                                                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{formatGSTIN(inv.seller_gstin)}</p>
                                                <p className={`text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{inv.seller_name}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{formatGSTIN(inv.buyer_gstin)}</p>
                                                <p className={`text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{inv.buyer_name}</p>
                                            </td>
                                            <td className={`px-6 py-4 text-right text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                                {formatCurrency(inv.total_amount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
                                                    IRN Generated
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                                {new Date(inv.irn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => setSelectedInvoice(inv)}
                                                        className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${darkMode ? 'text-indigo-400 hover:bg-indigo-900/30' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelEInvoice(inv.id)}
                                                        className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${darkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50'}`}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* E-Invoice Detail Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)}></div>
                    <div className={`relative w-full max-w-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-3xl shadow-2xl overflow-hidden`}>
                        {/* Modal Header */}
                        <div className={`px-6 py-5 ${darkMode ? 'bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-700/50' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'} border-b`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-emerald-800/50' : 'bg-emerald-100'}`}>
                                        <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>E-Invoice Details</h3>
                                        <p className={`text-sm ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>IRN Generated Successfully</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedInvoice(null)}
                                    className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* IRN Section */}
                            <div className={`p-4 rounded-xl ${darkMode ? 'bg-indigo-900/30 border-indigo-700/50' : 'bg-indigo-50 border-indigo-200'} border`}>
                                <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>INVOICE REFERENCE NUMBER (IRN)</p>
                                <p className={`text-sm font-mono break-all ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedInvoice.irn}</p>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Invoice Number</p>
                                    <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedInvoice.invoice_number}</p>
                                </div>
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Invoice Value</p>
                                    <p className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{formatCurrency(selectedInvoice.invoice_value || selectedInvoice.total_amount)}</p>
                                </div>
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Seller GSTIN</p>
                                    <p className={`text-sm font-mono ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedInvoice.seller_gstin}</p>
                                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{selectedInvoice.seller_name}</p>
                                </div>
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Buyer GSTIN</p>
                                    <p className={`text-sm font-mono ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedInvoice.buyer_gstin}</p>
                                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{selectedInvoice.buyer_name}</p>
                                </div>
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>IRN Date</p>
                                    <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(selectedInvoice.irn_date).toLocaleString('en-IN')}</p>
                                </div>
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>E-Invoice Status</p>
                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                                        {selectedInvoice.status || selectedInvoice.e_invoice_status || 'GENERATED'}
                                    </span>
                                </div>
                            </div>

                            {/* ACK Info (if available) */}
                            {selectedInvoice.ack_number && (
                                <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'} border`}>
                                    <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>ACKNOWLEDGEMENT</p>
                                    <div className="flex justify-between">
                                        <div>
                                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>ACK Number</p>
                                            <p className={`text-sm font-mono ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedInvoice.ack_number}</p>
                                        </div>
                                        <div>
                                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>ACK Date</p>
                                            <p className={`text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(selectedInvoice.ack_date).toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className={`px-6 py-4 border-t ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
