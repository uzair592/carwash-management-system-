import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Check, Loader2 } from 'lucide-react';
export default function ServiceEditorModal({
  job,
  onClose,
  onSaved
}) {
  const [catalog, setCatalog] = useState([]),
    [selected, setSelected] = useState(() => job.services.map(s => s.service_id || s.service?.id)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    axios.get('/api/services').then(r => {
      const rows = r.data.data;
      for (const s of job.services) if (s.service && !rows.some(item => item.id === s.service.id)) rows.push(s.service);
      setCatalog(rows);
    }).catch(() => setError('Services could not load.')).finally(() => setLoading(false));
  }, [job.id]);
  const price = s => job.services.find(line => (line.service_id || line.service?.id) === s.id)?.price_charged ?? s.price;
  const total = catalog.filter(s => selected.includes(s.id)).reduce((sum, s) => sum + Number(price(s)), 0);
  return <div className="dialog-backdrop"><form className="surface service-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="service-editor-title" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      setError('');
      try {
        const r = await axios.put(`/api/job-cards/${job.id}/services`, {
          service_ids: selected,
          expected_version: job.services_version ?? 0
        });
        onSaved(r.data.data);
        onClose();
      } catch (e) {
        setError(e.response?.data?.message || 'Services could not be saved.');
      } finally {
        setBusy(false);
      }
    }}>
    <header className="compact-dialog-header"><div><h2 id="service-editor-title">Edit services</h2><p>{job.vehicle?.registration_number} · {job.ticket_number}</p></div><button type="button" className="icon-button" aria-label="Close service editor" onClick={onClose}><X size={20} /></button></header>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <p>Loading services…</p> : <div className="service-editor-grid">{catalog.map(s => <button key={s.id} type="button" aria-pressed={selected.includes(s.id)} className={`service-edit-tile ${selected.includes(s.id) ? 'selected' : ''}`} onClick={() => setSelected(ids => ids.includes(s.id) ? ids.filter(id => id !== s.id) : [...ids, s.id])}><span>{s.name}</span><strong>Rs. {Number(price(s)).toLocaleString('en-PK')}</strong>{selected.includes(s.id) && <Check size={16} />}</button>)}</div>}
    {job.status === 'READY_FOR_BILLING' && <p className="muted text-sm">Adding a service returns this car to the workshop queue. Issued materials stay recorded.</p>}
    <footer className="compact-dialog-footer"><strong>{selected.length} services · Rs. {total.toLocaleString('en-PK')}</strong><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || loading || !selected.length}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}Save services</button></footer>
  </form></div>;
}
