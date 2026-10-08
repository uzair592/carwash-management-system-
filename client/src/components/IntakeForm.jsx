import React, { useEffect, useRef, useState } from 'react';
import { Car, User, Search, Plus, X, Printer, ArrowRight, Loader2, CheckCircle2, AlertCircle, RotateCw, ClipboardList, Check } from 'lucide-react';
import axios from 'axios';
import { printThermal } from '../utils/print';

const MAKES = ['Toyota', 'Honda', 'Suzuki', 'KIA', 'Hyundai', 'MG', 'Audi', 'Mercedes', 'BMW', 'Other'];
const money = (value) => Number(value).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function IntakeForm({ onJobCreated }) {
  const [plate, setPlate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [make, setMake] = useState('Toyota');
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
  const [returningVehicle, setReturningVehicle] = useState(null);
  const ticketDialog = useRef(null);
  const submitButton = useRef(null);
  const submitting = useRef(false);

  const fetchServices = async () => {
    setIsLoadingServices(true); setServiceError('');
    try {
      const res = await axios.get('/api/services');
      setAvailableServices(res.data?.data || []);
    } catch {
      setServiceError('Services could not be loaded. Check the shop server and try again.');
    } finally { setIsLoadingServices(false); }
  };
  useEffect(() => { fetchServices(); }, []);
  useEffect(() => {
    const trimmed = plate.trim().toUpperCase();
    setReturningVehicle(null);
    if (trimmed.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/vehicles/${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (res.data?.data) {
          const vehicle = res.data.data;
          setReturningVehicle(vehicle);
          if (vehicle.customer_name) setCustomerName((previous) => previous || vehicle.customer_name);
          if (vehicle.customer_phone) setCustomerPhone((previous) => previous || vehicle.customer_phone);
          if (vehicle.make) setMake(vehicle.make);
          if (vehicle.model) setModel((previous) => previous || vehicle.model);
        }
      } catch { /* A new plate has no saved customer yet. */ }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [plate]);
  useEffect(() => {
    if (!generatedTicket) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ticketDialog.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key !== 'Tab') return;
      const controls = ticketDialog.current?.querySelectorAll('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); submitButton.current?.focus(); };
  }, [generatedTicket]);

  const toggleService = (service) => setSelectedServices((previous) => previous.some((s) => s.id === service.id) ? previous.filter((s) => s.id !== service.id) : [...previous, service]);
  const subtotal = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const categories = ['All services', ...new Set(availableServices.map((s) => s.category || 'Other'))];
  const visibleServices = availableServices.filter((s) => (category === 'All services' || (s.category || 'Other') === category) && `${s.name} ${s.description || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const resetForm = () => { setPlate(''); setCustomerName(''); setCustomerPhone(''); setMake('Toyota'); setModel(''); setIntakeNotes(''); setSelectedServices([]); setReturningVehicle(null); setErrorMessage(''); };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!plate.trim() || !customerName.trim() || !customerPhone.trim()) { setErrorMessage('Enter the vehicle plate, customer name and phone number.'); return; }
    if (!selectedServices.length) { setErrorMessage('Select at least one service before creating the ticket.'); return; }
    setErrorMessage(''); setIsSubmitting(true); submitting.current = true;
    try {
      const res = await axios.post('/api/intake', {
        registration_number: plate.trim().toUpperCase(), customer_name: customerName.trim(), customer_phone: customerPhone.trim(),
        make, model: model.trim() || undefined, intake_notes: intakeNotes.trim() || undefined,
        services: selectedServices.map((s) => ({ service_id: s.id, price: s.price, name: s.name })),
      });
      const created = res.data?.data?.job_card || res.data?.data;
      if (!created?.id || !created?.ticket_number) throw new Error('The server did not return a valid work ticket. Check the workshop before retrying.');
      setGeneratedTicket({ ...created, selectedServices, customer_name: created.customer_name || customerName, total: subtotal });
      resetForm();
    } catch (error) { setErrorMessage(error.response?.data?.message || error.message || 'The ticket could not be created. Please try again.'); }
    finally { setIsSubmitting(false); submitting.current = false; }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="intake-layout">
        <div className="intake-main">
          <section className="surface vehicle-panel">
            <div className="section-title"><span className="section-icon"><Car size={18} /></span><div><h2>Vehicle & customer</h2><p>Required fields are marked with an asterisk.</p></div>{returningVehicle && <span className="status-badge success">Returning vehicle · {returningVehicle.visits || 0} visits</span>}</div>
            <div className="vehicle-fields">
              <div><label className="field-label" htmlFor="vehicle-plate">Vehicle plate <span>*</span></label><div className="plate-field"><span>PK</span><input id="vehicle-plate" className="field" required autoFocus autoComplete="off" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC-123" /></div></div>
              <div><label className="field-label" htmlFor="customer-name">Customer name <span>*</span></label><input id="customer-name" className="field" required autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" /></div>
              <div><label className="field-label" htmlFor="customer-phone">Phone number <span>*</span></label><input id="customer-phone" className="field" type="tel" required autoComplete="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0300 1234567" /></div>
              <div><label className="field-label" htmlFor="vehicle-make">Vehicle make</label><select id="vehicle-make" className="field" value={make} onChange={(e) => setMake(e.target.value)}>{[...new Set([...MAKES, make])].map((item) => <option key={item}>{item}</option>)}</select></div>
              <div><label className="field-label" htmlFor="vehicle-model">Model</label><input id="vehicle-model" className="field" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Corolla" /></div>
              <div><label className="field-label" htmlFor="intake-notes">Job notes <span className="optional">Optional</span></label><input id="intake-notes" className="field" value={intakeNotes} onChange={(e) => setIntakeNotes(e.target.value)} placeholder="Customer requests or damage notes" /></div>
            </div>
          </section>
          <section className="surface service-panel">
            <div className="section-title"><span className="section-icon"><ClipboardList size={18} /></span><div><h2>Select services</h2><p>Add the wash or detailing services for this vehicle.</p></div><span className="service-count">{availableServices.length} services</span></div>
            <div className="service-toolbar"><div className="category-tabs" aria-label="Service categories">{categories.map((item) => <button type="button" key={item} aria-pressed={category === item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="service-search"><Search size={16} /><input aria-label="Search services" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services…" /></div></div>
            <div className="service-list">{isLoadingServices ? <div className="empty-state"><Loader2 size={22} className="animate-spin" /><p>Loading services…</p></div> : serviceError ? <div className="empty-state" role="alert"><AlertCircle size={24} /><p>{serviceError}</p><button type="button" className="btn btn-secondary" onClick={fetchServices}><RotateCw size={15} />Try again</button></div> : !visibleServices.length ? <div className="empty-state"><Search size={24} /><strong>{availableServices.length ? 'No matching services' : 'No services configured'}</strong><p>{availableServices.length ? 'Try another search or category.' : 'Add services in the shop setup before taking a vehicle.'}</p></div> : visibleServices.map((service) => {
              const selected = selectedServices.some((s) => s.id === service.id);
              return <button key={service.id} type="button" aria-pressed={selected} className={`service-option ${selected ? 'is-selected' : ''}`} onClick={() => toggleService(service)}><span className="service-marker">{selected ? <Check size={16} /> : <Plus size={16} />}</span><span className="service-details"><strong>{service.name}</strong><span>{service.description || service.category || 'Service'}</span></span><span className="service-price">Rs. {money(service.price)}</span></button>;
            })}</div>
          </section>
        </div>
        <aside className="surface job-summary">
          <div className="summary-title"><ReceiptIcon /><h2>Job summary</h2><span>{selectedServices.length}</span></div>
          <div className="summary-vehicle"><Car size={19} /><div><strong>{plate.trim() || 'Vehicle not entered'}</strong><span>{customerName.trim() || 'Customer details'}</span></div></div>
          <div className="summary-items">{!selectedServices.length ? <div className="empty-summary"><ClipboardList size={30} /><strong>No services selected</strong><p>Select services to build this work ticket.</p></div> : selectedServices.map((service) => <div className="summary-item" key={service.id}><div><strong>{service.name}</strong><span>Rs. {money(service.price)}</span></div><button type="button" aria-label={`Remove ${service.name}`} onClick={() => toggleService(service)}><X size={15} /></button></div>)}</div>
          <div className="summary-total"><span>Estimated total</span><strong>Rs. {money(subtotal)}</strong></div>
          <p className="summary-hint">Payment is collected after the work is complete.</p>
          {errorMessage && <div className="form-error" role="alert"><AlertCircle size={16} /><span>{errorMessage}</span></div>}
          <button ref={submitButton} type="submit" className="btn btn-primary create-ticket" disabled={isSubmitting || isLoadingServices || !selectedServices.length}>{isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}{isSubmitting ? 'Creating ticket…' : 'Create work ticket'}<ArrowRight size={16} /></button>
          <button type="button" className="clear-ticket" onClick={resetForm} disabled={isSubmitting}>Clear form</button>
          <div className="summary-footnote"><Printer size={14} /><span>Print the work ticket for your wash team.</span></div>
        </aside>
      </form>
      {generatedTicket && <div className="dialog-backdrop"><section ref={ticketDialog} className="ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title"><div className="ticket-success"><CheckCircle2 size={27} /><div><h2 id="ticket-dialog-title">Work ticket created</h2><p>The vehicle is now in the workshop queue.</p></div></div><div id="printable-ticket" className="thermal-ticket"><h3 className="thermal-title">PUREPACK CAR WASH & DETAILING</h3><p className="text-center">WORK TICKET · {generatedTicket.ticket_number}</p><div className="thermal-plate-box">{generatedTicket.vehicle?.registration_number}</div><div className="ticket-line"><span>Customer</span><strong>{generatedTicket.customer_name}</strong></div><div className="ticket-line"><span>Phone</span><strong>{generatedTicket.vehicle?.customer_phone}</strong></div>{(generatedTicket.services?.length ? generatedTicket.services : generatedTicket.selectedServices).map((service) => <div className="ticket-line" key={service.id}><span>{service.service?.name || service.name}</span><strong>Rs. {money(service.price_charged ?? service.price)}</strong></div>)}<div className="ticket-line"><span>Estimated total</span><strong>Rs. {money(generatedTicket.total)}</strong></div><p className="text-center">Worker: __________ · Quality checked: [ ]</p></div><div className="ticket-actions"><button type="button" className="btn btn-secondary" onClick={() => { if (!printThermal('printable-ticket')) setErrorMessage('Allow pop-ups to open the ticket print preview.'); }}><Printer size={16} />Print ticket</button><button type="button" className="btn btn-primary" onClick={() => { const ticket = generatedTicket; setGeneratedTicket(null); onJobCreated?.(ticket); }}>View workshop<ArrowRight size={16} /></button></div></section></div>}
    </>
  );
}
function ReceiptIcon() { return <span className="section-icon"><ClipboardList size={18} /></span>; }
