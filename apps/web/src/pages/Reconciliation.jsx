import { useState, useEffect } from 'react';
import { reconciliationService } from '../services/api';
import { useDarkMode } from '../App';

export default function Reconciliation() {
    const { darkMode } = useDarkMode();
    const [discrepancies, setDiscrepancies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastRun, setLastRun] = useState(null);

    useEffect(() => {
        fetchDiscrepancies();
    }, []);

    const fetchDiscrepancies = async () => {
        try {
            const response = await reconciliationService.getDiscrepancies();
            setDiscrepancies(response.data.discrepancies || []);
        } catch (error) {
            console.error('Error fetching discrepancies:', error);
        }
    };

    const handleRunReconciliation = async () => {
        setLoading(true);
        try {
            const response = await reconciliationService.runReconciliation({});
            setLastRun(new Date().toLocaleString());
            alert(`Reconciliation complete! Found ${response.data.discrepancies?.length || 0} discrepancies.`);
            fetchDiscrepancies();
        } catch (error) {
            console.error('Error running reconciliation:', error);
            alert('Failed to run reconciliation');
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id) => {
        try {
            await reconciliationService.resolveDiscrepancy(id);
            alert('Discrepancy resolved!');
            fetchDiscrepancies();
        } catch (error) {
            console.error('Error resolving discrepancy:', error);
            alert('Failed to resolve discrepancy');
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Reconciliation</h1>
                    {lastRun && <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Last run: {lastRun}</p>}
                </div>
                <button
                    onClick={handleRunReconciliation}
                    disabled={loading}
                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Running...' : 'Run Reconciliation'}
                </button>
            </div>

            <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow overflow-hidden sm:rounded-lg border`}>
                <div className="px-4 py-5 sm:px-6">
                    <h2 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Discrepancies</h2>
                </div>
                <div className={`border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    {discrepancies.length === 0 ? (
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
