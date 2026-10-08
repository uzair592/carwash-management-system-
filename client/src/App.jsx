import React, { useEffect, useRef, useState } from 'react';
import { Car, LayoutDashboard, Receipt, Users, Boxes, PieChart, Settings, RefreshCw, Menu, X, Plus, Wallet, Landmark, ChevronRight, Crown, BarChart3 } from 'lucide-react';
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
import SettingsToggle from './components/SettingsToggle';
import LoyalCustomerSection from './pages/LoyalCustomerSection';
import ReportingSection from './pages/ReportingSection';

const PAGES = {
  intake: { title: 'New vehicle', description: 'Register a vehicle, select services and create a work ticket.', icon: Plus, group: 'WORKSHOP' },
  bays: { title: 'Workshop', description: 'Assign vehicles to a bay and keep work moving.', icon: LayoutDashboard, group: 'WORKSHOP' },
  billing: { title: 'Billing & invoices', description: 'Collect payments and review recent invoices.', icon: Receipt, group: 'WORKSHOP' },
  customers: { title: 'Loyal Customers', description: 'Customer directory, visit frequency, lifetime spend and VIP loyalty status.', icon: Crown, group: 'WORKSHOP' },
  reports: { title: 'Reports & Analytics', description: 'Daily sales, service performance, cash flow, and tax reporting summaries.', icon: BarChart3, group: 'MANAGEMENT' },
  leaderboard: { title: 'Staff performance', description: 'Review completed jobs and staff earnings.', icon: Users, group: 'MANAGEMENT' },
  investor: { title: 'Business overview', description: 'Review business activity, balances and partner reports.', icon: PieChart, group: 'MANAGEMENT' },
  admin: { title: 'Inventory & finance', description: 'Manage stock, payroll, partner accounts and audit records.', icon: Boxes, group: 'MANAGEMENT' },
  settings: { title: 'Settings', description: 'Manage camera, messaging and printer connections.', icon: Settings, group: 'MANAGEMENT' },
};
const money = (value) => Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function App() {
  const { currentUser, switchRole, isAdmin, isManager, isCashier, ROLES } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.slice(1);
    return PAGES[hash] ? hash : window.location.pathname === '/admin' ? 'admin' : 'intake';
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [syncState, setSyncState] = useState('loading');
  const [lastSync, setLastSync] = useState(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const syncInFlight = useRef(false);
  const roleRef = useRef(currentUser.role);
  roleRef.current = currentUser.role;
  const registerData = snapshot?.register;
  const allowed = (id) => {
    if (id === 'investor') return isAdmin;
    if (id === 'admin' || id === 'settings') return isManager;
    if (id === 'reports') return isManager || isCashier;
    if (id === 'intake' || id === 'billing' || id === 'customers') return isCashier;
    return true;
  };
  const navigate = (id) => {
    if (!allowed(id)) return;
    setActiveTab(id); setMobileNav(false);
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
    window.scrollTo({ top: 0 });
  };
  const sync = async () => {
    if (syncInFlight.current) return;
    const requestRole = currentUser.role;
    syncInFlight.current = true; setSyncState('loading');
    try {
      const [bayRes, ledgerRes, registerRes] = await Promise.all([
        axios.get('/api/bays/live-status'),
        isCashier ? axios.get('/api/ledger') : Promise.resolve(null),
        isCashier ? axios.get('/api/register/current') : Promise.resolve(null),
      ]);
      if (requestRole !== roleRef.current) return;
      const accounts = ledgerRes?.data?.data || [];
      const register = registerRes?.data?.data;
      setSnapshot({ cash: accounts.find((a) => a.account_type === 'Cash_Drawer')?.current_balance ?? 0,
        bank: accounts.find((a) => a.account_type === 'Main_Bank')?.current_balance ?? 0,
        queued: bayRes.data.queue?.length || 0, ready: bayRes.data.ready_for_billing?.length || 0, register });
      setLastSync(new Date()); setSyncState('online');
      setIsRegisterModalOpen(false);
    } catch {
      if (requestRole === roleRef.current) setSyncState('offline');
    } finally { syncInFlight.current = false; }
  };
  useEffect(() => {
    setSnapshot(null); setIsRegisterModalOpen(false); setIsCloseShiftModalOpen(false); setCheckoutTarget(null);
    sync(); const interval = setInterval(sync, 8000); return () => clearInterval(interval);
  }, [currentUser.role]);
  useEffect(() => { if (!allowed(activeTab)) navigate('bays'); }, [currentUser.role, activeTab]);
  useEffect(() => {
    const handleHash = () => { const id = window.location.hash.slice(1); if (PAGES[id] && allowed(id)) { setActiveTab(id); setMobileNav(false); } };
    window.addEventListener('hashchange', handleHash); return () => window.removeEventListener('hashchange', handleHash);
  }, [currentUser.role]);
  const page = PAGES[activeTab] || PAGES.intake;
  return (
    <div className="app-shell">
      <a href="#workspace-content" className="skip-link">Skip to content</a>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`app-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Shop navigation">
        <div className="brand">
          <span className="brand-icon"><Car size={22} /></span>
          <div>
            <strong>DF PRO</strong>
            <span className="text-[11px] text-slate-400">Car Wash & Detailing</span>
          </div>
          <button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="side-navigation">
          {['WORKSHOP', 'MANAGEMENT'].map((group) => (
            <div key={group} className="nav-group">
              <p>{group}</p>
              {Object.entries(PAGES)
                .filter(([id, item]) => item.group === group && allowed(id))
                .map(([id, item]) => (
                  <button
                    key={id}
                    className={`nav-item ${activeTab === id ? 'active' : ''}`}
                    aria-current={activeTab === id ? 'page' : undefined}
                    onClick={() => navigate(id)}
                  >
                    <item.icon size={18} />
                    <span>{item.title}</span>
                    {id === 'billing' && snapshot?.ready > 0 && <b className="nav-count">{snapshot.ready}</b>}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        {/* Compact bottom role switcher */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 mt-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                {currentUser.name?.charAt(0) || 'A'}
              </span>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">{currentUser.role}</p>
              </div>
            </div>
            <select
              id="workspace-role"
              aria-label="Workspace role"
              className="text-xs font-semibold bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 cursor-pointer"
              value={currentUser.role}
              onChange={(e) => switchRole(e.target.value)}
              title="Switch user role"
            >
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>{role[0] + role.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button className="icon-button mobile-only" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
              <Menu size={21} />
            </button>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              {page.title}
            </h1>
          </div>
          <div className="topbar-actions flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${syncState === 'offline' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`} role="status">
              <span className={`w-1.5 h-1.5 rounded-full ${syncState === 'offline' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              {syncState === 'offline' ? 'Server unavailable' : syncState === 'loading' ? 'Connecting…' : 'Shop server connected'}
            </span>
            {isCashier && activeTab !== 'intake' && (
              <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => navigate('intake')}>
                <Plus size={16} />
                <span>New vehicle</span>
              </button>
            )}
            <button className="icon-button" onClick={sync} aria-label="Refresh shop data" disabled={syncState === 'loading'}>
              <RefreshCw size={16} className={syncState === 'loading' ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <main id="workspace-content" className="workspace-content" tabIndex={-1}>
          {syncState === 'offline' && (
            <div className="connection-notice" role="alert">
              Unable to reach the shop server. {lastSync ? `Showing the last update from ${lastSync.toLocaleTimeString()}.` : 'Check the server and local network.'} <button onClick={sync}>Try again</button>
            </div>
          )}

          {/* Metric cards ONLY rendered on New Vehicle Tab per user requirement */}
          {activeTab === 'intake' && isCashier && (
            <div className="workspace-summary grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5" id="executive-kpi-bar">
              {/* Card 1: Waiting for a Bay */}
              <div
                onClick={() => navigate('bays')}
                className="bg-white border border-slate-200/90 hover:border-blue-400 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                    Waiting for Bay
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {snapshot ? snapshot.queued : '—'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">vehicles</span>
                  </div>
                  <p className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 group-hover:underline">
                    <span>Intake queue</span>
                    <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <Car size={24} />
                </div>
              </div>

              {/* Card 2: Ready for Billing */}
              <div
                onClick={() => isCashier && navigate('billing')}
                className={`bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between ${
                  isCashier ? 'hover:border-amber-400 cursor-pointer group' : ''
                }`}
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                    Ready for Billing
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-amber-600 tracking-tight">
                      {snapshot ? snapshot.ready : '—'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">vehicles</span>
                  </div>
                  <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                    <span>{snapshot?.ready > 0 ? 'Pending checkout' : 'All jobs billed'}</span>
                    {isCashier && <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <Receipt size={24} />
                </div>
              </div>

              {/* Card 3: Cash Drawer Balance */}
              {isCashier ? (
                <div
                  className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Cash Drawer Balance
                    </p>
                    <div className="flex items-baseline">
                      <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                        {snapshot ? `Rs. ${money(snapshot.cash)}` : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Cashier Active</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Wallet size={24} />
                  </div>
                </div>
              ) : null}

              {/* Card 4: Main Bank Balance */}
              {isCashier ? (
                <div className="bg-white border border-slate-200/90 hover:border-purple-300 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Main Bank Balance
                    </p>
                    <div className="flex items-baseline">
                      <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {snapshot ? `Rs. ${money(snapshot.bank)}` : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Meezan & Alfalah Accounts
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Landmark size={24} />
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <div className="page-content">
            {activeTab === 'intake' && isCashier && <IntakeForm onJobCreated={() => { sync(); navigate('bays'); }} />}
            {activeTab === 'bays' && <PhysicalBayDashboard onGoToBilling={isCashier ? () => navigate('billing') : undefined} />}
            {activeTab === 'billing' && isCashier && <BillingQueue onOpenCheckout={setCheckoutTarget} />}
            {activeTab === 'customers' && isCashier && (
              <LoyalCustomerSection
                onSelectCustomerForIntake={() => {
                  navigate('intake');
                }}
              />
            )}
            {activeTab === 'reports' && (isManager || isCashier) && <ReportingSection />}
            {activeTab === 'leaderboard' && <Leaderboard />}
            {activeTab === 'investor' && isAdmin && <InvestorDashboard />}
            {activeTab === 'admin' && isManager && <AdminManagement />}
            {activeTab === 'settings' && isManager && <SettingsToggle />}
          </div>
        </main>
      </div>
      {checkoutTarget && <CheckoutModal jobCard={checkoutTarget} onClose={() => setCheckoutTarget(null)} onCheckoutSuccess={sync} />}
      {isCashier && <RegisterModal isOpen={isRegisterModalOpen} onSessionOpened={() => { setIsRegisterModalOpen(false); sync(); }} />}
      {isCashier && <CloseShiftModal isOpen={isCloseShiftModalOpen} onClose={() => setIsCloseShiftModalOpen(false)} onSessionClosed={() => { setIsCloseShiftModalOpen(false); sync(); }} sessionData={registerData || {}} />}
    </div>
  );
}
