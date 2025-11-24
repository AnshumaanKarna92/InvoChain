import { useState, useEffect } from 'react';
import { invoiceService, blockchainService, gstAdapterService } from '../services/api';

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        invoice_number: '',
        seller_id: '',
        buyer_id: '',
        invoice_date: '',
        total_amount: '',
        tax_amount: '',
        items: [],
    });
    const [file, setFile] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const response = await invoiceService.getInvoices();
            setInvoices(response.data.invoices || []);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (key === 'items') {
                    data.append(key, JSON.stringify(formData[key]));
                } else {
                    data.append(key, formData[key]);
                }
            });
            if (file) {
                data.append('file', file);
            }

            const response = await invoiceService.createInvoice(data);
            const invoice = response.data.invoice;

            // Register on blockchain
            await blockchainService.registerInvoice({
                invoiceId: invoice.id,
                invoiceHash: invoice.hash,
                seller: formData.seller_id,
                buyer: formData.buyer_id,
            });

            // Generate e-invoice
            try {
                await gstAdapterService.generateEInvoice({ invoice });
            } catch (eInvError) {
                console.warn('E-invoice generation failed:', eInvError);
            }

            alert('Invoice created successfully!');
            setShowCreateForm(false);
            resetForm();
            fetchInvoices();
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            invoice_number: '',
            seller_id: '',
            buyer_id: '',
            invoice_date: '',
            total_amount: '',
            tax_amount: '',
            items: [],
        });
        setFile(null);
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700"
                >
                    {showCreateForm ? 'Cancel' : 'Create Invoice'}
                </button>
            </div>

            {showCreateForm && (
                <div className="bg-white shadow sm:rounded-lg mb-6">
                    <div className="px-4 py-5 sm:p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Invoice</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.invoice_number}
                                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.invoice_date}
                                        onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Seller ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.seller_id}
                                        onChange={(e) => setFormData({ ...formData, seller_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Buyer ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.buyer_id}
                                        onChange={(e) => setFormData({ ...formData, buyer_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.total_amount}
                                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tax Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.tax_amount}
                                        onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Upload File</label>
                                    <input
                                        type="file"
                                        onChange={(e) => setFile(e.target.files[0])}
                                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h2 className="text-lg font-medium text-gray-900">Invoice List</h2>
                </div>
                <div className="border-t border-gray-200">
                    {invoices.length === 0 ? (
                        <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                            No invoices yet. Create your first invoice to get started.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {invoices.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.invoice_date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{invoice.total_amount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                invoice.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-900">
                                            <button>View Details</button>
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
