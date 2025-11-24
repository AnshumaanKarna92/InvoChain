import { useState, useEffect } from 'react';
import { gstReturnService } from '../services/api';

export default function GSTReturns() {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchReturns();
    }, []);

    const fetchReturns = async () => {
        try {
            const response = await gstReturnService.getReturns();
            setReturns(response.data.returns || []);
        } catch (error) {
            console.error('Error fetching returns:', error);
        }
    };

    const handleGenerateReturn = async (type) => {
        setLoading(true);
        try {
            const month = new Date().getMonth() + 1;
            const year = new Date().getFullYear();

            if (type === 'GSTR1') {
                await gstReturnService.generateGSTR1({ month, year });
            } else {
                await gstReturnService.generateGSTR3B({ month, year });
            }

            alert(`${type} generated successfully!`);
            fetchReturns();
        } catch (error) {
            console.error(`Error generating ${type}:`, error);
            alert(`Failed to generate ${type}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">GST Returns</h1>
                <div className="space-x-4">
                    <button
                        onClick={() => handleGenerateReturn('GSTR1')}
                        disabled={loading}
                        className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Generate GSTR-1
                    </button>
                    <button
                        onClick={() => handleGenerateReturn('GSTR3B')}
                        disabled={loading}
                        className="bg-green-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                        Generate GSTR-3B
                    </button>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h2 className="text-lg font-medium text-gray-900">Return History</h2>
                </div>
                <div className="border-t border-gray-200">
                    {returns.length === 0 ? (
                        <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                            No returns generated yet.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated On</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {returns.map((ret) => (
                                    <tr key={ret.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ret.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ret.month}/{ret.year}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(ret.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ret.status === 'FILED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {ret.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-900">
                                            <button className="mr-4">View</button>
                                            <button>File</button>
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
