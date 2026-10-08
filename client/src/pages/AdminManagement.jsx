import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Users,
  AlertTriangle,
  PlusCircle,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PieChart,
  Percent,
  Layers,
  Send,
  Link as LinkIcon,
  HelpCircle,
  Award,
  Wallet,
  ShieldAlert,
  Filter,
  FileText,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function AdminManagement() {
  const { isAdmin } = useAuth();
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(true); // Pre-unlocked for smooth DX
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState('inventory'); // 'inventory' | 'payroll' | 'dividends'

  // Common month selection (YYYY-MM)
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Inventory state
  const [inventory, setInventory] = useState([]);
  const [isLoadingInv, setIsLoadingInv] = useState(false);
  const [restockModal, setRestockModal] = useState(null); // item object or null
  const [restockQty, setRestockQty] = useState('');
  const [newConsumableModal, setNewConsumableModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    item_name: '',
    unit_type: 'ML',
    current_stock: '',
    cost_per_unit: '',
    low_stock_threshold: '10',
  });

  // Service Inventory Yield Mappings state
  const [yieldMappings, setYieldMappings] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [yieldModal, setYieldModal] = useState(false);
  const [yieldForm, setYieldForm] = useState({
    service_id: '',
    inventory_id: '',
    deduction_amount: '',
  });

  // Payroll state
  const [payrollData, setPayrollData] = useState(null);
  const [isLoadingPayroll, setIsLoadingPayroll] = useState(false);
  const [editSalaryModal, setEditSalaryModal] = useState(null); // user object or null
  const [salaryForm, setSalaryForm] = useState({
    base_salary: '',
    commission_rate: '',
    flat_commission: '',
  });

  // Partner Dividends & Equity state
  const [dividendData, setDividendData] = useState(null);
  const [isLoadingDividends, setIsLoadingDividends] = useState(false);
  const [isDispatchingDividends, setIsDispatchingDividends] = useState(false);
  const [partnersList, setPartnersList] = useState([]);
  const [editPartnerModal, setEditPartnerModal] = useState(null); // partner object or null
  const [partnerForm, setPartnerForm] = useState({
    id: '',
    partner_name: '',
    equity_percentage: '',
    phone: '',
  });

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState('ALL');

  // Notifications
  const [toast, setToast] = useState(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Inventory items
  const fetchInventory = async () => {
    setIsLoadingInv(true);
    try {
      const res = await axios.get('/api/inventory');
      if (res.data?.data) {
        setInventory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
      showToast('error', `Failed to load inventory: ${err.message}`);
    } finally {
      setIsLoadingInv(false);
    }
  };

  // Fetch Services & Yield Mappings
  const fetchYieldData = async () => {
    try {
      const [mapsRes, srvRes] = await Promise.all([
        axios.get('/api/inventory/yield-mappings'),
        axios.get('/api/services'),
      ]);
      if (mapsRes.data?.data) setYieldMappings(mapsRes.data.data);
      if (srvRes.data?.data) setServicesList(srvRes.data.data);
    } catch (err) {
      console.error('Failed to load yield mappings:', err);
    }
  };

  // Fetch Payroll for chosen month
  const fetchPayroll = async (month) => {
    setIsLoadingPayroll(true);
    try {
      const res = await axios.get(`/api/financials/payroll?month=${month}`);
      if (res.data?.data) {
        setPayrollData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to generate payroll:', err);
      showToast('error', `Failed to generate payroll: ${err.message}`);
    } finally {
      setIsLoadingPayroll(false);
    }
  };

  // Fetch Partner Dividends & Equity
  const fetchDividends = async (month) => {
    setIsLoadingDividends(true);
    try {
      const [divRes, eqRes] = await Promise.all([
        axios.get(`/api/financials/dividends?month=${month}`),
        axios.get('/api/financials/equity'),
      ]);
      if (divRes.data?.data) setDividendData(divRes.data.data);
      if (eqRes.data?.data) setPartnersList(eqRes.data.data);
    } catch (err) {
      console.error('Failed to calculate dividends:', err);
      showToast('error', `Failed to calculate dividends: ${err.message}`);
    } finally {
      setIsLoadingDividends(false);
    }
  };

  // Fetch Immutable Audit Logs
  const fetchAuditLogs = async (filterVal = auditFilter) => {
    setIsLoadingAudit(true);
    try {
      const url =
        filterVal && filterVal !== 'ALL'
          ? `/api/audit-logs?limit=100&action=${filterVal}`
          : '/api/audit-logs?limit=100';
      const res = await axios.get(url);
      if (res.data?.data) {
        setAuditLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      showToast('error', `Failed to load audit log: ${err.message}`);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchInventory();
      fetchYieldData();
      fetchPayroll(currentMonth);
      fetchDividends(currentMonth);
      fetchAuditLogs(auditFilter);
    }
  }, [isAdminUnlocked, currentMonth]);

  // Handle PIN unlock
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsAdminUnlocked(true);
      setPinError('');
      setPinInput('');
    } else {
      setPinError('Invalid Admin PIN. Please enter 1234.');
    }
  };

  // Restock action
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockModal || !restockQty) return;
    try {
      const res = await axios.post(`/api/inventory/${restockModal.id}/restock`, {
        quantity_added: parseFloat(restockQty),
      });
      showToast('success', res.data.message || 'Inventory restocked successfully!');
      setRestockModal(null);
      setRestockQty('');
      fetchInventory();
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    }
  };

  // Create new inventory item
  const handleCreateItemSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory', newItemForm);
      showToast('success', `Created ${newItemForm.item_name} successfully!`);
      setNewConsumableModal(false);
      setNewItemForm({
        item_name: '',
        unit_type: 'ML',
        current_stock: '',
        cost_per_unit: '',
        low_stock_threshold: '10',
      });
      fetchInventory();
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    }
  };

  // Create or Update Yield Mapping
  const handleYieldMappingSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory/yield-mappings', yieldForm);
      showToast('success', 'Service inventory yield deduction mapped successfully!');
      setYieldModal(false);
      setYieldForm({ service_id: '', inventory_id: '', deduction_amount: '' });
      fetchYieldData();
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    }
  };

  // Update staff salary & commission
  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    if (!editSalaryModal) return;
    try {
      await axios.patch(`/api/payroll/users/${editSalaryModal.user_id}/salary`, {
        base_salary: parseFloat(salaryForm.base_salary) || 0,
        commission_rate: parseFloat(salaryForm.commission_rate) || 0,
        flat_commission: parseFloat(salaryForm.flat_commission) || 0,
      });
      showToast('success', `Updated compensation for ${editSalaryModal.name}`);
      setEditSalaryModal(null);
      fetchPayroll(currentMonth);
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    }
  };

  // Partner Equity Submit
  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/financials/equity', partnerForm);
      showToast('success', `Partner equity saved successfully!`);
      setEditPartnerModal(null);
      setPartnerForm({ id: '', partner_name: '', equity_percentage: '', phone: '' });
      fetchDividends(currentMonth);
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    }
  };

  // Dispatch Dividends to Telegram
  const handleDispatchDividends = async () => {
    setIsDispatchingDividends(true);
    try {
      const res = await axios.post('/api/financials/dividends/dispatch', { month: currentMonth });
      showToast('success', res.data.message || 'Monthly dividend dossier queued in Telegram Outbox!');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to dispatch dividends to Telegram.');
    } finally {
      setIsDispatchingDividends(false);
    }
  };

  // Month navigation
  const shiftMonth = (delta) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const newMonthStr = date.toISOString().slice(0, 7);
    setCurrentMonth(newMonthStr);
  };

  // PIN Lock Screen
  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center">
        <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Admin Management Lock</h2>
        <p className="text-slate-400 text-xs mt-2">
          Enter Shop Admin PIN to access Inventory Yield Control, Payroll, and Partner Equity Engine.
        </p>

        <form onSubmit={handlePinSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            maxLength={6}
            placeholder="Enter Admin PIN (Default: 1234)"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full text-center text-2xl tracking-widest font-mono bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500"
            autoFocus
          />
          {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <Unlock className="w-4 h-4" /> Unlock Admin Panel
          </button>
        </form>
      </div>
    );
  }

  // Inventory Totals
  const totalInvValue = inventory.reduce((sum, item) => sum + item.current_stock * item.cost_per_unit, 0);
  const lowStockCount = inventory.filter((item) => item.is_low_stock).length;

  // Partner equity sum
  const currentPartners = dividendData?.partners || partnersList;
  const totalEquitySum = currentPartners.reduce((acc, p) => acc + (parseFloat(p.equity_percentage) || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-800 text-emerald-200'
              : 'bg-rose-950 border-rose-800 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-semibold">{toast.text}</span>
        </div>
      )}

      {/* Top Banner & Tab Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Boxes className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Admin Financial Terminal
              </h2>
              <span className="bg-emerald-950 text-emerald-300 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-emerald-800">
                Monthly Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Consumable Yield Tracking • Staff Payroll & Commissions • Partner Equity & Profit Split
            </p>
          </div>
        </div>

        {/* Tab Toggle Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveAdminTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeAdminTab === 'inventory'
                ? 'bg-sky-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Inventory Yield
            {lowStockCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {lowStockCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveAdminTab('payroll')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeAdminTab === 'payroll'
                    ? 'bg-sky-500 text-slate-950 shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Monthly Payroll
              </button>
              <button
                onClick={() => setActiveAdminTab('dividends')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeAdminTab === 'dividends'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PieChart className="w-4 h-4" />
                Partner Profit Split
              </button>
              <button
                onClick={() => {
                  setActiveAdminTab('audit');
                  fetchAuditLogs(auditFilter);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeAdminTab === 'audit'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Audit Log
                {auditLogs.length > 0 && (
                  <span className="bg-rose-950 text-rose-300 font-mono text-[10px] px-1.5 py-0.2 rounded-full border border-rose-800">
                    {auditLogs.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: INVENTORY YIELD & CONSUMABLE MANAGEMENT */}
      {/* ============================================================== */}
      {activeAdminTab === 'inventory' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Items Cataloged</span>
                <Package className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{inventory.length}</p>
              <p className="text-[11px] text-slate-500 mt-1">High-value detailing consumables</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Low Stock Warnings</span>
                <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
              </div>
              <p className={`text-2xl font-black mt-2 ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {lowStockCount} Items
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Below critical reorder threshold</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Active Yield Rules</span>
                <LinkIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-2">{yieldMappings.length} Mappings</p>
              <p className="text-[11px] text-slate-500 mt-1">Deducted automatically on invoice</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Est. Inventory Value</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">
                Rs. {totalInvValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Current assets on premises</p>
            </div>
          </div>

          {/* Consumables Catalog Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-400" /> Detailing Consumables & Stock Levels
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Protects expensive ceramic bottles and PPF rolls from leakage and unaccounted shrinkage.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchInventory}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition"
                  title="Refresh Stock"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingInv ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setNewConsumableModal(true)}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add Consumable
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Cost Per Unit</th>
                    <th className="py-3 px-4 text-right">Total Value</th>
                    <th className="py-3 px-4 text-center">Threshold</th>
                    <th className="py-3 px-4 text-center">Stock Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        {item.item_name}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold">
                          {item.unit_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {item.current_stock.toLocaleString('en-US', { minimumFractionDigits: 1 })}{' '}
                        <span className="text-slate-500 text-[10px]">{item.unit_type}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        Rs. {item.cost_per_unit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        Rs. {(item.current_stock * item.cost_per_unit).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {item.low_stock_threshold} {item.unit_type}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 bg-rose-950 text-rose-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-rose-800">
                            <AlertTriangle className="w-3 h-3" /> Low Stock Alert
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Healthy Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setRestockModal(item);
                            setRestockQty('');
                          }}
                          className="text-[11px] bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 px-3 py-1 rounded-lg font-semibold transition"
                        >
                          + Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">
                        No consumables tracked. Click "Add Consumable" to register stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Service Consumable Yield Rules Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-emerald-400" /> Service Yield Rules (Deduction on Checkout)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  When a customer is invoiced, the exact chemical/roll quantity is deducted automatically in an atomic transaction.
                </p>
              </div>

              <button
                onClick={() => setYieldModal(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Map Consumable to Service
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Service Name</th>
                    <th className="py-3 px-4">Deducted Consumable</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Deduction Per Vehicle</th>
                    <th className="py-3 px-4 text-right">COGS Per Job</th>
                    <th className="py-3 px-4 text-center">Theft Shield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {yieldMappings.map((map) => (
                    <tr key={map.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{map.service?.name}</td>
                      <td className="py-3.5 px-4 text-slate-200">{map.inventory?.item_name}</td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold">
                          {map.inventory?.unit_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">
                        {map.deduction_amount} {map.inventory?.unit_type}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-bold">
                        Rs. {(map.deduction_amount * (map.inventory?.cost_per_unit || 0)).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-emerald-800">
                          <ShieldCheck className="w-3 h-3" /> Auto-Deducted
                        </span>
                      </td>
                    </tr>
                  ))}
                  {yieldMappings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500">
                        No yield rules mapped yet. Map a service to an inventory item to automate deductions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: STAFF PAYROLL ENGINE */}
      {/* ============================================================== */}
      {activeAdminTab === 'payroll' && (
        <div className="space-y-6">
          {/* Payroll Header & Month Navigation */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" /> Monthly Staff Payroll & Commissions Engine
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated compensation breakdown: Base Salary + Flat Rate Per Car or Detailing Percentage.
              </p>
            </div>

            {/* Month Picker Controls */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="bg-transparent text-white font-mono text-sm px-2 py-1 focus:outline-none cursor-pointer"
              />

              <button
                onClick={() => shiftMonth(1)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => fetchPayroll(currentMonth)}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 p-2 rounded-xl transition"
                title="Refresh Payroll"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingPayroll ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Payroll KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">Active Staff Count</span>
              <p className="text-2xl font-black text-white mt-2">
                {payrollData?.summary?.staff_count || 0} Members
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Admins, Cashiers & Bay Detailers</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">Total Base Salaries</span>
              <p className="text-2xl font-black text-slate-200 mt-2">
                Rs. {(payrollData?.summary?.total_base_salaries || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Fixed monthly payroll commitments</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">Total Commissions</span>
              <p className="text-2xl font-black text-amber-400 mt-2">
                Rs. {(payrollData?.summary?.total_commissions || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Earned from completed wash & detailing jobs</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-800/60 p-5 rounded-2xl">
              <span className="text-xs text-emerald-300 font-medium">Grand Total Payroll Payout</span>
              <p className="text-2xl font-black text-emerald-400 mt-2">
                Rs. {(payrollData?.summary?.total_payroll_expense || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-emerald-500/80 mt-1">Base Salaries + Total Commissions</p>
            </div>
          </div>

          {/* Detailed Staff Payroll Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Staff Compensation Breakdown</h3>
                <p className="text-xs text-slate-400">
                  Month Period: {payrollData?.month || currentMonth} • Direct integration with job card ledger
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role & Team</th>
                    <th className="py-3 px-4 text-right">Base Salary</th>
                    <th className="py-3 px-4 text-center">Completed Jobs</th>
                    <th className="py-3 px-4 text-right">Revenue Generated</th>
                    <th className="py-3 px-4 text-center">Commission Plan</th>
                    <th className="py-3 px-4 text-right">Commissions Earned</th>
                    <th className="py-3 px-4 text-right font-black text-white">Total Payout</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {payrollData?.payroll?.map((staff) => (
                    <tr key={staff.user_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{staff.name}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            staff.role === 'Admin'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : staff.role === 'Cashier'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {staff.role} {staff.team ? `(${staff.team})` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-200">
                        Rs. {staff.base_salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                        {staff.completed_jobs_count}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        Rs. {staff.total_revenue_generated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-amber-400 font-bold">
                        {staff.commission_mode === 'FLAT_PER_CAR'
                          ? `Rs. ${staff.flat_commission} / car`
                          : `${staff.commission_rate}%`}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">
                        Rs. {staff.commissions_earned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                        Rs. {staff.total_payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setEditSalaryModal(staff);
                            setSalaryForm({
                              base_salary: staff.base_salary,
                              commission_rate: staff.commission_rate,
                              flat_commission: staff.flat_commission || 0,
                            });
                          }}
                          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition"
                        >
                          Edit Pay
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!payrollData?.payroll || payrollData?.payroll.length === 0) && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500">
                        No staff records found for month {currentMonth}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: PARTNER EQUITY & PROFIT SPLIT ENGINE */}
      {/* ============================================================== */}
      {activeAdminTab === 'dividends' && (
        <div className="space-y-6">
          {/* Header & Telegram Outbox Dispatch */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <PieChart className="w-6 h-6 text-emerald-400" /> Sleeping Partner Profit Split & Equity Engine
                </h3>
                <span className="bg-emerald-950 text-emerald-300 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-emerald-800">
                  Strict Accounting
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                True absentee-owner transparency: <code className="text-emerald-300">Net Distributable Profit = Gross Revenue − Expenses − Staff Payroll − Consumable COGS</code>.
                Calculated strictly from immutable invoices and inventory deductions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Month Picker Controls */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <input
                  type="month"
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  className="bg-transparent text-white font-mono text-sm px-2 py-1 focus:outline-none cursor-pointer"
                />

                <button
                  onClick={() => shiftMonth(1)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => fetchDividends(currentMonth)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-2 rounded-xl transition"
                  title="Refresh Financials"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDividends ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Push to Telegram Button */}
              <button
                onClick={handleDispatchDividends}
                disabled={isDispatchingDividends}
                className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
              >
                <Send className={`w-4 h-4 ${isDispatchingDividends ? 'animate-pulse' : ''}`} />
                {isDispatchingDividends ? 'Queueing Dossier...' : 'Push to Telegram Outbox'}
              </button>
            </div>
          </div>

          {/* Month-End P&L Waterfall KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">1. Gross Revenue</span>
              <p className="text-2xl font-black text-white mt-2">
                Rs. {(dividendData?.summary?.gross_revenue || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Sum of all customer invoices</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">2. Operating Expenses</span>
              <p className="text-2xl font-black text-rose-400 mt-2">
                - Rs. {(dividendData?.summary?.total_expenses || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Shop rent, utilities, tea, misc</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">3. Staff Payroll</span>
              <p className="text-2xl font-black text-amber-400 mt-2">
                - Rs. {(dividendData?.summary?.total_payroll || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Base salaries + commissions</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">4. Consumables COGS</span>
              <p className="text-2xl font-black text-indigo-400 mt-2">
                - Rs. {(dividendData?.summary?.cogs || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Chemicals & PPF rolls used</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-600/60 p-5 rounded-2xl shadow-xl shadow-emerald-950/40">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
                <span>Net Distributable</span>
                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono">
                  {dividendData?.summary?.profit_margin_percent || 0}% Margin
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-2">
                Rs. {(dividendData?.summary?.net_distributable_profit || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-emerald-500/80 mt-1">Available for Partner Dividends</p>
            </div>
          </div>

          {/* Partner Equity & Dividend Distribution Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" /> Partner Equity & Monthly Dividend Distribution
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Total Equity Registered:{' '}
                  <span
                    className={`font-mono font-bold ${
                      Math.abs(totalEquitySum - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {totalEquitySum.toFixed(1)}%
                  </span>
                  {Math.abs(totalEquitySum - 100) >= 0.1 && ' (Warning: Equity shares do not equal 100%)'}
                </p>
              </div>

              <button
                onClick={() => {
                  setPartnerForm({ id: '', partner_name: '', equity_percentage: '', phone: '' });
                  setEditPartnerModal({ isNew: true });
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Add Partner
              </button>
            </div>

            {/* Partner Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(dividendData?.partners || partnersList).map((partner) => {
                const equityPct = parseFloat(partner.equity_percentage) || 0;
                const netProfit = dividendData?.summary?.net_distributable_profit || 0;
                const calculatedDividend =
                  partner.dividend_amount !== undefined
                    ? partner.dividend_amount
                    : Math.round(((netProfit * equityPct) / 100) * 100) / 100;

                return (
                  <div
                    key={partner.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">{partner.partner_name}</h4>
                          {partner.phone && (
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                              {partner.phone}
                            </span>
                          )}
                        </div>
                        <span className="bg-sky-950 text-sky-300 font-mono text-xs font-bold px-2.5 py-1 rounded-full border border-sky-800">
                          {equityPct.toFixed(1)}% Equity
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-slate-900 h-2 rounded-full mt-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-sky-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, equityPct)}%` }}
                        />
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800/80">
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                          Calculated Monthly Dividend
                        </span>
                        <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                          Rs. {calculatedDividend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {equityPct}% of Rs. {(netProfit > 0 ? netProfit : 0).toLocaleString()} net profit
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 flex items-center justify-end">
                      <button
                        onClick={() => {
                          setEditPartnerModal(partner);
                          setPartnerForm({
                            id: partner.id,
                            partner_name: partner.partner_name,
                            equity_percentage: partner.equity_percentage,
                            phone: partner.phone || '',
                          });
                        }}
                        className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl transition border border-slate-800"
                      >
                        Edit Share
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consumable COGS Breakdown Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-400" /> Detailing Consumables COGS Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Itemized chemical/film consumption for {dividendData?.month || currentMonth}. Deducted strictly at cost.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Consumable Item</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Consumed Units</th>
                    <th className="py-3 px-4 text-right">Cost Per Unit</th>
                    <th className="py-3 px-4 text-right font-black text-white">Total COGS Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {dividendData?.cogs_breakdown?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white">{item.inventory_name}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold">
                          {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400 font-bold">
                        {item.total_units_consumed} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        Rs. {item.cost_per_unit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                        Rs. {item.total_cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {(!dividendData?.cogs_breakdown || dividendData.cogs_breakdown.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        No consumable yield deductions recorded for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: IMMUTABLE AUDIT LOG */}
      {/* ============================================================== */}
      {activeAdminTab === 'audit' && (
        <div className="space-y-6">
          {/* Header & Control Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      Immutable System Audit Trail
                      <span className="text-[10px] bg-rose-950 text-rose-400 font-mono px-2 py-0.5 rounded border border-rose-800 font-bold uppercase">
                        Tamper-Evident
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chronological ledger tracking cash variances, discounts, refunds, and manual inventory shifts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Filter & Refresh */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={auditFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAuditFilter(val);
                      fetchAuditLogs(val);
                    }}
                    className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-slate-900">All Audit Events</option>
                    <option value="REGISTER_VARIANCE" className="bg-slate-900">Register Cash Variances</option>
                    <option value="INVOICE_REFUND" className="bg-slate-900">Credit Notes / Refunds</option>
                    <option value="INVOICE_DISCOUNT" className="bg-slate-900">Invoice Discounts</option>
                    <option value="INVENTORY_ADJUSTMENT" className="bg-slate-900">Manual Stock Adjustments</option>
                    <option value="INVENTORY_RESTOCK" className="bg-slate-900">Shipment Restocks</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => fetchAuditLogs(auditFilter)}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition flex items-center gap-2 text-xs font-bold"
                  title="Reload Audit Logs"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin text-rose-400' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Logged Events</span>
                <span className="text-xl font-mono font-black text-white mt-1 block">
                  {auditLogs.length}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                <span className="text-[10px] text-rose-400 uppercase font-bold block">Cash Variances</span>
                <span className="text-xl font-mono font-black text-rose-400 mt-1 block">
                  {auditLogs.filter((l) => l.action === 'REGISTER_VARIANCE').length}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                <span className="text-[10px] text-amber-400 uppercase font-bold block">Credit Refunds</span>
                <span className="text-xl font-mono font-black text-amber-400 mt-1 block">
                  {auditLogs.filter((l) => l.action === 'INVOICE_REFUND').length}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                <span className="text-[10px] text-purple-400 uppercase font-bold block">Authorized Discounts</span>
                <span className="text-xl font-mono font-black text-purple-400 mt-1 block">
                  {auditLogs.filter((l) => l.action === 'INVOICE_DISCOUNT').length}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-mono text-[11px] tracking-wider">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Action Type</th>
                    <th className="py-3.5 px-4">Audit Narrative</th>
                    <th className="py-3.5 px-4">Authorized By</th>
                    <th className="py-3.5 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {auditLogs.map((log) => {
                    const actionBadge = (() => {
                      switch (log.action) {
                        case 'REGISTER_VARIANCE':
                          return (
                            <span className="bg-rose-950/80 text-rose-400 border border-rose-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                              REGISTER VARIANCE
                            </span>
                          );
                        case 'INVOICE_REFUND':
                          return (
                            <span className="bg-amber-950/80 text-amber-400 border border-amber-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                              CREDIT REFUND
                            </span>
                          );
                        case 'INVOICE_DISCOUNT':
                          return (
                            <span className="bg-purple-950/80 text-purple-300 border border-purple-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                              DISCOUNT OVERRIDE
                            </span>
                          );
                        case 'INVENTORY_RESTOCK':
                          return (
                            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                              STOCK RESTOCK
                            </span>
                          );
                        case 'INVENTORY_ADJUSTMENT':
                          return (
                            <span className="bg-sky-950/80 text-sky-400 border border-sky-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                              MANUAL STOCK
                            </span>
                          );
                        default:
                          return (
                            <span className="bg-slate-800 text-slate-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                              {log.action}
                            </span>
                          );
                      }
                    })();

                    const dateStr = log.created_at
                      ? new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'N/A';

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {actionBadge}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-200">
                          {log.description}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-white">
                            {log.performed_by_name || 'System / Staff'}
                          </span>
                          {log.performed_by_user_id && (
                            <span className="block font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                              {log.performed_by_user_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-400">
                          {log.metadata ? (
                            <span
                              title={JSON.stringify(log.metadata, null, 2)}
                              className="bg-slate-950 px-2 py-1 rounded border border-slate-800 inline-block max-w-[180px] truncate"
                            >
                              {Object.entries(log.metadata)
                                .slice(0, 2)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' • ')}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {auditLogs.length === 0 && !isLoadingAudit && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">No audit events match the selected criteria.</p>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Sensitive actions such as variances, discounts, and refunds will appear here in real time.
                        </p>
                      </td>
                    </tr>
                  )}
                  {isLoadingAudit && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
                        <p>Loading tamper-evident audit logs...</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* RESTOCK MODAL */}
      {/* ============================================================== */}
      {restockModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" /> Restock Consumable Shipment
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Add arriving stock for <span className="text-white font-semibold">{restockModal.item_name}</span>.
            </p>

            <form onSubmit={handleRestockSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400">
                  Current Stock: {restockModal.current_stock} {restockModal.unit_type}
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder={`Quantity to add in ${restockModal.unit_type}`}
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <span className="absolute right-4 top-2.5 text-slate-500 text-xs font-mono">
                    {restockModal.unit_type}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* NEW CONSUMABLE MODAL */}
      {/* ============================================================== */}
      {newConsumableModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-400" /> New Consumable Item
            </h3>
            <p className="text-xs text-slate-400 mt-1">Register a high-value consumable in inventory.</p>

            <form onSubmit={handleCreateItemSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ceramic Coating 9H Pro"
                  value={newItemForm.item_name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, item_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs mt-1 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Unit Type</label>
                  <select
                    value={newItemForm.unit_type}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unit_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-sky-500"
                  >
                    <option value="ML">ML (Milliliters)</option>
                    <option value="ROLL">ROLL (PPF / Film)</option>
                    <option value="PIECE">PIECE (Pads / Towels)</option>
                    <option value="Unit">Unit / Bottle</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Initial Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500"
                    value={newItemForm.current_stock}
                    onChange={(e) => setNewItemForm({ ...newItemForm, current_stock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Cost Per Unit (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 150"
                    value={newItemForm.cost_per_unit}
                    onChange={(e) => setNewItemForm({ ...newItemForm, cost_per_unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 10"
                    value={newItemForm.low_stock_threshold}
                    onChange={(e) =>
                      setNewItemForm({ ...newItemForm, low_stock_threshold: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewConsumableModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Create Consumable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SERVICE INVENTORY YIELD MAPPING MODAL */}
      {/* ============================================================== */}
      {yieldModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-emerald-400" /> Map Consumable Yield to Service
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Specify how much chemical or film is deducted automatically when this service is invoiced.
            </p>

            <form onSubmit={handleYieldMappingSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400">Select Service</label>
                <select
                  required
                  value={yieldForm.service_id}
                  onChange={(e) => setYieldForm({ ...yieldForm, service_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Billed Service --</option>
                  {servicesList.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} (Rs. {srv.base_price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Select Consumable Inventory</label>
                <select
                  required
                  value={yieldForm.inventory_id}
                  onChange={(e) => setYieldForm({ ...yieldForm, inventory_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Inventory Consumable --</option>
                  {inventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.item_name} ({inv.current_stock} {inv.unit_type} in stock @ Rs. {inv.cost_per_unit}/unit)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Deduction Amount Per Vehicle</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 30 (for 30 ML) or 1.5 (for rolls)"
                  value={yieldForm.deduction_amount}
                  onChange={(e) => setYieldForm({ ...yieldForm, deduction_amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setYieldModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Save Yield Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT SALARY / COMMISSION MODAL */}
      {/* ============================================================== */}
      {editSalaryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Edit Staff Compensation
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Adjust base monthly salary, flat per-car rate, or commission rate for{' '}
              <span className="text-white font-semibold">{editSalaryModal.name}</span>.
            </p>

            <form onSubmit={handleSalarySubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400">Base Monthly Salary (Rs.)</label>
                <input
                  type="number"
                  step="100"
                  required
                  value={salaryForm.base_salary}
                  onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Flat Commission Per Car (Rs.) - Wash Teams</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  placeholder="e.g. 150 (paid per car washed)"
                  value={salaryForm.flat_commission}
                  onChange={(e) => setSalaryForm({ ...salaryForm, flat_commission: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Percentage Commission Rate (%) - Detailing Team</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 10 (%)"
                  value={salaryForm.commission_rate}
                  onChange={(e) => setSalaryForm({ ...salaryForm, commission_rate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditSalaryModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT / CREATE PARTNER EQUITY MODAL */}
      {/* ============================================================== */}
      {editPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-emerald-400" />{' '}
              {editPartnerModal.isNew ? 'Register Partner Equity' : 'Edit Partner Equity'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure profit dividend allocation percentage for sleeping partner.
            </p>

            <form onSubmit={handlePartnerSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400">Partner Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Malik Umair"
                  value={partnerForm.partner_name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, partner_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-xs mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Equity Share Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  required
                  placeholder="e.g. 40.0"
                  value={partnerForm.equity_percentage}
                  onChange={(e) => setPartnerForm({ ...partnerForm, equity_percentage: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Phone / Telegram Contact (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. +923001234567"
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-xs mt-1 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditPartnerModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Save Partner Share
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
