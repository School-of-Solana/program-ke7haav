import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import TaskManager from './components/TaskManager';
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

function App() {
  // Using Devnet for testing
  const network = WalletAdapterNetwork.Devnet;
  
  // Allow custom RPC endpoint via environment variable (e.g., QuickNode)
  // Set VITE_SOLANA_RPC_URL in .env file or use default
  const endpoint = useMemo(() => {
    // Check for custom RPC URL (e.g., QuickNode)
    const customRpc = import.meta.env.VITE_SOLANA_RPC_URL;
    if (customRpc) {
      console.log('Using custom RPC endpoint:', customRpc);
      return customRpc;
    }
    // Fallback to default Devnet endpoint
    return clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(
    () => {
      const walletAdapters = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];
      // Filter to ensure unique wallets by name
      const uniqueWallets = walletAdapters.filter((wallet, index, self) =>
        index === self.findIndex((w) => w.name === wallet.name)
      );
      return uniqueWallets;
    },
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app">
            <header className="app-header">
              <h1>📋 Task Manager</h1>
              <p>Manage your tasks on Solana</p>
            </header>
            <main className="app-main">
              <TaskManager />
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;

