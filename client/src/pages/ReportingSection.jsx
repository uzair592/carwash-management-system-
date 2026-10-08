import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, Calendar, DollarSign, TrendingUp, Receipt, Wallet, Landmark, CreditCard, RefreshCw, Printer, Car, PieChart, Tag, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
const money = val => Number(val || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export default function ReportingSection() {
  const [range, setRange] = useState('month');
  const [reportData, setReportData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const fetchReports = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await axios.get('/api/reports/summary', {
        params: {
          range
        }
      });
      if (res.data?.status === 'success') {
        setReportData(res.data.data);
      }
    } catch (err) {
      setLoadError('Unable to load data. Check the shop server and try again.');
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchReports();
  }, [range]);
  const summary = reportData?.summary || {};
  const topServices = reportData?.top_services || [];
  const topMakes = reportData?.top_makes || [];
  const recentInvoices = reportData?.recent_invoices || [];
  const handlePrint = () => {
    window.print();
  };
  return <div className="business-directory business-report space-y-4">
      {loadError && <div className="form-error" role="alert">{loadError}<button className="btn btn-secondary" onClick={fetchReports}>Try again</button></div>}
      {/* Top Controls Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Sales reports
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sales, collections and service performance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range filter buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
            {[{
            id: 'today',
            label: 'Today'
          }, {
            id: 'yesterday',
            label: 'Yesterday'
          }, {
            id: 'week',
            label: 'This Week'
          }, {
            id: 'month',
            label: 'This Month'
          }, {
            id: 'last_month',
            label: 'Last Month'
          }, {
            id: 'all',
            label: 'All Time'
          }].map(t => <button key={t.id} type="button" onClick={() => setRange(t.id)} className={`px-3 py-1.5 rounded-lg transition ${range === t.id ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}`}>
                {t.label}
              </button>)}
          </div>

          <button type="button" onClick={fetchReports} disabled={isLoading} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition" title="Refresh Report Data">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button type="button" onClick={handlePrint} className="btn-print px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition shadow-xs">
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Gross Revenue
            </p>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              Rs. {money(summary.gross_revenue)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.total_invoices || 0} total customer invoices
          </p>
        </div>

        {/* Card 2: Cash vs Bank Collection */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tender Split
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <Wallet className="w-3.5 h-3.5" /> Cash:
              </span>
              <span className="tabular-nums font-bold text-slate-800">
                Rs. {money(summary.cash_revenue)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1 text-purple-700 font-bold">
                <Landmark className="w-3.5 h-3.5" /> Bank/Card:
              </span>
              <span className="tabular-nums font-bold text-slate-800">
                Rs. {money(summary.bank_revenue)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Invoices & Average Ticket */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Avg Ticket Size
            </p>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-600 tabular-nums">
              Rs. {money(summary.average_ticket)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Average revenue per ticket billed
          </p>
        </div>

        {/* Card 4: Operating Expenses & Net */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Net cash flow
            </p>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700 tabular-nums">
              Rs. {money(summary.net_cash_flow)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Less Rs. {money(summary.total_expenses)} expenses
          </p>
        </div>
      </div>

      {/* Grid: Top Services & Top Vehicle Makes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Services Report */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-blue-600" />
            <span>Top Performing Services</span>
          </h3>

          {topServices.length === 0 ? <p className="text-xs text-slate-400 py-6 text-center">No service data for selected period.</p> : <div className="space-y-3">
              {topServices.slice(0, 6).map((srv, idx) => {
            const totalRev = summary.gross_revenue || 1;
            const pct = Math.min(100, Math.round(srv.revenue / totalRev * 100));
            return <div key={srv.name || idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 tabular-nums text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {srv.name}
                      </span>
                      <div className="text-right">
                        <span className="font-black text-slate-900 tabular-nums">
                          Rs. {money(srv.revenue)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          ({srv.count} jobs)
                        </span>
                      </div>
                    </div>
                    {/* Progress visual bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{
                  width: `${pct}%`
                }} />
                    </div>
                  </div>;
          })}
            </div>}
        </div>

        {/* Top Vehicle Makes Serviced */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 mb-4">
            <Car className="w-4 h-4 text-purple-600" />
            <span>Vehicles Serviced by Make</span>
          </h3>

          {topMakes.length === 0 ? <p className="text-xs text-slate-400 py-6 text-center">No vehicle data for selected period.</p> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {topMakes.slice(0, 6).map(m => <div key={m.make} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    {m.make}
                  </p>
                  <p className="text-xl font-black text-purple-700 tabular-nums mt-1">
                    {m.count}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold">vehicles serviced</p>
                </div>)}
            </div>}
        </div>
      </div>

      {/* Recent Invoices Itemized Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            <span>Itemized Billing & Sales Log</span>
          </h3>
          <span className="text-xs text-slate-500 font-semibold">
            Showing recent transactions
          </span>
        </div>

        {recentInvoices.length === 0 ? <div className="py-12 text-center text-slate-400 text-xs">
            No invoices logged in this time range.
          </div> : <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Vehicle Plate</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Tender</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentInvoices.map(inv => <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 tabular-nums font-bold text-slate-900">
                      {inv.invoice_number || 'INV-0000'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(inv.date).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white tabular-nums font-bold text-[11px]">
                        {inv.plate}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {inv.customer}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.payment_method === 'Cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                        {inv.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.cashier_name}
                    </td>
                    <td className="py-3 px-4 text-right font-black tabular-nums text-slate-900">
                      Rs. {money(inv.total_amount)}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </div>
    </div>;
}
