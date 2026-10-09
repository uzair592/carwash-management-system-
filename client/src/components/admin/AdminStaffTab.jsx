import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
const money = value => Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
export default function AdminStaffTab({ mode = 'staff' }) {
  const accounts = mode === 'accounts';
  const { currentUser } = useAuth();
  const endpoint = accounts ? '/api/users' : '/api/staff';
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const r = await axios.get(endpoint, { params: { include_inactive: true, category: accounts ? 'accounts' : 'staff' } });
      setRecords((r.data.data || []).filter(u => accounts ? ['Admin','Accountant'].includes(u.role) : u.role === 'Worker'));
    } catch (e) { setError(e.response?.data?.message || 'Unable to load records.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [mode]);
  function open(action, user = {}) {
    setError(''); setNotice('');
    setEditor({ action, user });
    setForm({ name: user.name || '', password: '', pin_code: '', overtime_rate: user.overtime_rate || 0, base_salary: user.base_salary || 0, flat_commission: user.flat_commission || 0, commission_rate: user.commission_rate || 0 });
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const user = editor.user;
      if (editor.action === 'password') await axios.post(`/api/users/${user.id}/reset-password`, { new_password: form.password });
      else if (editor.action === 'pin') await axios.post(`/api/users/${user.id}/update-pin`, { new_pin: form.pin_code });
      else {
        const payload = accounts ? { name: form.name, ...(user.id ? {} : { role: 'Accountant', password: form.password }) } : { name: form.name, overtime_rate: Number(form.overtime_rate), base_salary: Number(form.base_salary), flat_commission: Number(form.flat_commission), commission_rate: Number(form.commission_rate) };
        if (user.id) await axios.put(`${endpoint}/${user.id}`, payload); else await axios.post(endpoint, payload);
      }
      setEditor(null); setNotice('Saved.'); await load();
    } catch (e) { setError(e.response?.data?.message || 'Unable to save.'); }
    finally { setBusy(false); }
  }
  async function toggle(user) {
    setBusy(true); setError('');
    try { await axios.patch(`${endpoint}/${user.id}/toggle-status`); await load(); }
    catch (e) { setError(e.response?.data?.message || 'Unable to change status.'); }
    finally { setBusy(false); }
  }
  return <section className="operator-records surface">
    <header className="operator-records-header"><div><h2>{accounts ? 'Shop accounts' : 'Workshop staff'}</h2><p>{accounts ? 'Admin and Accountant logins.' : 'Names, salaries and commissions. No staff login needed.'}</p></div><div className="flex gap-2"><button className="btn btn-secondary" aria-label="Refresh records" disabled={loading || busy} onClick={load}><RefreshCw size={16}/></button><button className="btn btn-primary" onClick={() => open('details')}><Plus size={16}/>{accounts ? 'Add accountant' : 'Add worker'}</button></div></header>
    {error && !editor && <div className="form-error m-3" role="alert">{error}</div>}{notice && <p className="success-note px-4 py-2" role="status">{notice}</p>}
    <div className="overflow-x-auto"><table className="operator-table"><thead><tr><th>{accounts ? 'Username' : 'Name'}</th>{accounts ? <th>Account</th> : <><th>Monthly salary</th><th>Commission</th></>}<th>Status</th><th>Actions</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={5}>Loading…</td></tr> : records.length === 0 ? <tr><td colSpan={5}>{accounts ? 'No operator accounts found.' : 'Add your workshop staff to assign them to jobs.'}</td></tr> : records.map(u => <tr key={u.id}><td><strong>{u.name}</strong>{u.id === currentUser?.id && <span className="text-xs text-slate-500 ml-2">You</span>}</td>{accounts ? <td>{u.role}</td> : <><td>Rs. {money(u.base_salary)}</td><td>{Number(u.flat_commission) > 0 ? `Rs. ${money(u.flat_commission)} / car` : `${money(u.commission_rate)}%`}</td></>}<td><span className={u.is_active ? 'record-status active' : 'record-status'}>{u.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="record-actions"><button disabled={busy} className="btn btn-secondary" onClick={() => open('details',u)}>Edit</button>{accounts && <button disabled={busy} className="btn btn-secondary" onClick={() => open('password',u)}>Change password</button>}{accounts && u.role === 'Admin' && <button disabled={busy} className="btn btn-secondary" onClick={() => open('pin',u)}>Approval PIN</button>}<button disabled={busy || u.id === currentUser?.id} className="btn btn-secondary" onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</button></div></td></tr>)}
    </tbody></table></div>
    {editor && <div className="dialog-backdrop"><form onSubmit={save} role="dialog" aria-modal="true" aria-label={accounts ? 'Edit shop account' : 'Edit workshop staff'} className="surface operator-editor"><header className="flex items-center justify-between"><h2>{editor.action === 'password' ? 'Change password' : editor.action === 'pin' ? 'Admin approval PIN' : editor.user.id ? accounts ? 'Edit account' : 'Edit worker' : accounts ? 'Add accountant' : 'Add worker'}</h2><button type="button" className="icon-button" aria-label="Close editor" disabled={busy} onClick={() => setEditor(null)}><X size={20}/></button></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {editor.action === 'details' && <label className="field-label">{accounts ? 'Username' : 'Worker name'}<input className="field" required maxLength={100} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label>}
      {(editor.action === 'password' || accounts && editor.action === 'details' && !editor.user.id) && <label className="field-label">{editor.action === 'password' ? 'New password' : 'Password'}<input className="field" aria-label={editor.action === 'password' ? 'New password' : 'Password'} type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={e => setForm({...form,password:e.target.value})}/><span className="text-xs text-slate-500">At least 8 characters.</span></label>}
      {editor.action === 'pin' && <label className="field-label">New PIN<input className="field" type="password" inputMode="numeric" pattern="[0-9]{4,8}" autoComplete="new-password" required value={form.pin_code} onChange={e => setForm({...form,pin_code:e.target.value})}/><span className="text-xs text-slate-500">4–8 digits, used only for restricted approvals.</span></label>}
      {!accounts && editor.action === 'details' && <div className="staff-pay-fields">{[['base_salary','Monthly salary'],['flat_commission','Commission per car'],['commission_rate','Commission %'],['overtime_rate','Overtime rate / hour']].map(([key,label]) => <label className="field-label" key={key}>{label}<input className="field" type="number" min="0" step="0.01" max={key === 'commission_rate' ? 100 : undefined} required value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})}/></label>)}</div>}
      <footer className="flex justify-end gap-2"><button type="button" disabled={busy} className="btn btn-secondary" onClick={() => setEditor(null)}>Cancel</button><button disabled={busy} className="btn btn-primary">{busy ? 'Saving…' : 'Save'}</button></footer>
    </form></div>}
  </section>;
}
