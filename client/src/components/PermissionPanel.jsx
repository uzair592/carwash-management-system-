import React, { useEffect, useState } from 'react';
import axios from 'axios';
export default function PermissionPanel() {
  const [data, setData] = useState({
      catalog: [],
      users: []
    }),
    [selected, setSelected] = useState(''),
    [grants, setGrants] = useState({}),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const load = () => axios.get('/api/permissions').then(r => {
    setData(r.data.data);
    const user = r.data.data.users.find(u => u.role === 'Accountant') || r.data.data.users.find(u => u.role === 'Accountant');
    if (user) {
      setSelected(user.id);
      setGrants(user.permissions);
    }
  }).catch(e => setMessage(e.response?.data?.message || 'Permissions could not load.'));
  useEffect(() => {
    load();
  }, []);
  const operators = data.users.filter(u => u.role === 'Accountant');
  return <section className="surface p-4 space-y-4"><header><h2 className="text-lg font-bold">Accountant permissions</h2><p className="muted text-sm">Admin always has full access. Changes apply to the Accountant’s next request.</p></header>
 {message && <p role="status" className="text-sm">{message}</p>}{!operators.length ? <p>Create an Accountant account in Settings → Accounts.</p> : <><label className="block text-sm font-bold">Account<select className="field mt-1" value={selected} onChange={e => {
          setSelected(e.target.value);
          setGrants(data.users.find(u => u.id === e.target.value).permissions);
        }}>{operators.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
 <div className="permission-groups">{[...new Set(data.catalog.map(p => p.group))].map(group => <fieldset className="permission-group" key={group}><legend>{group}</legend>{data.catalog.filter(p => p.group === group).map(p => <label key={p.key} className="permission-switch"><span>{p.label}</span><input type="checkbox" checked={grants[p.key] === true} onChange={e => setGrants(prev => ({
              ...prev,
              [p.key]: e.target.checked
            }))} /></label>)}</fieldset>)}</div>
 <button className="btn btn-primary" disabled={busy} onClick={async () => {
        setBusy(true);
        setMessage('');
        try {
          await axios.patch(`/api/permissions/${selected}`, {
            permissions: grants
          });
          setData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === selected ? {
              ...u,
              permissions: grants
            } : u)
          }));
          setMessage('Permissions saved.');
        } catch (e) {
          setMessage(e.response?.data?.message || 'Save failed.');
        } finally {
          setBusy(false);
        }
      }}>{busy ? 'Saving…' : 'Save permissions'}</button></>}
 </section>;
}
