import React, { useState, useEffect } from 'react';
import { Clock, Play, CheckCircle, Receipt, ArrowRight, User, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function BayGrid({ onCheckoutTrigger }) {
  const [jobCards, setJobCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Real-time ticking clock for elapsed counters
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000); // Update every 30s
    return () => clearInterval(timer);
  }, []);

  const loadJobCards = async () => {
    try {
      const res = await axios.get('/api/job-cards');
      if (res.data?.data) {
        setJobCards(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load active bay job cards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobCards();
    const poller = setInterval(loadJobCards, 10000); // Poll every 10s
    return () => clearInterval(poller);
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      await axios.patch(`/api/job-cards/${id}/status`, { status: newStatus });
      loadJobCards();
    } catch (err) {
      alert(err.response?.data?.message || 'Status transition failed.');
    }
  };

  const calculateElapsed = (createdAt) => {
    const start = new Date(createdAt).getTime();
    const diffMinutes = Math.max(0, Math.floor((currentTime - start) / 60000));
    if (diffMinutes < 60) {
      return `${diffMinutes} mins`;
    }
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Group columns:
  // INTAKE: Queued at bay
  // IN_PROGRESS: Undergoing wash/detailing
  // READY_FOR_BILLING: Completed or In_Progress completed, without invoice
  const intakeCards = jobCards.filter((j) => j.status === 'Intake' && !j.invoice);
  const inProgressCards = jobCards.filter((j) => j.status === 'In_Progress' && !j.invoice);
  const readyCards = jobCards.filter((j) => j.status === 'Completed' && !j.invoice);

  const renderCard = (card, column) => {
    const subtotal = card.services?.reduce((sum, s) => sum + parseFloat(s.price_charged || 0), 0) || 0;

    return (
      <div
        key={card.id}
        className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
      >
        <div>
          {/* Header with Plate & Ticket */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                {card.vehicle?.registration_number}
              </span>
              <p className="text-xs text-slate-400">
                {card.vehicle?.make} {card.vehicle?.model || ''}
              </p>
            </div>
            <span className="font-mono text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {card.ticket_number}
            </span>
          </div>

          {/* Services Checklist */}
          <div className="my-3 space-y-1">
            {card.services?.map((item) => (
              <div key={item.id} className="text-xs text-slate-300 flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded">
                <span className="truncate pr-2">• {item.service?.name}</span>
                <span className="font-mono text-emerald-400 shrink-0">
                  Rs. {Number(item.price_charged).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Worker & Live Timer */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 mb-3">
            <span className="flex items-center gap-1 truncate text-slate-300">
              <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {card.worker?.name || 'Unassigned'}
            </span>
            <span className="flex items-center gap-1 font-mono text-amber-400 shrink-0 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
              <Clock className="w-3.5 h-3.5" />
              {calculateElapsed(card.created_at)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2">
          {column === 'INTAKE' && (
            <button
              onClick={() => updateStatus(card.id, 'IN_PROGRESS')}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              Start Wash / Bay Progress
            </button>
          )}

          {column === 'IN_PROGRESS' && (
            <button
              onClick={() => updateStatus(card.id, 'COMPLETED')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark Wash Finished
            </button>
          )}

          {column === 'READY' && (
            <button
              onClick={() => onCheckoutTrigger(card)}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-lg shadow-amber-500/20"
            >
              <Receipt className="w-4 h-4 text-slate-950" />
              Cashier Checkout (Rs. {subtotal.toLocaleString()})
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            Active Bay Operations & Tracking
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status board and live elapsed timer for technicians and cashiers.
          </p>
        </div>
        <button
          onClick={loadJobCards}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
          Refresh Bays
        </button>
      </div>

      {/* 3-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Intake */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col h-[calc(100vh-250px)] min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="font-bold text-sm text-sky-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping"></span>
              Intake / Queued
            </span>
            <span className="bg-sky-950 text-sky-300 font-mono text-xs px-2.5 py-0.5 rounded-full font-bold border border-sky-800">
              {intakeCards.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {intakeCards.map((c) => renderCard(c, 'INTAKE'))}
            {intakeCards.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-600 text-xs italic">
                No vehicles queued in intake.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col h-[calc(100vh-250px)] min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="font-bold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              In Progress / Bay Active
            </span>
            <span className="bg-amber-950 text-amber-300 font-mono text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-800">
              {inProgressCards.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {inProgressCards.map((c) => renderCard(c, 'IN_PROGRESS'))}
            {inProgressCards.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-600 text-xs italic">
                All bays currently idle.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Ready for Billing */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col h-[calc(100vh-250px)] min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <span className="font-bold text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              Ready For Checkout
            </span>
            <span className="bg-emerald-950 text-emerald-300 font-mono text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-800">
              {readyCards.length}
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {readyCards.map((c) => renderCard(c, 'READY'))}
            {readyCards.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-600 text-xs italic">
                No jobs awaiting checkout.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
