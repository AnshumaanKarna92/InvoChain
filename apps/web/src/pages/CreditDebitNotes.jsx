import { useState, useEffect } from 'react';
import { noteService } from '../services/api';

export default function CreditDebitNotes() {
    const [notes, setNotes] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'CREDIT',
        invoice_id: '',
        amount: '',
        reason: '',
    });

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const response = await noteService.getAllNotes();
            setNotes(response.data.notes || []);
        } catch (error) {
            console.error('Error fetching notes:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (formData.type === 'CREDIT') {
                await noteService.createCreditNote(formData);
            } else {
                await noteService.createDebitNote(formData);
            }

            alert(`${formData.type} Note created successfully!`);
            setShowCreateForm(false);
            setFormData({ type: 'CREDIT', invoice_id: '', amount: '', reason: '' });
            fetchNotes();
        } catch (error) {
            console.error('Error creating note:', error);
            alert('Failed to create note');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Credit/Debit Notes</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700"
                >
                    {showCreateForm ? 'Cancel' : 'Create Note'}
                </button>
            </div>

            {showCreateForm && (
                <div className="bg-white shadow sm:rounded-lg mb-6">
                    <div className="px-4 py-5 sm:p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Note</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="CREDIT">Credit Note</option>
                                        <option value="DEBIT">Debit Note</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Original Invoice ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.invoice_id}
                                        onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.reason}
                                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-indigo-600 px-4 py-2 rounded-md text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h2 className="text-lg font-medium text-gray-900">Notes History</h2>
                </div>
                <div className="border-t border-gray-200">
                    {notes.length === 0 ? (
                        <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                            No credit/debit notes created yet.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {notes.map((note) => (
                                    <tr key={note.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{note.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${note.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {note.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{note.invoice_id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{note.amount}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{note.reason}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(note.created_at).toLocaleDateString()}</td>
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
