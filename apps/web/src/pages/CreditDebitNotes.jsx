import { useState, useEffect } from 'react';
import { noteService, invoiceService } from '../services/api';
import { useDarkMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BlockchainAuditModal from '../components/BlockchainAuditModal';

export default function CreditDebitNotes() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const toast = useToast();
    const [notes, setNotes] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingNotes, setFetchingNotes] = useState(true);
    const [summary, setSummary] = useState(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [formData, setFormData] = useState({
        type: 'CREDIT',
        invoice_id: '',
        amount: '',
        reason: '',
    });

    useEffect(() => {
        fetchNotes();
        fetchInvoices();
    }, [user?.merchant_id]);

    const fetchNotes = async () => {
        setFetchingNotes(true);
        try {
            const response = await noteService.getAllNotes(user?.merchant_id);
            setNotes(response.data.notes || []);
            setSummary(response.data.summary || null);
        } catch (error) {
            console.error('Error fetching notes:', error);
            toast.error('Failed to load notes');
        } finally {
            setFetchingNotes(false);
        }
    };

    const fetchInvoices = async () => {
        try {
            // Fetch invoices that are ACCEPTED or PAID (eligible for notes)
            const response = await invoiceService.getInvoices(user?.merchant_id);
            const eligibleInvoices = (response.data.invoices || [])
                .filter(inv => ['ACCEPTED', 'PAID'].includes(inv.status));
            setInvoices(eligibleInvoices);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                invoice_id: formData.invoice_id,
                amount: parseFloat(formData.amount),
                reason: formData.reason,
                merchant_id: user?.merchant_id
            };

            let response;
            if (formData.type === 'CREDIT') {
                response = await noteService.createCreditNote(payload);
            } else {
                response = await noteService.createDebitNote(payload);
            }

            toast.success(response.data.message || `${formData.type} note created successfully!`);
            setShowCreateForm(false);
            setFormData({ type: 'CREDIT', invoice_id: '', amount: '', reason: '' });
            fetchNotes();
        } catch (error) {
            console.error('Error creating note:', error);
            const errorMsg = error.response?.data?.message || error.response?.data?.errors?.join(', ') || 'Failed to create note';
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            await noteService.deleteNote(id);
            toast.success('Note deleted successfully');
            fetchNotes();
        } catch (error) {
            console.error('Error deleting note:', error);
            toast.error('Failed to delete note');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const getSelectedInvoice = () => {
        return invoices.find(inv => inv.id === formData.invoice_id);
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div></div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${showCreateForm
                        ? 'bg-slate-600 hover:bg-slate-700 text-white'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                        }`}
                >
                    {showCreateForm ? 'Cancel' : '+ Create Note'}
                </button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-50 border-emerald-200'} border`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${darkMode ? 'bg-emerald-800' : 'bg-emerald-100'}`}>
                                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                                <p className={`text-xs ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>Credit Notes</p>
                                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-emerald-900'}`}>{summary.credit_notes}</p>
                            </div>
                        </div>
                    </div>
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'} border`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-800' : 'bg-red-100'}`}>
                                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </div>
                            <div>
                                <p className={`text-xs ${darkMode ? 'text-red-300' : 'text-red-600'}`}>Debit Notes</p>
                                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-red-900'}`}>{summary.debit_notes}</p>
                            </div>
                        </div>
                    </div>
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Credits</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{formatCurrency(summary.total_credits)}</p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Reduces liability</p>
                    </div>
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Debits</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>{formatCurrency(summary.total_debits)}</p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Increases liability</p>
                    </div>
                </div>
            )}

            {/* Create Form */}
            {showCreateForm && (
                <div className={`${darkMode ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50' : 'bg-white border-slate-200'} shadow-xl rounded-2xl mb-6 border p-6`}>
                    <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        Create {formData.type === 'CREDIT' ? 'Credit' : 'Debit'} Note
                    </h3>

                    {/* Info Banner */}
                    <div className={`mb-6 p-4 rounded-xl ${formData.type === 'CREDIT'
                        ? (darkMode ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-50 border-emerald-200')
                        : (darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200')
                        } border`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg ${formData.type === 'CREDIT'
                                ? (darkMode ? 'bg-emerald-800' : 'bg-emerald-100')
                                : (darkMode ? 'bg-red-800' : 'bg-red-100')
                                }`}>
                                {formData.type === 'CREDIT' ? (
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <p className={`font-medium text-sm ${formData.type === 'CREDIT'
                                    ? (darkMode ? 'text-emerald-300' : 'text-emerald-800')
                                    : (darkMode ? 'text-red-300' : 'text-red-800')
                                    }`}>
                                    {formData.type === 'CREDIT' ? 'Credit Note' : 'Debit Note'}
                                </p>
                                <p className={`text-xs ${formData.type === 'CREDIT'
                                    ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                                    : (darkMode ? 'text-red-400' : 'text-red-600')
                                    }`}>
                                    {formData.type === 'CREDIT'
                                        ? 'Issued when goods are returned or price reduced. Reduces taxable value and GST liability in GSTR-1.'
                                        : 'Issued when price increases or additional charges added. Increases taxable value and GST liability in GSTR-1.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Note Type</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    className={`block w-full rounded-xl px-4 py-3 shadow-sm text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                >
                                    <option value="CREDIT">Credit Note (Reduces Liability)</option>
                                    <option value="DEBIT">Debit Note (Increases Liability)</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Select Invoice</label>
                                <select
                                    name="invoice_id"
                                    value={formData.invoice_id}
                                    onChange={handleInputChange}
                                    required
                                    className={`block w-full rounded-xl px-4 py-3 shadow-sm text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                >
                                    <option value="">-- Select an invoice --</option>
                                    {invoices.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.invoice_number} - {formatCurrency(inv.total_amount)} ({inv.status})
                                        </option>
                                    ))}
                                </select>
                                {invoices.length === 0 && (
                                    <p className={`text-xs mt-1 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                        No eligible invoices found. Only ACCEPTED or PAID invoices can have notes.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Amount (₹)</label>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    placeholder="Enter amount"
                                    min="0.01"
                                    step="0.01"
                                    max={getSelectedInvoice()?.total_amount || undefined}
                                    className={`block w-full rounded-xl px-4 py-3 shadow-sm text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                                {getSelectedInvoice() && (
                                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Max: {formatCurrency(getSelectedInvoice().total_amount)}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Reason</label>
                                <input
                                    type="text"
                                    name="reason"
                                    value={formData.reason}
                                    onChange={handleInputChange}
                                    placeholder={formData.type === 'CREDIT' ? 'e.g., Goods returned, Price reduction' : 'e.g., Additional charges, Price increase'}
                                    className={`block w-full rounded-xl px-4 py-3 shadow-sm text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !formData.invoice_id}
                                className={`inline-flex justify-center py-3 px-6 border border-transparent shadow-lg text-sm font-semibold rounded-xl text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${formData.type === 'CREDIT'
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                                    }`}
                            >
                                {loading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                        </svg>
                                        Creating...
                                    </span>
                                ) : `Create ${formData.type === 'CREDIT' ? 'Credit' : 'Debit'} Note`}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Notes Table */}
            <div className={`${darkMode ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50' : 'bg-white border-slate-200'} shadow-xl rounded-2xl overflow-hidden border`}>
                <div className={`px-6 py-5 ${darkMode ? 'border-slate-700/50' : 'border-slate-200'} border-b bg-gradient-to-r ${darkMode ? 'from-slate-800 to-slate-800/50' : 'from-slate-50 to-white'}`}>
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Notes History</h2>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Post-invoice adjustments for GST compliance</p>
                </div>
                <div className="overflow-x-auto">
                    {fetchingNotes ? (
                        <div className="px-6 py-12 text-center">
                            <div className={`animate-spin inline-block w-10 h-10 border-2 border-current border-t-transparent rounded-full ${darkMode ? 'text-blue-500' : 'text-indigo-600'}`}></div>
                            <p className={`mt-4 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading notes...</p>
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <div className={`mx-auto w-16 h-16 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-2xl flex items-center justify-center mb-4`}>
                                <svg className={`h-8 w-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No notes created yet</p>
                            <p className={`mt-1 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Create credit/debit notes for post-invoice adjustments</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className={darkMode ? 'bg-slate-800/80' : 'bg-slate-50'}>
                                <tr>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Note</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Type</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Invoice</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Counterparty</th>
                                    <th className={`px-6 py-4 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Amount</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Reason</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Date</th>
                                    <th className={`px-6 py-4 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`${darkMode ? 'divide-slate-700/50' : 'divide-slate-200'} divide-y`}>
                                {notes.map((note) => (
                                    <tr key={note.id} className={`${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                                        <td className={`px-6 py-4 whitespace-nowrap`}>
                                            <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{note.note_number}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full ${note.note_type === 'CREDIT'
                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                                                : 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md'
                                                }`}>
                                                {note.note_type === 'CREDIT' ? (
                                                    <>
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Credit
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                        Debit
                                                    </>
                                                )}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {note.invoice_number || note.invoice_id?.substring(0, 8) || 'N/A'}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap`}>
                                            <div>
                                                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                                    {note.counterparty_name || 'N/A'}
                                                </p>
                                                {note.counterparty_gstin && (
                                                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {note.counterparty_gstin}
                                                    </p>
                                                )}
                                                {note.user_role && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${note.user_role === 'seller'
                                                        ? (darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')
                                                        : (darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700')
                                                        }`}>
                                                        You: {note.user_role}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${note.note_type === 'CREDIT'
                                            ? (darkMode ? 'text-emerald-400' : 'text-emerald-700')
                                            : (darkMode ? 'text-red-400' : 'text-red-700')
                                            }`}>
                                            {note.note_type === 'CREDIT' ? '-' : '+'}{formatCurrency(note.amount)}
                                        </td>
                                        <td className={`px-6 py-4 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {note.reason}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {new Date(note.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => {
                                                    setSelectedNote(note);
                                                    setShowAuditModal(true);
                                                }}
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold transition-colors mr-4"
                                            >
                                                Audit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(note.id)}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Blockchain Audit Modal */}
            <BlockchainAuditModal
                isOpen={showAuditModal}
                onClose={() => setShowAuditModal(false)}
                recordType="NOTE"
                recordId={selectedNote?.id}
                recordNumber={selectedNote?.note_number}
            />
        </div>
    );
}
