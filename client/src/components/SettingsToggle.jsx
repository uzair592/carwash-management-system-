import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Send,
  Smartphone,
  Camera,
  CheckCircle2,
  AlertCircle,
  Image,
  Upload,
  Trash2,
  Printer,
  Receipt,
  Car,
  Tag,
  DollarSign,
  Plus,
  X,
  Loader2,
  Sparkles,
  Save,
} from 'lucide-react';
import axios from 'axios';
import { InvoiceThermalReceipt, TokenThermalTicket } from './ThermalTemplates';
import { printThermal } from '../utils/print';

const DEFAULT_MAKES = [
  'Toyota', 'Honda', 'Suzuki', 'KIA', 'Hyundai',
  'MG', 'Changan', 'Haval', 'Chery', 'Audi',
  'Mercedes', 'BMW', 'Other',
];

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function SettingsToggle() {
  // Device Feature Flags
  const [settings, setSettings] = useState({
    ENABLE_TELEGRAM_ALERTS: true,
    ENABLE_SMS_GATEWAY: false,
    ENABLE_CAMERA_ANPR: false,
  });

  // Branding & Design Templates
  const [branding, setBranding] = useState({
    business_name: 'DF PRO Car Wash & Detailing Center',
    tagline: 'Premium Auto Care & Ceramic Studio',
    address: 'Plot 45-C, Commercial Broadway, Phase 5, DHA, Lahore',
    phone: '+92 300 8889977',
    email: 'info@dfprodetailing.com',
    ntn_number: '7482910-3',
    logo_url: null,
    logo_size: 140,
    loyalty_threshold: 5,
    invoice_template: 'CLASSIC_THERMAL',
    token_template: 'STANDARD_BOX',
    vehicle_makes: DEFAULT_MAKES.join(', '),
  });

  // Services catalog & prices
  const [services, setServices] = useState([]);
  const [editedPrices, setEditedPrices] = useState({});

  // Makes management
  const [newMakeInput, setNewMakeInput] = useState('');

  const [loadingKey, setLoadingKey] = useState(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [toast, setToast] = useState(null);

  const loadAllSettings = async () => {
    try {
      const [settingsRes, brandingRes, servicesRes] = await Promise.all([
        axios.get('/api/settings').catch(() => ({ data: null })),
        axios.get('/api/branding').catch(() => ({ data: null })),
        axios.get('/api/services?include_inactive=true').catch(() => ({ data: null })),
      ]);

      if (settingsRes.data?.data) {
        setSettings(settingsRes.data.data);
      }
      if (brandingRes.data?.data) {
        setBranding((prev) => ({
          ...prev,
          ...brandingRes.data.data,
          vehicle_makes: brandingRes.data.data.vehicle_makes || DEFAULT_MAKES.join(', '),
          invoice_template: brandingRes.data.data.invoice_template || 'CLASSIC_THERMAL',
          token_template: brandingRes.data.data.token_template || 'STANDARD_BOX',
        }));
      }
      if (servicesRes.data?.data) {
        setServices(servicesRes.data.data);
        const map = {};
        servicesRes.data.data.forEach((s) => {
          map[s.id] = s.price;
        });
        setEditedPrices(map);
      }
    } catch (err) {
      console.warn('Failed loading settings:', err);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDeviceToggle = async (key) => {
    const newValue = !settings[key];
    setLoadingKey(key);
    try {
      await axios.patch('/api/settings', { key, value: newValue });
      setSettings((prev) => ({ ...prev, [key]: newValue }));
      showToast('success', `Feature "${key}" is now ${newValue ? 'ENABLED' : 'DISABLED'}.`);
    } catch (err) {
      showToast('error', `Failed to update ${key}: ${err.message}`);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleSaveBranding = async (e) => {
    if (e) e.preventDefault();
    setIsSavingBranding(true);
    try {
      const res = await axios.patch('/api/branding', {
        business_name: branding.business_name,
        tagline: branding.tagline,
        address: branding.address,
        phone: branding.phone,
        email: branding.email,
        ntn_number: branding.ntn_number,
        logo_size: parseInt(branding.logo_size, 10) || 140,
        invoice_template: branding.invoice_template,
        token_template: branding.token_template,
        vehicle_makes: branding.vehicle_makes,
        show_business_name: branding.show_business_name !== false,
      });

      if (res.data?.data) setBranding(res.data.data);
      showToast('success', 'Design templates and branding settings saved successfully.');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to save branding.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please upload a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('error', 'Logo file size must be under 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        const res = await axios.post('/api/branding/logo', { logo_base64: base64 });
        if (res.data?.data) {
          setBranding(res.data.data);
          showToast('success', 'Logo uploaded! It will dynamically print on customer invoices.');
        }
      } catch (err) {
        showToast('error', 'Failed to upload logo.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    try {
      const res = await axios.delete('/api/branding/logo');
      if (res.data?.data) {
        setBranding(res.data.data);
        showToast('success', 'Logo removed.');
      }
    } catch (err) {
      showToast('error', 'Failed to remove logo.');
    }
  };

  // Makes management
  const currentMakesList = (branding.vehicle_makes || DEFAULT_MAKES.join(', '))
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const handleAddMake = async () => {
    const trimmed = newMakeInput.trim();
    if (!trimmed) return;
    if (currentMakesList.map((m) => m.toLowerCase()).includes(trimmed.toLowerCase())) {
      showToast('error', 'Make already exists.');
      return;
    }

    const updated = [...currentMakesList, trimmed].join(', ');
    setBranding((prev) => ({ ...prev, vehicle_makes: updated }));
    setNewMakeInput('');
    try {
      await axios.patch('/api/branding', { vehicle_makes: updated });
      showToast('success', `Vehicle make "${trimmed}" added.`);
    } catch (e) {
      // fallback
    }
  };

  const handleRemoveMake = async (makeToRemove) => {
    const updatedList = currentMakesList.filter((m) => m !== makeToRemove);
    const updated = updatedList.join(', ');
    setBranding((prev) => ({ ...prev, vehicle_makes: updated }));
    try {
      await axios.patch('/api/branding', { vehicle_makes: updated });
      showToast('success', `Make "${makeToRemove}" removed.`);
    } catch (e) {
      // fallback
    }
  };

  // Services price saving
  const handleSaveAllPrices = async () => {
    setIsSavingPrices(true);
    try {
      const updates = services.map((s) => {
        const newPrice = parseFloat(editedPrices[s.id]);
        if (!isNaN(newPrice) && newPrice !== s.price) {
          return axios.patch(`/api/services/${s.id}`, { price: newPrice });
        }
        return Promise.resolve();
      });

      await Promise.all(updates);
      showToast('success', 'Service prices updated successfully across all intake and workshop screens.');
      const res = await axios.get('/api/services?include_inactive=true');
      if (res.data?.data) setServices(res.data.data);
    } catch (err) {
      showToast('error', 'Failed to save some service prices.');
    } finally {
      setIsSavingPrices(false);
    }
  };

  // Sample data for live previews
  const sampleInvoice = {
    invoice_number: 'INV-20261008-01',
    created_at: new Date().toISOString(),
    vehicle_plate: 'LEA-5566',
    customer_name: 'Ahmed Malik',
    payment_method: 'CASH',
    services: [
      { id: '1', name: 'Premium Foam Wash', price_charged: 1500 },
      { id: '2', name: 'Interior Deep Vacuum', price_charged: 1000 },
    ],
    total_amount: 2500,
    paid_amount: 2500,
    cash_tendered: 3000,
    change_returned: 500,
    discount_amount: 0,
    balance_due: 0,
  };

  const sampleTicket = {
    ticket_number: 'CW-20261008-4102',
    vehicle: { registration_number: 'LEA-5566' },
    customer_name: 'Ahmed Malik',
    customer_phone: '0300 8889977',
    services: [
      { id: '1', name: 'Premium Foam Wash', price: 1500 },
      { id: '2', name: 'Interior Deep Vacuum', price: 1000 },
    ],
    total: 2500,
    intake_notes: 'Extra care on rims & mats',
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Settings Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-600" />
            Shop Settings & Customization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure invoice & token design templates, dynamic logo, vehicle makes, and adjustable service rates.
          </p>
        </div>

        {/* Quick Jump Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold flex-wrap">
          <button
            type="button"
            onClick={() => scrollToSection('sec-templates')}
            className="px-3 py-1.5 rounded-lg bg-white text-blue-600 hover:text-blue-700 shadow-xs"
          >
            🎨 Templates
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-branding')}
            className="px-3 py-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition"
          >
            🖼 Bill Logo
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-makes')}
            className="px-3 py-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition"
          >
            🚗 Vehicle Makes
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-pricing')}
            className="px-3 py-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition"
          >
            💰 Service Prices
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-devices')}
            className="px-3 py-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition"
          >
            📡 Devices & Alerts
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-500 text-emerald-700'
              : 'bg-rose-50 border border-rose-500 text-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* SECTION 1: RECEIPT & TOKEN TEMPLATES */}
      <section id="sec-templates" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Receipt & Token Design Templates
            </h3>
            <p className="text-xs text-slate-500">
              Select multiple design styles for customer invoices and workshop tokens.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveBranding}
            disabled={isSavingBranding}
            className="btn btn-primary px-5 py-2 text-xs rounded-xl flex items-center gap-1.5 shadow-sm bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {isSavingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Template Preferences
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invoice Designs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm">Customer Bill / Invoice Design</h4>
            </div>
            <p className="text-xs text-slate-500">
              (Prints with your dynamic uploaded logo at the top)
            </p>

            <div className="space-y-2.5">
              {[
                {
                  id: 'CLASSIC_THERMAL',
                  title: 'Classic Thermal',
                  desc: 'Traditional high-density ESC/POS layout with centered logo, dashed rules, and clear totals.',
                },
                {
                  id: 'MODERN_CLEAN',
                  title: 'Modern Clean ERP',
                  desc: 'Clean borders, boxed license plate, black grand total highlight, and store thank-you message.',
                },
                {
                  id: 'DETAILED_TAX',
                  title: 'Detailed Tax & NTN Invoice',
                  desc: 'Formal invoice layout with prominent NTN/STRN registration, tax breakdowns, and itemized charges.',
                },
                {
                  id: 'LUXURY_STUDIO',
                  title: 'Luxury Studio Passport (Elite Detailing)',
                  desc: 'High-end ceramic studio layout with vehicle passport box, aftercare guidance, and satisfaction guarantee stamp.',
                },
                {
                  id: 'ENTERPRISE_MINIMAL',
                  title: 'Vyapar-Style Retail Cash Memo',
                  desc: 'Ultra-crisp 2-column tabular grid with Rate & Item columns inspired by modern commercial retail POS.',
                },
                {
                  id: 'VIP_GOLD_PASS',
                  title: 'Auto Care Club & Loyalty Pass',
                  desc: 'Features customer visit tracker, VIP member banner, service checkmarks, and loyalty reward progress.',
                },
              ].map((tmpl) => (
                <label
                  key={tmpl.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    branding.invoice_template === tmpl.id
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="invoice_template"
                    value={tmpl.id}
                    checked={branding.invoice_template === tmpl.id}
                    onChange={(e) => {
                      setBranding((prev) => ({ ...prev, invoice_template: e.target.value }));
                    }}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">{tmpl.title}</strong>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{tmpl.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Token Designs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Printer className="w-4 h-4 text-purple-600" />
              <h4 className="font-bold text-slate-800 text-sm">Workshop Token / Work Order Design</h4>
            </div>
            <p className="text-xs text-slate-500">
              (NO logo on token number, per your requirement)
            </p>

            <div className="space-y-2.5">
              {[
                {
                  id: 'STANDARD_BOX',
                  title: 'Standard Boxed Token (Recommended)',
                  desc: 'Boxed license plate, customer details, itemized service checklist, and QC sign line.',
                },
                {
                  id: 'COMPACT_MINIMAL',
                  title: 'Compact Minimal Slip',
                  desc: 'Super paper-efficient slip with huge ticket number & plate for fast bay dispatching.',
                },
                {
                  id: 'BOLD_BADGE',
                  title: 'Bold Workshop Bay Pass',
                  desc: 'Heavy dark contrast borders, license plate header, and technician instructions.',
                },
              ].map((tmpl) => (
                <label
                  key={tmpl.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    branding.token_template === tmpl.id
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="token_template"
                    value={tmpl.id}
                    checked={branding.token_template === tmpl.id}
                    onChange={(e) => {
                      setBranding((prev) => ({ ...prev, token_template: e.target.value }));
                    }}
                    className="mt-0.5 text-purple-600"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">{tmpl.title}</strong>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{tmpl.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Live Thermal Previews */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Live 80mm Print Previews (As Configured)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Preview */}
            <div className="border border-slate-300 rounded-xl p-3 bg-white shadow-xs">
              <div className="flex justify-between items-center mb-2 pb-1 border-b text-[11px] font-bold text-slate-700">
                <span>Customer Bill (With Dynamic Logo)</span>
                <button
                  type="button"
                  onClick={() => printThermal('preview-invoice-box')}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Printer className="w-3 h-3" /> Test Print
                </button>
              </div>
              <div id="preview-invoice-box" className="border border-dashed border-slate-300 p-2">
                <InvoiceThermalReceipt invoice={sampleInvoice} branding={branding} id="preview-invoice-inner" />
              </div>
            </div>

            {/* Token Preview */}
            <div className="border border-slate-300 rounded-xl p-3 bg-white shadow-xs">
              <div className="flex justify-between items-center mb-2 pb-1 border-b text-[11px] font-bold text-slate-700">
                <span>Workshop Token (NO Logo per requirement)</span>
                <button
                  type="button"
                  onClick={() => printThermal('preview-token-box')}
                  className="text-purple-600 hover:underline flex items-center gap-1"
                >
                  <Printer className="w-3 h-3" /> Test Print
                </button>
              </div>
              <div id="preview-token-box" className="border border-dashed border-slate-300 p-2">
                <TokenThermalTicket ticket={sampleTicket} branding={branding} id="preview-token-inner" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: BILL LOGO & STORE INFORMATION */}
      <section id="sec-branding" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Image className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-base">Dynamic Bill Logo & Store Info</h3>
        </div>
        <p className="text-xs text-slate-500">
          Upload your logo picture. It will be printed dynamically at the top of customer invoices.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {/* Logo Preview */}
          <div className="border border-slate-200 rounded-xl p-4 text-center bg-slate-50 min-h-[140px] flex flex-col items-center justify-center">
            {branding.logo_url ? (
              <div className="space-y-2">
                <img
                  src={branding.logo_url}
                  alt="Shop Logo"
                  style={{
                    maxWidth: `${branding.logo_size || 140}px`,
                    maxHeight: '100px',
                    objectFit: 'contain',
                    margin: '0 auto',
                  }}
                />
                <span className="text-[10px] text-slate-400 block font-mono">Current Active Logo</span>
              </div>
            ) : (
              <div className="text-slate-400 space-y-1">
                <Image className="w-10 h-10 mx-auto text-slate-300" />
                <span className="text-xs">No logo uploaded yet</span>
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Upload Logo Picture (PNG, JPG, SVG, WebP)
              </label>
              <label className="btn btn-secondary text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2 border border-slate-300 hover:bg-slate-50">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Choose Image File</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>

            {branding.logo_url && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-xs text-red-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove current logo
              </button>
            )}

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Invoice Logo Width:</span>
                <span className="font-mono">{branding.logo_size || 140}px</span>
              </div>
              <input
                type="range"
                min="80"
                max="220"
                step="5"
                value={branding.logo_size || 140}
                onChange={(e) => setBranding({ ...branding, logo_size: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>80px (Compact)</span>
                <span>140px (Standard)</span>
                <span>220px (Wide)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Store Information & Business Name Toggle */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl">
            <div className="space-y-0.5">
              <label htmlFor="chk-print-business-name" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-2">
                <input
                  id="chk-print-business-name"
                  type="checkbox"
                  checked={branding.show_business_name !== false}
                  onChange={(e) => setBranding({ ...branding, show_business_name: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Print Business Name on Invoice</span>
              </label>
              <p className="text-[11px] text-slate-600 pl-6">
                {branding.show_business_name !== false
                  ? "✓ Checked: Business name text will be printed on invoices."
                  : "✗ Unchecked: Business name will NOT show on the invoice (only your uploaded logo and receipt data will print)."}
              </p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold self-start sm:self-center uppercase tracking-wider ${
                branding.show_business_name !== false
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {branding.show_business_name !== false ? 'NAME ON' : 'NAME OFF'}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Store Details on Printed Receipts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Name {branding.show_business_name === false && <span className="text-amber-600 font-normal">(Hidden on invoice print)</span>}
                </label>
                <input
                  type="text"
                  className="field text-sm w-full"
                  value={branding.business_name}
                  onChange={(e) => setBranding({ ...branding, business_name: e.target.value })}
                  placeholder="Business Name"
                />
              </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
              <input
                type="text"
                className="field text-sm w-full"
                value={branding.tagline || ''}
                onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Address</label>
              <input
                type="text"
                className="field text-sm w-full"
                value={branding.address || ''}
                onChange={(e) => setBranding({ ...branding, address: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                className="field text-sm w-full font-mono"
                value={branding.phone || ''}
                onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NTN / Tax Registration #</label>
              <input
                type="text"
                className="field text-sm w-full font-mono"
                value={branding.ntn_number || ''}
                onChange={(e) => setBranding({ ...branding, ntn_number: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveBranding}
            disabled={isSavingBranding}
            className="btn btn-primary px-6 py-2.5 text-xs rounded-xl flex items-center gap-2 shadow-sm bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {isSavingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Bill & Logo Settings
          </button>
        </div>
      </section>

      {/* SECTION 3: CUSTOMIZABLE VEHICLE MAKES */}
      <section id="sec-makes" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Car className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-base">Vehicle Makes Management</h3>
        </div>
        <p className="text-xs text-slate-500">
          Customize the vehicle manufacturers available during vehicle intake. You can add new brands anytime.
        </p>

        {/* Add Make Input */}
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="e.g. Haval, BYD, Changan, Tesla…"
            value={newMakeInput}
            onChange={(e) => setNewMakeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMake();
              }
            }}
            className="field text-sm flex-1"
          />
          <button
            type="button"
            onClick={handleAddMake}
            className="btn btn-primary px-4 py-2 text-xs rounded-lg flex items-center gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Make
          </button>
        </div>

        {/* Active Makes Badges */}
        <div className="pt-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Active Vehicle Makes ({currentMakesList.length}):
          </label>
          <div className="flex flex-wrap gap-2">
            {currentMakesList.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-800"
              >
                <span>{m}</span>
                {m !== 'Other' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMake(m)}
                    className="text-slate-400 hover:text-red-600 ml-1"
                    title={`Remove ${m}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: SERVICES & ADJUSTABLE PRICES */}
      <section id="sec-pricing" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Services & Adjustable Pricing</h3>
              <p className="text-xs text-slate-500">
                Easily edit catalog prices of all wash and detailing services. Changes apply immediately.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAllPrices}
            disabled={isSavingPrices}
            className="btn btn-primary px-5 py-2 text-xs rounded-xl flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isSavingPrices ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Price Adjustments
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
              <tr>
                <th className="py-2.5 px-3">Service Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3 w-40">Price (PKR)</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-semibold text-slate-900">{service.name}</td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {service.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono">~{service.estimated_time || 30} mins</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={editedPrices[service.id] !== undefined ? editedPrices[service.id] : service.price}
                        onChange={(e) => {
                          setEditedPrices({
                            ...editedPrices,
                            [service.id]: e.target.value,
                          });
                        }}
                        className="w-28 px-2 py-1 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {service.is_active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 5: CONNECTED DEVICES & ALERTS */}
      <section id="sec-devices" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Send className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-900 text-base">Shop Connections</h3>
        </div>
        <p className="text-xs text-slate-500">
          Enable or disable the connected shop devices and notifications.
        </p>

        <div className="space-y-3 pt-2">
          {[
            {
              key: 'ENABLE_TELEGRAM_ALERTS',
              title: 'Partner Telegram alerts',
              description: 'Broadcasts instant ledger balances, cash entries, and intake receipts to the sleeping partners group.',
              icon: Send,
              color: 'sky',
            },
            {
              key: 'ENABLE_SMS_GATEWAY',
              title: 'Customer SMS receipts',
              description: 'Sends text receipts through your Android SMS phone on the shop Wi-Fi.',
              icon: Smartphone,
              color: 'emerald',
            },
            {
              key: 'ENABLE_CAMERA_ANPR',
              title: 'Camera plate recognition',
              description: 'Monitors bay entry line-crossing alarms to automatically verify car plates against opened job cards.',
              icon: Camera,
              color: 'purple',
            },
          ].map((flag) => {
            const Icon = flag.icon;
            const isEnabled = settings[flag.key] ?? false;
            const isLoading = loadingKey === flag.key;

            return (
              <div
                key={flag.key}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-3.5 pr-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{flag.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{flag.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-label={flag.title}
                  aria-checked={isEnabled}
                  onClick={() => handleDeviceToggle(flag.key)}
                  disabled={isLoading}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
