import { useState, useEffect } from 'react';
import { invoiceService, reconciliationService, paymentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/ThemeContext';

export default function Dashboard() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalInvoices: 0,
        reconciled: 0,
        pending: 0,
        discrepancies: 0,
        // Role-agnostic metrics
        totalInvoicedAsSeller: 0,
        totalCollected: 0,
        totalInvoicedAsBuyer: 0,
        totalPaid: 0,
        receivables: 0,
        payables: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            const [invoicesRes, discrepanciesRes, , paymentAnalyticsRes] = await Promise.all([
                invoiceService.getInvoices(user.merchant_id, user.gstin),
                reconciliationService.getDiscrepancies(),
                invoiceService.getAnalytics(user.merchant_id),
                paymentService.getAnalytics(user.merchant_id),
            ]);

            const invoices = invoicesRes.data.invoices || [];
            const discrepancies = discrepanciesRes.data.discrepancies || [];
            const paymentAnalytics = paymentAnalyticsRes.data || {};

            // Compute role-specific invoice totals
            const invoicesAsSeller = invoices.filter(inv => inv.seller_merchant_id === user.merchant_id);
            const invoicesAsBuyer = invoices.filter(inv => inv.buyer_gstin === user.gstin);

            const totalInvoicedAsSeller = invoicesAsSeller.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const totalInvoicedAsBuyer = invoicesAsBuyer.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

            setStats({
                totalInvoices: invoices.length,
                reconciled: invoices.filter(inv => inv.status === 'ACCEPTED' || inv.status === 'PAID').length,
                pending: invoices.filter(inv => inv.status === 'ISSUED').length,
                discrepancies: discrepancies.length,
                // Role-agnostic financial metrics
                totalInvoicedAsSeller: totalInvoicedAsSeller,
                totalCollected: paymentAnalytics.total_collected || 0,
                totalInvoicedAsBuyer: totalInvoicedAsBuyer,
                totalPaid: paymentAnalytics.total_paid || 0,
                receivables: (paymentAnalytics.outstanding ?? 0),
                payables: totalInvoicedAsBuyer - (paymentAnalytics.total_paid || 0)
            });

            // Process recent activity from invoices
            const sortedInvoices = [...invoices].sort((a, b) => new Date(b.created_at || b.invoice_date) - new Date(a.created_at || a.invoice_date));
            setRecentActivity(sortedInvoices.slice(0, 5));

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const FinancialOverview = ({ stats }) => {
        const netBalance = (stats.receivables || 0) - (stats.payables || 0);
        const isPositive = netBalance >= 0;

        return (
            <div className={`p-6 rounded-xl border shadow-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        Financial Overview
                    </h3>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <svg className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                </div>

                {/* Two-Column Layout: Sales vs Purchases */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    {/* Sales (As Seller) */}
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-gradient-to-br from-slate-700/80 to-slate-700/40' : 'bg-gradient-to-br from-emerald-50 to-teal-50'} border ${darkMode ? 'border-slate-600' : 'border-emerald-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 ${darkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                    </svg>
                                </div>
                                <h4 className={`font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Sales</h4>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Seller</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Invoiced</span>
                                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    ₹{(stats.totalInvoicedAsSeller || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Collected</span>
                                <span className="font-semibold text-emerald-500">
                                    ₹{(stats.totalCollected || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className={`pt-3 border-t ${darkMode ? 'border-slate-600' : 'border-emerald-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Receivables</span>
                                    <span className={`font-bold text-lg ${stats.receivables > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        ₹{(stats.receivables || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-600">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
                                        style={{ width: `${stats.totalInvoicedAsSeller > 0 ? ((stats.totalCollected / stats.totalInvoicedAsSeller) * 100) : 0}%` }}
                                    />
                                </div>
                                <p className={`text-xs mt-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {stats.totalInvoicedAsSeller > 0
                                        ? `${((stats.totalCollected / stats.totalInvoicedAsSeller) * 100).toFixed(0)}% collected`
                                        : 'No sales yet'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Purchases (As Buyer) */}
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-gradient-to-br from-slate-700/80 to-slate-700/40' : 'bg-gradient-to-br from-blue-50 to-indigo-50'} border ${darkMode ? 'border-slate-600' : 'border-blue-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                    </svg>
                                </div>
                                <h4 className={`font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Purchases</h4>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>Buyer</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Invoiced</span>
                                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    ₹{(stats.totalInvoicedAsBuyer || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Paid</span>
                                <span className="font-semibold text-blue-500">
                                    ₹{(stats.totalPaid || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className={`pt-3 border-t ${darkMode ? 'border-slate-600' : 'border-blue-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Payables</span>
                                    <span className={`font-bold text-lg ${stats.payables > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                        ₹{Math.max(0, stats.payables || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-600">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-700"
                                        style={{ width: `${stats.totalInvoicedAsBuyer > 0 ? ((stats.totalPaid / stats.totalInvoicedAsBuyer) * 100) : 0}%` }}
                                    />
                                </div>
                                <p className={`text-xs mt-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {stats.totalInvoicedAsBuyer > 0
                                        ? `${((stats.totalPaid / stats.totalInvoicedAsBuyer) * 100).toFixed(0)}% paid`
                                        : 'No purchases yet'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Net Outstanding Balance */}
                <div className={`p-4 rounded-xl ${isPositive
                    ? (darkMode ? 'bg-gradient-to-r from-emerald-900/40 to-teal-900/30 border-emerald-700/50' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200')
                    : (darkMode ? 'bg-gradient-to-r from-red-900/40 to-rose-900/30 border-red-700/50' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200')
                    } border`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-3 ${isPositive
                                ? (darkMode ? 'bg-emerald-500/20' : 'bg-emerald-100')
                                : (darkMode ? 'bg-red-500/20' : 'bg-red-100')}`}>
                                <svg className={`w-5 h-5 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isPositive
                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    }
                                </svg>
                            </div>
                            <div>
                                <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                                    Net Balance
                                </p>
                                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {isPositive ? 'Amount owed to you' : 'Amount you owe'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                                {isPositive ? '+' : '-'}₹{Math.abs(netBalance).toLocaleString()}
                            </p>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isPositive
                                ? (darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                                : (darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                                }`}>
                                {isPositive ? 'Receivable' : 'Payable'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const StatCard = ({ title, value, icon, gradient, iconBg }) => (
        <div className={`${darkMode ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50' : 'bg-white border-slate-200'} rounded-xl border shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden relative group`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
            <div className="p-6 relative">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'} mb-1`}>{title}</p>
                        <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{value}</p>
                    </div>
                    <div className="ml-4">
                        <div className={`w-14 h-14 ${iconBg} rounded-xl flex items-center justify-center shadow-lg`}>
                            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {icon}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? 'border-blue-500' : 'border-indigo-600'}`}></div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
                {/* GST Profile Context Card */}
                <div className={`rounded-xl border shadow-md overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`px-6 py-3 border-b ${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} flex justify-between items-center`}>
                        <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            GST Taxpayer Profile
                        </h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`}>
                            Active
                        </span>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase mb-1`}>GSTIN</p>
                            <p className={`text-lg font-bold font-mono ${darkMode ? 'text-white' : 'text-slate-900'}`}>{user?.gstin || 'N/A'}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase mb-1`}>Legal Name</p>
                            <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{user?.legalName || 'N/A'}</p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase mb-1`}>Trade Name</p>
                            <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{user?.tradeName || 'N/A'}</p>
                        </div>
                        <div className={`col-span-1 md:col-span-3 h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} my-2`}></div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase mb-1`}>Financial Year</p>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {(() => {
                                    const today = new Date();
                                    const month = today.getMonth(); // 0-11
                                    const year = today.getFullYear();
                                    // If Jan-Mar (0-2), FY is (Year-1)-Year. Else Year-(Year+1)
                                    return month < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
                                })()}
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase mb-1`}>Return Period</p>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase mb-1`}>Last Updated</p>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatCard
                    title="Total Invoices"
                    value={stats.totalInvoices}
                    gradient="from-indigo-500 to-purple-600"
                    iconBg="bg-gradient-to-br from-indigo-500 to-purple-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    }
                />
                <StatCard
                    title="Collected (Sales)"
                    value={`₹${(stats.totalCollected ?? 0).toLocaleString()}`}
                    gradient="from-emerald-500 to-teal-600"
                    iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
                <StatCard
                    title="Paid (Purchases)"
                    value={`₹${(stats.totalPaid ?? 0).toLocaleString()}`}
                    gradient="from-blue-500 to-cyan-600"
                    iconBg="bg-gradient-to-br from-blue-500 to-cyan-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    }
                />
                <StatCard
                    title="Net Receivables"
                    value={`₹${(stats.receivables ?? 0).toLocaleString()}`}
                    gradient="from-amber-500 to-orange-600"
                    iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    }
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <FinancialOverview stats={stats} />

                <div className={`p-6 rounded-xl border shadow-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Recent Activity</h3>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((invoice) => (
                                <div key={invoice.id} className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                            Invoice #{invoice.invoice_number}
                                        </p>
                                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {new Date(invoice.created_at || invoice.invoice_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                            ₹{parseFloat(invoice.total_amount).toLocaleString()}
                                        </p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${invoice.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                                            invoice.status === 'ISSUED' ? 'bg-yellow-100 text-yellow-800' :
                                                invoice.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {invoice.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No recent activity</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
