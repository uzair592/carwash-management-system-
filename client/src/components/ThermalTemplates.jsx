import React from 'react';
const money = value => Number(value ?? 0).toLocaleString('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export const THERMAL_FONT_STYLE = 'Arial, Helvetica, sans-serif';
export const BOLD_RECEIPT_THEMES = [{
  id: 'BOLD_TABLE',
  title: 'Bold Table',
  desc: 'Ruled service table and strong total.'
}, {
  id: 'BOLD_BOXED',
  title: 'Bold Boxed',
  desc: 'Framed bill with prominent vehicle details.'
}, {
  id: 'BOLD_COMPACT',
  title: 'Bold Compact',
  desc: 'Short bill with less paper.'
}, {
  id: 'STUDIO_SIGNED',
  title: 'Detailing Studio',
  desc: 'Clean studio invoice with handover sign-off.'
}, {
  id: 'SERVICE_LEDGER',
  title: 'Service Ledger',
  desc: 'Numbered services and separate payment record.'
}, {
  id: 'MINIMAL_RULED',
  title: 'Clean Receipt',
  desc: 'Left-aligned heading and generous, readable figures.'
}];
export const TICKET_THEMES = [{
  id: 'WORKSHOP_CHECKLIST',
  title: 'Workshop Checklist'
}, {
  id: 'SERVICE_CARD',
  title: 'Service Card'
}, {
  id: 'COMPACT_DISPATCH',
  title: 'Compact Dispatch'
}, {
  id: 'STANDARD_BOX',
  title: 'Boxed Work Order'
}, {
  id: 'BOLD_TOKEN',
  title: 'Bold Vehicle Token'
}];
export const RECEIPT_CSS = `
.receipt-sheet,.ticket-sheet{width:72mm;max-width:100%;margin:0 auto;padding:2mm 1mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13px;line-height:1.35;font-variant-numeric:tabular-nums;box-sizing:border-box}
.receipt-sheet *,.ticket-sheet *{box-sizing:border-box;color:#000;font-family:inherit}.receipt-sheet h2,.ticket-sheet h2{font-size:19px;font-weight:900;line-height:1.15;margin:4px 0}.receipt-sheet p,.ticket-sheet p{margin:3px 0}.receipt-header{text-align:center;border-bottom:2px solid #000;padding-bottom:7px}.receipt-logo{display:block;margin:0 auto 5px;max-width:100%;max-height:85px;object-fit:contain}.receipt-caption{font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800;padding-top:4px}.receipt-meta{padding:7px 0;border-bottom:1px solid #000}.receipt-row{display:flex;justify-content:space-between;gap:8px;margin:3px 0}.receipt-row>*{overflow-wrap:anywhere}.receipt-plate{font-size:18px;font-weight:900}.receipt-items{border-collapse:collapse;width:100%;table-layout:fixed;margin:8px 0}.receipt-sheet .receipt-items th{font-size:11px;text-align:left;border-bottom:2px solid #000;padding:5px 2px;background:white;font-weight:900}.receipt-sheet .receipt-items td{padding:6px 2px;border-bottom:1px solid #aaa;vertical-align:top;background:white;font-weight:700;overflow-wrap:anywhere}.receipt-items th:last-child,.receipt-items td:last-child{text-align:right;width:28%}.receipt-totals{padding-top:5px}.receipt-grand-total{font-size:20px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:7px 0;margin:7px 0}.receipt-payment-record{border-top:1px dashed #000;padding-top:6px;margin-top:7px;font-size:12px}.receipt-footer{text-align:center;border-top:1px dashed #000;font-size:11px;padding-top:7px;margin-top:7px}.receipt-boxed{border:2px solid #000;padding:3mm}.receipt-boxed .receipt-meta{border:1px solid #000;padding:6px;margin-top:7px}.receipt-boxed .receipt-grand-total{border:2px solid #000;padding:7px}.receipt-compact{font-size:12px;line-height:1.25;padding:1mm}.receipt-compact .receipt-items td{padding:4px 1px}.receipt-compact .receipt-grand-total{font-size:18px;padding:5px 0}.receipt-studio .receipt-caption{border-top:1px solid #000;margin-top:7px}.receipt-studio .receipt-grand-total{border:2px solid #000;padding:8px 4px}.receipt-signoff{margin-top:12px;padding:8px 0;border-top:1px solid #000;font-size:11px}.receipt-ledger .receipt-items td:first-child,.receipt-ledger .receipt-items th:first-child{width:9%;text-align:center}.receipt-ledger .receipt-payment-record{border:1px solid #000;padding:6px}.receipt-minimal .receipt-header{text-align:left}.receipt-minimal .receipt-header img{margin-left:0}.receipt-minimal .receipt-grand-total{font-size:22px}.receipt-sheet tr,.receipt-totals,.receipt-footer,.ticket-check-row{break-inside:avoid}.receipt-items thead{display:table-header-group}
.ticket-plate{border:2px solid #000;text-align:center;font-size:26px;font-weight:900;letter-spacing:1px;margin:8px 0;padding:5px}.ticket-check-row{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid #aaa;font-size:15px;line-height:1.25}.ticket-check{width:15px;height:15px;border:2px solid #000;flex-shrink:0;margin-top:2px}.ticket-check-row strong{margin-left:auto;font-size:12px}.ticket-note{border:1px solid #000;padding:6px;margin-top:8px;font-size:13px}.ticket-signatures{display:flex;justify-content:space-between;border-top:1px dashed #000;padding-top:9px;margin-top:14px;font-size:11px}.ticket-card{border:2px solid #000;padding:3mm}.ticket-card .ticket-plate{border:none;border-top:2px solid #000;border-bottom:2px solid #000}.ticket-compact{font-size:12px;padding:1mm}.ticket-compact .ticket-check-row{font-size:13px;padding:4px 0}.ticket-compact .ticket-plate{font-size:23px;margin:5px 0}.ticket-token .ticket-plate{font-size:30px;border:3px solid #000;padding:8px}.ticket-token .ticket-check-row{font-size:16px;font-weight:900}
`;
export function InvoiceThermalReceipt({
  invoice,
  branding,
  id = 'printable-receipt',
  showBusinessName: override
}) {
  if (!invoice) return null;
  const data = invoice.invoice || invoice,
    theme = branding?.invoice_template || 'BOLD_TABLE';
  const classes = {
    BOLD_BOXED: 'receipt-boxed',
    LUXURY_STUDIO: 'receipt-studio',
    BOLD_COMPACT: 'receipt-compact',
    ENTERPRISE_MINIMAL: 'receipt-compact',
    STUDIO_SIGNED: 'receipt-studio',
    SERVICE_LEDGER: 'receipt-ledger',
    MINIMAL_RULED: 'receipt-minimal'
  };
  const compact = classes[theme] === 'receipt-compact',
    services = data.line_snapshot || data.job_card?.services || data.services || [],
    original = Number(data.total_amount ?? invoice.final_total ?? 0),
    refunds = (data.refunds || []).reduce((s, r) => s + Number(r.amount), 0),
    total = original - refunds,
    discount = Number(data.discount_amount ?? invoice.discount_amount ?? 0),
    subtotal = Number(data.subtotal ?? invoice.subtotal ?? original + discount),
    paid = Number(data.paid_amount ?? invoice.payments_collected ?? total),
    due = Number(data.balance_due ?? invoice.balance_due ?? Math.max(0, total - paid));
  const plate = data.job_card?.vehicle?.registration_number || data.vehicle_plate || '—',
    customer = data.job_card?.customer_name || data.job_card?.vehicle?.customer_name || data.customer_name,
    phone = data.job_card?.vehicle?.customer_phone || data.customer_phone;
  const showName = override ?? branding?.show_business_name !== false;
  const payments = data.payments || invoice.payments || [];
  const grouped = new Map();
  for (const p of payments) {
    const key = p.bank_account?.bank_name || p.payment_method;
    grouped.set(key, (grouped.get(key) || 0) + Number(p.amount));
  }
  const advance = Number(data.deposits_applied ?? invoice.deposits_applied ?? data.deposit_applications?.reduce((s, a) => s + Number(a.amount), 0) ?? 0);
  return <div id={id} className={`thermal-receipt receipt-sheet ${classes[theme] || ''}`} data-receipt-theme={theme} data-print-kind="INVOICE" data-print-id={data.id || ''} data-show-business-name={showName ? 'true' : 'false'}>
 <style>{RECEIPT_CSS}</style><header className="receipt-header">{branding?.logo_url && <img className="receipt-logo" src={branding.logo_url} alt="Business logo" style={{
        width: branding.logo_size || 140
      }} />}{showName && <h2>{branding?.business_name || 'DF PRO Car Wash & Detailing Center'}</h2>}{!compact && branding?.address && <p>{branding.address}</p>}{branding?.phone && <p>Tel: {branding.phone}</p>}<p className="receipt-caption">{theme === 'STUDIO_SIGNED' ? 'Detailing service invoice' : 'Customer invoice'}</p></header>
 <section className="receipt-meta"><div className="receipt-row"><strong>{data.invoice_number || 'Invoice'}</strong><span>{new Date(data.created_at || Date.now()).toLocaleDateString('en-GB', {
            timeZone: 'Asia/Karachi'
          })}</span></div><div className="receipt-row"><span>Vehicle</span><strong className="receipt-plate">{plate}</strong></div>{customer && <div className="receipt-row"><span>Customer</span><strong>{customer}</strong></div>}{phone && <div className="receipt-row"><span>Phone</span><strong>{phone}</strong></div>}{branding?.ntn_number && <div className="receipt-row"><span>NTN</span><strong>{branding.ntn_number}</strong></div>}</section>
 <table className="receipt-items"><thead><tr>{theme === 'SERVICE_LEDGER' && <th>#</th>}<th>Service</th><th>PKR</th></tr></thead><tbody>{services.map((s, i) => <tr key={s.id || i}>{theme === 'SERVICE_LEDGER' && <td>{i + 1}</td>}<td>{s.service?.name || s.name}</td><td>{money(s.price_charged ?? s.price)}</td></tr>)}</tbody></table>
 <section className="receipt-totals"><div className="receipt-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div className="receipt-row"><span>Discount</span><strong>−{money(discount)}</strong></div>}{refunds > 0 && <div className="receipt-row"><span>Refund / credit</span><strong>−{money(refunds)}</strong></div>}<div className="receipt-row receipt-grand-total"><span>TOTAL</span><strong>Rs. {money(total)}</strong></div><div className="receipt-row"><span>Paid</span><strong>Rs. {money(paid)}</strong></div><div className="receipt-row"><span>{due > 0 ? 'Balance due' : 'Balance settled'}</span><strong>Rs. {money(due)}</strong></div>{Number(data.cash_tendered) > 0 && <div className="receipt-row"><span>Cash tendered</span><strong>{money(data.cash_tendered)}</strong></div>}{Number(data.change_returned) > 0 && <div className="receipt-row"><span>Change returned</span><strong>{money(data.change_returned)}</strong></div>}</section>
 <section className="receipt-payment-record">{advance > 0 && <div className="receipt-row"><span>Advance applied</span><strong>{money(advance)}</strong></div>}{grouped.size ? [...grouped.entries()].map(([method, amount]) => <div className="receipt-row" key={method}><span>{method}</span><strong>{money(amount)}</strong></div>) : <div className="receipt-row"><span>Payment</span><strong>{data.payment_method || 'Cash'}</strong></div>}</section>
 {theme === 'STUDIO_SIGNED' && <div className="receipt-signoff">Vehicle received by: ____________________</div>}<footer className="receipt-footer"><strong>Thank you for visiting DF PRO</strong>{!compact && <p>Please keep this invoice for your records.</p>}</footer></div>;
}
export function TokenThermalTicket({
  ticket,
  branding,
  id = 'printable-ticket'
}) {
  if (!ticket) return null;
  const data = ticket.job_card || ticket,
    theme = branding?.token_template || 'WORKSHOP_CHECKLIST',
    services = data.services || ticket.services || [],
    vehicle = data.vehicle || ticket.vehicle || {},
    plate = vehicle.registration_number || data.registration_number || data.plate || '—',
    notes = data.intake_notes || data.notes,
    classes = {
      SERVICE_CARD: 'ticket-card',
      STANDARD_BOX: 'ticket-card',
      COMPACT_DISPATCH: 'ticket-compact',
      COMPACT_STRIP: 'ticket-compact',
      BOLD_TOKEN: 'ticket-token'
    };
  return <div id={id} className={`thermal-ticket ticket-sheet ${classes[theme] || ''}`} data-ticket-theme={theme} data-print-kind="TICKET" data-print-id={data.id || ''}><style>{RECEIPT_CSS}</style><header className="receipt-header">{branding?.logo_url && theme !== 'COMPACT_DISPATCH' && <img className="receipt-logo" src={branding.logo_url} alt="Business logo" style={{
        width: branding.logo_size || 140
      }} />}{branding?.show_business_name !== false && <h2>{branding?.business_name || 'DF PRO Car Wash & Detailing Center'}</h2>}<p className="receipt-caption">Work ticket · {data.ticket_number || ticket.ticket_number || 'Preview'}</p></header>
 <div className="ticket-plate">{plate}</div><div className="receipt-row"><span>{new Date(data.created_at || Date.now()).toLocaleString('en-GB', {
          timeZone: 'Asia/Karachi',
          dateStyle: 'short',
          timeStyle: 'short'
        })}</span><strong>{data.assigned_location?.replaceAll('_', ' ') || 'Waiting for bay'}</strong></div>{(data.customer_name || vehicle.customer_name) && <p>{data.customer_name || vehicle.customer_name}</p>}{vehicle.customer_phone && <p>{vehicle.customer_phone}</p>}
 <section>{services.map((s, i) => <div key={s.id || i} className="ticket-check-row"><span className="ticket-check" /><span>{s.service?.name || s.name}</span>{branding?.ticket_show_prices && <strong>{money(s.price_charged ?? s.price)}</strong>}</div>)}</section>{notes && <p className="ticket-note"><strong>Instructions:</strong> {notes}</p>}{branding?.ticket_show_prices && <div className="receipt-row mt-2"><span>Estimate · not a receipt</span><strong>Rs. {money(services.reduce((sum, s) => sum + Number(s.price_charged ?? s.price), 0))}</strong></div>}<div className="ticket-signatures"><span>Worker: __________</span><span>QC: __________</span></div></div>;
}
