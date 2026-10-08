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
  Users,
  Timer,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import axios from 'axios';
import InspectionMediaModal from './InspectionMediaModal';
import ConsumeMaterialModal from './ConsumeMaterialModal';

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function PhysicalBayDashboard({ onGoToBilling }) {
  const [baysData, setBaysData] = useState({
    jack_1: { location: 'JACK_1', name: 'Washing Jack 1', team: 'Wash Team 1', is_occupied: false, current_job: null },
    jack_2: { location: 'JACK_2', name: 'Washing Jack 2', team: 'Wash Team 2', is_occupied: false, current_job: null },
    detailing_bay_1: { location: 'DETAILING_BAY_1', name: 'Detailing Slot 1', team: 'Detailing Team', is_occupied: false, current_job: null },
    detailing_bay_2: { location: 'DETAILING_BAY_2', name: 'Detailing Slot 2', team: 'Detailing Team', is_occupied: false, current_job: null },
  });
  const [queue, setQueue] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [workersList, setWorkersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [mediaModalTarget, setMediaModalTarget] = useState(null);
  const [consumeModalTarget, setConsumeModalTarget] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Dispatch / Multi-Worker Assignment Modal State
  const [dispatchModal, setDispatchModal] = useState(null); // { job, targetLocation }
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);

  // Live ticking timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadWorkers = async () => {
    try {
      const res = await axios.get('/api/users');
      setWorkersList(res.data?.data || []);
    } catch {
      // fallback
    }
  };

  const loadBayStatus = async () => {
    try {
      const res = await axios.get('/api/bays/live-status');
      if (res.data?.status === 'success') {
        setErrorMsg(null);
        if (res.data.physical_bays) {
          setBaysData({
            jack_1: res.data.physical_bays.jack_1 || {},
            jack_2: res.data.physical_bays.jack_2 || {},
            detailing_bay_1: res.data.physical_bays.detailing_bay_1 || res.data.physical_bays.detailing_center || {},
            detailing_bay_2: res.data.physical_bays.detailing_bay_2 || {},
          });
        }
        setQueue(res.data.queue || []);
        setReadyCount(res.data.ready_for_billing?.length || 0);
      }
    } catch (err) {
      setErrorMsg('Workshop status could not be refreshed. Check server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBayStatus();
    loadWorkers();
    const interval = setInterval(loadBayStatus, 4000); // 4-second refresh
    return () => clearInterval(interval);
  }, []);

  // Format running duration for jobs running minutes, hours, or multiple days
  const formatLiveDuration = (startedAt) => {
    if (!startedAt) return '00:00';
    const startMs = new Date(startedAt).getTime();
    const totalSecs = Math.max(0, Math.floor((now - startMs) / 1000));
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (days > 0) {
      return `${days}d ${hours}h ${pad(mins)}m`;
    }
    if (hours > 0) {
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const openDispatchDialog = (job, locationKey) => {
    setDispatchModal({ job, targetLocation: locationKey });
    setSelectedWorkerIds([]);
  };

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  // Direct bay assignment
  const handleStartWork = async (jobCardId, targetLocation) => {
    setActionLoadingId(jobCardId);
    setErrorMsg(null);
    try {
      await axios.patch(`/api/job-cards/${jobCardId}/start`, {
        location: targetLocation,
        assigned_location: targetLocation,
      });
      await loadBayStatus();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to dispatch car to slot.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Start work with single or multiple workers
  const handleConfirmStartWork = async () => {
    if (!dispatchModal) return;
    const { job, targetLocation } = dispatchModal;

    setActionLoadingId(job.id);
    setErrorMsg(null);
    try {
      await axios.patch(`/api/job-cards/${job.id}/start`, {
        location: targetLocation,
        assigned_location: targetLocation,
        worker_ids: selectedWorkerIds,
      });
      setDispatchModal(null);
      await loadBayStatus();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to dispatch car to slot.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark job complete (frees ONLY that specific slot)
  const handleCompleteWork = async (jobCardId) => {
    setActionLoadingId(jobCardId);
    setErrorMsg(null);
    try {
      await axios.patch(`/api/job-cards/${jobCardId}/complete`);
      await loadBayStatus();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to complete job.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const baysList = [
    { key: 'JACK_1', data: baysData.jack_1 || {}, type: 'wash' },
    { key: 'JACK_2', data: baysData.jack_2 || {}, type: 'wash' },
    { key: 'DETAILING_BAY_1', data: baysData.detailing_bay_1 || {}, type: 'detailing' },
    { key: 'DETAILING_BAY_2', data: baysData.detailing_bay_2 || {}, type: 'detailing' },
  ];

  return (
    <div className="workshop-layout space-y-6">
      {errorMsg && (
        <div className="form-error flex items-center gap-2" role="alert">
          <AlertCircle size={16} className="text-red-600" />
          <span>{errorMsg}</span>
          <button className="ml-auto text-xs underline" onClick={() => setErrorMsg(null)}>Dismiss</button>
        </div>
      )}

      {/* Heading Bar */}
      <div className="section-heading flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Work areas
            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
              4 Physical Slots (2 Wash Jacks · 2 Detailing Slots)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jack 1 & Jack 2 for wash operations · Detailing Slot 1 & Detailing Slot 2 for multi-worker detailing jobs
          </p>
        </div>
        <div className="flex gap-2">
          {readyCount > 0 && onGoToBilling && (
            <button
              className="btn btn-primary text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
              onClick={onGoToBilling}
            >
              <CheckCircle2 size={15} />
              {readyCount} Ready for Billing
              <ArrowRight size={14} />
            </button>
          )}
          <button
            className="btn btn-secondary text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
            onClick={loadBayStatus}
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* 4 Physical Bays Grid (2 Wash + 2 Detailing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {baysList.map(({ key, data, type }) => {
          const occupied = Boolean(data.is_occupied && data.current_job);
          const job = data.current_job;
          const assignedWorkers = job?.assigned_worker_names || [];

          return (
            <section
              key={key}
              className={`surface bay-card p-4 rounded-xl border flex flex-col justify-between transition-all ${
                occupied
                  ? 'border-blue-400/80 bg-white ring-1 ring-blue-500/20 shadow-sm'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                {/* Slot Header */}
                <div className="bay-card-heading flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        type === 'wash' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      <Car size={16} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{data.name}</h3>
                      <span className="text-[11px] text-slate-400 block">{data.team}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      occupied ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {occupied ? 'Occupied' : 'Available'}
                  </span>
                </div>

                {occupied && job ? (
                  <div className="mt-3 space-y-3">
                    {/* Vehicle Registration & Ticket */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-lg font-bold text-slate-900 font-mono tracking-wider block">
                          {job.vehicle?.registration_number}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {job.vehicle?.make} {job.vehicle?.model}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {job.ticket_number}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <UserCheck size={13} className="text-slate-400 flex-shrink-0" />
                      <span>{job.customer_name || job.vehicle?.customer_name || 'Walk-in Customer'}</span>
                    </div>

                    {/* Assigned Workers (Requirement 6: Multiple Workers per job) */}
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <Users size={12} className="text-blue-600" />
                        <span>Assigned Workers ({assignedWorkers.length || (job.worker ? 1 : 0)}):</span>
                      </div>
                      <div className="text-slate-800 font-medium">
                        {assignedWorkers.length > 0
                          ? assignedWorkers.join(', ')
                          : job.worker?.name || 'Assigned to Team'}
                      </div>
                    </div>

                    {/* Timer & Duration */}
                    <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-900 flex items-center gap-1">
                        <Timer size={13} className="text-blue-600" />
                        Elapsed Time:
                      </span>
                      <strong className="text-sm font-bold font-mono text-blue-900 tabular-nums">
                        {formatLiveDuration(job.started_at)}
                      </strong>
                    </div>

                    {/* Services */}
                    <div className="text-xs space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Services:</span>
                      <ul className="space-y-0.5">
                        {(job.services || []).map((s) => (
                          <li key={s.id} className="text-slate-700 flex items-center gap-1 text-[11px]">
                            • {s.service?.name || s.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  /* Empty Slot State */
                  <div className="py-10 text-center text-slate-400">
                    <Car size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">Slot is currently free</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dispatch a vehicle from the intake queue below.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {occupied && job && (
                <div className="pt-3 border-t border-slate-100 mt-4 space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1"
                      onClick={() => setMediaModalTarget(job)}
                    >
                      <Camera size={13} />
                      Photos
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1"
                      onClick={() => setConsumeModalTarget(job)}
                    >
                      <Layers size={13} />
                      Materials
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label="Mark work complete"
                    className="btn btn-primary w-full text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
                    disabled={actionLoadingId === job.id}
                    onClick={() => handleCompleteWork(job.id)}
                  >
                    {actionLoadingId === job.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Mark work complete
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Waiting Intake Queue Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Car size={18} className="text-blue-600" />
            Waiting Intake Queue ({queue.length})
          </span>
          <span className="text-xs text-slate-400 font-normal">
            Dispatch waiting cars into any available wash jack or detailing slot
          </span>
        </h3>

        {queue.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No cars currently waiting in queue. Create a new intake ticket to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Vehicle Plate</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Services</th>
                  <th className="py-3 px-4 text-right">Dispatch to Bay / Slot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {queue.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/75">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {job.ticket_number}
                    </td>
                    <td className="py-3 px-4">
                      <strong className="text-sm font-bold font-mono text-slate-900 block">
                        {job.vehicle?.registration_number}
                      </strong>
                      <span className="text-[11px] text-slate-500">
                        {job.vehicle?.make} {job.vehicle?.model}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {job.customer_name || job.vehicle?.customer_name || 'Walk-in'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {job.services?.map((s) => s.service?.name).join(', ') || 'Standard Inspection'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <select
                          className="field text-xs py-1 px-2 border border-slate-300 rounded-lg bg-white"
                          aria-label={`Assign bay for ${job.vehicle?.registration_number}`}
                          value=""
                          disabled={actionLoadingId === job.id}
                          onChange={(e) => e.target.value && handleStartWork(job.id, e.target.value)}
                        >
                          <option value="">{actionLoadingId === job.id ? 'Assigning…' : 'Select a bay'}</option>
                          {baysList.map(({ key: location, data: bay }) => (
                            <option key={location} value={location} disabled={bay.is_occupied}>
                              {bay.name}{bay.is_occupied ? ' · Occupied' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary text-xs px-2.5 py-1 rounded border hover:bg-blue-50 hover:text-blue-700"
                          disabled={baysData.jack_1?.is_occupied}
                          onClick={() => openDispatchDialog(job, 'JACK_1')}
                        >
                          Jack 1
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-xs px-2.5 py-1 rounded border hover:bg-blue-50 hover:text-blue-700"
                          disabled={baysData.jack_2?.is_occupied}
                          onClick={() => openDispatchDialog(job, 'JACK_2')}
                        >
                          Jack 2
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary text-xs px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white"
                          disabled={baysData.detailing_bay_1?.is_occupied}
                          onClick={() => openDispatchDialog(job, 'DETAILING_BAY_1')}
                        >
                          Detailing 1
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary text-xs px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white"
                          disabled={baysData.detailing_bay_2?.is_occupied}
                          onClick={() => openDispatchDialog(job, 'DETAILING_BAY_2')}
                        >
                          Detailing 2
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispatch & Multi-Worker Assignment Modal (Requirement 6) */}
      {dispatchModal && (
        <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              Assign Slot & Workers
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Dispatching <strong>{dispatchModal.job.vehicle?.registration_number}</strong> to{' '}
              <strong>{dispatchModal.targetLocation.replace(/_/g, ' ')}</strong>. Multiple workers can be assigned.
            </p>

            <div className="space-y-3 mb-5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Select Floor Workers to Assign:
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-slate-50">
                {workersList.map((w) => {
                  const isChecked = selectedWorkerIds.includes(w.id);
                  return (
                    <label
                      key={w.id}
                      className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition ${
                        isChecked ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleWorkerSelection(w.id)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{w.name} ({w.role})</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                className="btn btn-secondary px-4 py-1.5 text-xs rounded-lg"
                onClick={() => setDispatchModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary px-5 py-1.5 text-xs rounded-lg flex items-center gap-1.5"
                disabled={actionLoadingId === dispatchModal.job.id}
                onClick={handleConfirmStartWork}
              >
                {actionLoadingId === dispatchModal.job.id && <Loader2 size={13} className="animate-spin" />}
                Confirm & Start Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photos Modal */}
      {mediaModalTarget && (
        <InspectionMediaModal
          jobCard={mediaModalTarget}
          onClose={() => setMediaModalTarget(null)}
        />
      )}

      {/* Materials Modal */}
      {consumeModalTarget && (
        <ConsumeMaterialModal
          jobCard={consumeModalTarget}
          onClose={() => setConsumeModalTarget(null)}
        />
      )}
    </div>
  );
}
