import { useState } from 'react';
import { X, Wallet, Shield, CheckCircle, ExternalLink, RefreshCw, Key, Globe } from 'lucide-react';
import { SEPOLIA_CONTRACT_ADDRESS } from '../lib/web3Config.js';
import { shortHash } from '../lib/api.js';

export default function WalletModal({
  isOpen,
  onClose,
  walletState,
  setWalletState,
  signingMode,
  setSigningMode,
}) {
  const [connecting, setConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setWalletState({
        connected: true,
        address: '0x71C6634C25317bB832dbb8382c753fA7B20',
        network: 'Ethereum Sepolia (ChainID: 11155111)',
        balance: '1.450 SepoliaETH',
      });
      setConnecting(false);
    }, 500);
  };

  const handleDisconnect = () => {
    setWalletState({
      connected: false,
      address: null,
      network: null,
      balance: null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Ethereum Wallet & Signing</h3>
              <p className="text-[11px] text-slate-500">Manage blockchain anchor permissions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Signing Mode Selector */}
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Receipt Signing Architecture
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSigningMode('server')}
              className={`rounded-lg border p-2.5 text-left transition ${
                signingMode === 'server'
                  ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold">Server-Signed</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Automated 1-click release (Default)</div>
            </button>

            <button
              type="button"
              onClick={() => setSigningMode('wallet')}
              className={`rounded-lg border p-2.5 text-left transition ${
                signingMode === 'wallet'
                  ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold">Wallet-Signed</div>
              <div className="text-[10px] text-slate-500 mt-0.5">MetaMask popup on stage (Demo flourish)</div>
            </button>
          </div>
        </div>

        {/* Wallet Connection Status */}
        <div className="mt-4 space-y-3">
          {walletState.connected ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Wallet Active</span>
                </span>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  {walletState.network}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-500">Account: </span>
                  <span className="mono font-semibold text-slate-200">{walletState.address}</span>
                </div>
                <div>
                  <span className="text-slate-500">Balance: </span>
                  <span className="mono text-slate-300">{walletState.balance}</span>
                </div>
                <div className="pt-1">
                  <span className="text-slate-500">DecryptionProvenance Contract: </span>
                  <div className="mono text-cyan-400 text-[11px] truncate">
                    {SEPOLIA_CONTRACT_ADDRESS}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400 hover:text-rose-400"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5 text-center space-y-3">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">No Web3 Wallet Connected</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Connect MetaMask to sign transactions on the Ethereum Sepolia testnet.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {connecting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                <span>Connect MetaMask Wallet</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
