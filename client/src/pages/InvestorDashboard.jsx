import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Car, 
  Vault, 
  DollarSign, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye
} from 'lucide-react';
import axios from 'axios';

export default function InvestorDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());
  const [isTriggeringEod, setIsTriggeringEod] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchLiveData = async () => {
    try {
      const res = await axios.get('/api/dashboard/live');
      if (res.data?.data) {
        setData(res.data.data);
      }
      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to fetch investor metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 15000); // 15-second live poller
    return () => clearInterval(interval);
  }, []);

  const handleManualEodPush = async () => {
    setIsTriggeringEod(true);
    try {
      await axios.post('/api/dashboard/trigger-eod');
      setToast({
        type: 'success',
        text: 'EOD Financial Dossier successfully compiled and dispatched to Telegram!',
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: `Failed to dispatch EOD report: ${err.message}`,
      });
    } finally {
      setIsTriggeringEod(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const summary = data?.today_summary || {};
  const vaults = data?.vault_balances || {};
  const bays = data?.live_bays || { in_progress: [], queued: [] };
  const invoices = data?.recent_invoices || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Absentee Partner Security Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-2xl text-sky-400">
            <Eye className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Investor & Partner Portal
              </h2>
              <span className="bg-emerald-950 text-emerald-300 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-emerald-800">
                Read-Only Audit
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Zero-leakage absentee partner oversight • Powered by immutable PostgreSQL ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLiveData}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            Live Sync ({lastSync.toLocaleTimeString()})
          </button>

          <button
            onClick={handleManualEodPush}
            disabled={isTriggeringEod}
            className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20 transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            {isTriggeringEod ? 'Sending...' : 'Push EOD to Telegram'}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-200'
              : 'bg-rose-950/90 border border-rose-500 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          {toast.text}
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Gross Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Today's Gross Revenue
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            Rs. {Number(summary.gross_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex justify-between font-mono">
            <span>Cash: Rs. {Number(summary.cash_revenue || 0).toLocaleString()}</span>
            <span>Bank: Rs. {Number(summary.bank_revenue || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Metric 2: Net Cash Flow */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Net Daily Cash Flow
          </span>
          <div className={`text-2xl font-black font-mono mt-1 ${
            (summary.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(summary.net_profit || 0) >= 0 ? '+' : ''}
            Rs. {Number(summary.net_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Expenses Deducted: Rs. {Number(summary.total_expenses || 0).toLocaleString()}
          </div>
        </div>

        {/* Metric 3: Total Washes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Vehicles Completed Today
          </span>
          <div className="text-2xl font-black font-mono text-white mt-1 flex items-center gap-2">
            <Car className="w-6 h-6 text-sky-400" />
            {summary.cars_washed_today || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Live in bays: {summary.active_in_bay || 0} | Queued: {summary.queued_in_intake || 0}
          </div>
        </div>

        {/* Metric 4: Cash Drawer Vault */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Vault 1: Physical Cash Drawer
          </span>
          <div className="text-2xl font-black font-mono text-amber-300 mt-1 flex items-center gap-2">
            <Vault className="w-5 h-5 text-amber-400" />
            Rs. {Number(vaults.cash_drawer || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Bank Vault: Rs. {Number(vaults.main_bank || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 2-Column Section: Live Bay Operations & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Real-Time Bay Occupancy */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Live Bay Occupancy
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {bays.in_progress.length} active wash bays
            </span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {bays.in_progress.map((item) => (
              <div
                key={item.job_card_id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-lg font-black text-amber-300">
                    {item.plate}
                  </span>
                  <p className="text-xs text-slate-400">
                    {item.make_model} • Tech: <span className="text-slate-200">{item.worker}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                    {item.services}
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-amber-950 text-amber-300 text-[10px] font-bold font-mono px-2 py-0.5 rounded border border-amber-800">
                    In Progress
                  </span>
                </div>
              </div>
            ))}

            {bays.in_progress.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs italic">
                All bays are currently clear.
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Settled Invoices */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Recent Invoices & Audited Receipts
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Last {invoices.length} invoices
            </span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {invoices.map((inv) => (
              <div
                key={inv.invoice_number}
                className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-white block">
                    {inv.invoice_number}
                  </span>
                  <span className="text-xs text-amber-300 font-mono font-bold">
                    {inv.plate}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(inv.time).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-bold text-emerald-400 block">
                    Rs. {inv.amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    [{inv.payment_method}]
                  </span>
                </div>
              </div>
            ))}

            {invoices.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs italic">
                No invoices settled yet today.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
