import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Save, Printer, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InvoiceThermalReceipt, TokenThermalTicket, BOLD_RECEIPT_THEMES, TICKET_THEMES } from './ThermalTemplates';
import { printThermal } from '../utils/print';
import AdminServicesTab from './admin/AdminServicesTab';
import PermissionPanel from './PermissionPanel';
import NotificationMonitor from './NotificationMonitor';
const previewJob = {
  ticket_number: 'CW-PREVIEW',
  vehicle: {
    registration_number: 'ABC-123'
  },
  customer_name: 'Sample customer',
  services: [{
    id: 'preview1',
    service: {
      name: 'Full body wash'
    },
    price_charged: 1000
  }, {
    id: 'preview2',
    service: {
      name: 'Interior cleaning'
    },
    price_charged: 500
  }],
  intake_notes: 'Clean wheels and door edges.'
};
const previewInvoice = {
  invoice_number: 'INV-PREVIEW',
  job_card: previewJob,
  total_amount: 1400,
  discount_amount: 100,
  paid_amount: 1000,
  balance_due: 400,
  payments: [{
    payment_method: 'Cash',
    amount: 600
  }, {
    payment_method: 'Bank',
    amount: 400,
    bank_account: {
      bank_name: 'Sample Bank'
    }
  }]
};
export default function SettingsToggle() {
  const {
    can,
    isAdmin
  } = useAuth();
  const [tab, setTab] = useState('printing'),
    [branding, setBranding] = useState(null),
    [printer, setPrinter] = useState(null),
    [flags, setFlags] = useState({}),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState('invoice');
  useEffect(() => {
    Promise.all([axios.get('/api/branding'), axios.get('/api/printer/settings'), axios.get('/api/settings')]).then(([b, p, s]) => {
      setBranding(b.data.data);
      setPrinter(p.data.data);
      setFlags(s.data.data);
    }).catch(() => setError('Settings could not load. Refresh and try again.'));
  }, []);
  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (can('branding.manage')) await axios.patch('/api/branding', branding);
      if (can('settings.manage')) await axios.put('/api/printer/settings', printer);
      setMessage('Settings saved.');
    } catch (e) {
      setError(e.response?.data?.message || 'Settings could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const tabs = [{
    id: 'printing',
    label: 'Printing & logo'
  }, {
    id: 'services',
    label: 'Services'
  }, {
    id: 'devices',
    label: 'Connections'
  }, ...(isAdmin ? [{
    id: 'permissions',
    label: 'Permissions'
  }] : [])];
  return <div className="settings-workspace space-y-4"><nav className="section-tabs" aria-label="Settings sections">{tabs.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
 {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-note" role="status">{message}</p>}
 {tab === 'services' && can('services.read') && <AdminServicesTab />}{tab === 'permissions' && isAdmin && <PermissionPanel />}
 {tab === 'printing' && branding && printer && <div className="print-settings-grid"><div className="surface p-4 space-y-4"><h2 className="text-lg font-bold">Bills & work tickets</h2><fieldset disabled={!can('branding.manage')} className="space-y-3">
 <label className="field-label">Invoice design<select aria-label="Invoice design" className="field" value={branding.invoice_template || 'BOLD_TABLE'} onChange={e => setBranding({
              ...branding,
              invoice_template: e.target.value
            })}>{BOLD_RECEIPT_THEMES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
 <label className="field-label">Ticket design<select aria-label="Ticket design" className="field" value={branding.token_template || 'WORKSHOP_CHECKLIST'} onChange={e => setBranding({
              ...branding,
              token_template: e.target.value
            })}>{TICKET_THEMES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
 <label className="permission-switch"><span>Show prices on work tickets</span><input type="checkbox" checked={branding.ticket_show_prices === true} onChange={e => setBranding({
              ...branding,
              ticket_show_prices: e.target.checked
            })} /></label>
 <label className="permission-switch"><span>Print business name</span><input type="checkbox" checked={branding.show_business_name !== false} onChange={e => setBranding({
              ...branding,
              show_business_name: e.target.checked
            })} /></label>
 {['business_name', 'address', 'phone'].map(key => <label className="field-label" key={key}>{{
              business_name: 'Business name',
              address: 'Address',
              phone: 'Phone'
            }[key]}<input className="field" value={branding[key] || ''} onChange={e => setBranding({
              ...branding,
              [key]: e.target.value
            })} /></label>)}
 <label className="field-label">Logo width · {branding.logo_size || 140}px<input type="range" min="60" max="220" value={branding.logo_size || 140} onChange={e => setBranding({
              ...branding,
              logo_size: Number(e.target.value)
            })} /></label>
 <label className="btn btn-secondary cursor-pointer"><Upload size={16} />Upload logo<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const data = new FormData();
              data.append('logo', f);
              try {
                const r = await axios.post('/api/branding/logo', data);
                setBranding(r.data.data);
                setMessage('Logo updated.');
              } catch (e) {
                setError(e.response?.data?.message || 'Logo could not upload.');
              }
            }} /></label>
 {branding.logo_url && <button type="button" className="btn btn-secondary" onClick={async () => {
            try {
              const r = await axios.delete('/api/branding/logo');
              setBranding(r.data.data);
            } catch {
              setError('Logo could not be removed.');
            }
          }}>Remove logo</button>}
 </fieldset>
 <hr /><h3 className="font-bold">Printer connection</h3><fieldset disabled={!can('settings.manage')} className="space-y-3"><label className="field-label">Print method<select aria-label="Print method" className="field" value={printer.mode} onChange={e => setPrinter({
              ...printer,
              mode: e.target.value
            })}><option value="BROWSER">Browser / printer driver</option><option value="NETWORK">Direct network ESC/POS</option><option value="WINDOWS">Windows USB / installed RAW printer</option></select></label>
 {printer.mode === 'NETWORK' && <><label className="field-label">Printer LAN IP<input className="field" value={printer.host || ''} onChange={e => setPrinter({
                ...printer,
                host: e.target.value
              })} placeholder="192.168.1.200" /></label><label className="field-label">Port<input className="field" type="number" value={printer.port || 9100} onChange={e => setPrinter({
                ...printer,
                port: Number(e.target.value)
              })} /></label></>}
 {printer.mode === 'WINDOWS' && <label className="field-label">Exact Windows printer name<input className="field" value={printer.printer_name || ''} onChange={e => setPrinter({
              ...printer,
              printer_name: e.target.value
            })} placeholder="Name from Windows Printers & scanners" /></label>}
 <label className="field-label">Paper width<select className="field" aria-label="Paper width" value={printer.paper_width || 80} onChange={e => setPrinter({
              ...printer,
              paper_width: Number(e.target.value)
            })}><option value={80}>80 mm</option><option value={58}>58 mm</option></select></label>
 <label className="permission-switch"><span>Auto-cut after each print</span><input aria-label="Auto-cut after each print" type="checkbox" disabled={printer.mode === 'BROWSER'} checked={printer.auto_cut === true} onChange={e => setPrinter({
              ...printer,
              auto_cut: e.target.checked
            })} /></label>
 {printer.mode === 'BROWSER' ? <p className="muted text-sm">For browser printing, enable the cutter in your printer driver. Direct ESC/POS printing sends one cut command.</p> : <label className="field-label">Feed lines before cut<input className="field" type="number" min="0" max="8" value={printer.cut_feed ?? 3} onChange={e => setPrinter({
              ...printer,
              cut_feed: Number(e.target.value)
            })} /></label>}
 </fieldset>{(can('branding.manage') || can('settings.manage')) && <button className="btn btn-primary" disabled={busy} onClick={save}><Save size={16} />{busy ? 'Saving…' : 'Save print settings'}</button>}</div>
 <section className="surface p-4 print-preview-pane"><div className="section-tabs mb-4"><button className={preview === 'invoice' ? 'active' : ''} onClick={() => setPreview('invoice')}>Bill preview</button><button className={preview === 'ticket' ? 'active' : ''} onClick={() => setPreview('ticket')}>Ticket preview</button></div><div className="thermal-preview">{preview === 'invoice' ? <InvoiceThermalReceipt invoice={previewInvoice} branding={branding} id="settings-print-preview" /> : <TokenThermalTicket ticket={previewJob} branding={branding} id="settings-print-preview" />}</div><button className="btn btn-print mt-4" onClick={() => printThermal('settings-print-preview', {
          preview: true,
          paperWidth: printer.paper_width
        })}><Printer size={16} />Print sample</button></section></div>}
 {tab === 'devices' && <section className="surface p-4 space-y-4"><h2 className="text-lg font-bold">Shop connections</h2>{[['ENABLE_TELEGRAM_ALERTS', 'Partner Telegram alerts'], ['ENABLE_SMS_GATEWAY', 'Customer SMS receipts'], ['ENABLE_CAMERA_ANPR', 'Camera plate recognition']].map(([key, label]) => <label className="permission-switch" key={key}><span>{label}</span><input type="checkbox" disabled={!can('settings.manage') || busy} checked={flags[key] === true} onChange={async e => {
          const value = e.target.checked;
          setBusy(true);
          setFlags({
            ...flags,
            [key]: value
          });
          try {
            await axios.patch('/api/settings', {
              key,
              value
            });
            setFlags({
              ...flags,
              [key]: value
            });
          } catch {
            setFlags({
              ...flags
            });
            setError('Connection setting could not save.');
          } finally {
            setBusy(false);
          }
        }} /></label>)}<NotificationMonitor /></section>}
 </div>;
}
