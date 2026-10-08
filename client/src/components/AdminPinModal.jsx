import React, { useState } from 'react';
import { ShieldCheck, X, KeyRound, AlertTriangle, Check, Delete } from 'lucide-react';
import axios from 'axios';

export default function AdminPinModal({ isOpen, onClose, onSuccess, title = 'Admin Authorization Required', subtitle = 'Enter 4-digit Shop Admin PIN to authorize this sensitive action' }) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleVerify = async () => {
    if (!pin) {
      setError('Please enter the Admin PIN');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await axios.post('/api/admin/verify-pin', { pin });
      if (res.data?.valid) {
        onSuccess(pin, res.data.user);
        onClose();
        setPin('');
      } else {
        setError('Incorrect PIN. Authorization denied.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid Admin PIN. Access denied.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40  animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-sm overflow-hidden p-5 text-center">
        <div className="flex justify-between items-center pb-4 mb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 text-amber-700">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold text-sm tracking-wide text-slate-900 uppercase">Security Clearance</span>
          </div>
          <button
            onClick={() => {
              setPin('');
              setError(null);
              onClose();
            }}
            className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3">
          <div className="w-12 h-12 bg-amber-50 border border-amber-500/40 rounded-lg flex items-center justify-center mx-auto text-amber-700 mb-3 shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
        </div>

        {/* PIN Dots Display */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg py-3 px-6 my-4 flex justify-center items-center gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                pin.length > idx
                  ? 'bg-amber-400 shadow-md shadow-amber-400/50 scale-110'
                  : 'bg-slate-100 border border-slate-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl py-2 px-3 mb-3 flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Touch Number Pad */}
        <div className="grid grid-cols-3 gap-2 my-2 tabular-nums">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(String(num))}
              className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 hover:border-slate-200 rounded-xl text-lg font-bold text-slate-900 transition active:scale-95 shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 rounded-xl text-xs font-bold transition active:scale-95 uppercase tracking-wider"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 hover:border-slate-200 rounded-xl text-lg font-bold text-slate-900 transition active:scale-95 shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying || pin.length < 4}
          className="w-full mt-3 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <span>Verifying Admin PIN...</span>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Authorize Action
            </>
          )}
        </button>

        <div className="mt-3 text-xs text-slate-500">
          Default Admin PIN: <span className="tabular-nums text-slate-500 font-bold">1234</span>
        </div>
      </div>
    </div>
  );
}
