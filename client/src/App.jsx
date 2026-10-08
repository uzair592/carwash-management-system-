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
  const navGroups = [['WORKSHOP', 'Daily operations'], ['MANAGEMENT', 'Business management']];
  return (
    <div className="app-shell">
      <a href="#workspace-content" className="skip-link">Skip to content</a>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`app-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Shop navigation">
        <div className="brand"><span className="brand-icon"><Car size={24} /></span><div><strong>DF PRO<span className="brand-dot">.</span></strong><span>Car Wash & Detailing Center</span></div><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={20} /></button></div>
        <div className="business-location"><span className="location-dot" /><span>Main workshop</span><span className="location-label">LOCAL</span></div>
        {isCashier && <button className="sidebar-create" onClick={() => navigate('intake')}><Plus size={18} />New work ticket</button>}
        <nav className="side-navigation">{navGroups.map(([group, label]) => <div className="nav-group" key={group}><p>{label}</p>{Object.entries(PAGES).filter(([id, item]) => item.group === group && allowed(id)).map(([id, item]) => <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => navigate(id)}><item.icon size={19} /><span>{item.title}</span>{id === 'billing' && snapshot?.ready > 0 && <b className="nav-count">{snapshot.ready}</b>}</button>)}</div>)}</nav>
        <div className="sidebar-bottom"><div className="operator-card"><span className="avatar">{currentUser.name?.charAt(0) || 'D'}</span><div><strong>{currentUser.name}</strong><span>Shop workspace</span></div></div><label className="operator-label" htmlFor="workspace-role">Workspace role</label><select id="workspace-role" value={currentUser.role} onChange={(e) => switchRole(e.target.value)}>{Object.values(ROLES).map(role => <option key={role} value={role}>{role[0] + role.slice(1).toLowerCase()}</option>)}</select></div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar"><div className="topbar-leading"><button className="icon-button mobile-only" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={22} /></button><span className="breadcrumb">DF PRO <ChevronRight size={15} /><strong>{page.title}</strong></span></div><div className="topbar-actions"><span className={`connection ${syncState === 'offline' ? 'connection-error' : ''}`} role="status"><i />{syncState === 'offline' ? 'Server unavailable' : syncState === 'loading' ? 'Connecting…' : 'Shop server connected'}</span><button className="icon-button" aria-label="Refresh shop data" onClick={sync} disabled={syncState === 'loading'}><RefreshCw size={18} className={syncState === 'loading' ? 'animate-spin' : ''} /></button><span className="topbar-date">{new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short',year:'numeric',timeZone:'Asia/Karachi'})}</span></div></header>
        <main id="workspace-content" className="workspace-content">
          <div className="workspace-heading"><div><h1>{page.title}</h1><p>{page.description}</p></div><div className="heading-actions">{isCashier && <button className="btn btn-secondary" onClick={() => registerData?.is_open ? setIsCloseShiftModalOpen(true) : setIsRegisterModalOpen(true)}><Wallet size={17} />{registerData?.is_open ? 'Close shift' : 'Open shift'}</button>}{isCashier && activeTab !== 'intake' && <button className="btn btn-primary" onClick={() => navigate('intake')}><Plus size={17} />New vehicle</button>}</div></div>
          {syncState === 'offline' && <div className="connection-notice" role="alert">Unable to reach the shop server. {lastSync ? `Showing the last update from ${lastSync.toLocaleTimeString()}.` : 'Check the server and local network.'}<button onClick={sync}>Try again</button></div>}
          {activeTab === 'intake' && isCashier && <div className="workspace-summary" id="executive-kpi-bar"><div><span className="stat-icon blue"><Car size={20} /></span><div><span>Waiting for a bay</span><strong>{snapshot?.queued ?? '—'}<small>vehicles</small></strong></div></div><div><span className="stat-icon amber"><Receipt size={20} /></span><div><span>Ready for billing</span><strong>{snapshot?.ready ?? '—'}<small>vehicles</small></strong></div></div><div><span className="stat-icon green"><Wallet size={20} /></span><div><span>Cash balance</span><strong>{snapshot ? `Rs. ${money(snapshot.cash)}` : '—'}</strong></div></div><div><span className="stat-icon purple"><Landmark size={20} /></span><div><span>Bank balance</span><strong>{snapshot ? `Rs. ${money(snapshot.bank)}` : '—'}</strong></div></div></div>}
          <div className="page-content">
            {activeTab === 'intake' && isCashier && <IntakeForm onJobCreated={() => { sync(); navigate('bays'); }} />}
            {activeTab === 'bays' && <PhysicalBayDashboard onGoToBilling={isCashier ? () => navigate('billing') : undefined} />}
            {activeTab === 'billing' && isCashier && <BillingQueue onOpenCheckout={setCheckoutTarget} />}
            {activeTab === 'customers' && isCashier && <LoyalCustomerSection onSelectCustomerForIntake={() => navigate('intake')} />}
            {activeTab === 'reports' && (isManager || isCashier) && <ReportingSection />}
            {activeTab === 'leaderboard' && <Leaderboard />}
            {activeTab === 'investor' && isAdmin && <InvestorDashboard />}
            {activeTab === 'admin' && isManager && <AdminManagement />}
            {activeTab === 'settings' && isManager && <SettingsToggle />}
          </div>
          <footer className="workspace-footer"><span>DF PRO · Car Wash & Detailing Center</span><span>Every vehicle starts with a work ticket</span></footer>
        </main>
      </div>
      {checkoutTarget && <CheckoutModal jobCard={checkoutTarget} onClose={() => setCheckoutTarget(null)} onCheckoutSuccess={sync} />}
      {isCashier && <RegisterModal isOpen={isRegisterModalOpen} onSessionOpened={() => { setIsRegisterModalOpen(false); sync(); }} />}
      {isCashier && <CloseShiftModal isOpen={isCloseShiftModalOpen} onClose={() => setIsCloseShiftModalOpen(false)} onSessionClosed={() => { setIsCloseShiftModalOpen(false); sync(); }} sessionData={registerData || {}} />}
    </div>
  );
}
