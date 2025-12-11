import { useState, useEffect } from 'react';
import { gstReturnService } from '../services/api';
import { useDarkMode, useAuth } from '../App';

export default function GSTReturns() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchReturns();
        }
    }, [user]);

    const fetchReturns = async () => {
        try {
            const response = await gstReturnService.getReturns(null, user?.merchant_id);
            setReturns(response.data.returns || []);
        } catch (error) {
            console.error('Error fetching returns:', error);
        }
    };

    const handleGenerateReturn = async (type) => {
        if (!user?.merchant_id) {
            alert('Please login to generate GST returns');
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

            alert(`${type} generated successfully!`);
            fetchReturns();
        } catch (error) {
            console.error(`Error generating ${type}:`, error);
            alert(`Failed to generate ${type}: ${error.response?.data?.error || error.message}`);
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
            alert('Return deleted successfully!');
            fetchReturns();
        } catch (error) {
            console.error('Error deleting return:', error);
            alert('Failed to delete return');
        }
    };

    const handleView = async (id) => {
        try {
            const response = await gstReturnService.getReturn(id);
            if (response.data && response.data.return) {
                setSelectedReturn(response.data.return);
                setShowModal(true);
            } else {
                alert('Failed to load return details: Invalid response');
            }
        } catch (error) {
            console.error('Error fetching return details:', error);
            alert('Failed to load return details');
        }
    };

    const handleFile = async (id) => {
        try {
            await gstReturnService.updateReturnStatus(id, 'FILED');
            alert('Return filed successfully!');
            fetchReturns();
        } catch (error) {
            console.error('Error filing return:', error);
            alert('Failed to file return');
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} mb-2`}>
                        GST Returns
                    </h1>
                    <p className={`text-lg ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Generate and manage your GST returns</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => handleGenerateReturn('GSTR1')}
                        disabled={loading}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-6 py-3 rounded-xl text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                    >
                        {loading ? 'Generating...' : 'Generate GSTR-1'}
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
                    {returns.length === 0 ? (
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
                                            {ret.period_month}/{ret.period_year}
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

            {/* View Modal */}
            {showModal && selectedReturn && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)}></div>
                        <div className={`inline-block align-bottom ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full`}>
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
                                <h3 className="text-2xl font-bold text-white">
                                    {selectedReturn.return_type} Details
                                </h3>
                            </div>
                            <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} px-6 py-6`}>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className={`${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'} p-4 rounded-xl border`}>
                                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'} uppercase font-semibold mb-1`}>GSTIN</p>
                                        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedReturn.gstin}</p>
                                    </div>
                                    <div className={`${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'} p-4 rounded-xl border`}>
                                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'} uppercase font-semibold mb-1`}>Period</p>
                                        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedReturn.period_month}/{selectedReturn.period_year}</p>
                                    </div>
                                    <div className={`${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'} p-4 rounded-xl border`}>
                                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'} uppercase font-semibold mb-1`}>Status</p>
                                        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedReturn.status}</p>
                                    </div>
                                    <div className={`${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'} p-4 rounded-xl border`}>
                                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'} uppercase font-semibold mb-1`}>Created</p>
                                        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(selectedReturn.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'} mb-3 text-lg`}>Return Data</h4>
                                    <pre className={`${darkMode ? 'bg-slate-950 border-slate-700' : 'bg-slate-900 border-slate-700'} text-slate-100 p-5 rounded-xl overflow-auto max-h-96 text-xs font-mono border shadow-inner`}>
                                        {JSON.stringify(selectedReturn.data, null, 2)}
                                    </pre>
                                </div>
                            </div>
                            <div className={`${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} px-6 py-4 flex justify-end border-t`}>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-6 py-2.5 rounded-xl text-white font-semibold shadow-lg transition-all duration-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
