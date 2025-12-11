import { useState, createContext, useContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Reconciliation from './pages/Reconciliation';
import GSTReturns from './pages/GSTReturns';
import EInvoice from './pages/EInvoice';
import CreditDebitNotes from './pages/CreditDebitNotes';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';
import Register from './pages/Register';
import Login from './pages/Login';
import { ToastProvider } from './context/ToastContext';

import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import { config } from './wagmi';

const queryClient = new QueryClient();

// Dark Mode Context
const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
};

// Auth Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

function Navigation() {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const navLinkClass = (path) => `
    ${isActive(path)
      ? darkMode
        ? 'text-white border-b-2 border-white'
        : 'text-slate-900 border-b-2 border-slate-900'
      : darkMode
        ? 'text-slate-400 hover:text-white border-b-2 border-transparent'
        : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent'
    } px-4 h-16 flex items-center text-sm font-medium transition-all duration-200
  `;

  // Don't show navigation on login/register pages
  if (['/login', '/register'].includes(location.pathname)) {
    return null;
  }

  return (
    <nav className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-b transition-colors duration-200`}>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-15">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${darkMode ? 'bg-white' : 'bg-slate-900'} rounded flex items-center justify-center transition-colors duration-200`}>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-slate-900' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight transition-colors duration-200`}>
                  InvoChain
                </span>
              </Link>
            </div>
            {user && (
              <div className="hidden sm:ml-12 sm:flex sm:space-x-1">
                <Link to="/" className={navLinkClass('/')}>Dashboard</Link>
                <Link to="/invoices" className={navLinkClass('/invoices')}>Invoices</Link>
                <Link to="/reconciliation" className={navLinkClass('/reconciliation')}>Reconciliation</Link>
                <Link to="/gst-returns" className={navLinkClass('/gst-returns')}>GST Returns</Link>
                <Link to="/e-invoice" className={navLinkClass('/e-invoice')}>E-Invoice</Link>
                <Link to="/notes" className={navLinkClass('/notes')}>Notes</Link>
                <Link to="/payments" className={navLinkClass('/payments')}>Payments</Link>
              </div>
            )}
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {user && (
              <>
                {/* Notification Icon */}
                <Link to="/notifications" className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'} transition-all duration-200 relative`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </Link>

                {/* User Info */}
                <div className={`hidden md:flex items-center space-x-3 px-3 py-1.5 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div className="text-right">
                    <p className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {user.businessName || 'User'}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      {user.gstin || 'No GSTIN'}
                    </p>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} transition-all duration-200`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-5 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <ConnectButton />

            {user && (
              <button
                onClick={logout}
                className={`ml-1 px-5 py-1 rounded-lg text-sm font-medium transition-colors ${darkMode
                  ? 'bg-red-600 hover:bg-red-900 text-white'
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
                  }`}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function MainContent() {
  const { darkMode } = useDarkMode();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className={`min-h-screen ${darkMode ? 'bg-slate-950' : 'bg-slate-50'} transition-colors duration-200 relative overflow-hidden`}>
      {/* Global Cursor Following Gradient Effect */}
      <div
        className="pointer-events-none fixed inset-0 transition-opacity duration-300 z-0"
        style={{
          background: darkMode
            ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`
            : `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.1), transparent 40%)`,
        }}
      />

      {/* Global Animated Background Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${darkMode ? 'bg-blue-500/10' : 'bg-indigo-200/30'} rounded-full blur-3xl animate-pulse`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${darkMode ? 'bg-purple-500/10' : 'bg-purple-200/30'} rounded-full blur-3xl animate-pulse`} style={{ animationDelay: '1s' }}></div>
        <div className={`absolute top-1/2 right-1/3 w-80 h-80 ${darkMode ? 'bg-cyan-500/10' : 'bg-cyan-200/25'} rounded-full blur-3xl animate-pulse`} style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10">
        <Navigation />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
            <Route path="/gst-returns" element={<ProtectedRoute><GSTReturns /></ProtectedRoute>} />
            <Route path="/e-invoice" element={<ProtectedRoute><EInvoice /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><CreditDebitNotes /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Remove the useEffect that was setting user, as we now do it in initial state
  // useEffect(() => {
  //   const storedUser = localStorage.getItem('user');
  //   if (storedUser) {
  //     setUser(JSON.parse(storedUser));
  //   }
  // }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <AuthContext.Provider value={{ user, setUser, logout }}>
        <ToastProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
                <Router>
                  <MainContent />
                </Router>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </ToastProvider>
      </AuthContext.Provider>
    </DarkModeContext.Provider>
  );
}

export default App;
