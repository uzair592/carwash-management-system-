import React, { useState, useEffect } from 'react';
import {
  Car,
  Layers,
  Receipt,
  Trophy,
  Sliders,
  Vault,
  RefreshCw,
  Activity,
  Eye,
  ShieldCheck,
  Clock,
  Sparkles,
  Lock,
  Unlock,
  Coins,
  UserCheck
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from './context/AuthContext';

import IntakeForm from './components/IntakeForm';
import PhysicalBayDashboard from './components/PhysicalBayDashboard';
import BillingQueue from './components/BillingQueue';
import CheckoutModal from './components/CheckoutModal';
import Leaderboard from './components/Leaderboard';
import InvestorDashboard from './pages/InvestorDashboard';
import AdminManagement from './pages/AdminManagement';
import RegisterModal from './components/RegisterModal';
import CloseShiftModal from './components/CloseShiftModal';

export default function App() {
  const { currentUser, switchRole, isAdmin, isManager, isCashier, ROLES } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
      return 'admin';
    }
    return 'intake';
  });
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [vaultBalance, setVaultBalance] = useState({ cash: 0, bank: 0 });
  const [readyCount, setReadyCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Register Shift Sessions state
  const [registerData, setRegisterData] = useState({ is_open: true, session: null });
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);

  // Sync Ledger, Bay Status, and Register Session
  const syncLedgerAndRegister = async () => {
    setIsSyncing(true);
    try {
      const [ledgerRes, bayRes, regRes] = await axios.all([
        axios.get('/api/ledger'),
        axios.get('/api/bays/live-status'),
        axios.get('/api/register/current'),
      ]);

      if (ledgerRes.data?.data) {
        const cashAcct = ledgerRes.data.data.find((a) => a.account_type === 'Cash_Drawer');
        const bankAcct = ledgerRes.data.data.find((a) => a.account_type === 'Main_Bank');
        setVaultBalance({
          cash: parseFloat(cashAcct?.current_balance || 0),
          bank: parseFloat(bankAcct?.current_balance || 0),
        });
      }

      if (bayRes.data?.ready_for_billing) {
        setReadyCount(bayRes.data.ready_for_billing.length);
      }
      if (bayRes.data?.queue) {
        setQueuedCount(bayRes.data.queue.length);
      }

      if (regRes.data?.data) {
        const reg = regRes.data.data;
        setRegisterData(reg);
        // If register is closed, prompt to open
        if (!reg.is_open) {
          setIsRegisterModalOpen(true);
        } else {
          setIsRegisterModalOpen(false);
        }
      }
    } catch (err) {
      console.warn('System sync notice:', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncLedgerAndRegister();
    const interval = setInterval(syncLedgerAndRegister, 8000); // 8s poll
    return () => clearInterval(interval);
  }, []);

  const handleJobCreated = () => {
    syncLedgerAndRegister();
    setActiveTab('bays');
  };

  const handleCheckoutSuccess = () => {
    syncLedgerAndRegister();
    setCheckoutTarget(null);
  };

  const handleSessionOpened = (session) => {
    setIsRegisterModalOpen(false);
    syncLedgerAndRegister();
  };

  const handleSessionClosed = (result) => {
    setIsCloseShiftModalOpen(false);
    syncLedgerAndRegister();
  };

  // Enforce Role Guards: redirect to available tab if user cannot access activeTab
  useEffect(() => {
    if (activeTab === 'investor' && !isAdmin) {
      setActiveTab('bays');
    } else if (activeTab === 'admin' && !isAdmin && !isManager) {
      setActiveTab('bays');
    } else if ((activeTab === 'intake' || activeTab === 'billing') && currentUser.role === ROLES.WORKER) {
      setActiveTab('bays');
    }
  }, [currentUser.role, activeTab, isAdmin, isManager, ROLES]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header & Financial Transparency Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
              AUTOWASH MANAGEMENT SYSTEM
              <span className="text-[10px] font-mono bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800 uppercase">
                Physical Bay MVP
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Jack 1 • Jack 2 • Detailing Center • Shift Tills &amp; Decoupled Outbox
            </p>
          </div>
        </div>

        {/* Live Vault Balance Badges & Shift Control */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Active Operator Role Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <div className="text-left">
              <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Role Access</span>
              <select
                value={currentUser.role}
                onChange={(e) => switchRole(e.target.value)}
                className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
              >
                <option value={ROLES.ADMIN} className="bg-slate-900 text-rose-300 font-bold">Admin (All Access)</option>
                <option value={ROLES.MANAGER} className="bg-slate-900 text-amber-300 font-bold">Manager (Ops & Stock)</option>
                <option value={ROLES.CASHIER} className="bg-slate-900 text-sky-300 font-bold">Cashier (POS & Till)</option>
                <option value={ROLES.WORKER} className="bg-slate-900 text-slate-300 font-bold">Worker (Floor)</option>
              </select>
            </div>
          </div>

          {/* Register Shift Status Pill */}
          {registerData.is_open ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <div className="font-mono">
                <span className="text-[10px] text-emerald-300 font-bold uppercase block">Shift Active</span>
                <span className="text-white font-extrabold text-xs">
                  Float: Rs. {Number(registerData.starting_cash || 0).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(true)}
                className="ml-1 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
              >
                Close Shift
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <div className="font-mono">
                <span className="text-[10px] text-rose-300 font-bold uppercase block">Till Closed</span>
                <span className="text-slate-400 text-xs">Shift Inactive</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="ml-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-lg transition"
              >
                Open Till
              </button>
            </div>
          )}

          {/* Cash Vault */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-inner">
            <Vault className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cash Drawer</span>
              <span className="font-mono text-sm font-black text-emerald-400">
                Rs. {vaultBalance.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Bank Vault */}
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
            onClick={syncLedgerAndRegister}
            title="Refresh Ledger Vaults"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs (Strictly mapping the 3 Physical Screens + Management) */}
      <nav className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-8 py-2 sticky top-[69px] z-30 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Screen 1: Rapid Intake */}
          {currentUser.role !== ROLES.WORKER && (
            <button
              onClick={() => setActiveTab('intake')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'intake'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Car className="w-4 h-4" />
              1. Rapid Intake
            </button>
          )}

          {/* Screen 2: Physical Bays */}
          <button
            onClick={() => setActiveTab('bays')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap relative ${
              activeTab === 'bays'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Physical Bays (Jack 1 • Jack 2 • Detailing)</span>
            {queuedCount > 0 && (
              <span className="font-mono text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                {queuedCount} queued
              </span>
            )}
          </button>

          {/* Screen 3: Ready for Billing */}
          {currentUser.role !== ROLES.WORKER && (
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap relative ${
                activeTab === 'billing'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>3. Ready for Billing</span>
              {readyCount > 0 && (
                <span className="font-mono text-[10px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                  {readyCount}
                </span>
              )}
            </button>
          )}

          {/* Tab 4: Staff Leaderboard */}
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Trophy className="w-4 h-4" />
            4. Staff Leaderboard
          </button>

          {/* Tab 5: Investor Portal (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('investor')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'investor'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
              }`}
            >
              <Eye className="w-4 h-4" />
              5. Investor Portal
            </button>
          )}

          {/* Tab 6: Admin Portal (Admin & Manager) */}
          {(isAdmin || isManager) && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              6. Admin Portal
            </button>
          )}
        </div>
      </nav>

      {/* Main Screen Layout */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
        {activeTab === 'intake' && currentUser.role !== ROLES.WORKER && (
          <IntakeForm onJobCreated={handleJobCreated} />
        )}
        {activeTab === 'bays' && (
          <PhysicalBayDashboard onGoToBilling={() => setActiveTab('billing')} />
        )}
        {activeTab === 'billing' && currentUser.role !== ROLES.WORKER && (
          <BillingQueue onOpenCheckout={(card) => setCheckoutTarget(card)} />
        )}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'investor' && isAdmin && <InvestorDashboard />}
        {activeTab === 'admin' && (isAdmin || isManager) && <AdminManagement />}
      </main>

      {/* Cashier Checkout Modal */}
      {checkoutTarget && (
        <CheckoutModal
          jobCard={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onCheckoutSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Register Shift Open Modal (Blocks POS if till is closed) */}
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onSessionOpened={handleSessionOpened}
      />

      {/* Register Shift Close Modal */}
      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        onSessionClosed={handleSessionClosed}
        sessionData={registerData}
      />
    </div>
  );
}
