import React, { useEffect, useState } from 'react';
import axios from 'axios';
export default function InvoiceBalanceModal({
  invoice,
  vehicle,
  onClose,
  onSaved
}) {
  const [value, setValue] = useState(invoice?.balance_due || ''),
    [method, setMethod] = useState('CASH'),
    [bank, setBank] = useState(''),
    [accounts, setAccounts] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    axios.get('/api/banks').then(r => setAccounts(r.data.data.accounts)).catch(() => setError('Bank accounts could not load.'));
  }, []);
  return <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4"><form className="surface p-6 w-full max-w-md" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      setError('');
      try {
        const body = {
          amount: Number(value),
          collected_amount: Number(value),
          payment_method: method,
          bank_account_id: method === 'CASH' ? null : bank || null,
          ...(vehicle ? {
            vehicle_id: vehicle.id,
            customer_name: vehicle.customer_name
          } : {})
        };
        await axios.post(vehicle ? '/api/deposits' : `/api/invoices/${invoice.id}/payments`, body);
        onSaved();
        onClose();
      } catch (e) {
        setError(e.response?.data?.message || 'Payment could not be confirmed. Retry to check safely.');
      } finally {
        setBusy(false);
      }
    }}><h2 className="text-xl font-bold mb-4">{vehicle ? 'Collect vehicle advance' : 'Collect remaining balance'}</h2><p className="mb-4">{vehicle?.registration_number || invoice?.invoice_number}{invoice && ` · Due Rs. ${invoice.balance_due}`}</p><label className="block mb-3">Amount collected<input className="form-input w-full" required type="number" min="0.01" step="0.01" max={invoice?.balance_due} value={value} onChange={e => setValue(e.target.value)} /></label><select aria-label="Payment method" className="form-input w-full mb-3" value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="BANK">Bank</option><option value="CARD">Card machine</option></select>{method !== 'CASH' && <select aria-label="Bank account" className="form-input w-full mb-3" required value={bank} onChange={e => setBank(e.target.value)}><option value="">Select bank account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} · {a.account_title}</option>)}</select>}{error && <p role="alert" className="form-error mb-3">{error}</p>}<div className="flex gap-3"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</button></div></form></div>;
}
