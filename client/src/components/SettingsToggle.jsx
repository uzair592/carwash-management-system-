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
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Sliders className="w-6 h-6 text-sky-700" />
          Shop connections
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Enable or disable the connected shop devices and notifications.
        </p>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition animate-fadeIn ${
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
          {toast.text}
        </div>
      )}

      <div className="space-y-4">
        {flagsConfig.map(({ key, title, description, icon: Icon, color }) => {
          const isEnabled = Boolean(settings[key]);
          const isLoading = loadingKey === key;
          const iconColors = { sky: 'bg-sky-50 border-sky-200 text-sky-700', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700', purple: 'bg-purple-50 border-purple-200 text-purple-700' };

          return (
            <div
              key={key}
              className="bg-white border border-slate-200 rounded-lg p-5 flex items-start justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl border ${iconColors[color]} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {title}
                    <span
                      className={`text-xs tabular-nums px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                        isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                aria-label={title}
                disabled={isLoading}
                onClick={() => handleToggle(key)}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 focus:outline-none ${
                  isEnabled ? 'bg-sky-500 text-white' : 'bg-slate-100'
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

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          Changes are saved on the shop server. Check device configuration before enabling a connection.
        </span>
      </div>
    </div>
  );
}
