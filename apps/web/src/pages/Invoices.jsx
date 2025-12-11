import { useState, useEffect, useMemo } from 'react';
import { invoiceService, blockchainService, gstAdapterService } from '../services/api';
import { useDarkMode, useAuth } from '../App';
import { useToast } from '../context/ToastContext';

export default function Invoices() {
    const { darkMode } = useDarkMode();
    const { user } = useAuth();
    const toast = useToast();
    const [invoices, setInvoices] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        invoice_number: '',
        buyer_gstin: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        items: [],
    });
    const [file, setFile] = useState(null);

    // Item State
    const [currentItem, setCurrentItem] = useState({
        sku: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        gst_rate: 18 // Default GST rate
    });

    // Calculate totals dynamically
    const calculatedTotals = useMemo(() => {
        return formData.items.reduce((acc, item) => {
            return {
                total_amount: acc.total_amount + item.total_item_amount,
                tax_amount: acc.tax_amount + (item.total_item_amount - item.taxable_value)
            };
        }, { total_amount: 0, tax_amount: 0 });
    }, [formData.items]);

    const handleItemChange = (e) => {
        const { name, value } = e.target;
        setCurrentItem(prev => ({ ...prev, [name]: value }));
    };

    const addItem = () => {
        if (!currentItem.sku || !currentItem.quantity || !currentItem.unit_price) {
            toast.warning('Please fill SKU, Quantity and Price');
            return;
        }

        const quantity = parseFloat(currentItem.quantity);
        const unit_price = parseFloat(currentItem.unit_price);
        const gst_rate = parseFloat(currentItem.gst_rate);
        const taxable_value = quantity * unit_price;
        const tax_amount = (taxable_value * gst_rate) / 100;
        const total_item_amount = taxable_value + tax_amount;

        const newItem = {
            sku: currentItem.sku,
            description: currentItem.description,
            quantity: quantity,
            unit_price: unit_price,
            gst_rate: gst_rate,
            taxable_value: taxable_value,
            total_item_amount: total_item_amount,
            // For display in table
            total: total_item_amount.toFixed(2)
        };

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setCurrentItem({
            sku: '',
            description: '',
            quantity: 1,
            unit_price: 0,
            gst_rate: 18
        });
        toast.success('Item added');
    };

    const removeItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
        toast.info('Item removed');
    };

    useEffect(() => {
        if (user?.merchant_id) {
            fetchInvoices();
        }
    }, [user]);

    const fetchInvoices = async () => {
        try {
            const response = await invoiceService.getInvoices(user?.merchant_id);
            setInvoices(response.data.invoices || []);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Failed to fetch invoices');
        }
    };

    const handleViewDetails = async (invoice) => {
        try {
            const response = await invoiceService.getInvoice(invoice.id);
            if (response.data.success) {
                setSelectedInvoice(response.data.invoice);
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching invoice details:', error);
            toast.error('Failed to fetch invoice details');
        }
    };

    const handleAction = async (action) => {
        if (!selectedInvoice) return;
        try {
            await invoiceService.performAction(selectedInvoice.id, action, action === 'REJECT' ? 'Rejected by user' : '');
            toast.success(`Invoice ${action === 'ACCEPT' ? 'accepted' : 'rejected'} successfully!`);
            setShowModal(false);
            fetchInvoices();
        } catch (error) {
            console.error(`Error performing ${action}:`, error);
            toast.error(`Failed to ${action.toLowerCase()} invoice`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!user?.merchant_id) {
            toast.error("User merchant ID not found. Please relogin.");
            setLoading(false);
            return;
        }

        try {
            const data = new FormData();

            // Append basic fields
            data.append('invoice_number', formData.invoice_number);
            data.append('seller_merchant_id', user.merchant_id); // Use logged-in user's ID
            data.append('buyer_gstin', formData.buyer_gstin);
            data.append('invoice_date', formData.invoice_date);
            data.append('due_date', formData.due_date);

            // Append calculated totals
            data.append('total_amount', calculatedTotals.total_amount.toFixed(2));
            data.append('tax_amount', calculatedTotals.tax_amount.toFixed(2));

            // Append items
            data.append('items', JSON.stringify(formData.items));

            if (file) {
                data.append('file', file);
            }

            const response = await invoiceService.createInvoice(data);
            const invoice = response.data.invoice;
            let warningMessage = '';

            // Register on Blockchain
            try {
                await blockchainService.registerInvoice({
                    invoiceId: invoice.id,
                    hash: invoice.file_hash,
                    amount: invoice.total_amount,
                    seller: invoice.seller_merchant_id,
                    buyer: invoice.buyer_gstin
                });
            } catch (err) {
                console.error('Blockchain registration failed:', err);
                warningMessage += ' Blockchain registration failed.';
            }

            // Generate E-Invoice
            try {
                await gstAdapterService.generateEInvoice({
                    invoice_number: invoice.invoice_number,
                    seller_gstin: user.gstin || '29ABCDE1234F1Z5', // Use user's GSTIN or fallback
                    buyer_gstin: invoice.buyer_gstin,
                    total_amount: invoice.total_amount,
                    invoice_date: invoice.invoice_date
                });
            } catch (err) {
                console.error('E-Invoice generation failed:', err);
                warningMessage += ' E-Invoice generation failed.';
            }

            if (warningMessage) {
                toast.warning(`Invoice created, but:${warningMessage}`);
            } else {
                toast.success('Invoice created successfully!');
            }

            setShowCreateForm(false);
            fetchInvoices();

            // Reset form
            setFormData({
                invoice_number: '',
                buyer_gstin: '',
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: '',
                items: [],
            });
            setFile(null);

        } catch (error) {
            console.error('Error creating invoice:', error);
            toast.error('Failed to create invoice: ' + (error.response?.data?.error || error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const generateInvoiceNumber = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const newNumber = `INV-${year}${month}${day}-${random}`;
        setFormData(prev => ({ ...prev, invoice_number: newNumber }));
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
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="text"
                                        name="invoice_number"
                                        value={formData.invoice_number}
                                        onChange={handleInputChange}
                                        className={`flex-1 min-w-0 block w-full rounded-none rounded-l-md sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={generateInvoiceNumber}
                                        className={`inline-flex items-center px-3 rounded-r-md border border-l-0 ${darkMode ? 'bg-slate-600 border-slate-600 text-slate-200 hover:bg-slate-500' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'} sm:text-sm`}
                                    >
                                        Auto-Gen
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Buyer GSTIN</label>
                                <input
                                    type="text"
                                    name="buyer_gstin"
                                    value={formData.buyer_gstin}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                    placeholder="15-digit GSTIN"
                                    maxLength={15}
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
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Due Date</label>
                                <input
                                    type="date"
                                    name="due_date"
                                    value={formData.due_date}
                                    onChange={handleInputChange}
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    required
                                />
                            </div>

                            {/* Calculated Totals Display */}
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Total Amount (Auto-calculated)</label>
                                <div className={`mt-1 block w-full py-2 px-3 rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                    ₹{calculatedTotals.total_amount.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tax Amount (Auto-calculated)</label>
                                <div className={`mt-1 block w-full py-2 px-3 rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                    ₹{calculatedTotals.tax_amount.toFixed(2)}
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className="sm:col-span-2 space-y-4">
                                <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Items</h3>
                                <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gray-50'} space-y-4`}>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6 items-end">
                                        <div className="sm:col-span-1">
                                            <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>SKU</label>
                                            <input
                                                type="text"
                                                name="sku"
                                                value={currentItem.sku}
                                                onChange={handleItemChange}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'border-gray-300'} focus:ring-indigo-500 focus:border-indigo-500`}
                                                placeholder="SKU-001"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Description</label>
                                            <input
                                                type="text"
                                                name="description"
                                                value={currentItem.description}
                                                onChange={handleItemChange}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'border-gray-300'} focus:ring-indigo-500 focus:border-indigo-500`}
                                                placeholder="Item description"
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Qty</label>
                                            <input
                                                type="number"
                                                name="quantity"
                                                value={currentItem.quantity}
                                                onChange={handleItemChange}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'border-gray-300'} focus:ring-indigo-500 focus:border-indigo-500`}
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Price</label>
                                            <input
                                                type="number"
                                                name="unit_price"
                                                value={currentItem.unit_price}
                                                onChange={handleItemChange}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'border-gray-300'} focus:ring-indigo-500 focus:border-indigo-500`}
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>GST %</label>
                                            <input
                                                type="number"
                                                name="gst_rate"
                                                value={currentItem.gst_rate}
                                                onChange={handleItemChange}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'border-gray-300'} focus:ring-indigo-500 focus:border-indigo-500`}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            Add Item
                                        </button>
                                    </div>
                                </div>

                                {formData.items.length > 0 && (
                                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                        <table className={`min-w-full divide-y ${darkMode ? 'divide-slate-600' : 'divide-gray-300'}`}>
                                            <thead className={darkMode ? 'bg-slate-800' : 'bg-gray-50'}>
                                                <tr>
                                                    <th scope="col" className={`py-3.5 pl-4 pr-3 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} sm:pl-6`}>SKU</th>
                                                    <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Description</th>
                                                    <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Qty</th>
                                                    <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Price</th>
                                                    <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>GST</th>
                                                    <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Total</th>
                                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                                        <span className="sr-only">Remove</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className={`divide-y ${darkMode ? 'divide-slate-700 bg-slate-800' : 'divide-gray-200 bg-white'}`}>
                                                {formData.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className={`whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'} sm:pl-6`}>{item.sku}</td>
                                                        <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.description}</td>
                                                        <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.quantity}</td>
                                                        <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>₹{item.unit_price}</td>
                                                        <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.gst_rate}%</td>
                                                        <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>₹{item.total_item_amount.toFixed(2)}</td>
                                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(index)}
                                                                className="text-red-600 hover:text-red-900"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
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
                </div >
            )
            }

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
            {
                showModal && selectedInvoice && (
                    <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={() => setShowModal(false)}></div>

                        {/* Modal Panel Container */}
                        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                                <div className={`relative transform overflow-hidden rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-white'} text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl`}>
                                    <div className={`${darkMode ? 'bg-slate-900' : 'bg-gray-50'} px-6 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                                        <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                            Invoice Details: {selectedInvoice.invoice_number}
                                        </h3>
                                    </div>
                                    <div className="px-6 py-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Seller ID</p>
                                                <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInvoice.seller_merchant_id}</p>
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Buyer ID</p>
                                                <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInvoice.buyer_gstin}</p>
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
                                                <p className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{selectedInvoice.tax_amount || '0.00'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>File Hash</p>
                                                <p className={`text-xs font-mono break-all ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>{selectedInvoice.file_hash || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`${darkMode ? 'bg-slate-900' : 'bg-gray-50'} px-6 py-4 flex justify-end space-x-3`}>
                                        {selectedInvoice.status === 'ISSUED' && (
                                            <>
                                                <button
                                                    onClick={() => handleAction('ACCEPT')}
                                                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-semibold"
                                                >
                                                    Accept Invoice
                                                </button>
                                                <button
                                                    onClick={() => handleAction('REJECT')}
                                                    className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors font-semibold"
                                                >
                                                    Reject Invoice
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className={`${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${darkMode ? 'text-white' : 'text-slate-700'} px-6 py-2 rounded-md transition-colors font-semibold`}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
