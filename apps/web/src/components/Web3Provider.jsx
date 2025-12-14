import { useState, useEffect, Component } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { config } from '../wagmi';

const queryClient = new QueryClient();

// Placeholder connect button when Web3 is disabled or errored
export const PlaceholderConnectButton = () => (
    <div className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 text-slate-400 cursor-not-allowed opacity-50">
        Connect Wallet
    </div>
);

// Internal error boundary for Web3 providers
class Web3ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        console.error('Web3ErrorBoundary: Caught error', error);
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Web3 Provider Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Render children without Web3 providers
            return this.props.fallback || this.props.children;
        }
        return this.props.children;
    }
}

// Variable to track Web3 state globally
let web3Available = true;

// Check config validity upfront
try {
    if (!config || !config.chains || config.chains.length === 0) {
        console.warn('Web3Provider: Invalid wagmi config');
        web3Available = false;
    }
} catch (e) {
    console.error('Web3Provider: Config error', e);
    web3Available = false;
}

// Web3 Provider wrapper that handles errors gracefully
export function Web3Provider({ children }) {
    const [isEnabled, setIsEnabled] = useState(web3Available);

    // If Web3 is not available, just render children
    if (!isEnabled) {
        return <>{children}</>;
    }

    return (
        <Web3ErrorBoundary fallback={children}>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <RainbowKitProvider>
                        {children}
                    </RainbowKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </Web3ErrorBoundary>
    );
}

// Smart ConnectButton that handles errors
export function ConnectButton() {
    const [mounted, setMounted] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !web3Available || hasError) {
        return <PlaceholderConnectButton />;
    }

    try {
        return <RainbowConnectButton />;
    } catch (e) {
        console.error('ConnectButton render error:', e);
        setHasError(true);
        return <PlaceholderConnectButton />;
    }
}
