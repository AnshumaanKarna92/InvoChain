import { useState, useEffect } from 'react';
import { gstReturnService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function GSTReturns() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const toast = useToast();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingReturns, setFetchingReturns] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchReturns();
        } else {
            setFetchingReturns(false);
        }
    }, [user?.merchant_id]);

    const fetchReturns = async () => {
        setFetchingReturns(true);
        try {
            const response = await gstReturnService.getReturns(null, user?.merchant_id);
            setReturns(response.data.returns || []);
        } catch (error) {
            console.error('Error fetching returns:', error);
            toast.error('Failed to load GST returns');
        } finally {
            setFetchingReturns(false);
        }
    };

    const handleGenerateReturn = async (type) => {
        if (!user?.merchant_id) {
            toast.error('Please login to generate GST returns');
            return;
        }

        setLoading(true);
        try {
            const month = new Date().getMonth() + 1;
            const year = new Date().getFullYear();

            const payload = {
                merchant_id: user.merchant_id,
                period: { month, year }
            };

            if (type === 'GSTR1') {
                await gstReturnService.generateGSTR1(payload);
            } else {
                await gstReturnService.generateGSTR3B(payload);
            }

            toast.success(`${type} generated successfully!`);
            fetchReturns();
        } catch (error) {
            console.error(`Error generating ${type}:`, error);
            toast.error(`Failed to generate ${type}: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this return?')) {
            return;
        }

        try {
            await gstReturnService.deleteReturn(id);
            toast.success('Return deleted successfully!');
            fetchReturns();
        } catch (error) {
            console.error('Error deleting return:', error);
            toast.error('Failed to delete return');
        }
    };

    const handleView = async (id) => {
        setSelectedReturn(null); // Clear previous data
        setShowModal(true); // Show modal immediately
        setViewLoading(true);
        try {
            console.log('[GST] Fetching return:', id);
            const response = await gstReturnService.getReturn(id);
            console.log('[GST] Response:', response.data);
            if (response.data && response.data.return) {
                const returnData = response.data.return;
                // Ensure data is properly set
                setSelectedReturn({
                    ...returnData,
                    data: returnData.data || returnData.return_data
                });
            } else {
                toast.error('Failed to load return details');
                setShowModal(false);
            }
        } catch (error) {
            console.error('Error fetching return details:', error);
            toast.error('Failed to load return details');
            setShowModal(false);
        } finally {
            setViewLoading(false);
        }
    };

    const handleFile = async (id) => {
        try {
            await gstReturnService.updateReturnStatus(id, 'FILED');
            toast.success('Return filed successfully!');
            fetchReturns();
        } catch (error) {
            console.error('Error filing return:', error);
            toast.error('Failed to file return');
        }
    };

    const getMonthName = (month) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[month - 1] || month;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    // GSTR-1 View Component
    const GSTR1View = ({ data, gstin, period_month, period_year, created_at, status }) => {
        console.log('[GSTR1View] Received data:', { data, gstin, period_month, period_year, created_at, status });

        // Handle both direct data and nested return_data
        const returnData = typeof data === 'string' ? JSON.parse(data) : (data || {});
        const sections = returnData.sections || {};
        const summary = returnData.summary || {};
        const b2bInvoices = sections.b2b || [];

        // If no data at all, show fallback
        if (!data && !gstin) {
            return (
                <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    <p>No return data available</p>
                </div>
            );
        }

        // Extract names from return data
        const legalName = returnData.legal_name || user?.businessName || 'N/A';
        const tradeName = returnData.trade_name || legalName;
        const invoiceFilter = returnData.invoice_filter || 'All invoices';

        return (
            <div className="space-y-6">
                {/* Header Section */}
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'} border`}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>GSTR-1: Outward Supplies Return</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${status === 'FILED'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500 text-white'}`}>
                            {status || 'DRAFT'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>GSTIN</p>
                            <p className={`font-semibold font-mono text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{gstin || returnData.gstin}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Legal Name</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{legalName}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Return Period</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{getMonthName(period_month || returnData.period_month)} {period_year || returnData.period_year}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Generated On</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(created_at || returnData.generated_at).toLocaleDateString('en-IN')}</p>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>Total Invoices</p>
                        <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-blue-900'}`}>{summary.total_invoices || 0}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Taxable Value</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(summary.total_taxable_value)}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-50 border-emerald-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>CGST</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{formatCurrency(summary.total_cgst)}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-teal-900/30 border-teal-700' : 'bg-teal-50 border-teal-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-teal-300' : 'text-teal-600'}`}>SGST</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-teal-400' : 'text-teal-700'}`}>{formatCurrency(summary.total_sgst)}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-200'} border`}>
                        <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>IGST</p>
                        <p className={`text-lg font-bold ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>{formatCurrency(summary.total_igst)}</p>
                    </div>
                </div>

                {/* B2B Invoices Table */}
                <div className={`rounded-xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            Table 4A, 4B, 6B, 6C: B2B Invoices (Outward Supplies to Registered Persons)
                        </h4>
                    </div>
                    {b2bInvoices.length === 0 ? (
                        <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="font-medium">No B2B invoices in this period</p>
                            <p className="text-sm mt-1">Invoices issued to registered buyers will appear here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className={darkMode ? 'bg-slate-900/50' : 'bg-slate-50'}>
                                    <tr>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Invoice No.</th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Date</th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Buyer GSTIN</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Taxable Value</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>CGST</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>SGST</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>IGST</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Total Value</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                                    {b2bInvoices.map((inv, idx) => (
                                        <tr key={idx} className={`${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-4 py-3 font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{inv.invoice_number}</td>
                                            <td className={`px-4 py-3 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</td>
                                            <td className={`px-4 py-3 font-mono text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{inv.ctin}</td>
                                            <td className={`px-4 py-3 text-right ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(inv.taxable_value)}</td>
                                            <td className={`px-4 py-3 text-right ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(inv.cgst)}</td>
                                            <td className={`px-4 py-3 text-right ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>{formatCurrency(inv.sgst)}</td>
                                            <td className={`px-4 py-3 text-right ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>{formatCurrency(inv.igst)}</td>
                                            <td className={`px-4 py-3 text-right font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(inv.invoice_value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className={darkMode ? 'bg-slate-900/80' : 'bg-slate-100'}>
                                    <tr className="font-semibold">
                                        <td colSpan="3" className={`px-4 py-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Total</td>
                                        <td className={`px-4 py-3 text-right ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(summary.total_taxable_value)}</td>
                                        <td className={`px-4 py-3 text-right ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{formatCurrency(summary.total_cgst)}</td>
                                        <td className={`px-4 py-3 text-right ${darkMode ? 'text-teal-400' : 'text-teal-700'}`}>{formatCurrency(summary.total_sgst)}</td>
                                        <td className={`px-4 py-3 text-right ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>{formatCurrency(summary.total_igst)}</td>
                                        <td className={`px-4 py-3 text-right ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(summary.total_taxable_value + summary.total_tax)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Tax Liability Summary */}
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-700' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'} border`}>
                    <h4 className={`font-semibold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Total Tax Liability (Outward)</h4>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-6">
                            <div>
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>CGST: </span>
                                <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(summary.total_cgst)}</span>
                            </div>
                            <div>
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>SGST: </span>
                                <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(summary.total_sgst)}</span>
                            </div>
                            <div>
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>IGST: </span>
                                <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(summary.total_igst)}</span>
                            </div>
                        </div>
                        <div className={`text-xl font-bold ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                            Total: {formatCurrency(summary.total_tax)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // GSTR-3B View Component
    const GSTR3BView = ({ data, gstin, period_month, period_year, created_at, status }) => {
        console.log('[GSTR3BView] Received data:', { data, gstin, period_month, period_year, created_at, status });

        // Handle both direct data and stringified data
        const returnData = typeof data === 'string' ? JSON.parse(data) : (data || {});
        const sections = returnData.sections || {};
        const outward = sections.outward_supplies || {};
        const itc = sections.itc || {};
        const taxPayable = sections.tax_payable || {};

        const totalOutwardTax = parseFloat(outward.central_tax || 0) + parseFloat(outward.state_tax || 0) + parseFloat(outward.integrated_tax || 0);
        const netPayable = parseFloat(taxPayable.central_tax || 0) + parseFloat(taxPayable.state_tax || 0) + parseFloat(taxPayable.integrated_tax || 0);

        // If no data at all, show fallback
        if (!data && !gstin) {
            return (
                <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    <p>No return data available</p>
                </div>
            );
        }

        // Extract names from return data
        const legalName = returnData.legal_name || user?.businessName || 'N/A';
        const tradeName = returnData.trade_name || legalName;
        const summaryData = returnData.summary || {};

        return (
            <div className="space-y-6">
                {/* Header Section */}
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-700' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'} border`}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>GSTR-3B: Monthly Summary Return</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${status === 'FILED'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500 text-white'}`}>
                            {status || 'DRAFT'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>GSTIN</p>
                            <p className={`font-semibold font-mono text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{gstin || returnData.gstin}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Legal Name</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{legalName}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tax Period</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{getMonthName(period_month || returnData.period_month)} {period_year || returnData.period_year}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Invoices Included</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{returnData.total_invoices || 0}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Generated On</p>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(created_at || returnData.generated_at).toLocaleDateString('en-IN')}</p>
                        </div>
                    </div>
                </div>

                {/* 3.1 Outward Supplies */}
                <div className={`rounded-xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                        <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge</h4>
                    </div>
                    <div className="p-4">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <th className={`py-2 text-left ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Nature of Supplies</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Taxable Value</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>IGST</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>CGST</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>SGST/UTGST</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <td className={`py-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>(a) Outward Taxable Supplies (other than zero rated, nil rated and exempted)</td>
                                    <td className={`py-3 text-right font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(outward.taxable_value)}</td>
                                    <td className={`py-3 text-right ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>{formatCurrency(outward.integrated_tax)}</td>
                                    <td className={`py-3 text-right ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(outward.central_tax)}</td>
                                    <td className={`py-3 text-right ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>{formatCurrency(outward.state_tax)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Input Tax Credit */}
                <div className={`rounded-xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                        <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>4. Eligible ITC</h4>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
                                <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>ITC Available</p>
                                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-blue-900'}`}>{formatCurrency(itc.itc_available)}</p>
                                <p className={`text-xs mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>From purchases made during the period</p>
                            </div>
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'} border`}>
                                <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>ITC Reversed</p>
                                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-red-900'}`}>{formatCurrency(itc.itc_reversed)}</p>
                                <p className={`text-xs mt-1 ${darkMode ? 'text-red-400' : 'text-red-500'}`}>Ineligible/blocked credit</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 6. Tax Payable */}
                <div className={`rounded-xl border ${darkMode ? 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-700' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'}`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-amber-700' : 'border-amber-200'}`}>
                        <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>6. Payment of Tax</h4>
                    </div>
                    <div className="p-4">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className={`border-b ${darkMode ? 'border-amber-700' : 'border-amber-200'}`}>
                                    <th className={`py-2 text-left ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Description</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>IGST</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>CGST</th>
                                    <th className={`py-2 text-right ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>SGST/UTGST</th>
                                    <th className={`py-2 text-right font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className={`border-b ${darkMode ? 'border-amber-700/50' : 'border-amber-200'}`}>
                                    <td className={`py-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tax Liability (from 3.1)</td>
                                    <td className={`py-3 text-right ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>{formatCurrency(outward.integrated_tax)}</td>
                                    <td className={`py-3 text-right ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(outward.central_tax)}</td>
                                    <td className={`py-3 text-right ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>{formatCurrency(outward.state_tax)}</td>
                                    <td className={`py-3 text-right font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(totalOutwardTax)}</td>
                                </tr>
                                <tr className={`border-b ${darkMode ? 'border-amber-700/50' : 'border-amber-200'}`}>
                                    <td className={`py-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Less: ITC Utilized</td>
                                    <td colSpan="3" className={`py-3 text-center ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{formatCurrency(itc.itc_available)}</td>
                                    <td className={`py-3 text-right font-semibold text-blue-500`}>(-) {formatCurrency(itc.itc_available)}</td>
                                </tr>
                                <tr className={`${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'}`}>
                                    <td className={`py-3 font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Net Tax Payable</td>
                                    <td className={`py-3 text-right font-bold ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>{formatCurrency(taxPayable.integrated_tax)}</td>
                                    <td className={`py-3 text-right font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{formatCurrency(taxPayable.central_tax)}</td>
                                    <td className={`py-3 text-right font-bold ${darkMode ? 'text-teal-400' : 'text-teal-700'}`}>{formatCurrency(taxPayable.state_tax)}</td>
                                    <td className={`py-3 text-right text-xl font-bold ${netPayable > 0 ? (darkMode ? 'text-amber-400' : 'text-amber-700') : (darkMode ? 'text-emerald-400' : 'text-emerald-700')}`}>
                                        {formatCurrency(Math.max(0, netPayable))}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-8">
                <div></div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => handleGenerateReturn('GSTR1')}
                        disabled={loading}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-6 py-3 rounded-xl text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Generating...
                            </span>
                        ) : 'Generate GSTR-1'}
                    </button>
                    <button
                        onClick={() => handleGenerateReturn('GSTR3B')}
                        disabled={loading}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-3 rounded-xl text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                    >
                        {loading ? 'Generating...' : 'Generate GSTR-3B'}
                    </button>
                </div>
            </div>

            <div className={`${darkMode ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50' : 'bg-white border-slate-200'} shadow-xl rounded-xl border`}>
                <div className={`px-6 py-5 ${darkMode ? 'border-slate-700/50' : 'border-slate-200'} border-b bg-gradient-to-r ${darkMode ? 'from-slate-800 to-slate-800/50' : 'from-slate-50 to-white'}`}>
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Return History</h2>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>View and manage all your generated returns</p>
                </div>
                <div className="overflow-x-auto">
                    {fetchingReturns ? (
                        <div className="px-6 py-12 text-center">
                            <div className={`animate-spin inline-block w-10 h-10 border-2 border-current border-t-transparent rounded-full ${darkMode ? 'text-blue-500' : 'text-indigo-600'}`}></div>
                            <p className={`mt-4 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading returns...</p>
                        </div>
                    ) : returns.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <div className={`mx-auto w-16 h-16 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-2xl flex items-center justify-center mb-4`}>
                                <svg className={`h-8 w-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No returns generated yet</p>
                            <p className={`mt-1 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Click the buttons above to generate your first GST return</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className={darkMode ? 'bg-slate-800/80' : 'bg-slate-50'}>
                                <tr>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Type</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Period</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Generated On</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Status</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} uppercase tracking-wider`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`${darkMode ? 'divide-slate-700/50' : 'divide-slate-200'} divide-y`}>
                                {returns.map((ret) => (
                                    <tr key={ret.id} className={`${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{ret.return_type}</span>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {getMonthName(ret.period_month)} {ret.period_year}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {new Date(ret.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${ret.status === 'FILED'
                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                                                }`}>
                                                {ret.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-4">
                                            <button
                                                onClick={() => handleView(ret.id)}
                                                disabled={viewLoading}
                                                className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-indigo-600 hover:text-indigo-900'} font-semibold transition-colors`}
                                            >
                                                View
                                            </button>
                                            {ret.status !== 'FILED' && (
                                                <button
                                                    onClick={() => handleFile(ret.id)}
                                                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold transition-colors"
                                                >
                                                    File
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(ret.id)}
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* Background overlay */}
                        <div
                            className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
                            aria-hidden="true"
                            onClick={() => setShowModal(false)}
                        ></div>

                        {/* This element centers the modal */}
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        {/* Modal panel */}
                        <div className={`relative inline-block align-bottom ${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full`}>
                            {viewLoading ? (
                                <div className="px-6 py-12 text-center">
                                    <div className={`animate-spin inline-block w-10 h-10 border-2 border-current border-t-transparent rounded-full ${darkMode ? 'text-blue-500' : 'text-indigo-600'}`}></div>
                                    <p className={`mt-4 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading return data...</p>
                                </div>
                            ) : selectedReturn ? (
                                <>
                                    <div className={`px-6 py-6 max-h-[75vh] overflow-y-auto ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                                        {selectedReturn.return_type === 'GSTR1' ? (
                                            <GSTR1View
                                                data={selectedReturn.data || selectedReturn.return_data}
                                                gstin={selectedReturn.gstin}
                                                period_month={selectedReturn.period_month}
                                                period_year={selectedReturn.period_year}
                                                created_at={selectedReturn.created_at}
                                                status={selectedReturn.status}
                                            />
                                        ) : (
                                            <GSTR3BView
                                                data={selectedReturn.data || selectedReturn.return_data}
                                                gstin={selectedReturn.gstin}
                                                period_month={selectedReturn.period_month}
                                                period_year={selectedReturn.period_year}
                                                created_at={selectedReturn.created_at}
                                                status={selectedReturn.status}
                                            />
                                        )}
                                    </div>
                                    <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} px-6 py-4 flex justify-end border-t`}>
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-6 py-2.5 rounded-xl text-white font-semibold shadow-lg transition-all duration-200"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="px-6 py-12 text-center">
                                    <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>Failed to load return data</p>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="mt-4 px-4 py-2 bg-slate-600 text-white rounded-lg"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
