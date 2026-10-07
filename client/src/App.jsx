import React, { useState, useEffect } from 'react';
import { Car, LayoutGrid, Trophy, Sliders, Vault, RefreshCw, Sparkles, Activity } from 'lucide-react';
import axios from 'axios';

import IntakeForm from './components/IntakeForm';
import BayGrid from './components/BayGrid';
import CheckoutModal from './components/CheckoutModal';
import SettingsToggle from './components/SettingsToggle';
import Leaderboard from './components/Leaderboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('intake'); // 'intake' | 'bays' | 'leaderboard' | 'settings'
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [vaultBalance, setVaultBalance] = useState({ cash: 0, bank: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync Ledger Balances for Top Bar
  const syncLedger = async () => {
    setIsSyncing(true);
    try {
      const res = await axios.get('/api/ledger');
      if (res.data?.data) {
        const cashAcct = res.data.data.find((a) => a.account_type === 'Cash_Drawer');
        const bankAcct = res.data.data.find((a) => a.account_type === 'Main_Bank');
        setVaultBalance({
          cash: parseFloat(cashAcct?.current_balance || 0),
          bank: parseFloat(bankAcct?.current_balance || 0),
        });
      }
    } catch (err) {
      console.warn('Ledger top bar sync notice:', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncLedger();
    const interval = setInterval(syncLedger, 15000); // 15s poll
    return () => clearInterval(interval);
  }, []);

  const handleJobCreated = () => {
    syncLedger();
    // Auto-switch to Bays to watch new vehicle progress
    setActiveTab('bays');
  };

  const handleCheckoutSuccess = () => {
    syncLedger();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header & Live Financial Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
              AUTOWASH POS
              <span className="text-[10px] font-mono bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800 uppercase">
                Phase 3 Terminal
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Local-First Car Wash & Detailing Management</p>
          </div>
        </div>

        {/* Live Vault Balance Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-inner">
            <Vault className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cash Drawer Vault</span>
              <span className="font-mono text-sm font-black text-emerald-400">
                Rs. {vaultBalance.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-inner hidden md:flex">
            <Activity className="w-4 h-4 text-sky-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank Vault</span>
              <span className="font-mono text-sm font-black text-sky-300">
                Rs. {vaultBalance.bank.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <button
            onClick={syncLedger}
            title="Refresh Vault Balances"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-8 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('intake')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
              activeTab === 'intake'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Car className="w-4 h-4" />
            1. Intake & POS
          </button>

          <button
            onClick={() => setActiveTab('bays')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
              activeTab === 'bays'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            2. Active Bays
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Trophy className="w-4 h-4" />
            3. Staff Leaderboard
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            4. System Settings
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
        {activeTab === 'intake' && <IntakeForm onJobCreated={handleJobCreated} />}
        {activeTab === 'bays' && <BayGrid onCheckoutTrigger={(card) => setCheckoutTarget(card)} />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'settings' && <SettingsToggle />}
      </main>

      {/* Cashier Checkout Modal */}
      {checkoutTarget && (
        <CheckoutModal
          jobCard={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onCheckoutSuccess={(data) => {
            handleCheckoutSuccess();
          }}
        />
      )}
    </div>
  );
}
