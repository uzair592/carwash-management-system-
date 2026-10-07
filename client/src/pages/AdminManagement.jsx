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
} from 'lucide-react';
import axios from 'axios';

export default function AdminManagement() {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(true); // Pre-unlocked for smooth DX, with option to lock
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState('inventory'); // 'inventory' | 'payroll'

  // Inventory state
  const [inventory, setInventory] = useState([]);
  const [isLoadingInv, setIsLoadingInv] = useState(false);
  const [restockModal, setRestockModal] = useState(null); // item object or null
  const [restockQty, setRestockQty] = useState('');
  const [newConsumableModal, setNewConsumableModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    item_name: '',
    unit_type: 'Unit',
    current_stock: '',
    cost_per_unit: '',
    low_stock_threshold: '10',
  });

  // Payroll state
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollData, setPayrollData] = useState(null);
  const [isLoadingPayroll, setIsLoadingPayroll] = useState(false);
  const [editSalaryModal, setEditSalaryModal] = useState(null); // user object or null
  const [salaryForm, setSalaryForm] = useState({ base_salary: '', commission_rate: '' });

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

  // Fetch Payroll for chosen month
  const fetchPayroll = async (month) => {
    setIsLoadingPayroll(true);
    try {
      const res = await axios.get(`/api/payroll/generate?month=${month}`);
      if (res.data) {
        setPayrollData(res.data);
      }
    } catch (err) {
      console.error('Failed to generate payroll:', err);
      showToast('error', `Failed to generate payroll: ${err.message}`);
    } finally {
      setIsLoadingPayroll(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchInventory();
      fetchPayroll(currentMonth);
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
        unit_type: 'Unit',
        current_stock: '',
        cost_per_unit: '',
        low_stock_threshold: '10',
      });
      fetchInventory();
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
        base_salary: parseFloat(salaryForm.base_salary),
        commission_rate: parseFloat(salaryForm.commission_rate),
      });
      showToast('success', `Updated compensation for ${editSalaryModal.name}`);
      setEditSalaryModal(null);
      fetchPayroll(currentMonth);
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
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
          Enter Shop Admin PIN to access Inventory Yield Control and Monthly Payroll.
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
                Admin Control Terminal
              </h2>
              <span className="bg-sky-950 text-sky-300 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-sky-800">
                Phase 7 Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Consumable Yield Theft-Protection • Automated Monthly Staff Payroll Engine
            </p>
          </div>
        </div>

        {/* Tab Toggle Buttons */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
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
              <p className={`text-2xl font-black mt-2 ${lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                {lowStockCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Below partner alert threshold</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Total Asset Valuation</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-2">
                Rs. {totalInvValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Current floor inventory value</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400">Yield Engine</span>
                <p className="text-sm font-bold text-sky-400 mt-1">Auto-Deductions Active</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Linked to invoice checkouts</p>
              </div>
              <button
                onClick={() => setNewConsumableModal(true)}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold p-3 rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <PlusCircle className="w-4 h-4" /> Add Item
              </button>
            </div>
          </div>

          {/* Consumable Inventory Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Consumable Floor Inventory</h3>
                <p className="text-xs text-slate-400">
                  Consumables automatically deducted upon invoice finalization to prevent shrinkage.
                </p>
              </div>
              <button
                onClick={fetchInventory}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInv ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Low Stock Alert</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Total Value</th>
                    <th className="py-3 px-4">Linked Services</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {inventory.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition ${
                        item.is_low_stock ? 'bg-rose-950/15' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {item.item_name}
                          {item.is_low_stock && (
                            <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" /> Low Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{item.unit_type}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {item.current_stock.toLocaleString('en-US', { minimumFractionDigits: 1 })}{' '}
                        <span className="text-slate-500 font-normal">{item.unit_type}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        ≤ {item.low_stock_threshold} {item.unit_type}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        Rs. {item.cost_per_unit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        Rs. {(item.current_stock * item.cost_per_unit).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.services && item.services.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.services.map((s) => (
                              <span
                                key={s.id}
                                className="bg-sky-950/80 text-sky-300 border border-sky-800/50 text-[10px] px-2 py-0.5 rounded"
                              >
                                {s.name} (-{s.inventory_deduction_amount} {item.unit_type})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Unlinked</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setRestockModal(item)}
                          className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 mx-auto text-[11px]"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500">
                        No inventory consumables registered.
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
      {/* TAB 2: MONTHLY STAFF PAYROLL ENGINE */}
      {/* ============================================================== */}
      {activeAdminTab === 'payroll' && (
        <div className="space-y-6">
          {/* Month Selector Bar & Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-400" />
                Monthly Staff Payroll Statement
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated compensation breakdown: Base Salary + Job Card Commissions.
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
                  Month Period: {payrollData?.month} • Exact calculations verifiable in ledger
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Base Salary</th>
                    <th className="py-3 px-4 text-center">Completed Jobs</th>
                    <th className="py-3 px-4 text-right">Revenue Generated</th>
                    <th className="py-3 px-4 text-center">Comm. Rate</th>
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
                          {staff.role}
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
                        {staff.commission_rate}%
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
                    <option value="Roll">Roll (PPF / Film)</option>
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
                    placeholder="e.g. 50"
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
      {/* EDIT SALARY / COMMISSION MODAL */}
      {/* ============================================================== */}
      {editSalaryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Edit Staff Compensation
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Adjust base monthly salary and commission rate for{' '}
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
                <label className="text-xs text-slate-400">Commission Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
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
    </div>
  );
}
