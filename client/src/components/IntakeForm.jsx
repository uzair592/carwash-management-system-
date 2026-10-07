import React, { useState, useEffect } from 'react';
import { Car, Phone, UserCheck, CheckCircle2, Star, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function IntakeForm({ onJobCreated }) {
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedWorker, setAssignedWorker] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [workers, setWorkers] = useState([]);

  // VIP / Loyalty State
  const [isCheckingVip, setIsCheckingVip] = useState(false);
  const [vipData, setVipData] = useState(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch Services & Workers on mount
  useEffect(() => {
    fetchServices();
    fetchWorkers();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/services');
      if (res.data?.data) {
        setAvailableServices(res.data.data);
      }
    } catch {
      // Fallback presets if backend is starting
      setAvailableServices([
        { id: '1', name: 'Express Body Foam Wash', price: 1000, category: 'Wash' },
        { id: '2', name: 'Premium Wash & Undercarriage', price: 1800, category: 'Wash' },
        { id: '3', name: 'Interior Deep Shampoo & Vacuum', price: 4500, category: 'Detailing' },
        { id: '4', name: '3-Stage Compound & Paint Correction', price: 12000, category: 'Detailing' },
        { id: '5', name: 'Front Bumper & Hood PPF Installation', price: 35000, category: 'PPF' },
      ]);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await axios.get('/api/users?role=Worker');
      if (res.data?.data) {
        setWorkers(res.data.data);
      }
    } catch {
      setWorkers([]);
    }
  };

  // Debounced Vehicle VIP Lookup
  useEffect(() => {
    const trimmed = plate.trim().toUpperCase();
    if (trimmed.length < 3) {
      setVipData(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingVip(true);
      try {
        const res = await axios.get(`/api/vehicles/${trimmed}`);
        if (res.data?.data) {
          const v = res.data.data;
          setVipData(v);
          if (v.customer_phone && !phone) setPhone(v.customer_phone);
          if (v.make && !make) setMake(v.make);
          if (v.model && !model) setModel(v.model);
        } else {
          setVipData(null);
        }
      } catch {
        setVipData(null);
      } finally {
        setIsCheckingVip(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [plate]);

  const toggleService = (service) => {
    const exists = selectedServices.find((s) => s.id === service.id);
    if (exists) {
      setSelectedServices(selectedServices.filter((s) => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!plate.trim()) {
      setErrorMessage('Registration plate is required.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Customer phone number is required for digital receipts.');
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMessage('Please select at least one wash or detailing service.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        registration_number: plate.trim().toUpperCase(),
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        customer_phone: phone.trim(),
        worker_id: assignedWorker || undefined,
        services: selectedServices.map((s) => ({
          service_id: s.id,
          price: s.price,
        })),
      };

      const res = await axios.post('/api/vehicles/intake', payload);
      setToastMessage({
        type: 'success',
        text: `Job Card ${res.data.data.job_card.ticket_number} created successfully! Dispatched to Bay.`,
      });

      // Reset form
      setPlate('');
      setMake('');
      setModel('');
      setPhone('');
      setSelectedServices([]);
      setAssignedWorker('');
      setVipData(null);

      if (onJobCreated) onJobCreated(res.data.data);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to create job card.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const calculatedSubtotal = selectedServices.reduce((sum, s) => sum + parseFloat(s.price), 0);

  return (
    <div className="max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Car className="w-7 h-7 text-sky-400" />
            Vehicle Intake & Rapid Job Card
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Enforces strict <span className="text-sky-300 font-semibold">"No-Ticket, No-Work"</span> gatekeeper rule.
          </p>
        </div>

        {/* Live VIP Loyalty Banner */}
        {vipData && (
          <div className="flex items-center gap-2">
            {vipData.visits >= 5 ? (
              <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 animate-pulse">
                <Star className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                ⭐ VIP Customer (Visit #{vipData.visits + 1}) - 10% Loyalty Eligible
              </div>
            ) : (
              <div className="bg-sky-950/80 border border-sky-500/40 text-sky-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Returning Vehicle (Visit #{vipData.visits + 1})
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      {toastMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-sm font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          {toastMessage.text}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-200 text-sm font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Vehicle Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Registration Plate *
            </label>
            <div className="relative">
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="e.g. LEB-1234"
                className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-3.5 text-xl font-mono font-bold tracking-wider text-amber-300 focus:outline-none focus:border-sky-500 uppercase placeholder:text-slate-600 shadow-inner"
                required
              />
              {isCheckingVip && (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin absolute right-3.5 top-4" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Make / Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Toyota"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 focus:outline-none focus:border-sky-500"
              />
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Fortuner"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-sky-400" />
              Customer Mobile *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03001234567"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 font-mono text-base focus:outline-none focus:border-sky-500"
              required
            />
          </div>
        </div>

        {/* Worker Assignment */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-sky-400" />
            Assign Bay Technician / Worker
          </label>
          <select
            value={assignedWorker}
            onChange={(e) => setAssignedWorker(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="">-- Unassigned (Auto Bay Dispatch) --</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.commission_rate}% Comm.)
              </option>
            ))}
          </select>
        </div>

        {/* Services Selection Grid */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Select Services & Detailing Packages *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {availableServices.map((service) => {
              const isSelected = selectedServices.some((s) => s.id === service.id);
              return (
                <button
                  type="button"
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between h-24 ${
                    isSelected
                      ? 'bg-sky-950/80 border-sky-400 ring-2 ring-sky-500/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-semibold text-sm line-clamp-2 text-white">
                      {service.name}
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                      isSelected ? 'bg-sky-500 border-sky-400' : 'border-slate-600'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2 w-full">
                    <span className="text-slate-400 font-mono">
                      {service.category || 'Wash'}
                    </span>
                    <span className="font-bold font-mono text-emerald-400 text-sm">
                      Rs. {Number(service.price).toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Bar & Total Summary */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-slate-300 font-medium text-sm">
            Total Quoted Services:{' '}
            <span className="text-emerald-400 font-bold font-mono text-xl ml-2">
              Rs. {calculatedSubtotal.toLocaleString()}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Issuing Ticket...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Ticket & Open Bay
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
