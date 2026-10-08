import React, { useState } from 'react';
import axios from 'axios';
export default function RecordEditorModal({
  kind,
  record,
  onClose,
  onSaved
}) {
  const inventory = kind === 'inventory';
  const [form, setForm] = useState(inventory ? {
    item_name: record.item_name,
    unit_type: record.unit_type,
    current_stock: record.current_stock,
    cost_per_unit: record.cost_per_unit,
    low_stock_threshold: record.low_stock_threshold,
    reason: ''
  } : {
    registration_number: record.registration_number || '',
    customer_name: record.customer_name === 'Walk-in Customer' ? '' : record.customer_name || '',
    customer_phone: record.customer_phone || '',
    make: record.make === 'Other' ? '' : record.make || '',
    model: record.model || ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(false);
  const endpoint = inventory ? '/api/inventory' : '/api/customers';
  const fields = inventory ? [['item_name', 'Item name'], ['unit_type', 'Unit'], ['current_stock', 'Counted stock'], ['cost_per_unit', 'Cost per unit'], ['low_stock_threshold', 'Low-stock threshold'], ['reason', 'Stock adjustment reason']] : [['registration_number', 'Vehicle plate'], ['customer_name', 'Customer name (optional)'], ['customer_phone', 'Phone (optional)'], ['make', 'Make (optional)'], ['model', 'Model (optional)']];
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form
      };
      if (inventory) {
        for (const key of ['current_stock', 'cost_per_unit', 'low_stock_threshold']) payload[key] = Number(payload[key]);
        if (payload.current_stock === Number(record.current_stock)) delete payload.current_stock;
      }
      if (remove) await axios.delete(endpoint + '/' + record.id);else if (record.id) await axios.patch(endpoint + '/' + record.id, payload);else await axios.post(endpoint, payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to save. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-label={inventory ? 'Edit inventory item' : 'Customer profile'} className="surface p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <h2 className="font-bold text-lg">{inventory ? 'Edit inventory item' : record.id ? 'Edit customer' : 'Add customer'}</h2>
    <form onSubmit={save} className="space-y-3 mt-4">
      {error && <div className="form-error" role="alert">{error}</div>}
      {remove ? <p>Delete this unused {inventory ? 'inventory item' : 'vehicle profile'}? Records with stock or transaction history cannot be deleted.</p> : fields.map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}
        {key === 'unit_type' ? <select className="input w-full mt-1" value={form[key]} onChange={e => setForm({
            ...form,
            [key]: e.target.value
          })}>{['Unit', 'ML', 'Roll', 'PIECE'].map(unit => <option key={unit}>{unit}</option>)}</select> : <input className="input w-full mt-1" aria-label={label} type={inventory && ['current_stock', 'cost_per_unit', 'low_stock_threshold'].includes(key) ? 'number' : 'text'} min="0" step="0.01" maxLength={key === 'customer_phone' ? 25 : key === 'registration_number' ? 30 : 100} required={['item_name', 'registration_number', 'current_stock', 'cost_per_unit', 'low_stock_threshold'].includes(key)} disabled={key === 'registration_number' && Boolean(record.id)} value={form[key] ?? ''} onChange={e => setForm({
            ...form,
            [key]: e.target.value
          })} />}
      </label>)}
      <div className="flex gap-2 pt-2 flex-wrap"><button disabled={busy} className="btn btn-primary" type="submit">{busy ? 'Saving…' : remove ? 'Confirm delete' : 'Save'}</button><button disabled={busy} className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>{record.id && !remove && <button disabled={busy} className="btn btn-secondary ml-auto text-red-700" type="button" onClick={() => setRemove(true)}>Delete unused record</button>}{remove && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setRemove(false)}>Back to editing</button>}</div>
    </form>
  </section></div>;
}
