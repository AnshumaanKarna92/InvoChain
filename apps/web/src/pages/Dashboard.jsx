import { useState, useEffect } from 'react';
import { invoiceService, reconciliationService, paymentService } from '../services/api';
import { useDarkMode, useAuth } from '../App';

export default function Dashboard() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalInvoices: 0,
        reconciled: 0,
        pending: 0,
        discrepancies: 0,
        collected: 0,
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
            const [invoicesRes, discrepanciesRes, analyticsRes] = await Promise.all([
                invoiceService.getInvoices(user.merchant_id),
                reconciliationService.getDiscrepancies(),
                paymentService.getAnalytics().catch(() => ({ data: { total_collected: 0 } })),
            ]);

            const invoices = invoicesRes.data.invoices || [];
            const discrepancies = discrepanciesRes.data.discrepancies || [];
            const analytics = analyticsRes.data || { total_collected: 0 };

            console.log('Dashboard invoices:', invoices); // Debug log

            setStats({
                totalInvoices: invoices.length,
                reconciled: invoices.filter(inv => inv.status === 'ACCEPTED').length, // Changed from RECONCILED
                pending: invoices.filter(inv => inv.status === 'ISSUED').length, // Changed from PENDING
                discrepancies: discrepancies.length,
                collected: analytics.total_collected || 0,
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
                <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} mb-2`}>
                    Dashboard
                </h1>
                <p className={`text-lg ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Overview of your invoice management system</p>
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
                    title="Reconciled"
                    value={stats.reconciled}
                    gradient="from-emerald-500 to-teal-600"
                    iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
                <StatCard
                    title="Pending"
                    value={stats.pending}
                    gradient="from-amber-500 to-orange-600"
                    iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
                <StatCard
                    title="Total Collected"
                    value={`₹${(stats.collected || 0).toLocaleString('en-IN')}`}
                    gradient="from-blue-500 to-cyan-600"
                    iconBg="bg-gradient-to-br from-blue-500 to-cyan-600"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
            </div>

            {stats.discrepancies > 0 && (
                <div className={`mb-8 ${darkMode ? 'bg-red-900/30 border-red-700/50 backdrop-blur-sm' : 'bg-red-50 border-red-200'} border rounded-xl p-4 shadow-lg`}>
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <div className={`w-10 h-10 ${darkMode ? 'bg-red-800' : 'bg-red-100'} rounded-lg flex items-center justify-center`}>
                                <svg className={`h-6 w-6 ${darkMode ? 'text-red-400' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <h3 className={`text-sm font-semibold ${darkMode ? 'text-red-300' : 'text-red-800'}`}>Attention Required</h3>
                            <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                                You have {stats.discrepancies} discrepancies that require review.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${darkMode ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700/50' : 'bg-white border-slate-200'} shadow-xl rounded-xl border`}>
                <div className={`px-6 py-5 ${darkMode ? 'border-slate-700/50' : 'border-slate-200'} border-b bg-gradient-to-r ${darkMode ? 'from-slate-800 to-slate-800/50' : 'from-slate-50 to-white'}`}>
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Recent Activity</h2>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Track your latest invoice activities</p>
                </div>
                <div className="px-6 py-6">
                    {recentActivity.length === 0 ? (
                        <div className={`text-center py-6 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            <div className={`mx-auto w-16 h-16 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-2xl flex items-center justify-center mb-4`}>
                                <svg className={`h-8 w-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No recent activity</p>
                            <p className={`mt-1 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Your invoice activities will appear here</p>
                        </div>
                    ) : (
                        <div className="flow-root">
                            <ul className={`-my-5 divide-y ${darkMode ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                                {recentActivity.map((invoice) => (
                                    <li key={invoice.id} className="py-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-shrink-0">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${invoice.status === 'PAID' ? 'bg-green-100 text-green-600' :
                                                    invoice.status === 'PENDING' ? 'bg-amber-100 text-amber-600' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'} truncate`}>
                                                    Invoice #{invoice.invoice_number} Created
                                                </p>
                                                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'} truncate`}>
                                                    To: {invoice.buyer_gstin || invoice.buyer_id}
                                                </p>
                                            </div>
                                            <div className="inline-flex items-center text-base font-semibold text-slate-900 dark:text-white">
                                                ₹{invoice.total_amount}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
