import React from 'react';
const money = value => Number(value ?? 0).toLocaleString('en-PK', {maximumFractionDigits:2});
export const THERMAL_FONT_STYLE = 'Arial, Helvetica, sans-serif';
export const BOLD_RECEIPT_THEMES = [
  {id:'BOLD_TABLE',title:'Bold Table',desc:'Strong text, ruled service table and clear payment totals.'},
  {id:'BOLD_BOXED',title:'Bold Boxed',desc:'Framed vehicle details and a prominent outlined total.'},
  {id:'BOLD_COMPACT',title:'Bold Compact',desc:'Short cash memo with solid type and minimal paper usage.'},
];
export const RECEIPT_CSS = `
.receipt-sheet{width:72mm;max-width:100%;padding:3mm 1mm;margin:0 auto;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.35;font-weight:700;font-variant-numeric:tabular-nums}
.receipt-sheet *{box-sizing:border-box;color:#000;font-family:inherit}.receipt-sheet h2{font-size:18px;font-weight:900;line-height:1.15;margin:5px 0}.receipt-sheet p{margin:3px 0}.receipt-header{text-align:center;padding-bottom:8px;border-bottom:2px solid #000}.receipt-logo{display:block;margin:0 auto 6px;max-width:100%;max-height:85px;object-fit:contain}.receipt-caption{text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:.6px;margin-top:6px}.receipt-meta{padding:7px 0;border-bottom:1px dashed #000}.receipt-row{display:flex;justify-content:space-between;gap:8px;margin:3px 0}.receipt-row>*{overflow-wrap:anywhere}.receipt-plate{font-size:17px;font-weight:900}.receipt-items{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;table-layout:fixed}.receipt-sheet .receipt-items th{text-align:left;font-size:11px;border-bottom:2px solid #000;padding:5px 2px;font-weight:800;background:white}.receipt-sheet .receipt-items td{padding:6px 2px;border-bottom:1px solid #999;font-weight:700;vertical-align:top;overflow-wrap:anywhere}.receipt-items th:last-child,.receipt-items td:last-child{text-align:right;width:28%}.receipt-totals{padding:6px 0;border-top:2px solid #000}.receipt-grand-total{font-size:19px;font-weight:900;border-top:1px solid #000;border-bottom:2px solid #000;padding:7px 0;margin:6px 0}.receipt-footer{text-align:center;font-size:11px;border-top:1px dashed #000;padding-top:7px;margin-top:7px}.receipt-boxed{border:2px solid #000;padding:3mm}.receipt-boxed .receipt-meta{border:1px solid #000;padding:7px;margin:8px 0}.receipt-boxed .receipt-grand-total{border:2px solid #000;padding:7px}.receipt-compact{font-size:12px;padding:2mm 0;line-height:1.25}.receipt-compact .receipt-sheet .receipt-items td{padding:4px 1px}.receipt-compact .receipt-header{padding-bottom:5px}.receipt-compact .receipt-meta{padding:5px 0}.receipt-compact .receipt-grand-total{font-size:18px;padding:5px 0}.receipt-sheet .receipt-items th,.receipt-sheet .receipt-items td{color:#000!important;background:#fff!important;font-weight:700}.receipt-sheet tr,.receipt-totals,.receipt-footer{break-inside:avoid}.receipt-items thead{display:table-header-group}
`;

