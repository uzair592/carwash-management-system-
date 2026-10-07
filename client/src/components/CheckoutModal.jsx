import React, { useState } from 'react';
import { X, Receipt, CreditCard, Banknote, ShieldCheck, Printer, CheckCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function CheckoutModal({ jobCard, onClose, onCheckoutSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH or BANK
  const [discount, setDiscount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!jobCard) return null;

  const services = jobCard.services || [];
  const subtotal = services.reduce((sum, s) => sum + parseFloat(s.price_charged || 0), 0);
  const discountNum = Math.max(0, parseFloat(discount) || 0);
  const finalTotal = Math.max(0, subtotal - discountNum);

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await axios.post('/api/invoices/checkout', {
        job_card_id: jobCard.id,
        payment_method: paymentMethod,
        discount_amount: discountNum,
      });

      setInvoiceResult(res.data.data);
      if (onCheckoutSuccess) {
        onCheckoutSuccess(res.data.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Checkout failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Cashier Settlement & Invoice</h3>
              <p className="text-xs text-slate-400">Ticket #{jobCard.ticket_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Post-Checkout Receipt View */}
          {invoiceResult ? (
            <div className="space-y-6 text-center py-2">
              <div className="w-16 h-16 bg-emerald-950/80 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Payment Settled Successfully!</h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Invoice #{invoiceResult.invoice.invoice_number}
                </p>
              </div>

              {/* Printable Receipt Card */}
              <div id="printable-receipt" className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-left text-xs font-mono space-y-2 text-slate-300">
                <div className="text-center font-bold text-sm text-white pb-2 border-b border-slate-800">
                  AUTOWASH & DETAILING SYSTEM
                </div>
                <div className="flex justify-between">
                  <span>VEHICLE:</span>
                  <span className="font-bold text-amber-300">{jobCard.vehicle?.registration_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAYMENT MODE:</span>
                  <span className="font-bold text-white">{invoiceResult.invoice.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>DISCOUNT:</span>
                    <span>-Rs. {discountNum.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-emerald-400 pt-2 border-t border-slate-800">
                  <span>TOTAL PAID:</span>
                  <span>Rs. {invoiceResult.invoice.total_amount.toLocaleString()}</span>
                </div>
                <div className="pt-2 text-[10px] text-slate-500 text-center">
                  Ledger Vault: Rs. {invoiceResult.ledger?.new_balance?.toLocaleString()} • Telegram Logged
                </div>
              </div>

              {/* Action Buttons for Receipt */}
              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  Print Customer Slip
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition"
                >
                  Done / Next Vehicle
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Vehicle & Services Review */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold">Vehicle</span>
                  <span className="text-base font-mono font-black text-amber-300 tracking-wider">
                    {jobCard.vehicle?.registration_number}
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  {services.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-300">
                      <span>{item.service?.name}</span>
                      <span className="font-mono text-slate-200">
                        Rs. {Number(item.price_charged).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Special Discount (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Segmented Payment Tender Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Payment Tender Mode *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Banknote className="w-6 h-6 text-emerald-400" />
                    <span className="font-bold text-sm">CASH DRAWER</span>
                    <span className="text-[10px] text-slate-400 font-mono">Vault 1 (Cash In)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      paymentMethod === 'BANK'
                        ? 'bg-sky-950/80 border-sky-500 ring-2 ring-sky-500/30 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 text-sky-400" />
                    <span className="font-bold text-sm">BANK / CARD</span>
                    <span className="text-[10px] text-slate-400 font-mono">Main Bank Account</span>
                  </button>
                </div>
              </div>

              {/* Audit Transparency Notice */}
              <div className="bg-sky-950/50 border border-sky-800/60 rounded-xl p-3 text-xs text-sky-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Audit Assurance:</span> Completing this transaction executes an immutable PostgreSQL ledger update and triggers an instant Telegram notification to the sleeping partners.
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Total & Finalize Button */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Net Payable Amount</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    Rs. {finalTotal.toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Auditing & Billing...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Finalize & Bill
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
