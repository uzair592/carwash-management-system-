import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
export default function LoginScreen() {
  const {
    login
  } = useAuth();
  const [restoreNotice] = useState(() => { const value = sessionStorage.getItem('dfpro_restore_notice'); sessionStorage.removeItem('dfpro_restore_notice'); return value; });
  const [name, setName] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return <main className="min-h-screen grid place-items-center bg-slate-100 p-4"><form className="surface p-7 w-full max-w-sm" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      const r = await login(name, password);
      setBusy(false);
      setError(r.message || '');
    }}><h1 className="text-2xl font-black">DF PRO</h1><p className="text-slate-500 mt-1 mb-5">Sign in to your shop account</p>{restoreNotice && <p role="status" className="success-note mb-4">{restoreNotice}</p>}<label className="block mb-4">Username<input required autoComplete="username" className="form-input w-full mt-1" value={name} onChange={e => setName(e.target.value)} /></label><label className="block mb-4">Password<input required type="password" autoComplete="current-password" className="form-input w-full mt-1" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert" className="form-error mb-3">{error}</p>}<button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></main>;
}
