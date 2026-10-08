import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  User,
  Search,
  Plus,
  X,
  Printer,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ClipboardList,
  Check,
  Crown,
  History,
  Phone,
  Clock,
  Sparkles,
} from 'lucide-react';
import axios from 'axios';
import { printThermal } from '../utils/print';
import { TokenThermalTicket } from './ThermalTemplates';

const DEFAULT_MAKES = ['Toyota', 'Honda', 'Suzuki', 'KIA', 'Hyundai', 'MG', 'Changan', 'Haval', 'Chery', 'Audi', 'Mercedes', 'BMW', 'Other'];
const money = (value) => Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function IntakeForm({ onJobCreated }) {
  const [plate, setPlate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [make, setMake] = useState('Toyota');
  const [isAddingMake, setIsAddingMake] = useState(false);
  const [newMakeText, setNewMakeText] = useState('');
  const [model, setModel] = useState('');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [category, setCategory] = useState('All services');
  const [search, setSearch] = useState('');
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedTicket, setGeneratedTicket] = useState(null);

  // Recognition state (Requirement 7)
  const [plateRecognition, setPlateRecognition] = useState(null);
  const [isCheckingPlate, setIsCheckingPlate] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Branding state for ticket logo (Requirement 9)
  const [branding, setBranding] = useState(null);

  const ticketDialog = useRef(null);
  const submitButton = useRef(null);
  const submitting = useRef(false);

  const fetchServices = async () => {
    setIsLoadingServices(true);
    setServiceError('');
    try {
      const res = await axios.get('/api/services');
      setAvailableServices(res.data?.data || []);
    } catch {
      setServiceError('Services could not be loaded. Check the shop server and try again.');
    } finally {
      setIsLoadingServices(false);
    }
  };

  const fetchBranding = async () => {
    try {
      const res = await axios.get('/api/branding');
      if (res.data?.data) setBranding(res.data.data);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchServices();
    fetchBranding();
  }, []);

  // Plate recognition with debounce (Requirement 7)
  useEffect(() => {
    const trimmed = plate.trim().toUpperCase();
    setPlateRecognition(null);
    if (trimmed.length < 3) return;

    const controller = new AbortController();
    setIsCheckingPlate(true);
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/bays/check-plate/${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (res.data?.data && res.data.data.exists) {
          const data = res.data.data;
          setPlateRecognition(data);
          // Auto-fill existing customer details if available and not yet modified
          if (data.customer_name && !customerName) setCustomerName(data.customer_name);
          if (data.customer_phone && !customerPhone) setCustomerPhone(data.customer_phone);
          if (data.make) setMake(data.make);
          if (data.model && !model) setModel(data.model);
        }
      } catch {
        /* New plate */
      } finally {
        setIsCheckingPlate(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [plate]);

  // Modal focus trap for generated ticket
  useEffect(() => {
    if (!generatedTicket) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ticketDialog.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key !== 'Tab') return;
      const controls = ticketDialog.current?.querySelectorAll('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      submitButton.current?.focus();
    };
  }, [generatedTicket]);

  const toggleService = (service) => {
    setSelectedServices((previous) =>
      previous.some((s) => s.id === service.id)
        ? previous.filter((s) => s.id !== service.id)
        : [...previous, { ...service, price_charged: service.price }]
    );
  };

  const handleUpdateServicePrice = (serviceId, newPrice) => {
    const val = Math.max(0, parseFloat(newPrice) || 0);
    setSelectedServices((previous) =>
      previous.map((s) => (s.id === serviceId ? { ...s, price: val, price_charged: val } : s))
    );
  };

  const subtotal = selectedServices.reduce((sum, service) => sum + Number(service.price_charged ?? service.price ?? 0), 0);
  const categories = ['All services', ...new Set(availableServices.map((s) => s.category || 'Other'))];
  const visibleServices = availableServices.filter(
    (s) =>
      (category === 'All services' || (s.category || 'Other') === category) &&
      `${s.name} ${s.description || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const resetForm = () => {
    setPlate('');
    setCustomerName('');
    setCustomerPhone('');
    setMake('Toyota');
    setModel('');
    setIntakeNotes('');
    setSelectedServices([]);
    setPlateRecognition(null);
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;

    // Requirement 2: Plate number and at least 1 service are strictly required; Name and Phone are OPTIONAL!
    if (!plate.trim()) {
      setErrorMessage('Vehicle registration plate number is strictly required.');
      return;
    }

    if (!selectedServices.length) {
      setErrorMessage('Please select at least one service before creating the ticket.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    submitting.current = true;

    try {
      const res = await axios.post('/api/intake', {
        registration_number: plate.trim().toUpperCase(),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        make,
        model: model.trim() || undefined,
        intake_notes: intakeNotes.trim() || undefined,
        services: selectedServices.map((s) => ({
          service_id: s.id,
          price: Number(s.price_charged ?? s.price),
          name: s.name,
        })),
      });

      const created = res.data?.data?.job_card || res.data?.data;
      if (!created?.id || !created?.ticket_number) {
        throw new Error('The server did not return a valid work ticket.');
      }

      setGeneratedTicket({
        ...created,
        selectedServices,
        customer_name: created.customer_name || customerName || 'Walk-in Customer',
        customer_phone: created.vehicle?.customer_phone || customerPhone || '',
        total: subtotal,
      });

      resetForm();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || error.message || 'Ticket creation failed.');
    } finally {
      setIsSubmitting(false);
      submitting.current = false;
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="intake-layout">
        <div className="intake-main">
          {/* Vehicle & Customer Section */}
          <section className="surface vehicle-panel">
            <div className="section-title">
              <span className="section-icon">
                <Car size={20} />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Vehicle & Customer Intake</h2>
                <p className="text-xs text-slate-500">
                  Registration plate is required. Customer details are optional for walk-ins.
                </p>
              </div>

              {/* Requirement 7: Returning and Loyal Customer Badges */}
              {plateRecognition && (
                <div className="flex items-center gap-2">
                  {plateRecognition.is_loyal ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm animate-pulse">
                      <Crown size={14} className="text-amber-600 fill-amber-500" />
                      Loyal Customer · {plateRecognition.completed_visits} visits
                    </span>
                  ) : plateRecognition.is_returning ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      <Sparkles size={14} className="text-blue-600" />
                      Returning Vehicle · {plateRecognition.completed_visits} visits
                    </span>
                  ) : null}

                  {plateRecognition.history?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition"
                    >
                      <History size={13} />
                      History
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="vehicle-fields">
              <div>
                <label className="field-label" htmlFor="vehicle-plate">
                  Vehicle Plate Number <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="plate-field">
                  <span>PK</span>
                  <input
                    id="vehicle-plate"
                    className="field text-base font-bold font-mono tracking-wider uppercase"
                    required
                    autoFocus
                    autoComplete="off"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="LEA-1234"
                  />
                </div>
              </div>

              {/* Requirement 2: Customer Name (Optional) */}
              <div>
                <label className="field-label" htmlFor="customer-name">
                  Customer Name <span className="optional">(Optional)</span>
                </label>
                <input
                  id="customer-name"
                  className="field text-sm"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Leave blank for Walk-in"
                />
              </div>

              {/* Requirement 2: Phone Number (Optional, skip SMS) */}
              <div>
                <label className="field-label" htmlFor="customer-phone">
                  Phone Number <span className="optional">(Optional)</span>
                </label>
                <input
                  id="customer-phone"
                  className="field text-sm font-mono"
                  type="tel"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0300 1234567 (SMS if provided)"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="field-label m-0" htmlFor="vehicle-make">Vehicle Make</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingMake(!isAddingMake)}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus size={12} /> {isAddingMake ? 'Cancel' : '+ Add Make'}
                  </button>
                </div>
                {isAddingMake ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Haval, BYD, Changan"
                      value={newMakeText}
                      onChange={(e) => setNewMakeText(e.target.value)}
                      className="field text-sm flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const trimmed = newMakeText.trim();
                        if (!trimmed) return;
                        const currentMakes = branding?.vehicle_makes ? branding.vehicle_makes.split(',').map((m) => m.trim()) : DEFAULT_MAKES;
                        if (!currentMakes.includes(trimmed)) {
                          const updated = [...currentMakes, trimmed].join(', ');
                          try {
                            await axios.patch('/api/branding', { vehicle_makes: updated });
                            setBranding((prev) => ({ ...prev, vehicle_makes: updated }));
                          } catch (e) {}
                        }
                        setMake(trimmed);
                        setNewMakeText('');
                        setIsAddingMake(false);
                      }}
                      className="btn btn-primary px-3 text-xs rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    id="vehicle-make"
                    className="field text-sm"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                  >
                    {[...new Set([...(branding?.vehicle_makes ? branding.vehicle_makes.split(',').map((m) => m.trim()) : DEFAULT_MAKES), make])].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="field-label" htmlFor="vehicle-model">Model / Variant</label>
                <input
                  id="vehicle-model"
                  className="field text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. Corolla, Civic, Sportage"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="intake-notes">Job Notes / Customer Requests</label>
                <input
                  id="intake-notes"
                  className="field text-sm"
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                  placeholder="e.g. Extra focus on rims or seat stains"
                />
              </div>
            </div>
          </section>

          {/* Requirement 3: Selectable Service Blocks */}
          <section className="surface service-panel">
            <div className="section-title">
              <span className="section-icon">
                <ClipboardList size={20} />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Select Services & Packages</h2>
                <p className="text-xs text-slate-500">
                  Select one or more services. Independent prices apply.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded">
                {selectedServices.length} selected
              </span>
            </div>

            <div className="service-toolbar">
              <div className="category-tabs" aria-label="Service categories">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={category === item}
                    className={category === item ? 'selected' : ''}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="service-search">
                <Search size={16} />
                <input
                  aria-label="Search services"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search services…"
                />
              </div>
            </div>

            {/* Service Blocks Grid */}
            <div className="p-4">
              {isLoadingServices ? (
                <div className="empty-state py-8">
                  <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                  <p>Loading service packages…</p>
                </div>
              ) : serviceError ? (
                <div className="empty-state" role="alert">
                  <AlertCircle size={24} className="text-red-500" />
                  <p>{serviceError}</p>
                  <button type="button" className="btn btn-secondary mt-2" onClick={fetchServices}>
                    <RotateCw size={15} /> Try again
                  </button>
                </div>
              ) : !visibleServices.length ? (
                <div className="empty-state py-8">
                  <Search size={24} />
                  <strong>No services found</strong>
                  <p>Try another search or filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {visibleServices.map((service) => {
                    const isSelected = selectedServices.some((s) => s.id === service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleService(service)}
                        className={`service-option p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 w-full mb-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              service.category === 'Wash'
                                ? 'bg-blue-100 text-blue-800'
                                : service.category === 'Detailing'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {service.category}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                        </div>

                        <div className="w-full">
                          <strong className="block text-sm font-bold text-slate-800 mb-1 leading-snug">
                            {service.name}
                          </strong>
                          <span className="text-xs text-slate-400 flex items-center gap-1 mb-2">
                            <Clock size={12} /> ~{service.estimated_time || 30} mins
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 w-full flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Price</span>
                          <span className="text-base font-bold text-slate-900 font-mono">
                            Rs. {money(service.price)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Aside: Job Summary */}
        <aside className="surface job-summary">
          <div className="summary-title">
            <ClipboardList size={18} />
            <h2 className="text-sm font-bold text-slate-800">Work Ticket Summary</h2>
            <span className="text-xs font-bold font-mono px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
              {selectedServices.length}
            </span>
          </div>

          <div className="summary-vehicle">
            <Car size={22} className="text-blue-600 flex-shrink-0" />
            <div>
              <strong className="text-base font-bold text-slate-900 font-mono tracking-wide">
                {plate.trim() || 'ENTER PLATE'}
              </strong>
              <span className="text-xs text-slate-500 block mt-0.5">
                {customerName.trim() || 'Walk-in Customer'}
                {customerPhone.trim() ? ` · ${customerPhone.trim()}` : ''}
              </span>
            </div>
          </div>

          <div className="summary-items">
            {!selectedServices.length ? (
              <div className="empty-summary py-6">
                <ClipboardList size={32} className="text-slate-300 mb-1" />
                <strong className="text-sm">No services selected</strong>
                <p className="text-xs">Click service blocks to add them.</p>
              </div>
            ) : (
              selectedServices.map((service) => (
                <div className="summary-item" key={service.id}>
                  <div className="flex-1 pr-2">
                    <strong className="text-sm font-semibold text-slate-800 block">{service.name}</strong>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-bold text-slate-400">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={service.price_charged ?? service.price}
                        onChange={(e) => handleUpdateServicePrice(service.id, e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                        title="Click to adjust price for this job"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${service.name}`}
                    onClick={() => toggleService(service)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="summary-total pt-4 border-t border-slate-200">
            <span className="text-sm font-medium text-slate-600">Estimated Total</span>
            <strong className="text-2xl font-bold text-slate-900 font-mono">
              Rs. {money(subtotal)}
            </strong>
          </div>

          <p className="summary-hint text-xs text-slate-400 mt-1 mb-4">
            Payment is collected after the job is completed.
          </p>

          {errorMessage && (
            <div className="form-error mb-3" role="alert">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            ref={submitButton}
            type="submit"
            className="btn btn-primary create-ticket py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md w-full"
            disabled={isSubmitting || isLoadingServices || !selectedServices.length || !plate.trim()}
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            {isSubmitting ? 'Creating Ticket…' : 'Create Work Ticket'}
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="clear-ticket mt-2 text-xs text-slate-400 hover:text-slate-600"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Clear Form
          </button>

          <div className="summary-footnote mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
            <Printer size={14} />
            <span>80mm thermal ticket generated automatically.</span>
          </div>
        </aside>
      </form>

      {/* Generated Ticket Modal with Thermal Preview */}
      {generatedTicket && (
        <div className="dialog-backdrop">
          <section
            ref={ticketDialog}
            className="ticket-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-dialog-title"
          >
            <div className="ticket-success">
              <CheckCircle2 size={28} className="text-emerald-600" />
              <div>
                <h2 id="ticket-dialog-title" className="text-lg font-bold text-slate-900">
                  Work Ticket Created
                </h2>
                <p className="text-xs text-slate-500">
                  Ticket #{generatedTicket.ticket_number} is now in the workshop queue.
                </p>
              </div>
            </div>

            <TokenThermalTicket ticket={generatedTicket} branding={branding} id="printable-ticket" />

            <div className="ticket-actions mt-4 flex gap-2">
              <button
                type="button"
                className="btn btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2 text-sm"
                onClick={() => {
                  if (!printThermal('printable-ticket')) {
                    setErrorMessage('Allow pop-ups to open the thermal print preview.');
                  }
                }}
              >
                <Printer size={16} />
                Print ticket
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-sm"
                onClick={() => {
                  const ticket = generatedTicket;
                  setGeneratedTicket(null);
                  onJobCreated?.(ticket);
                }}
              >
                View Workshop
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}

      {/* History Modal (Requirement 7) */}
      {isHistoryModalOpen && plateRecognition && (
        <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Vehicle History: {plateRecognition.registration_number}
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div><strong>Total Completed Visits:</strong> {plateRecognition.completed_visits}</div>
                <div><strong>Last Visit Date:</strong> {plateRecognition.last_visit_date ? new Date(plateRecognition.last_visit_date).toLocaleDateString('en-GB') : 'N/A'}</div>
                {plateRecognition.last_visit_services?.length > 0 && (
                  <div><strong>Last Services:</strong> {plateRecognition.last_visit_services.join(', ')}</div>
                )}
              </div>

              <h4 className="text-xs font-bold uppercase text-slate-500 pt-2">Recent Visits & Invoices</h4>
              <div className="space-y-2">
                {(plateRecognition.history || []).map((job) => (
                  <div key={job.id} className="p-3 border border-slate-200 rounded-lg text-xs">
                    <div className="flex justify-between font-semibold text-slate-700 mb-1">
                      <span>Ticket: {job.ticket_number}</span>
                      <span>{new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="text-slate-500 mb-1">
                      {job.services?.map((s) => s.service?.name).join(', ') || 'General Inspection'}
                    </div>
                    {job.invoice && (
                      <div className="flex justify-between font-mono text-emerald-700 font-bold border-t border-slate-100 pt-1 mt-1">
                        <span>Invoice #{job.invoice.invoice_number}</span>
                        <span>Rs. {money(job.invoice.total_amount)} ({job.invoice.status})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="btn btn-secondary px-4 py-1.5 text-xs rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
