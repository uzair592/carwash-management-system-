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
        setErrorMsg(null);
        if (res.data.physical_bays) {
          setBaysData(res.data.physical_bays);
        }
        setQueue(res.data.queue || []);
        setReadyCount(res.data.ready_for_billing?.length || 0);
      }
    } catch (err) {
      setErrorMsg('Workshop status could not be refreshed. Check the shop server.');
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
    <div className="workshop-layout">
      {errorMsg && <div className="form-error" role="alert"><AlertCircle size={16} /><span>{errorMsg}</span><button className="ml-auto" onClick={loadBayStatus}>Try again</button></div>}
      <div className="section-heading"><h2>Work areas <span>3 bays</span></h2><div className="flex gap-2">{readyCount > 0 && onGoToBilling && <button className="btn btn-secondary" onClick={onGoToBilling}>{readyCount} ready for billing<ArrowRight size={15} /></button>}<button className="btn btn-secondary" onClick={loadBayStatus}><RotateCw size={15} />Refresh</button></div></div>
      <div className="bay-layout">
        {baysList.map(({ key, data }) => {
          const occupied = Boolean(data.is_occupied && data.current_job);
          const job = data.current_job;
          const overdue = job && getDurationMinutes(job.started_at) >= 30;
          return <section key={key} className={`surface bay-card ${occupied ? 'bay-occupied' : ''}`}>
            <div className="bay-card-heading"><span className="section-icon"><Car size={18} /></span><div><h3>{data.name}</h3><span>{data.team}</span></div><span className={`bay-status ${occupied ? 'occupied' : ''}`}>{occupied ? 'In progress' : 'Available'}</span></div>
            {occupied ? <>
              <div className="bay-vehicle"><div><strong>{job.vehicle?.registration_number}</strong><span>{job.vehicle?.make} {job.vehicle?.model}</span></div><span className="bay-ticket">{job.ticket_number}</span></div>
              <p className="bay-customer"><UserCheck size={13} />{job.customer_name || job.vehicle?.customer_name}</p>
              <div className={`bay-timer ${overdue ? 'overdue' : ''}`}><span><Clock size={15} />Time in bay</span><strong>{formatLiveDuration(job.started_at)}</strong></div>
              <div className="bay-services">{job.services?.map((item) => <div key={item.id}><CheckCircle2 size={12} /><span>{item.service?.name}</span></div>)}</div>
              <div className="bay-tools"><button onClick={() => setMediaModalTarget(job)}><Camera size={14} />Photos ({job.media?.length || 0})</button><button onClick={() => setConsumeModalTarget(job)}><FlaskConical size={14} />Materials</button></div>
              <button className="btn btn-primary bay-complete" disabled={actionLoadingId === job.id} onClick={() => handleCompleteWork(job.id)}><CheckCircle2 size={16} />{actionLoadingId === job.id ? 'Saving…' : 'Mark work complete'}</button>
            </> : <div className="bay-empty"><Car size={34} /><strong>Ready for the next vehicle</strong><p>Assign a queued job to this bay.</p>{queue.length > 0 && <button className="btn btn-secondary" disabled={actionLoadingId === queue[0].id} onClick={() => handleStartWork(queue[0].id, key)}><Play size={14} />Start next job</button>}</div>}
          </section>;
        })}
      </div>
      <section className="surface queue-panel"><div className="section-title"><span className="section-icon"><Layers size={18} /></span><div><h2>Waiting queue</h2><p>Assign registered vehicles to an available work area.</p></div><span className="service-count">{queue.length} vehicles</span></div>
        {isLoading && !queue.length ? <div className="empty-state">Loading the workshop…</div> : !queue.length ? <div className="empty-state"><Car size={25} /><strong>No vehicles waiting</strong><p>New work tickets appear here.</p></div> : <div className="queue-table-wrapper"><table className="queue-table"><thead><tr><th>Vehicle / ticket</th><th>Customer</th><th>Services</th><th>Assign work area</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id}><td><strong>{item.vehicle?.registration_number}</strong><span>{item.ticket_number}</span></td><td>{item.customer_name || item.vehicle?.customer_name}<span>{item.vehicle?.make} {item.vehicle?.model}</span></td><td>{item.services?.map((service) => service.service?.name).join(', ') || '—'}</td><td><select className="field" aria-label={`Assign bay for ${item.vehicle?.registration_number}`} value="" disabled={actionLoadingId === item.id} onChange={(event) => event.target.value && handleStartWork(item.id, event.target.value)}><option value="">{actionLoadingId === item.id ? 'Assigning…' : 'Select a bay'}</option>{baysList.map(({ key: location, data: bay }) => <option key={location} value={location} disabled={bay.is_occupied}>{bay.name}{bay.is_occupied ? ' · Occupied' : ''}</option>)}</select></td></tr>)}</tbody></table></div>}
      </section>
      {mediaModalTarget && <InspectionMediaModal jobCard={mediaModalTarget} onClose={() => { setMediaModalTarget(null); loadBayStatus(); }} />}
      {consumeModalTarget && <ConsumeMaterialModal isOpen jobCard={consumeModalTarget} onClose={() => setConsumeModalTarget(null)} onMaterialConsumed={loadBayStatus} />}
    </div>
  );
}
