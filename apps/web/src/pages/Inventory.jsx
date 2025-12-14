import { useState, useEffect } from 'react';
import { inventoryService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function Inventory() {
    const { user } = useAuth();
    const { darkMode } = useDarkMode();
    const toast = useToast();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        sku: '',
        name: '',
        quantity_change: '',
        unit_price: '',
        type: 'ADD'
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchInventory();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchInventory = async () => {
        setError(null);
        setLoading(true);
        try {
            console.log('[Inventory] Fetching for merchant:', user?.merchant_id);
            const response = await inventoryService.getInventory(user.merchant_id);
            console.log('[Inventory] Response:', response.data);
            if (response.data.success) {
                setInventory(response.data.inventory || []);
            } else {
                setError(response.data.error || 'Failed to load inventory');
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
            setError('Failed to load inventory: ' + errorMessage);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Submitting inventory adjustment...', formData);

        if (!user?.merchant_id) {
            console.error('No merchant_id found for user');
            toast.error('User not authenticated correctly');
            return;
        }

        const qty = parseFloat(formData.quantity_change);
        const price = parseFloat(formData.unit_price);

        if (isNaN(qty) || isNaN(price)) {
            toast.error('Invalid quantity or price');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                merchant_id: user.merchant_id,
                ...formData,
                quantity_change: qty,
                unit_price: price
            };
            console.log('Sending payload:', payload);

            const response = await inventoryService.adjustStock(payload);
            console.log('Inventory response:', response.data);

            toast.success('Inventory updated successfully');
            setIsModalOpen(false);
            setFormData({ sku: '', name: '', quantity_change: '', unit_price: '', type: 'ADD' });
            fetchInventory();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            toast.error('Failed to update inventory: ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? 'border-blue-500' : 'border-indigo-600'}`}></div>
            </div>
        );
    }

    if (!user?.merchant_id) {
        return (
            <div className="px-4 py-6 sm:px-0">
                <div className={`p-6 rounded-lg ${darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border`}>
                    <p className={`text-sm ${darkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
                        User not authenticated. Please log in to manage inventory.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-6 sm:px-0">
                <div className={`p-6 rounded-lg ${darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'} border`}>
                    <p className={`text-sm ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
                        {error}
                    </p>
                    <button
                        onClick={fetchInventory}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <div></div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'} transition-colors`}
                >
                    Add New Item
                </button>
            </div>

            <div className={`shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg overflow-hidden ${darkMode ? 'bg-slate-800 ring-slate-700' : 'bg-white'}`}>
                <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-700">
                    <thead className={darkMode ? 'bg-slate-900' : 'bg-gray-50'}>
                        <tr>
                            <th scope="col" className={`py-3.5 pl-4 pr-3 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} sm:pl-6`}>SKU</th>
                            <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Name</th>
                            <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Unit Price</th>
                            <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Available Qty</th>
                            <th scope="col" className={`px-3 py-3.5 text-left text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Reserved</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y divide-gray-200 dark:divide-slate-700 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                        {inventory.map((item) => (
                            <tr key={item.id}>
                                <td className={`whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'} sm:pl-6`}>{item.sku}</td>
                                <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.name}</td>
                                <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>₹{item.unit_price}</td>
                                <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{item.quantity}</td>
                                <td className={`whitespace-nowrap px-3 py-4 text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{item.reserved_quantity}</td>
                            </tr>
                        ))}
                        {inventory.length === 0 && (
                            <tr>
                                <td colSpan="5" className={`px-3 py-8 text-center text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                    No items in inventory
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Item Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] overflow-y-auto"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    aria-labelledby="modal-title"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
                        <div
                            className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
                            aria-hidden="true"
                            onClick={() => setIsModalOpen(false)}
                        ></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className={`relative inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                            <div className={`px-4 pt-5 pb-4 sm:p-6 sm:pb-4`}>
                                <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`} id="modal-title">
                                    Add New Item
                                </h3>
                                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                                    <div>
                                        <label htmlFor="sku" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>SKU</label>
                                        <input
                                            type="text"
                                            name="sku"
                                            id="sku"
                                            required
                                            value={formData.sku}
                                            onChange={handleInputChange}
                                            className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm p-2 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="name" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            id="name"
                                            required
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm p-2 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="quantity_change" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Quantity</label>
                                            <input
                                                type="number"
                                                name="quantity_change"
                                                id="quantity_change"
                                                required
                                                min="0"
                                                value={formData.quantity_change}
                                                onChange={handleInputChange}
                                                className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm p-2 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none`}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="unit_price" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Unit Price</label>
                                            <input
                                                type="number"
                                                name="unit_price"
                                                id="unit_price"
                                                required
                                                min="0"
                                                value={formData.unit_price}
                                                onChange={handleInputChange}
                                                className={`mt-1 block w-full rounded-md border shadow-sm sm:text-sm p-2 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none`}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:flow-row-dense">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm ${submitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                        >
                                            {submitting ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Saving...
                                                </>
                                            ) : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className={`mt-3 w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:mt-0 sm:col-start-1 sm:text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
