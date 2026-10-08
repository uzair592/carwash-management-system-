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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40  animate-fadeIn">
      <div className="bg-white border-2 border-slate-200 rounded-xl w-full max-w-lg shadow-sm overflow-hidden p-5 text-slate-900 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Close Cashier Shift & Reconcile</h3>
              <p className="text-xs text-slate-500 tabular-nums">End-of-Day Till Settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {closedResult ? (
          /* Closed Success Receipt */
          <div className="py-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-700 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-slate-900">Shift Closed & Reconciled!</h4>
              <p className="text-xs text-slate-500 mt-1">
                Variance audit saved and dispatched to Telegram partners.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs tabular-nums space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">STARTING FLOAT:</span>
                <span className="text-slate-900 font-bold">Rs. {startingCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CASH SALES:</span>
                <span className="text-emerald-700 font-bold">+Rs. {cashCollected.toLocaleString()}</span>
              </div>
              {cashOutflow > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">CASH EXP/REFUNDS:</span>
                  <span className="text-rose-700 font-bold">-Rs. {cashOutflow.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500">EXPECTED IN TILL:</span>
                <span className="text-slate-900 font-bold">Rs. {expectedCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ACTUAL COUNTED:</span>
                <span className="text-amber-700 font-semibold">Rs. {countedNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                <span>TILL VARIANCE:</span>
                <span
                  className={
                    Math.abs(variance) < 0.01
                      ? 'text-emerald-700'
                      : variance < 0
                      ? 'text-rose-700'
                      : 'text-sky-700'
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
              className="w-full py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition"
            >
              Done / Lock POS
            </button>
          </div>
        ) : (
          <form onSubmit={handleCloseShift} className="space-y-4 my-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-500 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Shift Balance Overview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-slate-500 font-semibold">Starting Float Cash:</span>
                <span className="tabular-nums font-bold text-slate-900">Rs. {startingCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-slate-500 font-semibold">Cash Sales Inflow:</span>
                <span className="tabular-nums font-bold text-emerald-700">+Rs. {cashCollected.toLocaleString()}</span>
              </div>
              {cashOutflow > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-500 font-semibold">Cash Outflow:</span>
                  <span className="tabular-nums font-bold text-rose-700">-Rs. {cashOutflow.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-600">System Expected in Till:</span>
                <span className="tabular-nums text-base font-semibold text-amber-700">
                  Rs. {expectedCash.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Input: Physical Cash Counted */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>Physically Counted Cash in Till *</span>
                <span className="text-xs text-amber-700 tabular-nums">COUNT CAREFULLY</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 tabular-nums text-sm font-bold">
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
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-rose-500 rounded-lg text-slate-900 tabular-nums text-xl font-semibold outline-none"
                />
              </div>
            </div>

            {/* Real-time Variance Badge */}
            <div
              className={`p-3 rounded-lg border flex items-center justify-between text-xs tabular-nums font-bold ${
                Math.abs(variance) < 0.01
                  ? 'bg-emerald-50 border-emerald-500/50 text-emerald-700'
                  : variance < 0
                  ? 'bg-rose-50 border-rose-500/50 text-rose-700'
                  : 'bg-sky-50 border-sky-500/50 text-sky-700'
              }`}
            >
              <span>Calculated Till Discrepancy:</span>
              <span className="text-sm font-semibold">
                {Math.abs(variance) < 0.01
                  ? 'Rs. 0.00 (PERFECTLY BALANCED ✅)'
                  : `${variance < 0 ? '⚠️ -Rs. ' : '+Rs. '}${Math.abs(variance).toLocaleString()}`}
              </span>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Closing Notes / Explanation (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. End of night shift, counted by cashier"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs outline-none focus:border-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-lg bg-gradient-to-r from-rose-600 text-white to-red-700 hover:from-rose-500 text-white active:scale-[0.98] disabled:opacity-50 text-slate-900 font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2"
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
