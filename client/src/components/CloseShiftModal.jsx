import React, { useState, useEffect } from 'react';
import { X, Lock, AlertTriangle, CheckCircle2, Loader2, Coins, Calculator, Receipt } from 'lucide-react';
import axios from 'axios';

export default function CloseShiftModal({ isOpen, onClose, onSessionClosed, sessionData }) {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [closedResult, setClosedResult] = useState(null);

  useEffect(() => {
    if (sessionData?.expected_cash_in_drawer !== undefined) {
      setCountedCash(String(sessionData.expected_cash_in_drawer));
    }
  }, [sessionData]);

  if (!isOpen) return null;

  const startingCash = parseFloat(sessionData?.starting_cash || 0);
  const cashCollected = parseFloat(sessionData?.cash_collected || 0);
  const cashOutflow = parseFloat(sessionData?.cash_outflow || 0);
  const expectedCash = parseFloat(sessionData?.expected_cash_in_drawer || (startingCash + cashCollected - cashOutflow));

  const countedNum = parseFloat(countedCash) || 0;
  const variance = countedNum - expectedCash;

  const handleCloseShift = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(countedNum) || countedNum < 0) {
      setErrorMsg('Please input a valid counted cash figure.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/register/close', {
        actual_counted_cash: countedNum,
        notes: notes.trim() || undefined,
      });

      setClosedResult(res.data.data);
      if (onSessionClosed) {
        onSessionClosed(res.data.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to close register shift.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fadeIn">
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 text-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Close Cashier Shift & Reconcile</h3>
              <p className="text-xs text-slate-400 font-mono">End-of-Day Till Settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {closedResult ? (
          /* Closed Success Receipt */
          <div className="py-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-xl font-black text-white">Shift Closed & Reconciled!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Variance audit saved and dispatched to Telegram partners.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">STARTING FLOAT:</span>
                <span className="text-white font-bold">Rs. {startingCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CASH SALES:</span>
                <span className="text-emerald-400 font-bold">+Rs. {cashCollected.toLocaleString()}</span>
              </div>
              {cashOutflow > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">CASH EXP/REFUNDS:</span>
                  <span className="text-rose-400 font-bold">-Rs. {cashOutflow.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">EXPECTED IN TILL:</span>
                <span className="text-white font-bold">Rs. {expectedCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ACTUAL COUNTED:</span>
                <span className="text-amber-300 font-black">Rs. {countedNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-sm">
                <span>TILL VARIANCE:</span>
                <span
                  className={
                    Math.abs(variance) < 0.01
                      ? 'text-emerald-400'
                      : variance < 0
                      ? 'text-rose-400'
                      : 'text-sky-400'
                  }
                >
                  {Math.abs(variance) < 0.01
                    ? 'Rs. 0.00 (BALANCED)'
                    : `${variance < 0 ? '-' : '+'}Rs. ${Math.abs(variance).toLocaleString()}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Done / Lock POS
            </button>
          </div>
        ) : (
          <form onSubmit={handleCloseShift} className="space-y-4 my-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Shift Balance Overview Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 font-semibold">Starting Float Cash:</span>
                <span className="font-mono font-bold text-white">Rs. {startingCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 font-semibold">Cash Sales Inflow:</span>
                <span className="font-mono font-bold text-emerald-400">+Rs. {cashCollected.toLocaleString()}</span>
              </div>
              {cashOutflow > 0 && (
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-semibold">Cash Outflow:</span>
                  <span className="font-mono font-bold text-rose-400">-Rs. {cashOutflow.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-bold">
                <span className="text-slate-300">System Expected in Till:</span>
                <span className="font-mono text-base font-black text-amber-300">
                  Rs. {expectedCash.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Input: Physical Cash Counted */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Physically Counted Cash in Till *</span>
                <span className="text-[10px] text-amber-400 font-mono">COUNT CAREFULLY</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm font-bold">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border-2 border-slate-800 focus:border-rose-500 rounded-2xl text-white font-mono text-xl font-black outline-none"
                />
              </div>
            </div>

            {/* Real-time Variance Badge */}
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono font-bold ${
                Math.abs(variance) < 0.01
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : variance < 0
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-sky-950/40 border-sky-500/50 text-sky-300'
              }`}
            >
              <span>Calculated Till Discrepancy:</span>
              <span className="text-sm font-black">
                {Math.abs(variance) < 0.01
                  ? 'Rs. 0.00 (PERFECTLY BALANCED ✅)'
                  : `${variance < 0 ? '⚠️ -Rs. ' : '+Rs. '}${Math.abs(variance).toLocaleString()}`}
              </span>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Closing Notes / Explanation (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. End of night shift, counted by cashier"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-slate-700"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm transition shadow-xl shadow-rose-600/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reconciling & Closing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Reconcile & Close Register Shift
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
