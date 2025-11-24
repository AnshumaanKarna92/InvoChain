import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'InvoChain',
    projectId: 'YOUR_PROJECT_ID', // TODO: Get a project ID from https://cloud.walletconnect.com
    chains: [polygonAmoy, sepolia],
    ssr: false,
});
