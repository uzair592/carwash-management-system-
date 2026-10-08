import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Wallet,
  Split,
  Tag
} from 'lucide-react';
import axios from 'axios';
import PinPadModal from './PinPadModal';
import { printThermal } from '../utils/print';

export default function CheckoutModal({ jobCard, onClose, onCheckoutSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH or BANK (single mode)
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [cashSplitAmount, setCashSplitAmount] = useState('');
  const [bankSplitAmount, setBankSplitAmount] = useState('');

  const [activeDeposits, setActiveDeposits] = useState([]);
  const [selectedDepositIds, setSelectedDepositIds] = useState([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(false);

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
  const grossBilled = Math.max(0, subtotal - discountNum);

  // Fetch active deposits for this vehicle or customer
  useEffect(() => {
    async function fetchDeposits() {
      setIsLoadingDeposits(true);
      try {
        const vehicleId = jobCard.vehicle_id || jobCard.vehicle?.id;
        const res = await axios.get(`/api/deposits/active${vehicleId ? `?vehicle_id=${vehicleId}` : ''}`);
        if (res.data?.data) {
          setActiveDeposits(res.data.data);
          // By default, auto-select matching active deposits
          const ids = res.data.data.map((d) => d.id);
          setSelectedDepositIds(ids);
        }
      } catch (err) {
        console.warn('Failed to load active deposits:', err.message);
      } finally {
        setIsLoadingDeposits(false);
      }
    }
    fetchDeposits();
  }, [jobCard]);

  // Compute total applied deposits
  const totalAppliedDeposit = activeDeposits
    .filter((d) => selectedDepositIds.includes(d.id))
    .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

  const netBalanceDue = Math.max(0, parseFloat((grossBilled - totalAppliedDeposit).toFixed(2)));

  // Auto-fill split amounts when netBalanceDue changes or split toggled
  useEffect(() => {
    if (isSplitPayment) {
      const half = Math.floor(netBalanceDue / 2);
      setCashSplitAmount(String(half));
      setBankSplitAmount(String(parseFloat((netBalanceDue - half).toFixed(2))));
    }
  }, [isSplitPayment, netBalanceDue]);

  const toggleDepositSelection = (depositId) => {
    setSelectedDepositIds((prev) =>
      prev.includes(depositId) ? prev.filter((id) => id !== depositId) : [...prev, depositId]
    );
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    // If discount is applied and PIN not provided yet, open PIN modal
    if (discountNum > 0 && !adminPin) {
      setIsProcessing(false);
      setIsPinModalOpen(true);
      return;
    }

    // Validate Split Payment math if active
    let paymentsPayload = [];
    if (isSplitPayment && netBalanceDue > 0) {
      const cashVal = parseFloat(cashSplitAmount) || 0;
      const bankVal = parseFloat(bankSplitAmount) || 0;
      const splitSum = parseFloat((cashVal + bankVal).toFixed(2));

      if (Math.abs(splitSum - netBalanceDue) > 0.01) {
        setIsProcessing(false);
        setErrorMsg(
          `Split payment amounts (Rs. ${splitSum.toLocaleString()}) must match the remaining balance due (Rs. ${netBalanceDue.toLocaleString()}).`
        );
        return;
      }

      if (cashVal > 0) paymentsPayload.push({ payment_method: 'CASH', amount: cashVal });
      if (bankVal > 0) paymentsPayload.push({ payment_method: 'BANK', amount: bankVal });
    } else if (netBalanceDue > 0) {
      paymentsPayload.push({ payment_method: paymentMethod, amount: netBalanceDue });
    }

    try {
      const res = await axios.post('/api/invoices/checkout', {
        job_card_id: jobCard.id,
        payments: paymentsPayload,
        applied_deposit_ids: selectedDepositIds,
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
        let paymentsPayload = [];
        if (isSplitPayment && netBalanceDue > 0) {
          const cashVal = parseFloat(cashSplitAmount) || 0;
          const bankVal = parseFloat(bankSplitAmount) || 0;
          if (cashVal > 0) paymentsPayload.push({ payment_method: 'CASH', amount: cashVal });
          if (bankVal > 0) paymentsPayload.push({ payment_method: 'BANK', amount: bankVal });
        } else if (netBalanceDue > 0) {
          paymentsPayload.push({ payment_method: paymentMethod, amount: netBalanceDue });
        }

        const res = await axios.post('/api/invoices/checkout', {
          job_card_id: jobCard.id,
          payments: paymentsPayload,
          applied_deposit_ids: selectedDepositIds,
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
    if (!printThermal('printable-receipt')) setErrorMsg('Allow pop-ups to open the receipt print preview.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40  animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-sm overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Collect payment</h3>
              <p className="text-xs text-slate-500 tabular-nums">
                Ticket #{jobCard.ticket_number} •
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

        {/* Modal Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Post-Checkout Receipt View */}
          {invoiceResult ? (
            <div className="space-y-6 text-center py-2">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-700 shadow-sm">
                <CheckCircle className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-semibold text-slate-900">Payment Settled Successfully!</h4>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Invoice #{invoiceResult.invoice.invoice_number}
                </p>
              </div>

              {/* Printable Thermal Receipt Card (80mm) */}
              <div
                id="printable-receipt"
                className="thermal-receipt bg-slate-50 border border-slate-200 rounded-lg p-5 text-left text-xs tabular-nums space-y-2.5 text-slate-600 shadow-none"
              >
                <div className="text-center font-bold text-sm text-slate-900 pb-2.5 border-b border-slate-200">
                  <span className="thermal-title block text-base font-semibold">PUREPACK CAR WASH &amp; DETAILING</span>
                  <span className="block text-xs text-slate-500 font-normal mt-0.5">Customer invoice</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">INVOICE NO:</span>
                  <span className="font-bold text-sky-700">#{invoiceResult.invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CUSTOMER:</span>
                  <span className="font-bold text-slate-900">
                    {jobCard.customer_name || jobCard.vehicle?.customer_name}
                  </span>
                </div>
                <div className="thermal-plate-box border border-slate-200 bg-white rounded-lg py-1.5 px-3 flex justify-between items-center my-1.5">
                  <span className="text-xs text-slate-500 font-bold uppercase">VEHICLE PLATE:</span>
                  <span className="font-semibold text-amber-700 text-sm tabular-nums tracking-wider">{jobCard.vehicle?.registration_number}</span>
                </div>

                <div className="pt-1.5 border-t border-slate-200 space-y-1">
                  {services.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-600">
                      <span className="truncate pr-1">• {item.service?.name}</span>
                      <span className="tabular-nums text-slate-700">Rs. {parseFloat(item.price_charged).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">SUBTOTAL:</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>DISCOUNT (AUTH):</span>
                    <span>-Rs. {discountNum.toLocaleString()}</span>
                  </div>
                )}
                {totalAppliedDeposit > 0 && (
                  <div className="flex justify-between text-sky-700">
                    <span>ADVANCE DEPOSIT OFFSET:</span>
                    <span>-Rs. {totalAppliedDeposit.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-semibold text-emerald-700 pt-2 border-t-2 border-slate-200">
                  <span>TOTAL SETTLED:</span>
                  <span>Rs. {parseFloat(invoiceResult.invoice.total_amount).toLocaleString()}</span>
                </div>

                {/* Tender Breakdown */}
                <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                  <span className="text-slate-500 font-bold block uppercase text-xs">Tender Records:</span>
                  {invoiceResult.payments?.map((pmt, i) => (
                    <div key={pmt.id || i} className="flex justify-between text-slate-600">
                      <span>• {pmt.payment_method} Payment:</span>
                      <span className="font-bold text-emerald-700">Rs. {parseFloat(pmt.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {invoiceResult.applied_deposits?.map((dep, i) => (
                    <div key={dep.id || i} className="flex justify-between text-sky-700">
                      <span>• Advance Deposit Applied:</span>
                      <span className="font-bold text-sky-700">Rs. {parseFloat(dep.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 text-xs text-slate-500 text-center border-t border-dashed border-slate-200 space-y-0.5">
                  <div className="font-bold text-slate-700">Thank you for visiting!</div>
                  <div>Please visit us again soon.</div>
                  <div className="text-xs text-slate-500 pt-1">
                    PUREPACK Car Wash & Detailing
                  </div>
                </div>
              </div>

              {/* Action Buttons for Receipt */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Printer className="w-4 h-4 text-sky-700" />
                  Print Customer Slip
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-xl text-xs transition shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Customer & Vehicle Review */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 shadow-none">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">Vehicle &amp; Customer</span>
                    <span className="text-base font-bold text-slate-900">
                      {jobCard.customer_name || jobCard.vehicle?.customer_name}
                    </span>
                  </div>
                  <span className="text-xl tabular-nums font-semibold text-amber-700 tracking-wider">
                    {jobCard.vehicle?.registration_number}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {services.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-600">
                      <span>• {item.service?.name}</span>
                      <span className="tabular-nums text-slate-700">
                        Rs. {parseFloat(item.price_charged).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advance Customer Deposits (Liabilities) Section */}
              {activeDeposits.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-sky-700" />
                      Available deposits
                    </span>
                    <span className="text-xs bg-sky-100 border border-sky-200 text-sky-700 px-2 py-0.5 rounded-full tabular-nums">
                      {activeDeposits.length} Available
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeDeposits.map((dep) => {
                      const isSelected = selectedDepositIds.includes(dep.id);
                      return (
                        <div
                          key={dep.id}
                          onClick={() => toggleDepositSelection(dep.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-sky-100 border-sky-400 ring-1 ring-sky-400/40 text-slate-900'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <span className={isSelected ? 'text-slate-900' : 'text-slate-600'}>
                                {dep.customer_name}
                              </span>
                              <span className="text-xs text-slate-500 tabular-nums">
                                ({new Date(dep.created_at).toLocaleDateString()})
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Tender: {dep.payment_method} {dep.notes ? `• ${dep.notes}` : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="tabular-nums font-semibold text-sm text-sky-700">
                              Rs. {parseFloat(dep.amount).toLocaleString()}
                            </span>
                            <span className="block text-xs uppercase font-bold text-emerald-700">
                              {isSelected ? '✓ Applying' : 'Tap to Apply'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discount Input with Admin Security Notice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Special Discount (Rs.)</span>
                  <span className="text-xs text-amber-700 tabular-nums flex items-center gap-1">
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
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 tabular-nums text-sm focus:outline-none focus:border-amber-500"
                  />
                  {discountNum > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsPinModalOpen(true)}
                      className={`absolute right-2 top-2 py-1 px-2.5 rounded-lg text-xs font-bold border transition ${
                        adminPin
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {adminPin ? 'PIN Authorized' : 'Authorize PIN'}
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Mode Selector & Split Payments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Payment method
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSplitPayment(!isSplitPayment)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition ${
                      isSplitPayment
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>{isSplitPayment ? '✓ Split Payments Active' : 'Enable Split Payment'}</span>
                  </button>
                </div>

                {isSplitPayment ? (
                  /* Split Payment Inputs */
                  <div className="bg-slate-50 border-2 border-purple-500/40 rounded-lg p-4 space-y-3">
                    <div className="text-xs text-purple-700 font-bold flex items-center justify-between">
                      <span>Multi-Tender Allocation:</span>
                      <span className="tabular-nums text-slate-600">
                        Balance Due: Rs. {netBalanceDue.toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                          Cash Drawer (Rs.)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={cashSplitAmount}
                          onChange={(e) => setCashSplitAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 tabular-nums text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-sky-700 uppercase tracking-wider mb-1">
                          Bank / Card (Rs.)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={bankSplitAmount}
                          onChange={(e) => setBankSplitAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 tabular-nums text-sm focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div className="text-xs tabular-nums text-slate-500 text-right">
                      Allocated Sum: Rs.{' '}
                      {(parseFloat(cashSplitAmount || 0) + parseFloat(bankSplitAmount || 0)).toLocaleString()} / Rs.{' '}
                      {netBalanceDue.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  /* Single Mode Buttons */
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center gap-1.5 transition ${
                        paymentMethod === 'CASH'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <Banknote className="w-6 h-6 text-emerald-700" />
                      <span className="font-semibold text-sm">CASH DRAWER</span>
                      <span className="text-xs text-slate-500 tabular-nums">Physical Cash In</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK')}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center gap-1.5 transition ${
                        paymentMethod === 'BANK'
                          ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/30 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <CreditCard className="w-6 h-6 text-sky-700" />
                      <span className="font-semibold text-sm">BANK / CARD</span>
                      <span className="text-xs text-slate-500 tabular-nums">Main Bank Transfer</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Decoupled Outbox Assurance */}
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-700 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Payment summary:</span> Advance deposits offset customer liabilities; split payments hit independent ledger accounts. Materials are already consumed at the bay.
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-500 text-rose-700 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Total & Finalize Button */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block font-semibold">
                    Amount to collect
                  </span>
                  <span className="text-2xl font-semibold tabular-nums text-emerald-700">
                    Rs. {netBalanceDue.toLocaleString()}
                  </span>
                  {totalAppliedDeposit > 0 && (
                    <span className="text-xs text-sky-700 tabular-nums block">
                      (Deposit Applied: Rs. {totalAppliedDeposit.toLocaleString()})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="bg-emerald-600 text-white hover:bg-emerald-500 text-white disabled:opacity-50 text-slate-900 font-semibold px-7 py-4 rounded-lg shadow-sm transition flex items-center gap-2 active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving payment…
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Confirm payment
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Admin PIN Approval Modal for Discounts */}
      <PinPadModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinApproved}
        title="Admin Discount Authorization"
        description={`Enter Admin or Manager PIN to authorize Rs. ${discountNum.toLocaleString()} discount on Ticket #${jobCard.ticket_number}`}
      />
    </div>
  );
}
