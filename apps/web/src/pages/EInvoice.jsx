import { useState, useEffect } from 'react';
import { gstAdapterService } from '../services/api';

export default function EInvoice() {
    const [eInvoices, setEInvoices] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchEInvoices();
    }, []);

    const fetchEInvoices = async () => {
        try {
            const response = await gstAdapterService.listEInvoices();
            setEInvoices(response.data.eInvoices || []);
        } catch (error) {
            console.error('Error fetching e-invoices:', error);
        }
    };

    const handleCancel = async (irn) => {
        if (!window.confirm('Are you sure you want to cancel this e-invoice?')) return;

        setLoading(true);
        try {
            await gstAdapterService.cancelEInvoice({ irn, reason: '1', remarks: 'Cancelled by user' });
            alert('E-invoice cancelled successfully');
            fetchEInvoices();
        } catch (error) {
            console.error('Error cancelling e-invoice:', error);
            alert('Failed to cancel e-invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">E-Invoices</h1>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h2 className="text-lg font-medium text-gray-900">Generated E-Invoices</h2>
                </div>
                <div className="border-t border-gray-200">
                    {eInvoices.length === 0 ? (
                        <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                            No e-invoices generated yet.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IRN</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {eInvoices.map((inv) => (
                                    <tr key={inv.irn}>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono" title={inv.irn}>
                                            {inv.irn.substring(0, 10)}...
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${inv.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-900">
                                            <button className="mr-4">View QR</button>
                                            {inv.status === 'ACTIVE' && (
                                                <button onClick={() => handleCancel(inv.irn)} className="text-red-600 hover:text-red-900">
                                                    Cancel
                                                </button>
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
