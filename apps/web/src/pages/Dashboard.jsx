import { useState, useEffect } from 'react';
import { invoiceService, reconciliationService, paymentService } from '../services/api';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalInvoices: 0,
        reconciled: 0,
        pending: 0,
        discrepancies: 0,
        collected: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [invoicesRes, discrepanciesRes, analyticsRes] = await Promise.all([
                invoiceService.getInvoices(),
                reconciliationService.getDiscrepancies(),
                paymentService.getAnalytics().catch(() => ({ data: { total_collected: 0 } })),
            ]);

            const invoices = invoicesRes.data.invoices || [];
            const discrepancies = discrepanciesRes.data.discrepancies || [];
            const analytics = analyticsRes.data || { total_collected: 0 };

            setStats({
                totalInvoices: invoices.length,
                reconciled: invoices.filter(inv => inv.status === 'RECONCILED').length,
                pending: invoices.filter(inv => inv.status === 'PENDING').length,
                discrepancies: discrepancies.length,
                collected: analytics.total_collected,
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon, color }) => (
        <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <svg className={`h-6 w-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {icon}
                        </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
                            <dd className="text-lg font-semibold text-gray-900">{value}</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 sm:px-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatCard
                    title="Total Invoices"
                    value={stats.totalInvoices}
                    color="text-gray-400"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    }
                />
                <StatCard
                    title="Reconciled"
                    value={stats.reconciled}
                    color="text-green-400"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
                <StatCard
                    title="Pending"
                    value={stats.pending}
                    color="text-yellow-400"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
                <StatCard
                    title="Discrepancies"
                    value={stats.discrepancies}
                    color="text-red-400"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    }
                />
                <StatCard
                    title="Collected"
                    value={`₹${(stats.collected || 0).toLocaleString()}`}
                    color="text-blue-400"
                    icon={
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    }
                />
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
                </div>
                <div className="border-t border-gray-200">
                    <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                        No recent activity
                    </div>
                </div>
            </div>
        </div>
    );
}
