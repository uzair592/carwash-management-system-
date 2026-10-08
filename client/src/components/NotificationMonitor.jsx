import React, { useEffect, useState } from 'react';
import axios from 'axios';
export default function NotificationMonitor() {
  const [alerts, setAlerts] = useState([]),
    [error, setError] = useState('');
  const load = () => axios.get('/api/alerts').then(r => {
    setAlerts(r.data.data);
    setError('');
  }).catch(() => setError('Alert delivery status could not load.'));
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  return <section className="surface p-4 mt-4"><h2 className="font-bold mb-2">Notification delivery</h2>{error && <p role="alert">{error}</p>}{!alerts.length ? <p className="text-slate-500">No undelivered alerts.</p> : alerts.map(a => <div key={a.id} className="flex justify-between gap-3 py-2 border-b"><div><strong>{a.type} · {a.status}</strong><p className="text-sm">{a.error_message || 'Queued for delivery'} · {a.attempts} attempts</p></div><button className="btn btn-secondary" disabled={a.status === 'PROCESSING'} onClick={() => axios.post(`/api/alerts/${a.id}/retry`).then(load).catch(() => setError('Retry could not be scheduled.'))}>Retry now</button></div>)}</section>;
}
