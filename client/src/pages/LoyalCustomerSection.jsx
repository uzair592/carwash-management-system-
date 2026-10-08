import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Search,
  Crown,
  Star,
  Car,
  Phone,
  Calendar,
  Clock,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Plus,
} from 'lucide-react';

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function LoyalCustomerSection({ onSelectCustomerForIntake }) {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL, LOYAL, REGULAR, NEW

  const fetchCustomers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await axios.get('/api/customers', {
        params: {
          search: search.trim() || undefined,
          filter: filter !== 'ALL' ? filter : undefined,
        },
      });
      if (res.data?.status === 'success') {
        setCustomers(res.data.data.customers || []);
        setSummary(res.data.data.summary || null);
      }
    } catch (err) {
      setLoadError('Unable to load data. Check the shop server and try again.');
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, filter]);

  return (
    <div className="business-directory space-y-4">
      {loadError && <div className="form-error" role="alert">{loadError}<button className="btn btn-secondary" onClick={fetchCustomers}>Try again</button></div>}
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Customer directory
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Find returning vehicles and start a new job.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchCustomers}
          disabled={isLoading}
          className="self-start md:self-auto px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Registered */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Customers
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {summary ? summary.total_customers : '—'}
            </span>
            <span className="text-xs font-semibold text-slate-500">profiles</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Registered vehicles in database</p>
        </div>

        {/* Card 2: VIP Loyal Customers */}
        <div className="bg-white border border-amber-200/80 bg-amber-50/20 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              VIP Loyal Members
            </p>
            <Crown className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-700">
              {summary ? summary.loyal_customers : '—'}
            </span>
            <span className="text-xs font-bold text-amber-700">
              ({summary?.loyalty_threshold || 5}+ visits)
            </span>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-1">High-retention repeat clients</p>
        </div>

        {/* Card 3: Repeat Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Repeat Visit Rate
            </p>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-600">
              {summary ? `${summary.repeat_rate_percent}%` : '—'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Customers returning &gt; 1 time</p>
        </div>

        {/* Card 4: Total Lifetime Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Customer Revenue
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {summary ? `Rs. ${money(summary.total_lifetime_revenue)}` : '—'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Lifetime payments billed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            placeholder="Search by plate, customer name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Customers' },
            { id: 'LOYAL', label: 'Loyal', icon: Crown },
            { id: 'REGULAR', label: 'Returning' },
            { id: 'NEW', label: 'First-time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table / Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-semibold">Loading customer directory…</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-700">No customers found</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Vehicle Plate</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4 text-center">Visits</th>
                  <th className="py-3.5 px-4 text-center">Loyalty Tier</th>
                  <th className="py-3.5 px-4 text-right">Lifetime Spend</th>
                  <th className="py-3.5 px-4">Last Visit</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {customers.map((c) => {
                  const isVip = c.is_loyal;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Vehicle Plate & Make */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="px-2.5 py-1 rounded-md bg-slate-900 text-white tabular-nums font-black text-xs tracking-wider border border-slate-800 shadow-2xs">
                            {c.registration_number}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">
                              {c.make} {c.model}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div>
                          <strong className="text-slate-900 font-bold block text-xs">
                            {c.customer_name}
                          </strong>
                          {c.customer_phone ? (
                            <span className="text-[11px] text-slate-500 tabular-nums flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {c.customer_phone}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No phone logged</span>
                          )}
                        </div>
                      </td>

                      {/* Visits Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800">
                          {c.visits} {c.visits === 1 ? 'visit' : 'visits'}
                        </span>
                      </td>

                      {/* Loyalty Tier Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {c.loyalty_tier === 'VIP_PLATINUM' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                            <Crown className="w-3 h-3 text-purple-600" />
                            VIP PLATINUM
                          </span>
                        ) : c.loyalty_tier === 'VIP_GOLD' || isVip ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                            VIP LOYAL ({c.visits})
                          </span>
                        ) : c.visits > 1 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            REGULAR
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                            New Walk-in
                          </span>
                        )}
                      </td>

                      {/* Lifetime Spend */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-slate-900 text-xs tabular-nums">
                          Rs. {money(c.total_spent)}
                        </span>
                      </td>

                      {/* Last Visit */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {c.last_visit ? (
                          <div>
                            <span>{new Date(c.last_visit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            {c.recent_services?.length > 0 && (
                              <span className="block text-[10px] text-slate-400 truncate max-w-[140px]" title={c.recent_services.join(', ')}>
                                {c.recent_services[0]}
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectCustomerForIntake) {
                              onSelectCustomerForIntake(c);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 transition flex items-center gap-1 mx-auto"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Ticket</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
