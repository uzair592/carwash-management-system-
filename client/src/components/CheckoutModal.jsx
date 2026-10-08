import React, { useState } from 'react';
import {
  X,
  Receipt,
  CreditCard,
  Banknote,
  ShieldCheck,
  Printer,
  CheckCircle,
  Loader2,
  Lock,
  User,
  Clock,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import AdminPinModal from './AdminPinModal';

export default function CheckoutModal({ jobCard, onClose, onCheckoutSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH or BANK
  const [discount, setDiscount] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  if (!jobCard) return null;

  const services = jobCard.services || [];
  const subtotal = services.reduce((sum, s) => sum + parseFloat(s.price_charged || 0), 0);
  const discountNum = Math.max(0, parseFloat(discount) || 0);
  const finalTotal = Math.max(0, subtotal - discountNum);

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    // If discount is applied and PIN not provided yet, open PIN modal
    if (discountNum > 0 && !adminPin) {
      setIsProcessing(false);
      setIsPinModalOpen(true);
      return;
    }

    try {
      const res = await axios.post('/api/invoices/checkout', {
        job_card_id: jobCard.id,
        payment_method: paymentMethod,
        discount_amount: discountNum,
        admin_pin: adminPin || undefined,
      });

      setInvoiceResult(res.data.data);
      if (onCheckoutSuccess) {
        onCheckoutSuccess(res.data.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Checkout settlement failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePinApproved = (verifiedPin) => {
    setAdminPin(verifiedPin);
    // Continue checkout automatically
    setTimeout(async () => {
      setIsProcessing(true);
      try {
        const res = await axios.post('/api/invoices/checkout', {
          job_card_id: jobCard.id,
          payment_method: paymentMethod,
          discount_amount: discountNum,
          admin_pin: verifiedPin,
        });
        setInvoiceResult(res.data.data);
        if (onCheckoutSuccess) onCheckoutSuccess(res.data.data);
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Checkout failed.');
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Cashier Settlement & Invoice</h3>
              <p className="text-xs text-slate-400 font-mono">Ticket #{jobCard.ticket_number}</p>
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
              <div className="w-16 h-16 bg-emerald-950/80 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Payment Settled Successfully!</h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Invoice #{invoiceResult.invoice.invoice_number}
                </p>
              </div>

              {/* Printable Thermal Receipt Card (80mm) */}
              <div
                id="printable-receipt"
                className="thermal-receipt bg-slate-950 border border-slate-800 rounded-2xl p-5 text-left text-xs font-mono space-y-2.5 text-slate-300 shadow-inner"
              >
                <div className="text-center font-bold text-sm text-white pb-2.5 border-b border-slate-800">
                  <span className="thermal-title block text-base font-black">AUTOWASH &amp; DETAILING STUDIO</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Official Customer Tax Invoice</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">INVOICE NO:</span>
                  <span className="font-bold text-sky-400">#{invoiceResult.invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CUSTOMER:</span>
                  <span className="font-bold text-white">
                    {jobCard.customer_name || jobCard.vehicle?.customer_name}
                  </span>
                </div>
                <div className="thermal-plate-box border border-slate-700 bg-slate-900/60 rounded-lg py-1.5 px-3 flex justify-between items-center my-1.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">VEHICLE PLATE:</span>
                  <span className="font-black text-amber-300 text-sm font-mono tracking-wider">{jobCard.vehicle?.registration_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PAYMENT TENDER:</span>
                  <span className="font-bold text-emerald-400">{invoiceResult.invoice.payment_method}</span>
                </div>

                <div className="pt-1.5 border-t border-slate-800 space-y-1">
                  {services.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-300">
                      <span className="truncate pr-1">• {item.service?.name}</span>
                      <span className="font-mono text-slate-200">Rs. {parseFloat(item.price_charged).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400">SUBTOTAL:</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>DISCOUNT (AUTH):</span>
                    <span>-Rs. {discountNum.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black text-emerald-400 pt-2 border-t-2 border-slate-700">
                  <span>TOTAL PAID:</span>
                  <span>Rs. {parseFloat(invoiceResult.invoice.total_amount).toLocaleString()}</span>
                </div>

                <div className="pt-3 text-[11px] text-slate-400 text-center border-t border-dashed border-slate-800 space-y-0.5">
                  <div className="font-bold text-slate-200">Thank you for visiting!</div>
                  <div>Please visit us again soon.</div>
                  <div className="text-[9px] text-slate-500 pt-1">
                    Ledger Vault: Rs. {parseFloat(invoiceResult.ledger?.new_balance || 0).toLocaleString()} • Decoupled Outbox Logged
                  </div>
                </div>
              </div>

              {/* Action Buttons for Receipt */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  Print Customer Slip
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-xs transition shadow-lg shadow-emerald-600/20"
                >
                  Done / Bay Freed
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Customer & Vehicle Review */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-inner">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold block">Vehicle & Customer</span>
                    <span className="text-base font-bold text-white">
                      {jobCard.customer_name || jobCard.vehicle?.customer_name}
                    </span>
                  </div>
                  <span className="text-xl font-mono font-black text-amber-300 tracking-wider">
                    {jobCard.vehicle?.registration_number}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {services.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-300">
                      <span>• {item.service?.name}</span>
                      <span className="font-mono text-slate-200">
                        Rs. {parseFloat(item.price_charged).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Input with Admin Security Notice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Special Discount (Rs.)</span>
                  <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Admin PIN Required if &gt; 0
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => {
                      setDiscount(e.target.value);
                      if (parseFloat(e.target.value) <= 0) setAdminPin('');
                    }}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                  {discountNum > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsPinModalOpen(true)}
                      className={`absolute right-2 top-2 py-1 px-2.5 rounded-lg text-[10px] font-bold border transition ${
                        adminPin
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}
                    >
                      {adminPin ? 'PIN Authorized' : 'Authorize PIN'}
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Payment Tender Mode *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Banknote className="w-6 h-6 text-emerald-400" />
                    <span className="font-extrabold text-sm">CASH DRAWER</span>
                    <span className="text-[10px] text-slate-400 font-mono">Physical Cash In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition ${
                      paymentMethod === 'BANK'
                        ? 'bg-sky-950/80 border-sky-500 ring-2 ring-sky-500/30 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 text-sky-400" />
                    <span className="font-extrabold text-sm">BANK / CARD</span>
                    <span className="text-[10px] text-slate-400 font-mono">Main Bank Transfer</span>
                  </button>
                </div>
              </div>

              {/* Decoupled Outbox Assurance */}
              <div className="bg-sky-950/40 border border-sky-800/60 rounded-2xl p-3 text-xs text-sky-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Decoupled Outbox Guaranteed:</span> Telegram alert is committed to PostgreSQL in the same transaction. The background worker delivers it automatically—checkout never fails if the internet drops.
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Total & Finalize Button */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Net Settlement</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    Rs. {finalTotal.toLocaleString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-7 py-4 rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center gap-2 active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Billing & Committing...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Finalize & Print Slip
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Admin PIN Approval Modal for Discounts */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinApproved}
        title="Admin Discount Authorization"
        subtitle={`Enter Admin PIN (1234) to authorize Rs. ${discountNum.toLocaleString()} discount on Ticket #${jobCard.ticket_number}`}
      />
    </div>
  );
}
