import { useState, useEffect } from 'react';
import { reconciliationService } from '../services/api';
import { useDarkMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Reconciliation() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const toast = useToast();
    const [discrepancies, setDiscrepancies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingDiscrepancies, setFetchingDiscrepancies] = useState(true);
    const [lastRun, setLastRun] = useState(null);
    const [lastReport, setLastReport] = useState(null);

    useEffect(() => {
        fetchDiscrepancies();
    }, []);

    const fetchDiscrepancies = async () => {
        setFetchingDiscrepancies(true);
        try {
            const response = await reconciliationService.getDiscrepancies();
            setDiscrepancies(response.data.discrepancies || []);
        } catch (error) {
            console.error('Error fetching discrepancies:', error);
            toast.error('Failed to fetch discrepancies');
        } finally {
            setFetchingDiscrepancies(false);
        }
    };

    const handleRunReconciliation = async () => {
        setLoading(true);
        try {
            console.log('[Reconciliation] Running for merchant:', user?.merchant_id);
            const response = await reconciliationService.runReconciliation({
                merchant_id: user?.merchant_id
            });
            console.log('[Reconciliation] Response:', response.data);

            setLastRun(new Date().toLocaleString());
            setLastReport(response.data.report);

            const report = response.data.report;
            toast.success(`Reconciliation completed! Total: ${report.total_invoices}, Matched: ${report.matched_invoices}, Discrepancies: ${report.discrepancies_count}`);

            await fetchDiscrepancies();
        } catch (error) {
            console.error('Error running reconciliation:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            toast.error('Failed to run reconciliation: ' + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id) => {
        try {
            await reconciliationService.resolveDiscrepancy(id);
            toast.success('Discrepancy resolved!');
            fetchDiscrepancies();
        } catch (error) {
            console.error('Error resolving discrepancy:', error);
            toast.error('Failed to resolve discrepancy');
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    {lastRun && <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Last run: {lastRun}</p>}
                </div>
                <button
                    onClick={handleRunReconciliation}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                >
                    {loading ? (
                        <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Running...
                        </span>
                    ) : 'Run Reconciliation'}
                </button>
            </div>

            {/* Report Summary */}
            {lastReport && (
                <div className={`mb-6 p-4 rounded-xl ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
                    <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Last Reconciliation Summary</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-blue-50'}`}>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-blue-600'}`}>Total Invoices</p>
                            <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-blue-700'}`}>{lastReport.total_invoices}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-emerald-50'}`}>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-emerald-600'}`}>Matched</p>
                            <p className={`text-xl font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{lastReport.matched_invoices}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-red-50'}`}>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-red-600'}`}>Discrepancies</p>
                            <p className={`text-xl font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>{lastReport.discrepancies_count}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow overflow-hidden rounded-xl border`}>
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h2 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Open Discrepancies</h2>
                    <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{discrepancies.length} items</span>
                </div>
                <div className={`border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    {fetchingDiscrepancies ? (
                        <div className="px-4 py-8 text-center">
                            <div className={`animate-spin inline-block w-8 h-8 border-2 border-current border-t-transparent rounded-full ${darkMode ? 'text-blue-500' : 'text-indigo-600'}`}></div>
                        </div>
                    ) : discrepancies.length === 0 ? (
                        <div className={`px-4 py-5 sm:p-6 text-center ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            No discrepancies found. All invoices match!
                        </div>
                    ) : (
                        <table className={`min-w-full divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                            <thead className={darkMode ? 'bg-slate-900' : 'bg-gray-50'}>
                                <tr>
                                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>Invoice #</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>Type</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>Details</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>Status</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`${darkMode ? 'bg-slate-800 divide-slate-700' : 'bg-white divide-gray-200'} divide-y`}>
                                {discrepancies.map((item) => (
                                    <tr key={item.id}>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.invoice_number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.details}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.status}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-900">
                                            {item.status !== 'RESOLVED' && (
                                                <button onClick={() => handleResolve(item.id)}>Resolve</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
