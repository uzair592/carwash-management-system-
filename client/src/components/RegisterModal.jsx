import React, { useState } from 'react';
import { Lock, Unlock, KeyRound, AlertTriangle, Check, Loader2, Sparkles, Coins } from 'lucide-react';
import axios from 'axios';

const QUICK_FLOAT_AMOUNTS = [3000, 5000, 10000, 15000];

export default function RegisterModal({ isOpen, onSessionOpened }) {
  const [startingCash, setStartingCash] = useState('5000');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen) return null;

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    const amount = parseFloat(startingCash);
    if (isNaN(amount) || amount < 0) {
      setErrorMessage('Please enter a valid starting cash amount for the till float.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/register/open', {
        starting_cash: amount,
        notes: notes.trim() || undefined,
      });

      if (res.data?.status === 'success' || res.data?.status === 'created') {
        onSessionOpened(res.data.data);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to record opening cash.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40  animate-fadeIn">
      <div className="bg-white border-2 border-slate-200 rounded-xl w-full max-w-md shadow-sm overflow-hidden p-5 text-slate-900 flex flex-col">
        {/* Header Icon */}
        <div className="text-center pb-3">
          <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-700 mb-3 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
            Register Till Closed
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Record the shop cash drawer opening balance. This is one business cash drawer, not a staff shift.
          </p>
        </div>

        {errorMessage && (
          <div className="my-3 p-3 rounded-xl bg-rose-50 border border-rose-500/80 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleOpenShift} className="space-y-4 my-2">
          {/* Starting Float Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Starting Cash Float (Rs.) *</span>
              <span className="text-xs text-amber-700 tabular-nums">FOR CHANGE TILL</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 tabular-nums text-sm font-bold">
                Rs.
              </span>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                placeholder="5000"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-amber-500 rounded-lg text-slate-900 tabular-nums text-xl font-semibold tracking-wider outline-none"
              />
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-1">Quick Select:</span>
            {QUICK_FLOAT_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setStartingCash(String(amt))}
                className={`text-xs px-2.5 py-1 rounded-lg border tabular-nums font-bold transition ${
                  parseFloat(startingCash) === amt
                    ? 'bg-amber-500/20 border-amber-400 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
                }`}
              >
                {amt.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Opening cash count"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs outline-none focus:border-slate-200"
            />
          </div>

          {/* Security Transparency note */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold">
              <Coins className="w-3.5 h-3.5 text-amber-700" />
              <span>Cash audit trail</span>
            </div>
            <p>
              The opening cash balance is recorded for reconciliation and partner reporting.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-lg bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unlocking Till...
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                Save opening cash
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
