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
  RotateCcw
} from 'lucide-react';
import axios from 'axios';
import AdminPinModal from './AdminPinModal';

export default function BillingQueue({ onOpenCheckout }) {
  const [readyJobs, setReadyJobs] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refundTargetInvoice, setRefundTargetInvoice] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('Customer Request / Service Correction');
  const [statusFeedback, setStatusFeedback] = useState(null);

  const loadData = async () => {
    try {
      const [bayRes, invRes] = await axios.all([
        axios.get('/api/bays/live-status'),
        axios.get('/api/invoices?limit=8'),
      ]);

      if (bayRes.data?.ready_for_billing) {
        setReadyJobs(bayRes.data.ready_for_billing);
      }
      if (invRes.data?.data) {
        setRecentInvoices(invRes.data.data);
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
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black text-xl">
            3
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Ready for Billing & Settlement
              <span className="text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
                {readyJobs.length} Vehicles Awaiting Payment
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
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
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-amber-500 w-48 sm:w-60 font-mono"
            />
          </div>

          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-3 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          {statusFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* Main Ready for Billing Grid */}
      <div className="space-y-4">
        {filteredReady.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
              <Receipt className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-300">No Vehicles Waiting for Billing</h3>
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
                  className="bg-slate-900/90 border-2 border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 shadow-2xl flex flex-col justify-between transition-all duration-150 backdrop-blur-xl group"
                >
                  <div>
                    {/* Header: Plate & Ticket */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <span className="font-mono text-2xl font-black text-amber-300 tracking-wider">
                          {job.vehicle?.registration_number}
                        </span>
                        <div className="text-xs text-slate-300 font-semibold mt-0.5">
                          {job.vehicle?.make} {job.vehicle?.model || ''}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                        {job.ticket_number}
                      </span>
                    </div>

                    {/* Customer & Bay Info */}
                    <div className="py-3 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-500">Customer:</span>
                        <strong className="text-white">{job.customer_name || job.vehicle?.customer_name}</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-500">Completed From:</span>
                        <span className="font-mono text-sky-400 font-bold">{bayTag}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-500">Bay Duration:</span>
                        <span className="font-mono text-amber-400 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {calculateBayDuration(job.started_at, job.completed_at)}
                        </span>
                      </div>
                    </div>

                    {/* Services Breakdown */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 space-y-1.5 my-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Completed Services:
                      </span>
                      {job.services?.map((s) => (
                        <div
                          key={s.id}
                          className="flex justify-between items-center text-xs text-slate-300"
                        >
                          <span className="truncate pr-2">• {s.service?.name}</span>
                          <span className="font-mono text-emerald-400 font-bold shrink-0">
                            Rs. {parseFloat(s.price_charged).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settle Payment Action */}
                  <div className="pt-4 border-t border-slate-800 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-400 font-semibold">Net Payable</span>
                      <span className="font-mono text-2xl font-black text-emerald-400">
                        Rs. {subtotal.toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCheckout(job)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 active:scale-[0.98] text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 group-hover:shadow-amber-500/30"
                    >
                      <Receipt className="w-4 h-4 text-slate-950" />
                      <span>Cashier Settle & Print Receipt</span>
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
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Settled Invoices & Ledger Immutability
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Invoices are strictly immutable. Corrections or voids require Shop Admin PIN authorization.
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-xl">
            Audit Standard: Zero-Deletion
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Vehicle</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Tender</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-3 font-mono font-bold text-sky-400">{inv.invoice_number}</td>
                  <td className="py-3 px-3 font-mono font-extrabold text-amber-300">
                    {inv.job_card?.vehicle?.registration_number || 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-semibold">
                    {inv.job_card?.customer_name || inv.job_card?.vehicle?.customer_name || 'Walk-in'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                        inv.payment_method === 'CASH'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-sky-950 text-sky-400 border-sky-800'
                      }`}
                    >
                      {inv.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                    Rs. {parseFloat(inv.total_amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    {inv.refund ? (
                      <span className="font-mono text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded font-bold">
                        REFUNDED
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                        SETTLED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {!inv.refund && (
                      <button
                        type="button"
                        onClick={() => handleRefundInitiate(inv)}
                        className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/60 px-2.5 py-1 rounded-lg transition"
                      >
                        Refund / Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin PIN Pad Modal for Refund Authorization */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setRefundTargetInvoice(null);
        }}
        onSuccess={handlePinSuccess}
        title="Authorize Ledger Refund"
        subtitle={`Admin PIN required to reverse ledger and void Invoice ${refundTargetInvoice?.invoice_number || ''}`}
      />
    </div>
  );
}
