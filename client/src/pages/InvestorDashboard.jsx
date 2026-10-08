import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
const money = n => Number(n || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export default function InvestorDashboard() {
  const {
    can
  } = useAuth();
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await axios.get('/api/dashboard/live');
      setData(r.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Business overview could not load.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  const s = data?.today_summary || {},
    vault = data?.vault_balances || {},
    bays = data?.live_bays || {};
  return <section className="space-y-4"><header className="surface compact-section-heading"><div><h2 className="text-xl font-bold">Business overview</h2><p className="muted text-sm">Today’s activity · Karachi time{data?.as_of ? ` · Updated ${new Date(data.as_of).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit'
          })}` : ''}</p></div><div className="flex gap-2"><button className="btn btn-secondary" aria-label="Live Sync" disabled={busy} onClick={load}><RefreshCw size={16} />Refresh</button>{can('overview.dispatch') && <button className="btn btn-secondary" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await axios.post('/api/dashboard/trigger-eod');
            setMessage('Daily summary queued for delivery.');
          } catch (e) {
            setError(e.response?.data?.message || 'Summary could not be queued.');
          } finally {
            setBusy(false);
          }
        }}><Send size={16} />Send summary</button>}</div></header>
 {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-note">{message}</p>}
 <div className="compact-metrics overview-metrics">{[['Sales', s.gross_revenue], ['Collected', Number(s.cash_revenue || 0) + Number(s.bank_revenue || 0)], ['Expenses', s.total_expenses], ['Net cash flow', s.net_cash_flow ?? s.net_profit]].map(([label, value]) => <div className="surface" key={label}><span>{label}</span><strong>{value === undefined ? '—' : `Rs. ${money(value)}`}</strong></div>)}</div>
 <div className="overview-panels"><section className="surface p-4"><h3 className="font-bold mb-3">Account balances</h3><div className="receipt-row"><span>Cash drawer</span><strong>Rs. {money(vault.cash_drawer)}</strong></div><div className="receipt-row"><span>Bank accounts</span><strong>Rs. {money(vault.main_bank)}</strong></div><div className="receipt-row border-t pt-2"><span>Combined balance</span><strong>Rs. {money(vault.combined_total ?? Number(vault.cash_drawer || 0) + Number(vault.main_bank || 0))}</strong></div><div className="receipt-row"><span>Customer advances today</span><strong>Rs. {money(s.advances_collected)}</strong></div><div className="receipt-row"><span>Refunds today</span><strong>Rs. {money(s.total_refunds)}</strong></div></section><section className="surface p-4"><h3 className="font-bold mb-3">Workshop activity</h3><div className="receipt-row"><span>Completed today</span><strong>{s.cars_washed_today ?? '—'}</strong></div><div className="receipt-row"><span>In progress</span><strong>{s.active_in_bay ?? '—'}</strong></div><div className="receipt-row"><span>Waiting for bay</span><strong>{s.queued_in_intake ?? '—'}</strong></div><div className="receipt-row"><span>Detailing completed</span><strong>{data?.bays_breakdown?.detailing_center ?? '—'}</strong></div></section></div>
 <section className="surface overflow-x-auto"><h3 className="font-bold p-4">Live work</h3><table className="professional-table"><thead><tr><th>Vehicle</th><th>Services</th><th>Worker</th><th>Status</th></tr></thead><tbody>{[...(bays.in_progress || []).map(j => ({
            ...j,
            state: 'In progress'
          })), ...(bays.queued || []).map(j => ({
            ...j,
            state: 'Waiting'
          }))].map(j => <tr key={j.job_card_id}><td className="font-bold">{j.plate}</td><td>{j.services}</td><td>{j.worker || '—'}</td><td>{j.state}</td></tr>)}{!bays.in_progress?.length && !bays.queued?.length && <tr><td colSpan="4">No vehicles currently in the workshop.</td></tr>}</tbody></table></section>
 <section className="surface overflow-x-auto"><h3 className="font-bold p-4">Recent invoices</h3><table className="professional-table"><thead><tr><th>Invoice</th><th>Vehicle</th><th>Amount</th><th>Payment</th><th>Balance due</th></tr></thead><tbody>{(data?.recent_invoices || []).map((i, index) => <tr key={i.invoice_number || i.id || index}><td>{i.invoice_number}</td><td>{i.plate || i.job_card?.vehicle?.registration_number}</td><td>Rs. {money(i.amount ?? i.total_amount)}</td><td>{i.payment_method}</td><td>Rs. {money(i.balance_due)}</td></tr>)}</tbody></table></section><p className="muted text-sm">Net cash flow includes collections and advances, less expenses and refunds. It is not net profit.</p></section>;
}
