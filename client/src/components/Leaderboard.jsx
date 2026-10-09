import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Users } from 'lucide-react';
const money = n => Number(n || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export default function Leaderboard({ onPayroll }) {
  const { can } = useAuth();
  const [range, setRange] = useState('today'),
    [data, setData] = useState([]),
    [summary, setSummary] = useState({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await axios.get('/api/leaderboard', {
        params: {
          range
        }
      });
      setData(r.data.data);
      setSummary(r.data.summary || {});
    } catch (e) {
      setError(e.response?.data?.message || 'Staff performance could not load.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [range]);
  return <section className="space-y-4"><header className="surface compact-section-heading"><div><h2 className="text-xl font-bold">Staff performance</h2><p className="muted text-sm">Completed work and each worker’s commission.</p></div><div className="flex flex-wrap gap-2">{can('payroll.read') && <button className="btn btn-primary" onClick={onPayroll}>Overtime & pay</button>}<select className="field" aria-label="Staff performance period" value={range} onChange={e => setRange(e.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select><button className="btn btn-secondary" aria-label="Refresh staff performance" disabled={loading} onClick={load}><RefreshCw size={16} /></button></div></header>
 {error && <p className="form-error" role="alert">{error}</p>}<div className="compact-metrics"><div className="surface"><span>Workers</span><strong>{summary.assigned_workers ?? data.length}</strong></div><div className="surface"><span>Jobs completed</span><strong>{summary.completed_jobs ?? '—'}</strong></div><div className="surface"><span>Commission earned</span><strong>Rs. {money(summary.commissions ?? data.reduce((s, w) => s + w.estimated_commission, 0))}</strong></div></div>
 <div className="surface overflow-x-auto"><table className="professional-table"><thead><tr><th>Worker</th><th>Cars worked on</th><th>Revenue share</th><th>Commission earned</th></tr></thead><tbody>{data.map(w => <tr key={w.id}><td><h4 className="font-bold">{w.name}</h4></td><td>{w.cars_completed}</td><td>Rs. {money(w.total_revenue_generated)}</td><td className="font-bold">Rs. {money(w.estimated_commission)}</td></tr>)}{!data.length && <tr><td colSpan="4">{loading ? 'Loading…' : 'No active workers. Add workers under Inventory & finance → Workshop staff.'}</td></tr>}</tbody></table></div><p className="muted text-sm">A shared job counts for every assigned worker. Percentage commissions split by their recorded share; flat commissions apply per assigned car.</p>
 </section>;
}
