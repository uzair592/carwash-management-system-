import React, { useState, useEffect } from 'react';
import { Lock, Unlock, X, Delete, ShieldAlert, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function PinPadModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Admin Authorization Required',
  description = 'An Admin or Manager must physically enter their 4-digit PIN to authorize this sensitive action.',
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');

      // Auto-submit on 4 digits
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const verifyPin = async (pinToVerify = pin) => {
    if (!pinToVerify || pinToVerify.length < 4) {
      setError('Please enter your 4-digit PIN.');
      return;
    }

    setIsVerifying(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/verify-pin', { pin: pinToVerify });
      if (res.data?.valid) {
        onSuccess(pinToVerify, res.data.user);
        onClose();
      } else {
        setError('Invalid Admin PIN. Access Denied.');
        setPin('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Try again.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Shield Icon Header */}
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-black text-white">{title}</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{description}</p>

        {/* PIN Digit Indicators */}
        <div className="flex items-center justify-center gap-3 my-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-amber-400 border-amber-400 scale-110 shadow-lg shadow-amber-400/30'
                  : 'bg-slate-950 border-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 text-xs font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/80 rounded-xl py-2 px-3 flex items-center justify-center gap-1.5 animate-shake">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isVerifying}
              onClick={() => handleDigit(String(num))}
              className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 active:scale-95 text-white font-mono text-xl font-bold transition flex items-center justify-center disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 active:scale-95 text-slate-400 font-mono text-xs font-bold transition flex items-center justify-center disabled:opacity-30"
          >
            CLEAR
          </button>

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 active:scale-95 text-white font-mono text-xl font-bold transition flex items-center justify-center disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 active:scale-95 text-slate-400 hover:text-white transition flex items-center justify-center disabled:opacity-30"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            disabled={pin.length < 4 || isVerifying}
            onClick={() => verifyPin(pin)}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <span className="animate-pulse">Authorizing PIN...</span>
            ) : (
              <>
                <Unlock className="w-4 h-4" /> Authorize Action
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
