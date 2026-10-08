import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Clock,
  Car,
  User,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  CreditCard,
  Banknote,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Printer,
  X,
} from 'lucide-react';
import axios from 'axios';
import PinPadModal from './PinPadModal';
import { printThermal } from '../utils/print';
import { InvoiceThermalReceipt } from './ThermalTemplates';

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function BillingQueue({ onOpenCheckout }) {
  const [readyJobs, setReadyJobs] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refundTargetInvoice, setRefundTargetInvoice] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('Customer Request / Service Correction');
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [printInvoiceTarget, setPrintInvoiceTarget] = useState(null);
  const [branding, setBranding] = useState(null);
  const [printBusinessName, setPrintBusinessName] = useState(true);

  const loadData = async () => {
    try {
      const [bayRes, invRes, brandRes] = await axios.all([
        axios.get('/api/bays/live-status'),
        axios.get('/api/invoices?limit=8'),
        axios.get('/api/branding').catch(() => ({ data: null })),
      ]);

      if (bayRes.data?.ready_for_billing) {
        setReadyJobs(bayRes.data.ready_for_billing);
      }
      if (invRes.data?.data) {
        setRecentInvoices(invRes.data.data);
      }
      if (brandRes.data?.data) {
        setBranding(brandRes.data.data);
        if (brandRes.data.data.show_business_name !== undefined) {
          setPrintBusinessName(brandRes.data.data.show_business_name !== false);
        }
      }
    } catch (err) {
      console.warn('Billing queue poll error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 6000);
    return () => clearInterval(timer);
  }, []);

  const calculateBayDuration = (startedAt, completedAt) => {
    if (!startedAt) return 'Quick';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diffMins = Math.max(1, Math.round((end - start) / 60000));
    return `${diffMins} mins in bay`;
  };

  const handleRefundInitiate = (invoice) => {
    setRefundTargetInvoice(invoice);
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = async (adminPin) => {
    if (!refundTargetInvoice) return;

    try {
      const res = await axios.post(`/api/invoices/${refundTargetInvoice.id}/refund`, {
        admin_pin: adminPin,
        reason: refundReason,
        amount: refundTargetInvoice.total_amount,
      });

      setStatusFeedback({
        type: 'success',
        text: `Refund approved for invoice ${refundTargetInvoice.invoice_number}. Ledger reversed & telegram alerted.`,
      });
      loadData();
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Refund authorization failed.',
      });
    } finally {
      setRefundTargetInvoice(null);
    }
  };

  const filteredReady = readyJobs.filter((job) => {
    const q = searchTerm.toLowerCase();
    const plate = job.vehicle?.registration_number?.toLowerCase() || '';
    const cust = (job.customer_name || job.vehicle?.customer_name || '').toLowerCase();
    const ticket = job.ticket_number?.toLowerCase() || '';
    return plate.includes(q) || cust.includes(q) || ticket.includes(q);
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 ">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-slate-950 shadow-sm font-semibold text-xl">
            3
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              Ready for payment
              <span className="text-xs tabular-nums bg-amber-500/10 text-amber-700 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
                {readyJobs.length} awaiting payment
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Vehicles that completed wash/detailing, freed up the jacks, and are ready for cashier settlement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter plate, customer..."
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 outline-none focus:border-amber-500 w-48 sm:w-60 tabular-nums"
            />
          </div>

          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-200 text-slate-500 hover:text-slate-900 transition"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-700' : ''}`} />
          </button>
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`p-4 rounded-lg border text-xs sm:text-sm font-semibold flex items-center gap-3 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
              : 'bg-rose-50 border-rose-500 text-rose-700'
          }`}
        >
          {statusFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" />
          )}
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* Main Ready for Billing Grid */}
      <div className="space-y-4">
        {filteredReady.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
              <Receipt className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-600">No Vehicles Waiting for Billing</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When a wash team marks a vehicle complete in Jack 1, Jack 2, or Detailing, it will instantly appear here for cashier checkout.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredReady.map((job) => {
              const subtotal =
                job.services?.reduce((sum, s) => sum + parseFloat(s.price_charged || 0), 0) || 0;
              const bayTag =
                job.assigned_location === 'JACK_1'
                  ? 'Jack 1 (Team 1)'
                  : job.assigned_location === 'JACK_2'
                  ? 'Jack 2 (Team 2)'
                  : job.assigned_location === 'DETAILING_CENTER'
                  ? 'Detailing Studio'
                  : 'Bay Completed';

              return (
                <div
                  key={job.id}
                  className="bg-white border-2 border-slate-200 hover:border-amber-500/60 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all duration-150  group"
                >
                  <div>
                    {/* Header: Plate & Ticket */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <span className="tabular-nums text-2xl font-semibold text-amber-700 tracking-wider">
                          {job.vehicle?.registration_number}
                        </span>
                        <div className="text-xs text-slate-600 font-semibold mt-0.5">
                          {job.vehicle?.make} {job.vehicle?.model || ''}
                        </div>
                      </div>
                      <span className="tabular-nums text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        {job.ticket_number}
                      </span>
                    </div>

                    {/* Customer & Bay Info */}
                    <div className="py-3 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-slate-500">Customer:</span>
                        <strong className="text-slate-900">{job.customer_name || job.vehicle?.customer_name}</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-slate-500">Completed From:</span>
                        <span className="tabular-nums text-sky-700 font-bold">{bayTag}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-slate-500">Bay Duration:</span>
                        <span className="tabular-nums text-amber-700 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {calculateBayDuration(job.started_at, job.completed_at)}
                        </span>
                      </div>
                    </div>

                    {/* Services Breakdown */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 my-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Completed Services:
                      </span>
                      {job.services?.map((s) => (
                        <div
                          key={s.id}
                          className="flex justify-between items-center text-xs text-slate-600"
                        >
                          <span className="truncate pr-2">• {s.service?.name}</span>
                          <span className="tabular-nums text-emerald-700 font-bold shrink-0">
                            Rs. {parseFloat(s.price_charged).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settle Payment Action */}
                  <div className="pt-4 border-t border-slate-200 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500 font-semibold">Net Payable</span>
                      <span className="tabular-nums text-2xl font-semibold text-emerald-700">
                        Rs. {subtotal.toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCheckout(job)}
                      className="w-full py-3.5 px-4 rounded-lg bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 active:scale-[0.98] text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm group-hover:shadow-amber-500/30"
                    >
                      <Receipt className="w-4 h-4 text-slate-950" />
                      <span>Collect payment</span>
                      <ArrowRight className="w-4 h-4 ml-auto text-slate-950" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT SETTLED INVOICES & IMMUTABLE LEDGER REVERSAL / REFUND */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-5 ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              Recent invoices
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review payments or request an authorised refund.
            </p>
          </div>
          <span className="text-xs tabular-nums bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl">
            Payment history
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tabular-nums text-xs">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Vehicle</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Tender</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-100 transition">
                  <td className="py-3 px-3 tabular-nums font-bold text-sky-700">{inv.invoice_number}</td>
                  <td className="py-3 px-3 tabular-nums font-semibold text-amber-700">
                    {inv.job_card?.vehicle?.registration_number || 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-semibold">
                    {inv.job_card?.customer_name || inv.job_card?.vehicle?.customer_name || 'Walk-in'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`tabular-nums text-xs px-2 py-0.5 rounded border ${
                        inv.payment_method === 'CASH'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}
                    >
                      {inv.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-semibold text-emerald-700">
                    Rs. {parseFloat(inv.total_amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    {inv.refund ? (
                      <span className="tabular-nums text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-bold">
                        REFUNDED
                      </span>
                    ) : (
                      <span className="tabular-nums text-xs bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                        SETTLED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPrintInvoiceTarget(inv)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Invoice
                      </button>
                      {!inv.refund && (
                        <button
                          type="button"
                          onClick={() => handleRefundInitiate(inv)}
                          className="text-xs font-semibold text-rose-700 hover:text-rose-700 bg-rose-50 hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin PIN Pad Modal for Refund Authorization */}
      <PinPadModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setRefundTargetInvoice(null);
        }}
        onSuccess={handlePinSuccess}
        title="Authorize Ledger Refund"
        description={`Admin or Manager PIN required to reverse ledger and void Invoice ${refundTargetInvoice?.invoice_number || ''}`}
      />

      {/* Invoice Reprint Modal with Business Logo (Requirement 9 & User Request) */}
      {printInvoiceTarget && (
        <div className="dialog-backdrop">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Customer Invoice Print #{printInvoiceTarget.invoice_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintInvoiceTarget(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Business Name on Invoice Check Mark (User Requirement) */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={printBusinessName}
                  onChange={(e) => setPrintBusinessName(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <span>Print Business Name on Invoice</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {printBusinessName ? '✓ Name will print' : '✗ Name omitted (logo only)'}
              </span>
            </div>

            {/* 80mm ESC/POS Formatted Receipt with Business Logo */}
            <InvoiceThermalReceipt
              invoice={printInvoiceTarget}
              branding={branding}
              showBusinessName={printBusinessName}
              id="reprint-invoice-dialog"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary px-4 py-2 text-xs rounded-lg"
                onClick={() => setPrintInvoiceTarget(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary px-5 py-2 text-xs rounded-lg flex items-center gap-1.5 shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => printThermal('reprint-invoice-dialog')}
              >
                <Printer className="w-4 h-4" />
                Print Invoice (80mm)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
