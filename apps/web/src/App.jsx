import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Reconciliation from './pages/Reconciliation';
import GSTReturns from './pages/GSTReturns';
import EInvoice from './pages/EInvoice';
import CreditDebitNotes from './pages/CreditDebitNotes';
import Payments from './pages/Payments';

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

function Navigation() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navLinkClass = (path) => `
    ${isActive(path)
      ? 'border-indigo-500 text-gray-900'
      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
  `;

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl font-bold text-indigo-600">
                InvoChain
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link to="/" className={navLinkClass('/')}>
                Dashboard
              </Link>
              <Link to="/invoices" className={navLinkClass('/invoices')}>
                Invoices
              </Link>
              <Link to="/reconciliation" className={navLinkClass('/reconciliation')}>
                Reconciliation
              </Link>
              <Link to="/gst-returns" className={navLinkClass('/gst-returns')}>
                GST Returns
              </Link>
              <Link to="/e-invoice" className={navLinkClass('/e-invoice')}>
                E-Invoice
              </Link>
              <Link to="/notes" className={navLinkClass('/notes')}>
                Credit/Debit Notes
              </Link>
              <Link to="/payments" className={navLinkClass('/payments')}>
                Payments
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Navigation />
              <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/reconciliation" element={<Reconciliation />} />
                  <Route path="/gst-returns" element={<GSTReturns />} />
                  <Route path="/e-invoice" element={<EInvoice />} />
                  <Route path="/notes" element={<CreditDebitNotes />} />
                  <Route path="/payments" element={<Payments />} />
                </Routes>
              </main>
            </div>
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
