import { useEffect } from 'react';
import { useDarkMode } from '../context/ThemeContext';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
    const { darkMode } = useDarkMode();

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    bg: darkMode ? 'bg-green-900/90 border-green-700' : 'bg-green-50 border-green-200',
                    text: darkMode ? 'text-green-200' : 'text-green-800',
                    icon: (
                        <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    )
                };
            case 'error':
                return {
                    bg: darkMode ? 'bg-red-900/90 border-red-700' : 'bg-red-50 border-red-200',
                    text: darkMode ? 'text-red-200' : 'text-red-800',
                    icon: (
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )
                };
            case 'warning':
                return {
                    bg: darkMode ? 'bg-yellow-900/90 border-yellow-700' : 'bg-yellow-50 border-yellow-200',
                    text: darkMode ? 'text-yellow-200' : 'text-yellow-800',
                    icon: (
                        <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )
                };
            case 'info':
            default:
                return {
                    bg: darkMode ? 'bg-blue-900/90 border-blue-700' : 'bg-blue-50 border-blue-200',
                    text: darkMode ? 'text-blue-200' : 'text-blue-800',
                    icon: (
                        <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )
                };
        }
    };

    const styles = getTypeStyles();

    return (
        <div className={`${styles.bg} border ${styles.text} px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm flex items-center space-x-3 min-w-[300px] max-w-md animate-slide-in`}>
            <div className="flex-shrink-0">
                {styles.icon}
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium">{message}</p>
            </div>
            <button
                onClick={onClose}
                className={`flex-shrink-0 ${styles.text} hover:opacity-70 transition-opacity`}
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
