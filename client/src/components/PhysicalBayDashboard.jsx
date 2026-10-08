import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Camera,
  Layers,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Car,
  ChevronDown,
  FlaskConical
} from 'lucide-react';
import axios from 'axios';
import InspectionMediaModal from './InspectionMediaModal';
import ConsumeMaterialModal from './ConsumeMaterialModal';

export default function PhysicalBayDashboard({ onGoToBilling }) {
  const [baysData, setBaysData] = useState({
    jack_1: { location: 'JACK_1', name: 'Washing Jack 1', team: 'Wash Team 1', is_occupied: false, current_job: null },
    jack_2: { location: 'JACK_2', name: 'Washing Jack 2', team: 'Wash Team 2', is_occupied: false, current_job: null },
    detailing_center: { location: 'DETAILING_CENTER', name: 'Detailing Center', team: 'Detailing Team', is_occupied: false, current_job: null },
  });
  const [queue, setQueue] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [mediaModalTarget, setMediaModalTarget] = useState(null);
  const [consumeModalTarget, setConsumeModalTarget] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Live ticking timer (every 1 second for live running clock)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadBayStatus = async () => {
    try {
      const res = await axios.get('/api/bays/live-status');
      if (res.data?.status === 'success') {
        if (res.data.physical_bays) {
          setBaysData(res.data.physical_bays);
        }
        setQueue(res.data.queue || []);
        setReadyCount(res.data.ready_for_billing?.length || 0);
      }
    } catch (err) {
      console.warn('Bay status poll error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBayStatus();
    const interval = setInterval(loadBayStatus, 5000); // 5-second polling
    return () => clearInterval(interval);
  }, []);

  // Format exact running duration: MM:SS or HH:MM:SS
  const formatLiveDuration = (startedAt) => {
    if (!startedAt) return '00:00';
    const startMs = new Date(startedAt).getTime();
    const totalSecs = Math.max(0, Math.floor((now - startMs) / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const getDurationMinutes = (startedAt) => {
    if (!startedAt) return 0;
    const startMs = new Date(startedAt).getTime();
    return Math.floor((now - startMs) / 60000);
  };

  // Start work in target bay
  const handleStartWork = async (jobCardId, locationKey) => {
    setActionLoadingId(jobCardId);
    setErrorMsg(null);
    try {
      await axios.patch(`/api/job-cards/${jobCardId}/start`, {
        location: locationKey,
      });
      await loadBayStatus();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to dispatch car to bay.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark wash complete (frees the jack!)
  const handleCompleteWork = async (jobCardId) => {
    setActionLoadingId(jobCardId);
    setErrorMsg(null);
    try {
      await axios.patch(`/api/job-cards/${jobCardId}/complete`);
      await loadBayStatus();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to complete wash.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const baysList = [
    { key: 'JACK_1', data: baysData.jack_1 || {} },
    { key: 'JACK_2', data: baysData.jack_2 || {} },
    { key: 'DETAILING_CENTER', data: baysData.detailing_center || {} },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 font-black text-xl">
            2
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Physical Shop Bay Control
              <span className="text-[11px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full uppercase">
                Live Status
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              3 Distinct Work Areas: Washing Jack 1 (Team 1), Washing Jack 2 (Team 2), and Detailing Center.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadBayStatus}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
            Refresh
          </button>

          {readyCount > 0 && (
            <button
              onClick={onGoToBilling}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 animate-pulse"
            >
              <span>{readyCount} Cars Waiting for Payment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs sm:text-sm font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Screen 2: 3 DISTINCT PHYSICAL WORK AREAS (3 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {baysList.map(({ key, data }) => {
          const isOccupied = Boolean(data.is_occupied && data.current_job);
          const job = data.current_job;
          const mins = job ? getDurationMinutes(job.started_at) : 0;
          const isLongRunning = mins >= 30;

          return (
            <div
              key={key}
              className={`rounded-3xl border-2 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xl ${
                isOccupied
                  ? isLongRunning
                    ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/60 shadow-amber-500/10'
                    : 'bg-gradient-to-b from-sky-950/40 via-slate-900 to-slate-950 border-sky-500/60 shadow-sky-500/10'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Bay Header */}
              <div
                className={`p-5 border-b flex items-center justify-between ${
                  isOccupied
                    ? isLongRunning
                      ? 'border-amber-500/30 bg-amber-950/30'
                      : 'border-sky-500/30 bg-sky-950/30'
                    : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400 uppercase">
                      {key === 'DETAILING_CENTER' ? 'STUDIO BAY 3' : `HYDRAULIC BAY ${key.replace('JACK_', '')}`}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-0.5">{data.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-sky-400 mt-1 font-semibold">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{data.team}</span>
                  </div>
                </div>

                {/* Status Glow Pill */}
                <div>
                  {isOccupied ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold tracking-wide uppercase font-mono animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      IN WORK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold tracking-wide uppercase font-mono">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      VACANT
                    </span>
                  )}
                </div>
              </div>

              {/* Bay Body */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                {isOccupied && job ? (
                  <div className="space-y-5">
                    {/* Vehicle Plate Badge */}
                    <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                      <div>
                        <div className="font-mono text-2xl font-black text-amber-300 tracking-wider">
                          {job.vehicle?.registration_number}
                        </div>
                        <div className="text-xs text-slate-300 font-semibold mt-0.5">
                          {job.vehicle?.make} {job.vehicle?.model || ''}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Cust: <strong className="text-white">{job.customer_name || job.vehicle?.customer_name}</strong>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded block">
                          {job.ticket_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMediaModalTarget(job)}
                          className="mt-2 text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{job.media?.length || 0} Media</span>
                        </button>
                      </div>
                    </div>

                    {/* Live Stopwatch / Ticking Timer */}
                    <div
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        isLongRunning
                          ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                          : 'bg-sky-950/40 border-sky-500/50 text-sky-200'
                      }`}
                    >
                      <div>
                        <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                          Bay Usage Duration
                        </span>
                        <div className="font-mono text-2xl font-black tracking-widest flex items-center gap-2 mt-0.5">
                          <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                          <span>{formatLiveDuration(job.started_at)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono block text-slate-400">
                          Started: {new Date(job.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isLongRunning && (
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mt-0.5">
                            Over 30m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Booked Services Checklist */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Assigned Packages:
                      </span>
                      {job.services?.map((item) => (
                        <div
                          key={item.id}
                          className="text-xs text-slate-200 flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60"
                        >
                          <span className="truncate pr-2 font-medium">• {item.service?.name}</span>
                          <span className="font-mono text-emerald-400 font-bold shrink-0">
                            Rs. {parseFloat(item.price_charged).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Multi-Day Workshop Consumable Usage */}
                    <button
                      type="button"
                      onClick={() => setConsumeModalTarget(job)}
                      className="w-full py-3 px-4 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-200 font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                      <FlaskConical className="w-4 h-4 text-purple-400" />
                      <span>Consume Material (Ceramic / PPF / Liquid)</span>
                    </button>

                    {/* Massive Button: Mark Wash Complete (Free up Jack) */}
                    <button
                      type="button"
                      onClick={() => handleCompleteWork(job.id)}
                      disabled={actionLoadingId === job.id}
                      className="w-full py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition"
                    >
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <span>Mark Wash Complete (Free up {data.name})</span>
                    </button>
                  </div>
                ) : (
                  /* Vacant State */
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                      <Car className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-300">Jack is Currently Vacant</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                        Ready for next car from the waiting queue.
                      </p>
                    </div>

                    {queue.length > 0 ? (
                      <div className="w-full pt-2">
                        <span className="text-[11px] font-mono text-slate-400 block mb-2">
                          {queue.length} car{queue.length > 1 ? 's' : ''} in waiting queue:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartWork(queue[0].id, key)}
                          disabled={actionLoadingId === queue[0].id}
                          className="w-full py-3 px-3 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Pull {queue[0].vehicle?.registration_number} Into {data.name}
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 font-mono">No vehicles queued</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* WAITING QUEUE SECTION: Vehicles awaiting bay assignment */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 font-mono font-black text-sm">
              {queue.length}
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Intake Waiting Queue</h3>
              <p className="text-xs text-slate-400">Cars registered at intake awaiting bay dispatch</p>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Click a button to dispatch car to an open hydraulic jack or detailing studio
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            Waiting queue is empty. Register new vehicles using the Rapid Intake tab.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queue.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono text-lg font-black text-amber-300">
                        {item.vehicle?.registration_number}
                      </span>
                      <p className="text-xs text-slate-400 font-medium">
                        {item.vehicle?.make} {item.vehicle?.model || ''}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                      {item.ticket_number}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 mb-2">
                    Cust: <strong className="text-white">{item.customer_name || item.vehicle?.customer_name}</strong>
                  </div>

                  <div className="space-y-1 mb-3">
                    {item.services?.map((s) => (
                      <div key={s.id} className="text-[11px] text-slate-400 flex justify-between bg-slate-900/50 px-2 py-1 rounded">
                        <span className="truncate pr-1">• {s.service?.name}</span>
                        <span className="font-mono text-emerald-400 shrink-0">
                          Rs. {parseFloat(s.price_charged).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dispatch Buttons to 3 Bays */}
                <div className="space-y-1.5 pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Dispatch to:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Jack 1 Button */}
                    <button
                      type="button"
                      disabled={baysData.jack_1?.is_occupied || actionLoadingId === item.id}
                      onClick={() => handleStartWork(item.id, 'JACK_1')}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center ${
                        baysData.jack_1?.is_occupied
                          ? 'bg-slate-900/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                          : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                      }`}
                    >
                      <span>Jack 1</span>
                      <span className="text-[9px] opacity-75">
                        {baysData.jack_1?.is_occupied ? 'Occupied' : 'Open'}
                      </span>
                    </button>

                    {/* Jack 2 Button */}
                    <button
                      type="button"
                      disabled={baysData.jack_2?.is_occupied || actionLoadingId === item.id}
                      onClick={() => handleStartWork(item.id, 'JACK_2')}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center ${
                        baysData.jack_2?.is_occupied
                          ? 'bg-slate-900/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                          : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                      }`}
                    >
                      <span>Jack 2</span>
                      <span className="text-[9px] opacity-75">
                        {baysData.jack_2?.is_occupied ? 'Occupied' : 'Open'}
                      </span>
                    </button>

                    {/* Detailing Button */}
                    <button
                      type="button"
                      disabled={baysData.detailing_center?.is_occupied || actionLoadingId === item.id}
                      onClick={() => handleStartWork(item.id, 'DETAILING_CENTER')}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center ${
                        baysData.detailing_center?.is_occupied
                          ? 'bg-slate-900/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm'
                      }`}
                    >
                      <span>Detailing</span>
                      <span className="text-[9px] opacity-75">
                        {baysData.detailing_center?.is_occupied ? 'Occupied' : 'Open'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digital Inspection Photos Modal */}
      {mediaModalTarget && (
        <InspectionMediaModal
          jobCard={mediaModalTarget}
          onClose={() => {
            setMediaModalTarget(null);
            loadBayStatus();
          }}
        />
      )}

      {/* Multi-Day Consumable Declaration Modal */}
      {consumeModalTarget && (
        <ConsumeMaterialModal
          isOpen={!!consumeModalTarget}
          jobCard={consumeModalTarget}
          onClose={() => setConsumeModalTarget(null)}
          onMaterialConsumed={() => loadBayStatus()}
        />
      )}
    </div>
  );
}
