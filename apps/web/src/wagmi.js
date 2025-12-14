import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, sepolia } from 'wagmi/chains';

// WalletConnect Project ID - get one from https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Log warning if using placeholder
if (projectId === 'YOUR_PROJECT_ID') {
    console.warn('WalletConnect: Using placeholder project ID. Get a real one from https://cloud.walletconnect.com');
}

export const config = getDefaultConfig({
    appName: 'InvoChain',
    projectId: projectId,
    chains: [polygonAmoy, sepolia],
    ssr: false,
});
