import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Printer, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PinPadModal from './PinPadModal';
import ServiceEditorModal from './ServiceEditorModal';
import { InvoiceThermalReceipt } from './ThermalTemplates';
import { printThermal } from '../utils/print';
const money = n => Number(n || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export default function CheckoutModal({
  jobCard,
  onClose,
  onCheckoutSuccess
}) {
  const {
    can
  } = useAuth();
  const [job, setJob] = useState(jobCard),
    [mode, setMode] = useState('CASH'),
    [banks, setBanks] = useState([]),
    [bank, setBank] = useState(''),
    [branding, setBranding] = useState(null),
    [deposits, setDeposits] = useState([]),
    [selected, setSelected] = useState([]),
    [discount, setDiscount] = useState(''),
    [value, setValue] = useState(''),
    [cash, setCash] = useState(''),
    [bankValue, setBankValue] = useState(''),
    [tender, setTender] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState(null),
    [edit, setEdit] = useState(false),
    [pinOpen, setPinOpen] = useState(false),
    [more, setMore] = useState(false);
  const subtotal = (job.services || []).reduce((sum, s) => sum + Number(s.price_charged || 0), 0),
    discountValue = Number(discount || 0),
    total = Math.max(0, subtotal - discountValue),
    available = deposits.filter(d => selected.includes(d.id)).reduce((sum, d) => sum + Number(d.remaining_amount ?? d.amount), 0),
    applied = Math.min(total, available),
    due = Math.max(0, total - applied);
  const collected = mode === 'SPLIT' ? Number(cash || 0) + Number(bankValue || 0) : Number(value || 0),
    cashPart = mode === 'SPLIT' ? Number(cash || 0) : mode === 'CASH' ? collected : 0,
    change = Math.max(0, Number(tender || cashPart) - cashPart),
    remaining = Math.max(0, due - collected);
  useEffect(() => {
    let alive = true;
    Promise.all([axios.get('/api/banks'), axios.get('/api/branding'), axios.get('/api/deposits/active', {
      params: {
        vehicle_id: job.vehicle_id || job.vehicle?.id
      }
    })]).then(([b, r, d]) => {
      if (!alive) return;
      const accounts = b.data.data.accounts.filter(a => a.is_active);
      setBanks(accounts);
      setBank(accounts[0]?.id || '');
      setBranding(r.data.data);
      setDeposits(d.data.data);
      let left = subtotal;
      const ids = [];
      for (const item of d.data.data) {
        if (left <= 0) break;
        ids.push(item.id);
        left -= Number(item.remaining_amount ?? item.amount);
      }
      setSelected(ids);
    }).catch(() => setError('Bank accounts or advances could not load. Refresh before collecting payment.'));
    return () => {
      alive = false;
    };
  }, [job.id]);
  useEffect(() => {
    setValue(String(due));
    setCash(String(Math.round(due * 50) / 100));
    setBankValue(String((due - Math.round(due * 50) / 100).toFixed(2)));
    setTender('');
  }, [due]);
  const submit = async pin => {
    setError('');
    if (discountValue < 0 || discountValue > subtotal || !Number.isFinite(discountValue)) {
      setError('Enter a discount within the bill total.');
      return;
    }
    if (collected < 0 || !Number.isFinite(collected) || collected > due) {
      setError('Amount collected must be within the balance due.');
      return;
    }
    if (cashPart > 0 && tender !== '' && Number(tender) < cashPart) {
      setError('Cash handed over is below the cash collected.');
      return;
    }
    if (collected > 0 && mode !== 'CASH' && !bank) {
      setError('Select the receiving bank account.');
      return;
    }
    if (discountValue > 0 && !can('billing.discount') && !pin) {
      setPinOpen(true);
      return;
    }
    setBusy(true);
    try {
      const payments = mode === 'SPLIT' ? [...(Number(cash) > 0 ? [{
        payment_method: 'CASH',
        amount: Number(cash),
        ...(tender !== '' ? {
          tender_amount: Number(tender)
        } : {})
      }] : []), ...(Number(bankValue) > 0 ? [{
        payment_method: 'BANK',
        amount: Number(bankValue),
        bank_account_id: bank
      }] : [])] : [{
        payment_method: mode,
        amount: collected,
        ...(mode !== 'CASH' ? {
          bank_account_id: bank
        } : tender !== '' ? {
          tender_amount: Number(tender)
        } : {})
      }];
      const r = await axios.post('/api/invoices/checkout', {
        job_card_id: job.id,
        payments,
        applied_deposit_ids: selected,
        discount_amount: discountValue,
        admin_pin: pin || undefined
      });
      setResult(r.data.data);
      onCheckoutSuccess?.(r.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Payment could not be confirmed. Retry safely.');
    } finally {
      setBusy(false);
    }
  };
  const receipt = result?.invoice ? {
    ...result.invoice,
    payments: result.payments || result.invoice.payments,
    deposits_applied: result.deposits_applied
  } : null;
  return <div className="dialog-backdrop"><section className="surface checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><header className="compact-dialog-header"><div><h2 id="checkout-title">{result ? 'Invoice ready' : 'Collect payment'}</h2><p><strong>{job.vehicle?.registration_number}</strong> · {job.ticket_number}</p></div><button className="icon-button" aria-label="Close payment window" disabled={busy} onClick={onClose}><X size={20} /></button></header>
 {error && <p className="form-error" role="alert">{error}</p>}
 {result ? <div className="checkout-receipt"><p className="success-note"><CheckCircle2 size={18} />Recorded · {result.balance_due > 0 ? `Rs. ${money(result.balance_due)} still due` : 'Fully paid'}</p><InvoiceThermalReceipt invoice={receipt} branding={branding} id="printable-receipt" /><footer className="compact-dialog-footer"><button className="btn btn-print" onClick={() => printThermal('printable-receipt')}><Printer size={16} />Print bill</button><button className="btn btn-primary" onClick={onClose}>Done</button></footer></div> : <><div className="checkout-services"><div className="flex justify-between items-center"><strong>Services</strong>{can('job.services') && <button className="text-blue-700 text-sm font-bold flex gap-1 items-center" onClick={() => setEdit(true)}><Pencil size={14} />Edit services</button>}</div>{job.services.map((s, i) => <div className="receipt-row" key={s.id || i}><span>{s.service?.name || s.name}</span><strong>{money(s.price_charged)}</strong></div>)}</div>
 <div className="checkout-total"><span>Amount due</span><strong>Rs. {money(due)}</strong></div>
 {applied > 0 && <p className="text-sm text-blue-700">Rs. {money(applied)} advance applied{available > applied ? ` · Rs. ${money(available - applied)} retained for later` : ''}.</p>}
 <div className="payment-methods" role="group" aria-label="Payment method">{[['CASH', 'Cash'], ['BANK', 'Bank'], ['CARD', 'Card machine'], ['SPLIT', 'Split']].map(([key, label]) => <button key={key} aria-label={key === 'SPLIT' ? 'Enable Split Payment' : label} aria-pressed={mode === key} className={mode === key ? 'selected' : ''} onClick={() => setMode(key)}>{label}</button>)}</div>
 {mode === 'SPLIT' ? <div className="grid grid-cols-2 gap-3"><label className="field-label">Cash amount<input aria-label="Cash amount" className="field money-input" type="number" min="0" step="0.01" value={cash} onChange={e => setCash(e.target.value)} /></label><label className="field-label">Bank amount<input aria-label="Bank amount" className="field money-input" type="number" min="0" step="0.01" value={bankValue} onChange={e => setBankValue(e.target.value)} /></label></div> : <label className="field-label">Amount collected<input aria-label="Amount collected" className="field money-input" type="number" min="0" step="0.01" max={due} value={value} onChange={e => setValue(e.target.value)} /></label>}
 {mode !== 'CASH' && <label className="field-label">Receiving bank<select className="field" aria-label="Receiving bank" value={bank} onChange={e => setBank(e.target.value)}><option value="">Select account</option>{banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} · {b.account_title}</option>)}</select></label>}
 {cashPart > 0 && <label className="field-label">Cash handed over <span className="muted font-normal">optional · for change</span><input aria-label="Cash handed over" className="field" type="number" min={cashPart} step="0.01" value={tender} onChange={e => setTender(e.target.value)} placeholder={String(cashPart)} /></label>}
 <div className="checkout-balance"><span>{change > 0 ? 'Change to return' : 'Remaining balance'}</span><strong>Rs. {money(change > 0 ? change : remaining)}</strong></div>
 <button type="button" className="checkout-more" aria-expanded={more} onClick={() => setMore(!more)}>Discount & advances {more ? '−' : '+'}</button>{more && <div className="checkout-extras"><label className="field-label">Discount (PKR)<input className="field" aria-label="Discount (PKR)" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label>{deposits.length > 0 && <fieldset><legend className="text-sm font-bold">Available deposits</legend>{deposits.map(d => <label key={d.id} className="permission-switch"><span>Rs. {money(d.remaining_amount ?? d.amount)}</span><input type="checkbox" checked={selected.includes(d.id)} onChange={() => setSelected(ids => ids.includes(d.id) ? ids.filter(id => id !== d.id) : [...ids, d.id])} /></label>)}</fieldset>}</div>}
 {!['READY_FOR_BILLING', 'Completed'].includes(job.status) && <p className="form-error">Additional work must be completed in Workshop before billing.</p>}
 <footer className="compact-dialog-footer"><button className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" aria-label="Confirm payment" disabled={busy || !can('billing.manage') || !['READY_FOR_BILLING', 'Completed'].includes(job.status)} onClick={() => submit()}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}{busy ? 'Recording…' : `Confirm · Rs. ${money(collected)}`}</button></footer></>}
 </section>{edit && <ServiceEditorModal job={job} onClose={() => setEdit(false)} onSaved={setJob} />}<PinPadModal isOpen={pinOpen} onClose={() => setPinOpen(false)} onSuccess={pin => {
      setPinOpen(false);
      submit(pin);
    }} title="Approve discount" /></div>;
}
