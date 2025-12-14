import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/ThemeContext';

export default function NotificationBell() {
    const { user } = useAuth();
    const { darkMode } = useDarkMode();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (user?.merchant_id) {
            fetchUnreadCount();
            // Poll for new notifications every 10 seconds
            const interval = setInterval(fetchUnreadCount, 10000);
            return () => clearInterval(interval);
        }
    }, [user?.merchant_id]);

    const fetchUnreadCount = async () => {
        try {
            const response = await notificationService.getNotifications(user?.merchant_id);
            setUnreadCount(response.data.unread_count || 0);
        } catch (error) {
            console.error('Error fetching notification count:', error);
        }
    };

    return (
        <Link
            to="/notifications"
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'} transition-all duration-200 relative`}
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
