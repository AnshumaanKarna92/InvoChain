import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Notifications() {
    const { user } = useAuth();
    const { darkMode } = useDarkMode();
    const toast = useToast();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchNotifications();
        } else {
            setLoading(false);
        }
    }, [user?.merchant_id]);

    const fetchNotifications = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[Notifications] Fetching for merchant:', user?.merchant_id);
            const response = await axios.get(`${API_URL}/notifications`, {
                params: { merchant_id: user?.merchant_id }
            });
            console.log('[Notifications] Response:', response.data);
            setNotifications(response.data.notifications || []);
            setUnreadCount(response.data.unread_count || 0);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError(err.response?.data?.error || err.message || 'Failed to load notifications');
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await axios.patch(`${API_URL}/notifications/${id}/read`);
            // Update UI
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            ));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await axios.patch(`${API_URL}/notifications/read-all`, {
                merchant_id: user.merchant_id
            });
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        }
    };

    const handleNotificationClick = (notification) => {
        // Mark as read
        if (!notification.is_read) {
            markAsRead(notification.id);
        }

        // Navigate to invoice if it exists
        if (notification.invoice_id) {
            navigate(`/invoices`);
        }
    };

    const getNotificationIcon = (type) => {
        const iconMap = {
            INVOICE_RECEIVED: (
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            INVOICE_ACCEPTED: (
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            INVOICE_REJECTED: (
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            INVOICE_PAID: (
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
            ),
            PAYMENT_RECORDED: (
                <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            PAYMENT_CONFIRMED: (
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        };
        return iconMap[type] || (
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
        );
    };

    const getNotificationColor = (type, darkMode) => {
        const colors = {
            INVOICE_RECEIVED: darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200',
            INVOICE_ACCEPTED: darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200',
            INVOICE_REJECTED: darkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200',
            INVOICE_EDITED: darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200',
            INVOICE_PAID: darkMode ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-50 border-emerald-200',
            PAYMENT_RECORDED: darkMode ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200',
            PAYMENT_CONFIRMED: darkMode ? 'bg-teal-900/30 border-teal-700' : 'bg-teal-50 border-teal-200',
        };
        return colors[type] || (darkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? 'border-blue-500' : 'border-indigo-600'}`}></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-6 sm:px-0">
                <div className={`p-8 text-center rounded-lg border ${darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}`}>
                    <svg className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-red-400' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        Failed to Load Notifications
                    </h3>
                    <p className={`text-sm mb-4 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                        {error}
                    </p>
                    <button
                        onClick={fetchNotifications}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                    >
                        Mark All as Read
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {notifications.length === 0 ? (
                    <div className={`p-12 text-center rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="text-6xl mb-4">🔔</div>
                        <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            No Notifications
                        </h3>
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            You're all caught up! New notifications will appear here.
                        </p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`
                                p-4 rounded-lg border cursor-pointer transition-all
                                ${getNotificationColor(notification.type, darkMode)}
                                ${!notification.is_read ? 'shadow-md' : 'opacity-75'}
                                hover:shadow-lg hover:scale-[1.01]
                            `}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-slate-700' : 'bg-white'} shadow-sm`}>
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                            {notification.title}
                                            {!notification.is_read && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                                                    New
                                                </span>
                                            )}
                                        </h3>
                                        <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {new Date(notification.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {notification.message}
                                    </p>
                                    {notification.invoice_number && (
                                        <div className={`mt-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            Invoice: <span className="font-mono">{notification.invoice_number}</span>
                                            {notification.invoice_status && (
                                                <span className="ml-2">
                                                    Status: <span className="font-medium">{notification.invoice_status}</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
