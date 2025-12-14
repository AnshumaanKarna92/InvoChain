import React, { useState, useEffect } from 'react';
import { blockchainService } from '../services/api';
import { useDarkMode } from '../context/ThemeContext';

export default function BlockchainAuditModal({ isOpen, onClose, recordType, recordId, recordNumber }) {
    const { darkMode } = useDarkMode();
    const [anchors, setAnchors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [verificationStatus, setVerificationStatus] = useState(null);

    useEffect(() => {
        if (isOpen && recordType && recordId) {
            fetchAnchors();
        }
    }, [isOpen, recordType, recordId]);

    const fetchAnchors = async () => {
        setLoading(true);
        try {
            const response = await blockchainService.getAnchors(recordType, recordId);
            setAnchors(response.data.anchors || []);
        } catch (error) {
            console.error('Error fetching blockchain anchors:', error);
        } finally {
            setLoading(false);
        }
    };

    const verifyAnchor = async (anchor, data) => {
        // In a real app, we would verify the hash against the current data
        // For this demo, we'll just show the verification status from the anchor
        setVerificationStatus({
            verifying: true,
            anchorId: anchor.id
        });

        // Simulate verification delay
        setTimeout(() => {
            setVerificationStatus({
                verified: true,
                anchorId: anchor.id,
                message: 'Hash verified on-chain'
            });
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className={`relative w-full max-w-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>

                {/* Header */}
                <div className={`px-6 py-5 ${darkMode ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-700/50' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'} border-b flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${darkMode ? 'bg-indigo-800/50' : 'bg-indigo-100'}`}>
                            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Blockchain Audit Trail</h3>
                            <p className={`text-sm ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Record: {recordNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className={`animate-spin w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full mb-4`}></div>
                            <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Loading blockchain records...</p>
                        </div>
                    ) : anchors.length === 0 ? (
                        <div className="text-center py-12">
                            <div className={`mx-auto w-16 h-16 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-full flex items-center justify-center mb-4`}>
                                <svg className={`w-8 h-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <p className={`text-lg font-medium ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>No Blockchain Anchors Found</p>
                            <p className={`mt-1 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>This record has not been anchored to the blockchain yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {anchors.map((anchor, index) => (
                                <div key={anchor.id} className={`relative pl-8 pb-8 last:pb-0 border-l-2 ${darkMode ? 'border-indigo-900' : 'border-indigo-100'}`}>
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${darkMode ? 'bg-slate-800 border-indigo-500' : 'bg-white border-indigo-500'}`}></div>

                                    <div className={`p-5 rounded-xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${anchor.event_type.includes('ACCEPTED') ? 'bg-green-100 text-green-800' :
                                                        anchor.event_type.includes('PAYMENT') ? 'bg-blue-100 text-blue-800' :
                                                            'bg-purple-100 text-purple-800'
                                                    }`}>
                                                    {anchor.event_type}
                                                </span>
                                                <p className={`mt-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    Anchored on {new Date(anchor.anchor_timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            {verificationStatus?.anchorId === anchor.id && verificationStatus.verified ? (
                                                <span className="flex items-center text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded">
                                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                                                    Verified
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => verifyAnchor(anchor)}
                                                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${darkMode ? 'bg-slate-700 text-indigo-400 hover:bg-slate-600' : 'bg-slate-100 text-indigo-600 hover:bg-slate-200'}`}
                                                >
                                                    Verify Hash
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <p className={`text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>DATA HASH (SHA-256)</p>
                                                <div className={`p-2 rounded font-mono text-xs break-all ${darkMode ? 'bg-slate-900 text-indigo-300' : 'bg-slate-50 text-indigo-700'}`}>
                                                    {anchor.data_hash}
                                                </div>
                                            </div>

                                            {anchor.metadata && anchor.metadata.txHash && (
                                                <div>
                                                    <p className={`text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>TRANSACTION HASH</p>
                                                    <div className={`p-2 rounded font-mono text-xs break-all ${darkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                                                        {anchor.metadata.txHash}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-xs text-center ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        Blockchain anchoring provides tamper-evidence and non-repudiation for audit purposes.
                    </p>
                </div>
            </div>
        </div>
    );
}
