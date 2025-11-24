import { useState, useEffect } from 'react';
import { invoiceService, blockchainService, gstAdapterService } from '../services/api';
import { useDarkMode } from '../App';

export default function Invoices() {
    const { darkMode } = useDarkMode();
    const [invoices, setInvoices] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);
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

    const handleViewDetails = (invoice) => {
        setSelectedInvoice(invoice);
        setShowModal(true);
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

            // Register on Blockchain
            await blockchainService.registerInvoice({
                invoiceId: invoice.id,
                hash: invoice.file_hash,
                amount: invoice.total_amount,
                seller: invoice.seller_id,
                buyer: invoice.buyer_id
            });

            // Generate E-Invoice
            await gstAdapterService.generateEInvoice({
                invoice_number: invoice.invoice_number,
                seller_gstin: '29ABCDE1234F1Z5', // Mock GSTIN
                buyer_gstin: '29XYZDE1234F1Z5', // Mock GSTIN
                total_amount: invoice.total_amount,
                invoice_date: invoice.invoice_date
            });

            alert('Invoice created successfully!');
            setShowCreateForm(false);
            fetchInvoices();
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Invoices</h1>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Manage and track your invoices</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                    {showCreateForm ? 'Cancel' : 'Create Invoice'}
                </button>
            </div>

            {showCreateForm && (
                <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow sm:rounded-lg mb-6 border p-6`}>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Invoice Number</label>
                                <input
                                    type="text"
                                    name="invoice_number"
                                    value={formData.invoice_number}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Invoice Date</label>
                                <input
                                    type="date"
                                    name="invoice_date"
                                    value={formData.invoice_date}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Seller ID</label>
                                <input
                                    type="text"
                                    name="seller_id"
                                    value={formData.seller_id}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Buyer ID</label>
                                <input
                                    type="text"
                                    name="buyer_id"
                                    value={formData.buyer_id}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Total Amount</label>
                                <input
                                    type="number"
                                    name="total_amount"
                                    value={formData.total_amount}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tax Amount</label>
                                <input
                                    type="number"
                                    name="tax_amount"
                                    value={formData.tax_amount}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Upload Invoice File</label>
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className={`mt-1 block w-full text-sm ${darkMode ? 'text-slate-300 file:bg-slate-700 file:text-white file:border-slate-600' : 'text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'}`}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create Invoice'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow overflow-hidden sm:rounded-lg border`}>
                <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                        <thead className={darkMode ? 'bg-slate-900' : 'bg-gray-50'}>
                            <tr>
                                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                    Invoice #
                                </th>
                                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                    Date
                                </th>
                                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                    Amount
                                </th>
                                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                    Status
                                </th>
                                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className={`${darkMode ? 'bg-slate-800 divide-slate-700' : 'bg-white divide-gray-200'} divide-y`}>
                            {invoices.map((invoice) => (
                                <tr key={invoice.id}>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {invoice.invoice_number}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>
                                        {new Date(invoice.invoice_date).toLocaleDateString()}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>
                                        ₹{invoice.total_amount}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                            invoice.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {invoice.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleViewDetails(invoice)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Details Modal */}
            {showModal && selectedInvoice && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                        <div className={`inline-block align-bottom ${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full`}>
                            <div className={`${darkMode ? 'bg-slate-900' : 'bg-gray-50'} px-6 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Invoice Details: {selectedInvoice.invoice_number}
                                </h3>
                            </div>
                            <div className="px-6 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Seller ID</p>
                                        <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInvoice.seller_id}</p>
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Buyer ID</p>
                                        <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInvoice.buyer_id}</p>
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Date</p>
                                        <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Status</p>
                                        <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInvoice.status}</p>
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Total Amount</p>
                                        <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{selectedInvoice.total_amount}</p>
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Tax Amount</p>
                                        <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{selectedInvoice.tax_amount}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>File Hash</p>
                                        <p className={`text-xs font-mono break-all ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>{selectedInvoice.file_hash || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={`${darkMode ? 'bg-slate-900' : 'bg-gray-50'} px-6 py-4 flex justify-end`}>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
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