export function InvoiceThermalReceipt({invoice,branding,id='printable-receipt',showBusinessName:showOverride}) {
  if (!invoice) return null;
  const data=invoice.invoice || invoice;
  const theme=branding?.invoice_template || 'BOLD_TABLE';
  const boxed=['BOLD_BOXED','LUXURY_STUDIO','DETAILED_TAX'].includes(theme);
  const compact=['BOLD_COMPACT','ENTERPRISE_MINIMAL'].includes(theme);
  const showName=showOverride !== undefined ? showOverride : branding?.show_business_name !== false;
  const services=data.job_card?.services || data.services || [];
  const total=Number(data.total_amount ?? invoice.final_total ?? 0);
  const discount=Number(data.discount_amount ?? invoice.discount_amount ?? 0);
  const subtotal=Number(data.subtotal ?? invoice.subtotal ?? (total+discount));
  const paid=Number(data.paid_amount ?? invoice.payments_collected ?? total);
  const due=Number(data.balance_due ?? invoice.balance_due ?? Math.max(0,total-paid));
  const plate=data.job_card?.vehicle?.registration_number || data.vehicle_plate || '—';
  const customer=data.job_card?.customer_name || data.job_card?.vehicle?.customer_name || data.customer_name;
  const date=new Date(data.created_at || Date.now()).toLocaleDateString('en-GB');
  return <div id={id} className={`thermal-receipt receipt-sheet ${boxed?'receipt-boxed':''} ${compact?'receipt-compact':''}`} data-receipt-theme={theme}>
    <style>{RECEIPT_CSS}</style>
    <header className="receipt-header">
      {branding?.logo_url && <img className="receipt-logo" src={branding.logo_url} alt="Business logo" style={{width:branding.logo_size || 140}} />}
      {showName && <h2>{branding?.business_name || 'DF PRO Car Wash & Detailing Center'}</h2>}
      {!compact && branding?.address && <p>{branding.address}</p>}
      {branding?.phone && <p>Tel: {branding.phone}</p>}
      <p className="receipt-caption">{theme==='DETAILED_TAX'?'Service invoice':'Customer invoice'}</p>
    </header>
    <section className="receipt-meta"><div className="receipt-row"><strong>{data.invoice_number || 'Invoice'}</strong><span>{date}</span></div><div className="receipt-row"><span>Vehicle</span><strong className="receipt-plate">{plate}</strong></div>{customer && <div className="receipt-row"><span>Customer</span><strong>{customer}</strong></div>}{branding?.ntn_number && <div className="receipt-row"><span>NTN</span><strong>{branding.ntn_number}</strong></div>}</section>
    <table className="receipt-items"><thead><tr><th>Service</th><th>PKR</th></tr></thead><tbody>{services.map((s,i)=><tr key={s.id || i}><td>{s.service?.name || s.name}</td><td>{money(s.price_charged ?? s.price)}</td></tr>)}</tbody></table>
    <section className="receipt-totals"><div className="receipt-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount>0 && <div className="receipt-row"><span>Discount</span><strong>−{money(discount)}</strong></div>}<div className="receipt-row receipt-grand-total"><span>TOTAL</span><strong>Rs. {money(total)}</strong></div><div className="receipt-row"><span>Paid</span><strong>Rs. {money(paid)}</strong></div>{Number(data.cash_tendered)>0 && <div className="receipt-row"><span>Cash tendered</span><strong>{money(data.cash_tendered)}</strong></div>}{Number(data.change_returned)>0 && <div className="receipt-row"><span>Change returned</span><strong>{money(data.change_returned)}</strong></div>}{due>0 && <div className="receipt-row"><span>Balance due</span><strong>Rs. {money(due)}</strong></div>}<div className="receipt-row"><span>Payment</span><strong>{data.payment_method || 'Cash'}</strong></div></section>
    <footer className="receipt-footer"><strong>Thank you for visiting DF PRO</strong>{!compact && <p>Please keep this invoice for your records.</p>}</footer>
  </div>;
}

