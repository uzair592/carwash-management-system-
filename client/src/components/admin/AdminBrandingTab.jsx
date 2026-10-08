import React, { useState, useEffect } from 'react';
import {
  Image,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  Printer,
  Sparkles,
  Sliders,
  Receipt,
  FileText,
  RotateCcw,
} from 'lucide-react';
import axios from 'axios';
import { printThermal } from '../../utils/print';

export default function AdminBrandingTab() {
  const [branding, setBranding] = useState({
    business_name: 'DF PRO Car Wash & Detailing Center',
    tagline: 'Premium Auto Care & Ceramic Studio',
    address: 'Plot 45-C, Commercial Broadway, Phase 5, DHA, Lahore',
    phone: '+92 300 8889977',
    email: 'info@dfprodetailing.com',
    ntn_number: '7482910-3',
    logo_url: null,
    logo_size: 120,
    loyalty_threshold: 5,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadBranding = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get('/api/branding');
      if (res.data?.data) {
        setBranding(res.data.data);
      }
    } catch (err) {
      setErrorMsg('Failed to load branding settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    try {
      const res = await axios.patch('/api/branding', {
        business_name: branding.business_name,
        tagline: branding.tagline,
        address: branding.address,
        phone: branding.phone,
        email: branding.email,
        ntn_number: branding.ntn_number,
        logo_size: parseInt(branding.logo_size, 10) || 120,
        loyalty_threshold: parseInt(branding.loyalty_threshold, 10) || 5,
      });
      setSuccessMsg('Branding details and loyalty threshold saved successfully.');
      if (res.data?.data) setBranding(res.data.data);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Convert uploaded image file to base64 for reliable local-first persistence
  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo file must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        setIsSaving(true);
        const res = await axios.post('/api/branding/logo', {
          logo_base64: base64,
        });
        setBranding((prev) => ({ ...prev, logo_url: res.data?.data?.logo_url || base64 }));
        setSuccessMsg('Logo updated and saved successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        setErrorMsg('Failed to upload logo.');
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the business logo?')) return;
    setIsSaving(true);
    try {
      await axios.delete('/api/branding/logo');
      setBranding((prev) => ({ ...prev, logo_url: null }));
      setSuccessMsg('Logo removed.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Failed to remove logo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Business Branding & Thermal Printing Setup
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload and scale your shop logo for 80mm thermal printers and bills. Configure business contact details and set the customer loyalty threshold for recognition badges.
        </p>
      </div>

      {errorMsg && (
        <div className="form-error flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
          <button className="ml-auto text-xs underline" onClick={() => setErrorMsg('')}>Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="status-badge success flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Settings & Logo Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Logo Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image className="w-4 h-4 text-blue-600" />
                Business Logo
              </span>
              <span className="text-xs text-slate-400 font-normal">Formats: PNG, JPG, SVG</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div
                className="w-32 h-24 bg-white rounded-lg border border-slate-300 flex items-center justify-center p-2 overflow-hidden shadow-inner flex-shrink-0"
              >
                {branding.logo_url ? (
                  <img
                    src={branding.logo_url}
                    alt="Business Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400 text-center font-medium">No Logo Uploaded</span>
                )}
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="btn btn-primary text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2 shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    {branding.logo_url ? 'Replace Logo' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                  </label>
                  {branding.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="btn btn-secondary text-xs px-3 py-2 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                      Adjustable Thermal Logo Width
                    </span>
                    <span className="font-mono font-bold text-blue-600">{branding.logo_size || 120}px</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="220"
                    step="5"
                    value={branding.logo_size || 120}
                    onChange={(e) => setBranding({ ...branding, logo_size: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>Compact (60px)</span>
                    <span>Standard (120px)</span>
                    <span>Wide (220px)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Business Details Form */}
          <form onSubmit={handleSaveSettings} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 text-sm">
            <h3 className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Store Details & Loyalty Configuration
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Legal / Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={branding.business_name}
                onChange={(e) => setBranding({ ...branding, business_name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Tagline</label>
              <input
                type="text"
                value={branding.tagline || ''}
                onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
                placeholder="e.g. Premium Auto Care & Ceramic Studio"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Address</label>
              <input
                type="text"
                value={branding.address || ''}
                onChange={(e) => setBranding({ ...branding, address: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
                placeholder="Shop street address & city"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={branding.phone || ''}
                  onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
                  placeholder="+92 300 1234567"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NTN / Tax Number</label>
                <input
                  type="text"
                  value={branding.ntn_number || ''}
                  onChange={(e) => setBranding({ ...branding, ntn_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
                  placeholder="e.g. 1234567-8"
                />
              </div>
            </div>

            {/* Requirement 7: Admin-Configurable Loyalty Threshold */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Loyal Customer Recognition Threshold (Visits)
              </label>
              <p className="text-xs text-amber-800/80">
                Vehicles with this number of completed service visits will automatically display the "Loyal Customer" badge during intake and workshop monitoring.
              </p>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={branding.loyalty_threshold || 5}
                onChange={(e) => setBranding({ ...branding, loyalty_threshold: parseInt(e.target.value, 10) || 1 })}
                className="w-32 p-2 border border-amber-300 rounded-lg text-sm bg-white font-bold text-amber-900 focus:border-amber-600 focus:outline-none font-mono"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="btn btn-primary px-6 py-2.5 text-sm rounded-lg flex items-center gap-2 shadow-sm"
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Branding Settings
              </button>
            </div>
          </form>
        </div>

        {/* Right Preview: 80mm Thermal Paper Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              Live 80mm Thermal Print Preview
            </h3>
            <button
              onClick={() => printThermal('thermal-live-preview')}
              className="btn btn-secondary text-xs px-2.5 py-1 rounded border border-slate-200 flex items-center gap-1"
            >
              <Printer className="w-3 h-3 text-slate-600" />
              Test Print
            </button>
          </div>

          <div
            id="thermal-live-preview"
            className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-5 shadow-sm max-w-[320px] mx-auto text-black font-mono text-xs leading-tight"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {branding.logo_url && (
              <div className="text-center mb-3">
                <img
                  src={branding.logo_url}
                  alt="Shop Logo"
                  style={{
                    maxWidth: `${branding.logo_size || 120}px`,
                    maxHeight: '85px',
                    objectFit: 'contain',
                    margin: '0 auto',
                    display: 'block',
                  }}
                />
              </div>
            )}

            <div className="text-center font-bold text-sm border-b-2 border-black pb-2 mb-2">
              {branding.business_name || 'DF PRO CAR WASH & DETAILING'}<br />
              <span className="text-[11px] font-normal italic">
                {branding.tagline || 'Official Customer Receipt'}
              </span>
            </div>

            <div className="flex justify-between text-[11px] mb-1">
              <span><strong>Inv:</strong> INV-20261008-7821</span>
              <span>{new Date().toLocaleDateString('en-GB')}</span>
            </div>

            <div className="border-t border-b border-dashed border-black py-1.5 my-1.5 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span><strong>Plate:</strong> LEA-7821</span>
                <span><strong>Status:</strong> PAID</span>
              </div>
              <div><strong>Customer:</strong> Tariq Mahmood</div>
              <div><strong>Method:</strong> CASH / BANK</div>
            </div>

            <table className="w-full text-[11px] my-2 border-collapse" style={{ width: '100%' }}>
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1">Service</th>
                  <th className="py-1 text-right">PKR</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-0.5">Full Body Wash</td>
                  <td className="py-0.5 text-right">Rs. 1,500</td>
                </tr>
                <tr>
                  <td className="py-0.5">Interior Detail & Vacuum</td>
                  <td className="py-0.5 text-right">Rs. 8,500</td>
                </tr>
              </tbody>
            </table>

            <div className="border-t border-dashed border-black pt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. 10,000</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
                <span>Total Paid:</span>
                <span>Rs. 10,000</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Cash Tendered:</span>
                <span>Rs. 10,000</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Change:</span>
                <span>Rs. 0</span>
              </div>
            </div>

            <div className="text-center text-[10px] mt-4 pt-2 border-t border-black leading-tight space-y-0.5">
              <p className="font-bold">Thank you for visiting DF PRO!</p>
              {branding.address && <p>{branding.address}</p>}
              {branding.phone && <p>Phone: {branding.phone}</p>}
              {branding.ntn_number && <p>NTN: {branding.ntn_number}</p>}
              <p className="text-[9px] text-gray-500 mt-1">Software by AutoWash Management</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
