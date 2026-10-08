import React, { useState, useEffect } from 'react';
import {
  X,
  FlaskConical,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import axios from 'axios';

export default function ConsumeMaterialModal({ isOpen, onClose, jobCard, onMaterialConsumed }) {
  const [inventory, setInventory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoadingInv, setIsLoadingInv] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadInventory();
      setSelectedItem(null);
      setQuantity('');
      setNotes('');
      setErrorMsg(null);
      setSuccessResult(null);
    }
  }, [isOpen]);

  const loadInventory = async () => {
    setIsLoadingInv(true);
    try {
      const res = await axios.get('/api/inventory');
      if (res.data?.data) {
        setInventory(res.data.data);
      }
    } catch (err) {
      setErrorMsg('Failed to load consumable inventory items.');
    } finally {
      setIsLoadingInv(false);
    }
  };

  if (!isOpen || !jobCard) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) {
      setErrorMsg('Please select an inventory consumable.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg('Please enter a valid positive quantity.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await axios.post('/api/materials/issue', {
        job_card_id: jobCard.id,
        inventory_id: selectedItem.id,
        quantity_issued: qtyNum,
        notes: notes || undefined,
      });

      setSuccessResult(res.data);
      if (onMaterialConsumed) {
        onMaterialConsumed(res.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to issue material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40  animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-sm overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-700">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Workshop Material Consumption</h3>
              <p className="text-xs text-slate-500 tabular-nums">
                Bay Issuance • Ticket #{jobCard.ticket_number} ({jobCard.vehicle?.registration_number})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {successResult ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-700 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-slate-900">Material Deducted Instantly!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Stock decremented in real-time. Decoupled from final customer checkout.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs tabular-nums text-left space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">CONSUMABLE:</span>
                  <span className="text-slate-900 font-bold">{successResult.inventory?.item_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">QUANTITY USED:</span>
                  <span className="text-purple-700 font-bold">
                    {quantity} {successResult.inventory?.unit_type}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">NEW INVENTORY STOCK:</span>
                  <span className="text-emerald-700 font-bold">
                    {successResult.inventory?.current_stock} {successResult.inventory?.unit_type}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-xl text-xs transition"
              >
                Close &amp; Return to Bay
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Consumable */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Select Consumable Chemical / Liquid *
                </label>
                {isLoadingInv ? (
                  <div className="flex items-center justify-center p-5 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span>Loading consumable catalog...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {inventory.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isLow = parseFloat(item.current_stock) <= parseFloat(item.low_stock_threshold || 10);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/30 text-slate-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200'
                          }`}
                        >
                          <div className="font-bold text-xs truncate">{item.item_name}</div>
                          <div className="flex items-center justify-between text-xs tabular-nums mt-1 text-slate-500">
                            <span>
                              {parseFloat(item.current_stock).toLocaleString()} {item.unit_type}
                            </span>
                            {isLow && (
                              <span className="text-amber-700 font-sans text-xs uppercase font-bold">
                                Low
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quantity Used Input */}
              {selectedItem && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Selected Item:</span>
                    <span className="text-xs tabular-nums font-bold text-purple-700">
                      {selectedItem.item_name}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Quantity Consumed ({selectedItem.unit_type}) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={`e.g. 30 (in ${selectedItem.unit_type})`}
                        required
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 tabular-nums text-sm focus:outline-none focus:border-purple-500"
                      />
                      <span className="absolute right-3 top-3 text-xs tabular-nums text-slate-500 font-bold">
                        {selectedItem.unit_type}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Notes / Application Step (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 1st layer ceramic coating on hood & roof"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* ERP Invariant Notice */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Decoupled ERP Accounting:</strong> Material stock is deducted now on Day 1 of detailing, rather than waiting for invoice checkout on Day 3.
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-500 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedItem}
                  className="flex-1 bg-gradient-to-r from-purple-600 text-white to-indigo-600 hover:from-purple-500 text-white hover:to-indigo-500 disabled:opacity-50 text-slate-900 font-semibold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deducting Stock...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-4 h-4" />
                      Confirm Stock Issuance
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
