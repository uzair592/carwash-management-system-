import React, { useState, useEffect } from 'react';
import {
  Car,
  User,
  Phone,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
  RotateCcw
} from 'lucide-react';
import axios from 'axios';

const VEHICLE_MAKES = ['Toyota', 'Honda', 'Suzuki', 'KIA', 'Hyundai', 'MG', 'Audi', 'Mercedes', 'BMW', 'Other'];

export default function IntakeForm({ onJobCreated }) {
  const [plate, setPlate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Post-Intake Ticket Modal
  const [generatedTicket, setGeneratedTicket] = useState(null);

  // Fetch Services from backend on load
  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/services');
      if (res.data?.data && res.data.data.length > 0) {
        setAvailableServices(res.data.data);
      } else {
        throw new Error('Empty services');
      }
    } catch {
      // Clean fallback packages
      setAvailableServices([
        { id: '1', name: 'Express Body Foam Wash', price: 1000, category: 'Wash', description: 'High-pressure snow foam, wheel arches, microfiber dry' },
        { id: '2', name: 'Premium Wash & Undercarriage', price: 1800, category: 'Wash', description: 'Underbody blast, engine bay rinse, tire shine & wax spray' },
        { id: '3', name: 'Interior Deep Shampoo & Vacuum', price: 4500, category: 'Detailing', description: 'Seats steam extraction, roof lining, AC vents sterilization' },
        { id: '4', name: '3-Stage Compound & Ceramic Glow', price: 12000, category: 'Detailing', description: 'Full paint decontamination, cut, polish & 9H ceramic topcoat' },
        { id: '5', name: 'High-Impact PPF Installation', price: 35000, category: 'PPF', description: 'Self-healing polyurethane film on bumper, hood & mirrors' },
      ]);
    }
  };

  // Debounced Vehicle VIP Lookup when typing plate
  useEffect(() => {
    const trimmed = plate.trim().toUpperCase();
    if (trimmed.length < 3) return;

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/vehicles/${trimmed}`);
        if (res.data?.data) {
          const v = res.data.data;
          if (v.customer_name && !customerName) setCustomerName(v.customer_name);
          if (v.customer_phone && !customerPhone) setCustomerPhone(v.customer_phone);
          if (v.make) setMake(v.make);
          if (v.model && !model) setModel(v.model);
        }
      } catch {
        // vehicle not yet registered, continue smoothly
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [plate]);

  const toggleService = (srv) => {
    const exists = selectedServices.find((s) => s.id === srv.id);
    if (exists) {
      setSelectedServices(selectedServices.filter((s) => s.id !== srv.id));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  };

  const handleQuickMake = (m) => {
    setMake(m);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPlate = plate.trim().toUpperCase();
    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();

    if (!cleanPlate) {
      setErrorMessage('Vehicle Registration Plate is strictly required.');
      return;
    }
    if (!cleanName) {
      setErrorMessage('Customer Name is strictly required for physical intake.');
      return;
    }
    if (!cleanPhone) {
      setErrorMessage('Customer Phone Number is strictly required for ticket receipt.');
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMessage('Please select at least one wash or detailing package.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        registration_number: cleanPlate,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        make: make || undefined,
        model: model.trim() || undefined,
        intake_notes: intakeNotes.trim() || undefined,
        services: selectedServices.map((s) => ({
          service_id: s.id,
          price: s.price,
          name: s.name,
        })),
      };

      const res = await axios.post('/api/intake', payload);
      const createdCard = res.data.data;

      setGeneratedTicket({
        ...createdCard,
        selectedServices,
      });

      // Clear form inputs
      setPlate('');
      setCustomerName('');
      setCustomerPhone('');
      setModel('');
      setIntakeNotes('');
      setSelectedServices([]);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Intake failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateSubtotal = () => {
    return selectedServices.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Rapid Intake Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-black text-xl">
              1
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Rapid Intake Terminal
                <span className="text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
                  No-Ticket, No-Work
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Physical shop intake: register customer, plate & package. Dispatches directly to the Bay Waiting Queue.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-950 text-slate-400 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Live Queue Status: Instant Dispatch
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Registration Plate Badge + Customer Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Plate Input with Realistic License Plate Badge */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Vehicle Registration Plate *</span>
                <span className="text-[10px] text-amber-400 font-mono">ALL-CAPS FORMAT</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <div className="w-7 h-5 rounded bg-emerald-700 text-[10px] font-black text-white flex items-center justify-center font-mono">
                    PK
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. LEA-21-9988"
                  className="w-full pl-14 pr-4 py-3.5 bg-slate-950 border-2 border-slate-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-white font-mono text-lg font-black tracking-widest placeholder:text-slate-600 transition outline-none"
                />
              </div>
            </div>

            {/* Customer Name Input (STRICTLY REQUIRED) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Customer Full Name *</span>
                <span className="text-[10px] text-sky-400 font-mono">STRICTLY REQUIRED</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Malik Muhammad Umair"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border-2 border-slate-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-white font-semibold text-base placeholder:text-slate-600 transition outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Customer Phone + Vehicle Make/Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Customer Phone Number *</span>
                <span className="text-[10px] text-slate-400 font-mono">SMS & INVOICE</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="w-5 h-5 text-slate-500" />
                </div>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border-2 border-slate-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-white font-mono text-base placeholder:text-slate-600 transition outline-none"
                />
              </div>
            </div>

            {/* Model & Make Chips */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Vehicle Make & Model
              </label>
              <div className="flex gap-2">
                <select
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-1/3 py-3.5 px-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white font-bold text-sm outline-none focus:border-sky-500"
                >
                  {VEHICLE_MAKES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model (e.g. Civic RS / Fortuner)"
                  className="flex-1 py-3.5 px-4 bg-slate-950 border-2 border-slate-800 focus:border-sky-500 rounded-2xl text-white font-semibold text-sm placeholder:text-slate-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Make Selection Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Quick Select:</span>
            {VEHICLE_MAKES.slice(0, 6).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleQuickMake(m)}
                className={`text-xs px-3 py-1 rounded-lg border font-semibold transition ${
                  make === m
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Service Selection Cards */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Select Wash & Detailing Packages *
              </label>
              <span className="text-xs font-mono text-slate-400">
                {selectedServices.length} Selected • Subtotal:{' '}
                <strong className="text-emerald-400 font-black">
                  Rs. {calculateSubtotal().toLocaleString()}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {availableServices.map((srv) => {
                const isSelected = selectedServices.some((s) => s.id === srv.id);
                return (
                  <div
                    key={srv.id}
                    onClick={() => toggleService(srv)}
                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all duration-150 flex flex-col justify-between select-none ${
                      isSelected
                        ? 'bg-sky-950/70 border-sky-400 shadow-lg shadow-sky-500/10 ring-2 ring-sky-400/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                            srv.category === 'Wash'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : srv.category === 'Detailing'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {srv.category || 'Package'}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                            isSelected ? 'bg-sky-400 text-slate-950' : 'border border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>

                      <h4 className="font-extrabold text-sm text-white leading-tight mt-1">
                        {srv.name}
                      </h4>
                      {srv.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {srv.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-semibold">Package Price</span>
                      <span className="font-mono text-base font-black text-emerald-400">
                        Rs. {parseFloat(srv.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Bay Notes */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Special Bay Instructions / Notes (Optional)
            </label>
            <input
              type="text"
              value={intakeNotes}
              onChange={(e) => setIntakeNotes(e.target.value)}
              placeholder="e.g. VIP client, focus on wheel rims, trunk contains delicate items..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs placeholder:text-slate-600 outline-none focus:border-slate-700"
            />
          </div>

          {/* Action Row: Massive Generate Ticket Button */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setPlate('');
                  setCustomerName('');
                  setCustomerPhone('');
                  setModel('');
                  setSelectedServices([]);
                }}
                className="py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Form
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-w-[320px] bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white font-black text-base py-4 px-8 rounded-2xl shadow-xl shadow-sky-500/25 flex items-center justify-center gap-3 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Job Ticket...
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  Print / Generate Job Ticket
                  <span className="font-mono text-xs bg-black/30 px-2 py-0.5 rounded-lg border border-white/20">
                    Rs. {calculateSubtotal().toLocaleString()}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Ticket Modal with Immediate Print / Dispatch Option */}
      {generatedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 text-slate-100 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-black text-white">Ticket Issued & Queued</h3>
                  <p className="text-xs text-slate-400">Physical bay dispatch ticket generated</p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                QUEUED
              </span>
            </div>

            {/* Printable Ticket Card */}
            <div
              id="printable-job-ticket"
              className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl p-5 my-5 space-y-4 font-mono text-xs"
            >
              <div className="text-center pb-3 border-b border-slate-800">
                <h4 className="text-base font-black text-white tracking-widest">AUTOWASH SERVICE TICKET</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Physical Shop Queue Pass</p>
                <div className="inline-block mt-2 bg-slate-900 text-sky-400 font-bold px-3 py-1 rounded-md border border-slate-800 text-sm">
                  {generatedTicket.ticket_number}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Plate Number:</span>
                  <span className="text-base font-black text-amber-300">{generatedTicket.vehicle?.registration_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Customer:</span>
                  <span className="text-sm font-bold text-white truncate block">{generatedTicket.customer_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Phone:</span>
                  <span className="text-xs text-slate-300">{generatedTicket.vehicle?.customer_phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Vehicle:</span>
                  <span className="text-xs text-slate-300">
                    {generatedTicket.vehicle?.make} {generatedTicket.vehicle?.model || ''}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Booked Packages:</span>
                <div className="space-y-1">
                  {generatedTicket.services?.map((s) => (
                    <div key={s.id} className="flex justify-between items-center text-slate-200">
                      <span>• {s.service?.name || s.name}</span>
                      <span className="font-bold text-emerald-400">
                        Rs. {parseFloat(s.price_charged || s.price).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center font-bold text-sm">
                <span className="text-slate-400">Total Est. Bill:</span>
                <span className="text-emerald-400 font-black">
                  Rs.{' '}
                  {generatedTicket.services
                    ?.reduce((sum, s) => sum + parseFloat(s.price_charged || s.price || 0), 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                Print Physical Ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratedTicket(null);
                  if (onJobCreated) onJobCreated(generatedTicket);
                }}
                className="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-sky-500/20"
              >
                <span>View Physical Bays</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
