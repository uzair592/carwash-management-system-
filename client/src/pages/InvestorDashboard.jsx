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
  Eye,
  Layers,
  Sparkles,
  Lock,
  Coins
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function InvestorDashboard() {
  const { isAdmin } = useAuth();
  const [investorPin, setInvestorPin] = useState(() => sessionStorage.getItem('investor_pin') || '');
  const [isUnlocked, setIsUnlocked] = useState(() => Boolean(sessionStorage.getItem('investor_pin')));
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());
  const [isTriggeringEod, setIsTriggeringEod] = useState(false);
  const [toast, setToast] = useState(null);

  const getHeaders = () => {
    const pin = investorPin || sessionStorage.getItem('investor_pin');
    return pin ? { 'x-investor-pin': pin } : {};
  };

  const fetchLiveData = async (pinOverride) => {
    const pin = pinOverride || investorPin || sessionStorage.getItem('investor_pin');
    const headers = pin ? { 'x-investor-pin': pin } : {};
    try {
      const res = await axios.get('/api/dashboard/live', { headers });
      if (res.data?.data) {
        setData(res.data.data);
      }
      setLastSync(new Date());
      return true;
    } catch (err) {
      if (err.response?.status === 401) {
        setIsUnlocked(false);
        sessionStorage.removeItem('investor_pin');
        setInvestorPin('');
      }
      console.error('Failed to fetch investor metrics:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked || isAdmin) {
      fetchLiveData();
      const interval = setInterval(() => fetchLiveData(), 15000); // 15-second live poller
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [isUnlocked, isAdmin]);

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    setIsVerifyingPin(true);
    setPinError('');

    try {
      const success = await fetchLiveData(pinInput.trim());
      if (success) {
        sessionStorage.setItem('investor_pin', pinInput.trim());
        setInvestorPin(pinInput.trim());
        setIsUnlocked(true);
      } else {
        setPinError('Invalid Investor PIN. Remote access denied.');
      }
    } catch (err) {
      setPinError(err.response?.data?.message || 'Access verification failed.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLockSession = () => {
    sessionStorage.removeItem('investor_pin');
    setInvestorPin('');
    setIsUnlocked(false);
    setData(null);
  };

  const handleManualEodPush = async () => {
    setIsTriggeringEod(true);
    try {
      await axios.post('/api/dashboard/trigger-eod', {}, { headers: getHeaders() });
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
  const baysBreakdown = data?.bays_breakdown || { jack_1: 0, jack_2: 0, detailing_center: 0 };
  const registerSummary = data?.register_summary || { total_shifts: 0, closed_shifts: 0, open_shifts: 0, total_variance: 0, sessions: [] };
  const vaults = data?.vault_balances || {};
  const bays = data?.live_bays || { in_progress: [], queued: [] };
  const invoices = data?.recent_invoices || [];

  // PIN Lock Screen if not authenticated
  if (!isUnlocked && !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 bg-sky-50 border-2 border-sky-500 rounded-lg flex items-center justify-center mx-auto text-sky-700 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Investor Portal Locked</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Remote tunnel security enabled. Enter your confidential Investor PIN to view live shop finances and bay activity.
          </p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              maxLength="8"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder="••••"
              autoFocus
              className="w-full text-center tracking-[0.5em] text-2xl tabular-nums py-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
            />
            {pinError && (
              <p className="text-xs text-rose-700 font-semibold mt-2 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {pinError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <button
              type="button"
              onClick={() => setPinInput('1122')}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs tabular-nums text-slate-500 hover:text-slate-900 hover:border-slate-200 transition text-center"
            >
              Demo Partner PIN: 1122
            </button>
            <button
              type="button"
              onClick={() => setPinInput('1234')}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs tabular-nums text-slate-500 hover:text-slate-900 hover:border-slate-200 transition text-center"
            >
              Admin Master: 1234
            </button>
          </div>

          <button
            type="submit"
            disabled={isVerifyingPin || !pinInput}
            className="w-full bg-gradient-to-r from-sky-500 text-white to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-slate-900 font-semibold py-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
          >
            {isVerifyingPin ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Authenticating Tunnel...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Unlock Live Dashboard
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-500 tabular-nums">
          🔒 Cloudflare Tunnel Ready • Encrypted Local Vault
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Absentee Partner Security Badge */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm ">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-700">
            <Eye className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                Business overview
              </h2>
              <span className="bg-emerald-50 text-emerald-700 tabular-nums text-xs uppercase font-bold px-2 py-0.5 rounded border border-emerald-200">
                Read-Only Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sales, balances and workshop activity in one place.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLiveData()}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-700" />
            Live Sync ({lastSync.toLocaleTimeString()})
          </button>

          <button
            onClick={handleManualEodPush}
            disabled={isTriggeringEod}
            className="bg-gradient-to-r from-sky-500 text-white to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-slate-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            {isTriggeringEod ? 'Sending...' : 'Push EOD to Telegram'}
          </button>

          {isUnlocked && (
            <button
              onClick={handleLockSession}
              title="Lock Investor Session"
              className="bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-700 p-2.5 rounded-xl transition"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-lg text-xs font-semibold flex items-center gap-2.5 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-500 text-emerald-700'
              : 'bg-rose-50 border border-rose-500 text-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          {toast.text}
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Gross Revenue */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm relative overflow-hidden">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Today's Gross Revenue
          </span>
          <div className="text-2xl font-semibold tabular-nums text-emerald-700 mt-1">
            Rs. {Number(summary.gross_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex justify-between tabular-nums">
            <span>Cash: Rs. {Number(summary.cash_revenue || 0).toLocaleString()}</span>
            <span>Bank: Rs. {Number(summary.bank_revenue || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Metric 2: Net Cash Flow */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Reported net profit
          </span>
          <div className={`text-2xl font-semibold tabular-nums mt-1 ${
            (summary.net_profit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {(summary.net_profit || 0) >= 0 ? '+' : ''}
            Rs. {Number(summary.net_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Expenses Deducted: Rs. {Number(summary.total_expenses || 0).toLocaleString()}
          </div>
        </div>

        {/* Metric 3: Total Washes */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Vehicles Finished Today
          </span>
          <div className="text-2xl font-semibold tabular-nums text-slate-900 mt-1 flex items-center gap-2">
            <Car className="w-6 h-6 text-sky-700" />
            {summary.cars_washed_today || 0} Cars
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Live in Bays: {summary.active_in_bay || 0} | Queued: {summary.queued_in_intake || 0}
          </div>
        </div>

        {/* Metric 4: Cash Drawer Vault */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Cash balance
          </span>
          <div className="text-2xl font-semibold tabular-nums text-amber-700 mt-1 flex items-center gap-2">
            <Vault className="w-5 h-5 text-amber-700" />
            Rs. {Number(vaults.cash_drawer || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular-nums">
            Main Bank: Rs. {Number(vaults.main_bank || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* PHYSICAL BAY BREAKDOWN CARDS: Jack 1, Jack 2, Detailing Center */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-700" />
              Physical Work Areas Productivity Today
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Vehicles washed and processed per physical zone</p>
          </div>
          <span className="text-xs tabular-nums bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1 rounded-xl">
            {summary.cars_washed_today || 0} Total Completed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Jack 1 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-sky-700 tabular-nums block">Hydraulic Bay 1</span>
              <h4 className="text-base font-semibold text-slate-900 mt-0.5">Washing Jack 1</h4>
              <p className="text-xs text-slate-500">Wash Team 1</p>
            </div>
            <div className="text-right">
              <span className="tabular-nums text-2xl font-semibold text-amber-700">{baysBreakdown.jack_1 || 0}</span>
              <span className="text-xs text-slate-500 uppercase font-bold block">Cars Done</span>
            </div>
          </div>

          {/* Jack 2 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-sky-700 tabular-nums block">Hydraulic Bay 2</span>
              <h4 className="text-base font-semibold text-slate-900 mt-0.5">Washing Jack 2</h4>
              <p className="text-xs text-slate-500">Wash Team 2</p>
            </div>
            <div className="text-right">
              <span className="tabular-nums text-2xl font-semibold text-amber-700">{baysBreakdown.jack_2 || 0}</span>
              <span className="text-xs text-slate-500 uppercase font-bold block">Cars Done</span>
            </div>
          </div>

          {/* Detailing Studio */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-purple-700 tabular-nums block">Studio Bay 3</span>
              <h4 className="text-base font-semibold text-slate-900 mt-0.5">Detailing Center</h4>
              <p className="text-xs text-slate-500">Detailing Team</p>
            </div>
            <div className="text-right">
              <span className="tabular-nums text-2xl font-semibold text-purple-700">{baysBreakdown.detailing_center || 0}</span>
              <span className="text-xs text-slate-500 uppercase font-bold block">Cars Detailed</span>
            </div>
          </div>
        </div>
      </div>

      {/* CASH REGISTER SESSIONS AUDIT & TILL DISCREPANCIES */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-700" />
              Cash Register Shifts & Till Reconciliation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditing cashier shifts, starting float change, counted cash, and till variances
            </p>
          </div>

          {/* Till Variance Indicator */}
          <div>
            {Math.abs(registerSummary.total_variance || 0) < 0.01 ? (
              <span className="text-xs tabular-nums font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                All Tills Balanced (Rs. 0.00 Variance)
              </span>
            ) : registerSummary.total_variance < 0 ? (
              <span className="text-xs tabular-nums font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 ">
                <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                Till Shortage: -Rs. {Math.abs(registerSummary.total_variance).toLocaleString()}
              </span>
            ) : (
              <span className="text-xs tabular-nums font-bold bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                Till Surplus: +Rs. {registerSummary.total_variance.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {registerSummary.sessions?.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No register shifts recorded today. Cashier shifts will appear here upon opening.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-xs">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3">Opened</th>
                  <th className="py-2.5 px-3">Closed</th>
                  <th className="py-2.5 px-3 text-right">Start Float</th>
                  <th className="py-2.5 px-3 text-right">Counted Cash</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-slate-600">
                {registerSummary.sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-100 transition">
                    <td className="py-3 px-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          sess.status === 'OPEN'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {sess.opened_by?.name || 'Cashier'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(sess.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {sess.closed_at
                        ? new Date(sess.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">
                      Rs. {parseFloat(sess.starting_cash).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-900 font-bold">
                      {sess.actual_counted_cash
                        ? `Rs. ${parseFloat(sess.actual_counted_cash).toLocaleString()}`
                        : 'In Till'}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {sess.variance !== null && sess.variance !== undefined ? (
                        <span
                          className={
                            Math.abs(parseFloat(sess.variance)) < 0.01
                              ? 'text-emerald-700'
                              : parseFloat(sess.variance) < 0
                              ? 'text-rose-700'
                              : 'text-sky-700'
                          }
                        >
                          {Math.abs(parseFloat(sess.variance)) < 0.01
                            ? 'Rs. 0.00'
                            : `${parseFloat(sess.variance) < 0 ? '-' : '+'}Rs. ${Math.abs(parseFloat(sess.variance)).toLocaleString()}`}
                        </span>
                      ) : (
                        <span className="text-slate-500">Pending Close</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2-Column Section: Live Bay Operations & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Real-Time Bay Occupancy */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700" />
              Live Bay Occupancy
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {bays.in_progress.length} active wash bays
            </span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {bays.in_progress.map((item) => (
              <div
                key={item.job_card_id}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <span className="tabular-nums text-lg font-semibold text-amber-700">
                    {item.plate}
                  </span>
                  <p className="text-xs text-slate-500">
                    {item.make_model} • Tech: <span className="text-slate-700">{item.worker}</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                    {item.services}
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-amber-50 text-amber-700 text-xs font-bold tabular-nums px-2 py-0.5 rounded border border-amber-200">
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              Recent Invoices & Audited Receipts
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              Last {invoices.length} invoices
            </span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {invoices.map((inv) => (
              <div
                key={inv.invoice_number}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between tabular-nums"
              >
                <div>
                  <span className="text-sky-700 text-xs font-bold">#{inv.invoice_number}</span>
                  <p className="text-sm font-semibold text-amber-700">{inv.plate}</p>
                  <span className="text-xs text-slate-500">
                    {new Date(inv.time).toLocaleTimeString()} • Tender: {inv.payment_method}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-semibold text-emerald-700">
                    Rs. {Number(inv.amount).toLocaleString()}
                  </span>
                  <span className="block text-xs text-emerald-500 font-bold uppercase">
                    Settled & Logged
                  </span>
                </div>
              </div>
            ))}

            {invoices.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs italic">
                No invoices recorded today yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