export function TokenThermalTicket({ ticket, branding, id = 'printable-ticket' }) {
  if (!ticket) return null;

  const template = branding?.token_template || 'STANDARD_BOX';
  const businessName = branding?.business_name || 'DF PRO CAR WASH & DETAILING';
  const ticketNumber = ticket.ticket_number || 'CW-0001';
  const plate = ticket.vehicle?.registration_number || ticket.plate || 'N/A';
  const customer = ticket.customer_name || ticket.vehicle?.customer_name || 'Walk-in Customer';
  const phone = ticket.customer_phone || ticket.vehicle?.customer_phone;
  const servicesList = ticket.services?.length ? ticket.services : (ticket.selectedServices || []);
  const total = ticket.total || ticket.subtotal || servicesList.reduce((sum, s) => sum + Number(s.price_charged ?? s.price ?? 0), 0);
  const notes = ticket.intake_notes || '';

  // Template 1: COMPACT_MINIMAL (Ultra paper-efficient)
  if (template === 'COMPACT_MINIMAL') {
    return (
      <div
        id={id}
        className="thermal-ticket compact-token text-left text-xs font-mono space-y-1.5 text-black p-3 bg-white"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', color: '#000' }}
      >
        <div className="text-center font-bold text-xs uppercase">
          {businessName} · WORK ORDER
        </div>
        <div className="text-center text-2xl font-black tracking-widest my-1 border-y-2 border-black py-1">
          {ticketNumber}
        </div>
        <div className="text-center text-xl font-bold font-mono tracking-wider bg-black text-white py-1">
          {plate}
        </div>

        <div className="flex justify-between text-[11px] pt-1">
          <span>Client: {customer}</span>
          {phone && <span>{phone}</span>}
        </div>

        <div className="border-t border-dashed border-gray-400 py-1 space-y-0.5 text-[11px]">
          {servicesList.map((s, idx) => (
            <div key={s.id || idx} className="flex justify-between">
              <span>[ ] {s.service?.name || s.name}</span>
              <strong>Rs. {money(s.price_charged ?? s.price)}</strong>
            </div>
          ))}
        </div>

        {notes && (
          <div className="text-[10px] bg-gray-100 p-1 border border-gray-300">
            <strong>Notes:</strong> {notes}
          </div>
        )}

        <div className="flex justify-between font-bold border-t border-black pt-1 text-xs">
          <span>Est Total:</span>
          <span>Rs. {money(total)}</span>
        </div>

        <div className="text-[10px] text-center pt-1 border-t border-dashed border-gray-400">
          QC Sign: ___________ · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  }

  // Template 2: BOLD_BADGE (Heavy workshop bay pass)
  if (template === 'BOLD_BADGE') {
    return (
      <div
        id={id}
        className="thermal-ticket bold-token text-left text-xs font-mono space-y-2 text-black p-4 bg-white border-4 border-black"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', color: '#000' }}
      >
        <div className="text-center font-black text-sm uppercase tracking-wider bg-black text-white py-1">
          ★ BAY WORK TICKET ★
        </div>
        <div className="text-center font-bold text-xs">
          {businessName}
        </div>

        <div className="border-2 border-black p-2 text-center my-2 bg-gray-50">
          <span className="text-[10px] block uppercase text-gray-600">License Plate</span>
          <strong className="text-2xl font-black font-mono tracking-widest">{plate}</strong>
          <span className="text-[10px] block text-gray-500 font-mono mt-0.5">#{ticketNumber}</span>
        </div>

        <div className="text-[11px] space-y-0.5 border-b border-black pb-1.5">
          <div className="flex justify-between">
            <span className="font-bold">Customer:</span>
            <span>{customer}</span>
          </div>
          {phone && (
            <div className="flex justify-between">
              <span className="font-bold">Phone:</span>
              <span>{phone}</span>
            </div>
          )}
          {notes && (
            <div className="text-[10px] text-gray-700">
              <span className="font-bold">Instructions:</span> {notes}
            </div>
          )}
        </div>

        <div className="space-y-1 py-1">
          <span className="font-bold text-[11px] block uppercase">Services Checklist:</span>
          {servicesList.map((s, idx) => (
            <div key={s.id || idx} className="flex justify-between text-[11px] pl-1">
              <span>[ ] {s.service?.name || s.name}</span>
              <strong className="font-mono">Rs. {money(s.price_charged ?? s.price)}</strong>
            </div>
          ))}
        </div>

        <div className="flex justify-between font-black text-sm border-t-2 border-black pt-1">
          <span>Est Total:</span>
          <span>Rs. {money(total)}</span>
        </div>

        <div className="text-[10px] text-center pt-2 border-t border-dashed border-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Bay Lead: _________</span>
            <span>Inspector: _________</span>
          </div>
          <span className="block text-[9px] text-gray-500">Collect ticket upon car release</span>
        </div>
      </div>
    );
  }

  // Default Template 3: STANDARD_BOX
  return (
    <div
      id={id}
      className="thermal-ticket standard-token text-left text-xs font-mono space-y-2 text-black p-4 bg-white"
      style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', color: '#000' }}
    >
      <h3 className="thermal-title font-bold text-center text-sm">
        {businessName}
      </h3>
      <p className="text-center text-[11px] text-gray-600 mb-2">
        BAY WORK ORDER · {ticketNumber}
      </p>

      <div className="thermal-plate-box text-center font-bold text-xl my-2 p-2 bg-slate-50 border border-slate-200 rounded">
        {plate}
      </div>

      <div className="ticket-line flex justify-between py-1 border-b border-dashed border-gray-300">
        <span>Customer</span>
        <strong>{customer}</strong>
      </div>

      {phone ? (
        <div className="ticket-line flex justify-between py-1 border-b border-dashed border-gray-300">
          <span>Phone</span>
          <strong>{phone}</strong>
        </div>
      ) : null}

      <div className="py-2 border-b border-gray-300 space-y-1">
        <span className="font-bold text-[11px] block">Services to perform:</span>
        {servicesList.map((service, idx) => (
          <div className="flex justify-between" key={service.id || idx}>
            <span>[ ] {service.service?.name || service.name}</span>
            <strong>Rs. {money(service.price_charged ?? service.price)}</strong>
          </div>
        ))}
      </div>

      {notes && (
        <div className="py-1 text-[11px] text-gray-700 border-b border-dashed border-gray-300">
          <strong>Notes:</strong> {notes}
        </div>
      )}

      <div className="ticket-line flex justify-between py-1.5 font-bold text-sm border-b border-black">
        <span>Estimated Total</span>
        <strong>Rs. {money(total)}</strong>
      </div>

      <p className="text-center text-[10px] mt-3 pt-2 border-t border-dashed border-gray-400">
        Worker: __________ · QC Check: [ ]
      </p>
    </div>
  );
}
