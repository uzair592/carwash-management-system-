import AppConnection from './components/AppConnection';
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
  intake: {
    title: 'New vehicle',
    description: 'Register a vehicle, select services and create a work ticket.',
    icon: Plus,
    group: 'WORKSHOP'
  },
  bays: {
    title: 'Workshop',
    description: 'Assign vehicles to a bay and keep work moving.',
    icon: LayoutDashboard,
    group: 'WORKSHOP'
  },
  billing: {
    title: 'Billing & invoices',
    description: 'Collect payments and review recent invoices.',
    icon: Receipt,
    group: 'WORKSHOP'
  },
  customers: {
    title: 'Loyal Customers',
    description: 'Customer directory, visit frequency, lifetime spend and VIP loyalty status.',
    icon: Crown,
    group: 'WORKSHOP'
  },
  reports: {
    title: 'Reports',
    description: 'Daily sales, service performance, cash flow, and tax reporting summaries.',
    icon: BarChart3,
    group: 'MANAGEMENT'
  },
  leaderboard: {
    title: 'Staff performance',
    description: 'Review completed jobs and staff earnings.',
    icon: Users,
    group: 'MANAGEMENT'
  },
  investor: {
    title: 'Business overview',
    description: 'Review business activity, balances and partner reports.',
    icon: PieChart,
    group: 'MANAGEMENT'
  },
  admin: {
    title: 'Inventory & finance',
    description: 'Manage stock, payroll, partner accounts and audit records.',
    icon: Boxes,
    group: 'MANAGEMENT'
  },
  settings: {
    title: 'Settings',
    description: 'Manage camera, messaging and printer connections.',
    icon: Settings,
    group: 'MANAGEMENT'
  }
};
const money = value => Number(value).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export default function App() {
  const {
    currentUser,
    isAdmin,
    logout,
    can
  } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.slice(1);
    return PAGES[hash] ? hash : window.location.pathname === '/admin' ? 'admin' : 'intake';
  });
  const [managementSection, setManagementSection] = useState(null);
  const [intakeCustomer, setIntakeCustomer] = useState(null);
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
  const allowed = id => ({
    intake: can('intake.manage'),
    bays: can('workshop.read'),
    billing: can('billing.read'),
    customers: can('customers.read'),
    reports: can('reports.read'),
    leaderboard: can('staff.read'),
    investor: can('overview.read'),
    admin: can('inventory.read') || can('finance.read') || can('services.read') || can('payroll.read'),
    settings: can('settings.read')
  })[id];
  const navigate = id => {
    if (!allowed(id)) return;
    setActiveTab(id);
    setMobileNav(false);
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
    window.scrollTo({
      top: 0
    });
  };
  const sync = async () => {
    if (syncInFlight.current) return;
    const requestRole = currentUser.role;
    syncInFlight.current = true;
    setSyncState('loading');
    try {
      const [bayRes, ledgerRes, registerRes] = await Promise.all([can('workshop.read') ? axios.get('/api/bays/live-status') : Promise.resolve({
        data: {}
      }), can('finance.read') ? axios.get('/api/ledger') : Promise.resolve(null), can('finance.read') ? axios.get('/api/register/current') : Promise.resolve(null)]);
      if (requestRole !== roleRef.current) return;
      const accounts = ledgerRes?.data?.data || [];
      const register = registerRes?.data?.data;
      setSnapshot({
        cash: accounts.find(a => a.account_type === 'Cash_Drawer')?.current_balance ?? 0,
        bank: accounts.find(a => a.account_type === 'Main_Bank')?.current_balance ?? 0,
        queued: bayRes.data.queue?.length || 0,
        ready: bayRes.data.ready_for_billing?.length || 0,
        register
      });
      const saved=[bayRes,ledgerRes,registerRes].filter(Boolean).find(r=>r.offline);
      setLastSync(saved ? new Date(saved.savedAt) : new Date());
      setSyncState(saved ? 'offline' : 'online');
      setIsRegisterModalOpen(false);
    } catch {
      if (requestRole === roleRef.current) setSyncState('offline');
    } finally {
      syncInFlight.current = false;
    }
  };
  useEffect(() => {
    setSnapshot(null);
    setIsRegisterModalOpen(false);
    setIsCloseShiftModalOpen(false);
    setCheckoutTarget(null);
    sync();
    const interval = setInterval(sync, 8000);
    return () => clearInterval(interval);
  }, [currentUser.role, JSON.stringify(currentUser.permissions)]);
  useEffect(() => {
    if (!allowed(activeTab)) {
      const next = Object.keys(PAGES).find(allowed);
      if (next) navigate(next);
    }
  }, [currentUser.role, activeTab, JSON.stringify(currentUser.permissions)]);
  useEffect(() => {
    const handleHash = () => {
      const id = window.location.hash.slice(1);
      if (PAGES[id] && allowed(id)) {
        setActiveTab(id);
        setMobileNav(false);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentUser.role, JSON.stringify(currentUser.permissions)]);
  const page = PAGES[activeTab] || PAGES.intake;
  const navGroups = [['WORKSHOP', 'Daily operations'], ['MANAGEMENT', 'Business management']];
  return <div className="app-shell">
      <a href="#workspace-content" className="skip-link">Skip to content</a>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`app-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Shop navigation">
        <div className="brand"><span className="brand-icon"><Car size={24} /></span><div><strong>DF PRO<span className="brand-dot">.</span></strong></div><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={20} /></button></div>
        <nav className="side-navigation">{navGroups.map(([group, label]) => <div className="nav-group" key={group}><p>{label}</p>{Object.entries(PAGES).filter(([id, item]) => item.group === group && allowed(id)).map(([id, item]) => <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => navigate(id)}><item.icon size={19} /><span>{item.title}</span>{id === 'billing' && snapshot?.ready > 0 && <b className="nav-count">{snapshot.ready}</b>}</button>)}</div>)}</nav><AppConnection /><button className="btn btn-secondary m-3" onClick={logout}>Sign out</button>

      </aside>
      <div className="app-workspace">

        <main id="workspace-content" className="workspace-content">
          <div className="workspace-heading compact-page-heading"><div className="compact-title"><button className="icon-button mobile-only" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button><h1>{page.title}</h1></div><div className="heading-actions"><button className="icon-button" aria-label="Refresh shop data" onClick={sync} disabled={syncState === 'loading'}><RefreshCw size={17} className={syncState === 'loading' ? 'animate-spin' : ''} /></button>{can('intake.manage') && activeTab !== 'intake' && <button className="btn btn-primary" onClick={() => {
              setIntakeCustomer(null);
              navigate('intake');
            }}><Plus size={17} />New vehicle</button>}</div></div>
          {syncState === 'offline' && <div className="connection-notice" role="alert">Unable to reach the shop server. {lastSync ? `Showing the last update from ${lastSync.toLocaleTimeString()}.` : 'Check the server and local network.'}<button onClick={sync}>Try again</button></div>}
          {activeTab === 'intake' && allowed('intake') && <div className="workspace-summary" id="executive-kpi-bar"><div><span className="stat-icon blue"><Car size={20} /></span><div><span>Waiting for a bay</span><strong>{snapshot?.queued ?? '—'}<small>vehicles</small></strong></div></div><div><span className="stat-icon amber"><Receipt size={20} /></span><div><span>Ready for billing</span><strong>{snapshot?.ready ?? '—'}<small>vehicles</small></strong></div></div><div><span className="stat-icon green"><Wallet size={20} /></span><div><span>Cash balance</span><strong>{snapshot ? `Rs. ${money(snapshot.cash)}` : '—'}</strong></div></div><div><span className="stat-icon purple"><Landmark size={20} /></span><div><span>Bank balance</span><strong>{snapshot ? `Rs. ${money(snapshot.bank)}` : '—'}</strong></div></div></div>}
          <div className="page-content">
            {activeTab === 'intake' && allowed('intake') && <IntakeForm customerPreset={intakeCustomer} onJobCreated={() => {
            setIntakeCustomer(null);
            sync();
            navigate('bays');
          }} />}
            {activeTab === 'bays' && allowed('bays') && <PhysicalBayDashboard onGoToBilling={can('billing.read') ? () => navigate('billing') : undefined} />}
            {activeTab === 'billing' && allowed('billing') && <BillingQueue onOpenCheckout={setCheckoutTarget} />}
            {activeTab === 'customers' && allowed('customers') && <LoyalCustomerSection onSelectCustomerForIntake={customer => {
            setIntakeCustomer(customer);
            navigate('intake');
          }} />}
            {activeTab === 'reports' && allowed('reports') && <ReportingSection />}
            {activeTab === 'leaderboard' && allowed('leaderboard') && <Leaderboard onPayroll={() => { setManagementSection('payroll'); navigate('admin'); }} />}
            {activeTab === 'investor' && allowed('investor') && <InvestorDashboard />}
            {activeTab === 'admin' && allowed('admin') && <AdminManagement section={managementSection} />}
            {activeTab === 'settings' && allowed('settings') && <><SettingsToggle /><section className="surface cash-reconciliation"><div><h2>Cash drawer reconciliation</h2><p>Use one shop cash drawer. Record its opening float or reconcile the counted cash.</p></div><button className="btn btn-secondary" disabled={!can('finance.manage')} onClick={() => registerData?.is_open ? setIsCloseShiftModalOpen(true) : setIsRegisterModalOpen(true)}><Wallet size={17} />{registerData?.is_open ? 'Reconcile cash drawer' : 'Set opening cash'}</button></section></>}
          </div>
        </main>
      </div>
      {checkoutTarget && <CheckoutModal jobCard={checkoutTarget} onClose={() => setCheckoutTarget(null)} onCheckoutSuccess={sync} />}
      {can('finance.manage') && <RegisterModal isOpen={isRegisterModalOpen} onSessionOpened={() => {
      setIsRegisterModalOpen(false);
      sync();
    }} />}
      {can('finance.manage') && <CloseShiftModal isOpen={isCloseShiftModalOpen} onClose={() => setIsCloseShiftModalOpen(false)} onSessionClosed={() => {
      setIsCloseShiftModalOpen(false);
      sync();
    }} sessionData={registerData || {}} />}
    </div>;
}
