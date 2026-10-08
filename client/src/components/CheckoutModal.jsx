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
  Tag,
  Landmark,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import axios from 'axios';
import PinPadModal from './PinPadModal';
import { printThermal } from '../utils/print';

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function CheckoutModal({ jobCard, onClose, onCheckoutSuccess }) {
  const [paymentMode, setPaymentMode] = useState('CASH'); // 'CASH' | 'BANK' | 'SPLIT'
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');

  // Editable Payment Amounts
  const [collectedAmount, setCollectedAmount] = useState('');
  const [cashTendered, setCashTendered] = useState('');

  // Split Mode Values
  const [cashSplitAmount, setCashSplitAmount] = useState('');
  const [bankSplitAmount, setBankSplitAmount] = useState('');
  const [splitBankAccountId, setSplitBankAccountId] = useState('');

  // Advances / Deposits
  const [activeDeposits, setActiveDeposits] = useState([]);
  const [selectedDepositIds, setSelectedDepositIds] = useState([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(false);

  // Discount & Admin PIN
  const [discount, setDiscount] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Business Branding for Receipt
  const [branding, setBranding] = useState(null);

  if (!jobCard) return null;

  const services = jobCard.services || [];
  const subtotal = services.reduce((sum, s) => sum + parseFloat(s.price_charged || 0), 0);
  const discountNum = Math.max(0, parseFloat(discount) || 0);
  const grossBilled = Math.max(0, parseFloat((subtotal - discountNum).toFixed(2)));

  // Load bank accounts and branding
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [bankRes, brandRes] = await Promise.all([
          axios.get('/api/banks'),
          axios.get('/api/branding'),
        ]);
        const accounts = bankRes.data?.data?.accounts || [];
        setBankAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedBankAccountId(accounts[0].id);
          setSplitBankAccountId(accounts[0].id);
        }
        if (brandRes.data?.data) {
          setBranding(brandRes.data.data);
        }
      } catch (err) {
        console.warn('Auxiliary data load error:', err.message);
      }
    }
    loadAuxData();
  }, []);

  // Fetch active deposits for this vehicle or customer
  useEffect(() => {
    async function fetchDeposits() {
      setIsLoadingDeposits(true);
      try {
        const vehicleId = jobCard.vehicle_id || jobCard.vehicle?.id;
        const res = await axios.get(`/api/deposits/active${vehicleId ? `?vehicle_id=${vehicleId}` : ''}`);
        if (res.data?.data) {
          setActiveDeposits(res.data.data);
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

  // Initialize collectedAmount whenever netBalanceDue changes
  useEffect(() => {
    setCollectedAmount(String(netBalanceDue));
    setCashTendered(String(netBalanceDue));

    const half = Math.floor(netBalanceDue / 2);
    setCashSplitAmount(String(half));
    setBankSplitAmount(String(parseFloat((netBalanceDue - half).toFixed(2))));
  }, [netBalanceDue]);

  // Numerical payment calculations (Requirement 4)
  const enteredAmount = paymentMode === 'SPLIT'
    ? parseFloat(cashSplitAmount || 0) + parseFloat(bankSplitAmount || 0)
    : parseFloat(collectedAmount || 0);

  const tenderedCash = paymentMode === 'SPLIT'
    ? parseFloat(cashTendered || cashSplitAmount || 0)
    : parseFloat(cashTendered || collectedAmount || 0);

  const appliedCashPortion = paymentMode === 'SPLIT'
    ? parseFloat(cashSplitAmount || 0)
    : (paymentMode === 'CASH' ? parseFloat(collectedAmount || 0) : 0);

  const changeToReturn = Math.max(0, parseFloat((tenderedCash - appliedCashPortion).toFixed(2)));
  const remainingUnpaidBalance = Math.max(0, parseFloat((netBalanceDue - enteredAmount).toFixed(2)));
  const isPartialPayment = remainingUnpaidBalance > 0.01;

  const toggleDepositSelection = (depositId) => {
    setSelectedDepositIds((prev) =>
      prev.includes(depositId) ? prev.filter((id) => id !== depositId) : [...prev, depositId]
    );
  };

  const handlePinApproved = (pin) => {
    setAdminPin(pin);
    setIsPinModalOpen(false);
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

    let paymentsPayload = [];

    if (paymentMode === 'SPLIT') {
      const cAmt = parseFloat(cashSplitAmount || 0);
      const bAmt = parseFloat(bankSplitAmount || 0);

      if (cAmt <= 0 && bAmt <= 0) {
        setIsProcessing(false);
        setErrorMsg('Please enter at least one split payment amount.');
        return;
      }

      if (cAmt > 0) {
        paymentsPayload.push({
          payment_method: 'CASH',
          amount: cAmt,
        });
      }
      if (bAmt > 0) {
        paymentsPayload.push({
          payment_method: 'BANK',
          amount: bAmt,
        });
      }
    } else if (paymentMode === 'BANK') {
      const bAmt = parseFloat(collectedAmount || 0);
      if (bAmt <= 0) {
        setIsProcessing(false);
        setErrorMsg('Collected amount must be greater than zero.');
        return;
      }
      if (!selectedBankAccountId) {
        setIsProcessing(false);
        setErrorMsg('Please select which bank account is receiving this payment.');
        return;
      }
      paymentsPayload.push({
        payment_method: 'BANK',
        amount: bAmt,
        bank_account_id: selectedBankAccountId,
      });
    } else {
      // CASH mode
      const cAmt = parseFloat(collectedAmount || 0);
      if (cAmt <= 0 && netBalanceDue > 0) {
        setIsProcessing(false);
        setErrorMsg('Collected amount must be greater than zero.');
        return;
      }
      paymentsPayload.push({
        payment_method: 'CASH',
        amount: cAmt,
        tender_amount: tenderedCash,
        change_amount: changeToReturn,
      });
    }

    try {
      const res = await axios.post('/api/invoices/checkout', {
        job_card_id: jobCard.id,
        payments: paymentsPayload,
        applied_deposit_ids: selectedDepositIds,
        payment_method: paymentMode === 'SPLIT' ? 'Cash' : paymentMode,
        collected_amount: enteredAmount,
        cash_tendered: paymentMode === 'BANK' ? null : tenderedCash,
        change_returned: changeToReturn,
        bank_account_id: paymentMode === 'BANK' ? selectedBankAccountId : (paymentMode === 'SPLIT' ? (splitBankAccountId || null) : null),
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

  return (
    <div className="dialog-backdrop">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Checkout Settlement & Payment Collection
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                Ticket #{jobCard.ticket_number} · Plate: {jobCard.vehicle?.registration_number}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {invoiceResult ? (
            /* Successful Checkout Receipt Screen */
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Payment Processed Successfully</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Invoice #{invoiceResult.invoice?.invoice_number} generated with status{' '}
                  <strong className="text-slate-800">{invoiceResult.status}</strong>.
                </p>
              </div>

              {/* 80mm Printable Receipt (Requirement 9: with Logo) */}
              <div
                id="printable-receipt"
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left text-xs font-mono max-w-md mx-auto space-y-2 text-black"
                style={{ fontFamily: "'Courier New', Courier, monospace" }}
              >
                {branding?.logo_url && (
                  <div className="text-center mb-2">
                    <img
                      src={branding.logo_url}
                      alt="Logo"
                      style={{
                        maxWidth: `${branding.logo_size || 120}px`,
                        maxHeight: '80px',
                        objectFit: 'contain',
                        margin: '0 auto',
                        display: 'block',
                      }}
                    />
                  </div>
                )}
                <div className="text-center font-bold text-sm">
                  {branding?.business_name || 'DF PRO CAR WASH & DETAILING'}
                </div>
                <div className="text-center text-[11px] text-gray-500">
                  {branding?.tagline || 'Official Customer Receipt'}
                </div>
                <div className="border-t border-b border-dashed border-gray-400 py-1.5 my-2 text-[11px] flex justify-between">
                  <span>Inv: {invoiceResult.invoice?.invoice_number}</span>
                  <span>{new Date().toLocaleDateString('en-GB')}</span>
                </div>
                <div className="text-[11px]">
                  <div><strong>Vehicle:</strong> {jobCard.vehicle?.registration_number}</div>
                  <div><strong>Customer:</strong> {jobCard.customer_name || 'Walk-in'}</div>
                </div>

                <div className="py-2 border-t border-b border-gray-300 space-y-1">
                  {services.map((s) => (
                    <div key={s.id} className="flex justify-between">
                      <span>{s.service?.name || s.name}</span>
                      <strong>Rs. {money(s.price_charged)}</strong>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 pt-1 font-semibold">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rs. {money(invoiceResult.subtotal)}</span>
                  </div>
                  {invoiceResult.discount_amount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span>-Rs. {money(invoiceResult.discount_amount)}</span>
                    </div>
                  )}
                  {invoiceResult.deposits_applied > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Advance Applied:</span>
                      <span>-Rs. {money(invoiceResult.deposits_applied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-black pt-1">
                    <span>Total Paid:</span>
                    <span>Rs. {money(invoiceResult.payments_collected + invoiceResult.deposits_applied)}</span>
                  </div>
                  {invoiceResult.cash_tendered > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span>Cash Tendered:</span>
                      <span>Rs. {money(invoiceResult.cash_tendered)}</span>
                    </div>
                  )}
                  {invoiceResult.change_returned > 0 && (
                    <div className="flex justify-between text-[11px] text-emerald-700">
                      <span>Change Returned:</span>
                      <span>Rs. {money(invoiceResult.change_returned)}</span>
                    </div>
                  )}
                  {invoiceResult.balance_due > 0 && (
                    <div className="flex justify-between font-bold text-red-600 border-t border-dashed border-red-300 pt-1">
                      <span>Remaining Balance Due:</span>
                      <span>Rs. {money(invoiceResult.balance_due)}</span>
                    </div>
                  )}
                </div>

                <div className="text-center text-[10px] text-gray-500 pt-3 border-t border-dashed border-gray-400">
                  <p>Thank you for choosing DF PRO!</p>
                  {branding?.address && <p>{branding.address}</p>}
                  {branding?.phone && <p>Tel: {branding.phone}</p>}
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  type="button"
                  className="btn btn-secondary px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
                  onClick={() => printThermal('printable-receipt')}
                >
                  <Printer className="w-4 h-4" />
                  Print Customer Receipt (80mm)
                </button>
                <button
                  type="button"
                  className="btn btn-primary px-6 py-2.5 rounded-lg text-sm flex items-center gap-2"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Main Editable Checkout Form */
            <>
              {/* Order Services Breakdown */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-2 uppercase">
                  <span>Selected Services</span>
                  <span>Price (PKR)</span>
                </div>
                <div className="space-y-1.5 divide-y divide-slate-100">
                  {services.map((s) => (
                    <div key={s.id} className="flex justify-between text-sm pt-1.5">
                      <span className="text-slate-800">{s.service?.name || s.name}</span>
                      <span className="font-mono font-bold text-slate-900">Rs. {money(s.price_charged)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 mt-3 pt-2.5 flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">Subtotal</span>
                  <span className="font-mono font-bold text-base text-slate-900">Rs. {money(subtotal)}</span>
                </div>
              </div>

              {/* Discounts & Advances */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Special Discount (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                  {discountNum > 0 && (
                    <span className="text-[11px] text-amber-700 mt-1 block">
                      Requires Admin PIN authorization upon checkout.
                    </span>
                  )}
                </div>

                {/* Advance Deposits (if any) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Available deposits
                  </label>
                  {activeDeposits.length === 0 ? (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400">
                      No active deposits on file for this vehicle.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {activeDeposits.map((d) => (
                        <label
                          key={d.id}
                          className="flex items-center justify-between text-xs p-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={selectedDepositIds.includes(d.id)}
                              onChange={() => toggleDepositSelection(d.id)}
                              className="rounded text-blue-600"
                            />
                            <span>Advance Deposit</span>
                          </div>
                          <span className="font-mono font-bold text-blue-900">Rs. {money(d.amount)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMode === 'CASH'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs">Physical Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('BANK')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMode === 'BANK'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Landmark className="w-5 h-5 text-blue-600" />
                    <span className="text-xs">Bank Transfer</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Enable Split Payment"
                    onClick={() => setPaymentMode('SPLIT')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMode === 'SPLIT'
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Split className="w-5 h-5 text-purple-600" />
                    <span className="text-xs">Enable Split Payment</span>
                  </button>
                </div>
              </div>

              {/* Requirement 4: Editable Amount Collected & Change Calculation */}
              {paymentMode === 'CASH' && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-emerald-900 mb-1">
                        Payment Amount Collected (PKR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={collectedAmount}
                        onChange={(e) => setCollectedAmount(e.target.value)}
                        className="w-full p-2.5 border border-emerald-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-emerald-900 mb-1">
                        Cash Tendered (Handed Over by Customer)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full p-2.5 border border-emerald-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200">
                    <span className="text-emerald-800 font-semibold">Change to Return Customer:</span>
                    <strong className="text-base font-bold font-mono text-emerald-900">
                      Rs. {money(changeToReturn)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Requirement 8: Multiple Bank Accounts Selector */}
              {paymentMode === 'BANK' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-blue-900 mb-1">
                      Payment Amount Collected (PKR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={collectedAmount}
                      onChange={(e) => setCollectedAmount(e.target.value)}
                      className="w-full p-2.5 border border-blue-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-blue-900 mb-1">
                      Select Receiving Business Bank Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full p-2.5 border border-blue-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none"
                    >
                      {bankAccounts
                        .filter((b) => b.is_active)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bank_name} ({b.account_title}) · Ledger Bal: Rs. {money(b.current_balance)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Split Mode (Cash + Bank) */}
              {paymentMode === 'SPLIT' && (
                <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">
                        Cash Portion (PKR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashSplitAmount}
                        onChange={(e) => setCashSplitAmount(e.target.value)}
                        className="w-full p-2.5 border border-purple-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">
                        Cash Tendered
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder="Customer handed cash"
                        className="w-full p-2.5 border border-purple-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">
                        Bank Portion (PKR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bankSplitAmount}
                        onChange={(e) => setBankSplitAmount(e.target.value)}
                        className="w-full p-2.5 border border-purple-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">
                        Receiving Bank Account
                      </label>
                      <select
                        value={splitBankAccountId}
                        onChange={(e) => setSplitBankAccountId(e.target.value)}
                        className="w-full p-2.5 border border-purple-300 rounded-lg text-sm bg-white focus:outline-none"
                      >
                        {bankAccounts
                          .filter((b) => b.is_active)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.bank_name} ({b.account_title})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-200">
                    <span className="text-purple-800">Cash Change to Return:</span>
                    <strong className="font-mono font-bold text-purple-900">
                      Rs. {money(changeToReturn)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Partial Payment Notice (Requirement 4) */}
              {isPartialPayment && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Partial Payment Warning:</span>
                    An unpaid balance of <strong>Rs. {money(remainingUnpaidBalance)}</strong> will remain outstanding on this invoice. The invoice will be saved as <strong>PARTIAL</strong>.
                  </div>
                </div>
              )}

              {/* Financial Totals Summary Bar */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Gross Invoice Total:</span>
                  <span className="font-mono font-bold text-white">Rs. {money(grossBilled)}</span>
                </div>
                {totalAppliedDeposit > 0 && (
                  <div className="flex justify-between text-xs text-blue-300">
                    <span>Applied Customer Advance:</span>
                    <span className="font-mono font-bold">-Rs. {money(totalAppliedDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Net Due:</span>
                  <span className="font-mono font-bold text-white">Rs. {money(netBalanceDue)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-slate-700 pt-2 text-emerald-400">
                  <span>Payment Being Collected:</span>
                  <span className="font-mono text-xl">Rs. {money(enteredAmount)}</span>
                </div>
                {isPartialPayment && (
                  <div className="flex justify-between text-xs font-bold text-rose-400 border-t border-slate-800 pt-1">
                    <span>Outstanding Remaining Balance:</span>
                    <span className="font-mono">Rs. {money(remainingUnpaidBalance)}</span>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Checkout Action Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary px-5 py-2.5 text-sm rounded-lg"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-label="Confirm payment"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="btn btn-primary px-7 py-2.5 text-sm rounded-lg flex items-center gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )}
                  {isProcessing ? 'Processing…' : 'Confirm payment'}
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
