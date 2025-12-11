import { useState, useEffect } from 'react';
import { notificationService, buyerActionService, invoiceService } from '../services/api';
import { useDarkMode } from '../App';

export default function Notifications() {
    const { darkMode } = useDarkMode();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await notificationService.getNotifications();
            // Sort by timestamp desc
            const sorted = (response.data.notifications || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setNotifications(sorted);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const handleAction = async (notification, action, reason = '') => {
        if (!notification.metadata || !notification.metadata.invoiceId) return;

        const { invoiceId } = notification.metadata;
        setLoading(true);

        try {
            if (action === 'ACCEPT') {
                await buyerActionService.acceptInvoice(invoiceId);
                // Optionally update invoice status directly if backend doesn't do it
                await invoiceService.updateInvoiceStatus(invoiceId, 'ACCEPTED');
                alert('Invoice accepted successfully');
            } else if (action === 'REJECT') {
                const rejectReason = prompt('Enter reason for rejection:', 'Incorrect amount');
                if (!rejectReason) {
                    setLoading(false);
                    return;
                }
                await buyerActionService.rejectInvoice(invoiceId, rejectReason);
                await invoiceService.updateInvoiceStatus(invoiceId, 'REJECTED');
                alert('Invoice rejected');
            } else if (action === 'REQUEST_EDIT') {
                const editReason = prompt('What needs to be edited?', 'Wrong tax rate');
                if (!editReason) {
                    setLoading(false);
                    return;
                }
                // We can use reject or a specific endpoint. For now, let's use a notification back to seller
                await notificationService.sendNotification({
                    recipient: notification.metadata.sellerId || 'SELLER',
                    type: 'SYSTEM',
                    subject: `Edit Requested for Invoice ${invoiceId}`,
                    message: `Buyer requested edit: ${editReason}`,
                    metadata: { invoiceId, type: 'EDIT_REQUEST' }
                });
                alert('Edit request sent to seller');
            }

            // Mark notification as read or handled (locally for now as backend doesn't support it)
            // In a real app, we'd call an endpoint to mark as read.
            fetchNotifications();
        } catch (error) {
            console.error('Error performing action:', error);
            alert('Failed to perform action');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'} mb-6`}>Notifications & Approvals</h1>

            <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow overflow-hidden sm:rounded-lg border`}>
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                    {notifications.length === 0 ? (
                        <div className={`p-6 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            No notifications found.
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div key={notif.id} className={`p-6 ${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} transition-colors`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center mb-1">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${notif.type === 'ALERT' ? 'bg-red-100 text-red-800' :
                                                    notif.type === 'ACTION_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-blue-100 text-blue-800'
                                                } mr-3`}>
                                                {notif.type}
                                            </span>
                                            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {new Date(notif.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                                            {notif.subject}
                                        </h3>
                                        <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'} mb-4`}>
                                            {notif.message}
                                        </p>

                                        {/* Action Buttons for Invoice Approvals */}
                                        {notif.metadata && notif.metadata.type === 'INVOICE_APPROVAL' && (
                                            <div className="flex space-x-3 mt-3">
                                                <button
                                                    onClick={() => handleAction(notif, 'ACCEPT')}
                                                    disabled={loading}
                                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleAction(notif, 'REJECT')}
                                                    disabled={loading}
                                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleAction(notif, 'REQUEST_EDIT')}
                                                    disabled={loading}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-slate-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                                >
                                                    Request Edit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
