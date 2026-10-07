import React, { useState, useEffect } from 'react';
import { Sliders, Send, Smartphone, Camera, CheckCircle2, AlertCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function SettingsToggle() {
  const [settings, setSettings] = useState({
    ENABLE_TELEGRAM_ALERTS: true,
    ENABLE_SMS_GATEWAY: false,
    ENABLE_CAMERA_ANPR: false,
  });
  const [loadingKey, setLoadingKey] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data?.data) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleToggle = async (key) => {
    const newValue = !settings[key];
    setLoadingKey(key);
    try {
      const res = await axios.patch('/api/settings', {
        key,
        value: newValue,
      });

      setSettings((prev) => ({ ...prev, [key]: newValue }));
      setToast({
        type: 'success',
        text: `Feature flag "${key}" is now ${newValue ? 'ENABLED' : 'DISABLED'}.`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: `Failed to update ${key}: ${err.message}`,
      });
    } finally {
      setLoadingKey(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const flagsConfig = [
    {
      key: 'ENABLE_TELEGRAM_ALERTS',
      title: 'Partner Telegram Transparency Alerts',
      description: 'Broadcasts instant ledger balances, cash entries, and intake receipts to the sleeping partners group.',
      icon: Send,
      color: 'sky',
    },
    {
      key: 'ENABLE_SMS_GATEWAY',
      title: 'Local Android SMS Receipt Gateway',
      description: 'Pushes zero-cost customer invoice text receipts through the on-premise Android phone on the shop Wi-Fi.',
      icon: Smartphone,
      color: 'emerald',
    },
    {
      key: 'ENABLE_CAMERA_ANPR',
      title: 'Hikvision Optical Gatekeeper (ANPR / OCR)',
      description: 'Monitors bay entry line-crossing alarms to automatically verify car plates against opened job cards.',
      icon: Camera,
      color: 'purple',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <Sliders className="w-6 h-6 text-sky-400" />
          System Settings & Dynamic Feature Toggles
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Adjust hardware and notification engines in real-time without restarting server processes.
        </p>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border border-rose-500 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          {toast.text}
        </div>
      )}

      <div className="space-y-4">
        {flagsConfig.map(({ key, title, description, icon: Icon, color }) => {
          const isEnabled = Boolean(settings[key]);
          const isLoading = loadingKey === key;

          return (
            <div
              key={key}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4 shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-${color}-950/70 border border-${color}-800/60 text-${color}-400 shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {title}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                        isEnabled
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleToggle(key)}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 focus:outline-none ${
                  isEnabled ? 'bg-sky-500' : 'bg-slate-800'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                    isEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          Feature flag mutations are held in high-speed RAM on the Node.js host and persisted in PostgreSQL for immediate recovery.
        </span>
      </div>
    </div>
  );
}
