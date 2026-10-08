import React from 'react';

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const THERMAL_FONT_STYLE = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * INVOICE / BILL THERMAL RECEIPT (Prints with dynamic logo per user request)
 */
export function InvoiceThermalReceipt({ invoice, branding, id = 'printable-receipt', showBusinessName: showNameOverride }) {
  if (!invoice) return null;

  const template = branding?.invoice_template || 'CLASSIC_THERMAL';
  const logoUrl = branding?.logo_url;
  const logoWidth = branding?.logo_size || 140;
  const showBusinessName = showNameOverride !== undefined
    ? Boolean(showNameOverride)
    : (branding?.show_business_name !== false);
  const businessName = branding?.business_name || 'DF PRO CAR WASH & DETAILING';
  const tagline = branding?.tagline || 'Premium Auto Care & Ceramic Studio';
  const address = branding?.address || 'Plot 45-C, Commercial Broadway, Phase 5, DHA, Lahore';
  const phone = branding?.phone || '+92 300 8889977';
  const ntn = branding?.ntn_number || '7482910-3';

  const invoiceNumber = invoice.invoice_number || invoice.invoice?.invoice_number || 'INV-0001';
  const dateStr = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');

  const vehiclePlate = invoice.job_card?.vehicle?.registration_number || invoice.vehicle_plate || 'N/A';
  const vehicleDesc = invoice.job_card?.vehicle?.make
    ? `${invoice.job_card.vehicle.make} ${invoice.job_card.vehicle.model || ''}`
    : '';
  const customer = invoice.job_card?.customer_name || invoice.job_card?.vehicle?.customer_name || invoice.customer_name || 'Walk-in Customer';
  const tender = invoice.payment_method || 'CASH';

  const servicesList = invoice.job_card?.services || invoice.services || [];
  const subtotal = invoice.subtotal || invoice.total_amount || 0;
  const discount = parseFloat(invoice.discount_amount || 0);
  const paid = parseFloat(invoice.paid_amount || invoice.total_amount || 0);
  const cashTendered = invoice.cash_tendered ? parseFloat(invoice.cash_tendered) : null;
  const changeReturned = invoice.change_returned ? parseFloat(invoice.change_returned) : null;
  const balanceDue = invoice.balance_due ? parseFloat(invoice.balance_due) : 0;

  // Render Template 1: MODERN_CLEAN
  if (template === 'MODERN_CLEAN') {
    return (
      <div
        id={id}
        className="thermal-receipt modern-template text-left text-xs font-mono space-y-2 text-black p-4 bg-white"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', color: '#000' }}
      >
        {logoUrl && (
          <div className="text-center mb-2">
            <img
              src={logoUrl}
              alt="Business Logo"
              style={{
                maxWidth: `${logoWidth}px`,
                maxHeight: '90px',
                objectFit: 'contain',
                margin: '0 auto',
                display: 'block',
              }}
            />
          </div>
        )}
        {showBusinessName && (
          <div className="text-center font-black text-sm tracking-wide uppercase border-b-2 border-black pb-1">
            {businessName}
          </div>
        )}
        {tagline && (
          <div className="text-center text-[10px] text-gray-600">
            {tagline}
          </div>
        )}

        <div className="flex justify-between text-[11px] font-bold border-b border-gray-400 py-1">
          <span>INVOICE: #{invoiceNumber}</span>
          <span>{dateStr}</span>
        </div>

        <div className="bg-gray-100 p-2 rounded border border-gray-300 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-600">Plate:</span>
            <strong className="text-sm font-black">{vehiclePlate}</strong>
          </div>
          {vehicleDesc && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">Vehicle:</span>
              <span>{vehicleDesc}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Client:</span>
            <span>{customer}</span>
          </div>
        </div>

        <div className="py-1.5 border-t border-b border-gray-400 space-y-1">
          <div className="text-[10px] font-bold uppercase text-gray-500 flex justify-between">
            <span>Description</span>
            <span>PKR</span>
          </div>
          {servicesList.map((s, idx) => (
            <div key={s.id || idx} className="flex justify-between text-[11px]">
              <span>{s.service?.name || s.name}</span>
              <strong>Rs. {money(s.price_charged || s.price)}</strong>
            </div>
          ))}
        </div>

        <div className="space-y-1 pt-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>Rs. {money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Discount Applied:</span>
              <span>-Rs. {money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black bg-black text-white p-1 rounded mt-1">
            <span>TOTAL PAID:</span>
            <span>Rs. {money(paid)}</span>
          </div>
          {cashTendered !== null && cashTendered > 0 && (
            <div className="flex justify-between text-[10px] pt-1">
              <span>Cash Tendered:</span>
              <span>Rs. {money(cashTendered)}</span>
            </div>
          )}
          {changeReturned !== null && changeReturned > 0 && (
            <div className="flex justify-between text-[10px] font-bold text-emerald-700">
              <span>Change Returned:</span>
              <span>Rs. {money(changeReturned)}</span>
            </div>
          )}
          {balanceDue > 0 && (
            <div className="flex justify-between text-xs font-bold text-red-600 border border-red-400 p-1 rounded">
              <span>BALANCE DUE:</span>
              <span>Rs. {money(balanceDue)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-[9px] text-gray-600 pt-2 border-t border-dashed border-gray-400 space-y-0.5">
          <p className="font-bold">Thank you for visiting{showBusinessName ? ` ${businessName}` : ''}!</p>
          <p>{address}</p>
          <p>Tel: {phone} · NTN: {ntn}</p>
        </div>
      </div>
    );
  }

  // Render Template 2: DETAILED_TAX
  if (template === 'DETAILED_TAX') {
    return (
      <div
        id={id}
        className="thermal-receipt tax-template text-left text-xs font-mono space-y-2 text-black p-4 bg-white"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', color: '#000' }}
      >
        {logoUrl && (
          <div className="text-center mb-2">
            <img
              src={logoUrl}
              alt="Business Logo"
              style={{
                maxWidth: `${logoWidth}px`,
                maxHeight: '85px',
                objectFit: 'contain',
                margin: '0 auto',
                display: 'block',
              }}
            />
          </div>
        )}
        {showBusinessName && (
          <div className="text-center font-bold text-sm">
            {businessName}
          </div>
        )}
        <div className="text-center text-[10px] text-gray-500">
          SALES TAX & COMMERCIAL SERVICES INVOICE
        </div>
        <div className="text-center text-[10px] font-bold border-y border-dashed border-gray-400 py-1">
          NTN / STRN REG: {ntn}
        </div>

        <div className="grid grid-cols-2 text-[10px] gap-1 py-1">
          <div><strong>INV NO:</strong> {invoiceNumber}</div>
          <div className="text-right"><strong>DATE:</strong> {dateStr}</div>
          <div><strong>TENDER:</strong> {tender}</div>
          <div className="text-right"><strong>STATUS:</strong> PAID</div>
        </div>

        <div className="border border-black p-1.5 text-center font-bold text-base my-1">
          REG: {vehiclePlate}
        </div>

        <div className="text-[10px]">
          <strong>CUSTOMER:</strong> {customer}
          {vehicleDesc && <span> ({vehicleDesc})</span>}
        </div>

        <div className="py-2 border-t border-b border-black space-y-1">
          <div className="flex justify-between font-bold text-[10px] border-b border-gray-300 pb-0.5">
            <span>SRV / ITEM</span>
            <span>AMOUNT</span>
          </div>
          {servicesList.map((s, idx) => (
            <div key={s.id || idx} className="flex justify-between text-[11px]">
              <span>• {s.service?.name || s.name}</span>
              <strong>Rs. {money(s.price_charged || s.price)}</strong>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-[11px] pt-1">
          <div className="flex justify-between">
            <span>Gross Amount:</span>
            <span>Rs. {money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Less Rebate / Disc:</span>
              <span>-Rs. {money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-black pt-1 text-xs">
            <span>Net Charged:</span>
            <span>Rs. {money(paid)}</span>
          </div>
          {cashTendered !== null && cashTendered > 0 && (
            <div className="flex justify-between text-[10px]">
              <span>Cash Given:</span>
              <span>Rs. {money(cashTendered)}</span>
            </div>
          )}
          {changeReturned !== null && changeReturned > 0 && (
            <div className="flex justify-between text-[10px] text-emerald-700 font-bold">
              <span>Cash Returned:</span>
              <span>Rs. {money(changeReturned)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-[9px] text-gray-500 pt-2 border-t border-dashed border-gray-400">
          <p>{address}</p>
          <p>Helpline: {phone}</p>
          <p className="mt-1 font-semibold">Official Computer Generated Tax Invoice</p>
        </div>
      </div>
    );
  }

  // Render Template 4: LUXURY_STUDIO (Elite Detailing Studio Card)
  if (template === 'LUXURY_STUDIO') {
    return (
      <div
        id={id}
        className="thermal-receipt luxury-template text-left text-xs font-mono space-y-2 text-black p-4 bg-white"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', border: '2px solid #000', color: '#000' }}
      >
        {logoUrl && (
          <div className="text-center mb-2">
            <img
              src={logoUrl}
              alt="Studio Logo"
              style={{
                maxWidth: `${logoWidth}px`,
                maxHeight: '90px',
                objectFit: 'contain',
                margin: '0 auto',
                display: 'block',
              }}
            />
          </div>
        )}

        {showBusinessName && (
          <div className="text-center font-black text-sm tracking-wider uppercase border-b-2 border-black pb-1">
            ❖ {businessName} ❖
          </div>
        )}
        {tagline && (
          <div className="text-center text-[10px] tracking-widest uppercase text-gray-600 font-bold">
            {tagline}
          </div>
        )}

        <div className="bg-black text-white p-1 text-center font-bold text-[10px] tracking-widest my-1 uppercase">
          ★ OFFICIAL DETAILING PASSPORT ★
        </div>

        <div className="border border-black p-2 bg-gray-50 text-[11px] space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 uppercase font-bold">Plate No:</span>
            <span className="text-sm font-black font-mono tracking-wider">{vehiclePlate}</span>
          </div>
          {vehicleDesc && (
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-500 font-bold uppercase">Vehicle:</span>
              <span className="font-bold">{vehicleDesc}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-500 font-bold uppercase">Client:</span>
            <span className="font-bold">{customer}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] pt-1 border-t border-gray-300">
            <span>INV #{invoiceNumber}</span>
            <span>{dateStr}</span>
          </div>
        </div>

        <div className="py-2 border-t-2 border-b-2 border-black space-y-1">
          <div className="flex justify-between font-bold text-[10px] uppercase text-gray-600 pb-0.5 border-b border-gray-300">
            <span>Treatment / Service</span>
            <span>PKR</span>
          </div>
          {servicesList.map((s, idx) => (
            <div key={s.id || idx} className="flex justify-between text-[11px] py-0.5">
              <span>◆ {s.service?.name || s.name}</span>
              <strong>Rs. {money(s.price_charged || s.price)}</strong>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-[11px] pt-1">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal:</span>
            <span>Rs. {money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-700 font-bold">
              <span>VIP Privilege Rebate:</span>
              <span>-Rs. {money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black border-2 border-black p-1 bg-black text-white mt-1">
            <span>TOTAL PAID:</span>
            <span>Rs. {money(paid)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold pt-1">
            <span>Payment Mode:</span>
            <span className="uppercase font-mono bg-gray-200 px-1 rounded">{tender}</span>
          </div>
          {cashTendered !== null && cashTendered > 0 && (
            <div className="flex justify-between text-[10px]">
              <span>Cash Given:</span>
              <span>Rs. {money(cashTendered)}</span>
            </div>
          )}
          {changeReturned !== null && changeReturned > 0 && (
            <div className="flex justify-between text-[10px] text-emerald-800 font-bold">
              <span>Change Returned:</span>
              <span>Rs. {money(changeReturned)}</span>
            </div>
          )}
          {balanceDue > 0 && (
            <div className="flex justify-between font-bold text-red-600 border border-red-500 p-1 rounded">
              <span>Remaining Balance:</span>
              <span>Rs. {money(balanceDue)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-[9px] text-gray-600 pt-2 border-t border-dashed border-gray-400 space-y-0.5">
          <p className="font-bold text-black uppercase tracking-wider">★ 100% QUALITY GUARANTEE ★</p>
          <p>Please avoid high-pressure wash directly on fresh wax/ceramic for 48 hrs.</p>
          <p>{address}</p>
          <p>Helpline: {phone} · NTN: {ntn}</p>
        </div>
      </div>
    );
  }

  // Render Template 5: ENTERPRISE_MINIMAL (Vyapar / Modern Retail POS)
  if (template === 'ENTERPRISE_MINIMAL') {
    return (
      <div
        id={id}
        className="thermal-receipt vyapar-template text-left text-xs font-mono space-y-2 text-black p-4 bg-white"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', color: '#000' }}
      >
        {logoUrl && (
          <div className="text-center mb-1">
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                maxWidth: `${logoWidth}px`,
                maxHeight: '80px',
                objectFit: 'contain',
                margin: '0 auto',
                display: 'block',
              }}
            />
          </div>
        )}

        {showBusinessName && (
          <div className="text-center font-bold text-sm tracking-wide">
            {businessName}
          </div>
        )}
        <div className="text-center text-[10px] text-gray-500">
          RETAIL CASH MEMO & POS INVOICE
        </div>

        <div className="text-[10px] border-y border-black py-1 space-y-0.5">
          <div className="flex justify-between">
            <span><strong>BILL NO:</strong> {invoiceNumber}</span>
            <span><strong>DATE:</strong> {dateStr}</span>
          </div>
          <div className="flex justify-between">
            <span><strong>VEHICLE:</strong> {vehiclePlate}</span>
            <span><strong>PAY:</strong> {tender}</span>
          </div>
          <div className="flex justify-between">
            <span><strong>CLIENT:</strong> {customer}</span>
            <span>{vehicleDesc}</span>
          </div>
        </div>

        {/* Vyapar Tabular Grid */}
        <table className="w-full text-left text-[11px] border-collapse my-1">
          <thead>
            <tr className="border-b border-black text-[10px]">
              <th className="py-1">ITEM DESCRIPTION</th>
              <th className="text-right py-1">RATE</th>
            </tr>
          </thead>
          <tbody>
            {servicesList.map((s, idx) => (
              <tr key={s.id || idx} className="border-b border-gray-200">
                <td className="py-1 pr-1">{s.service?.name || s.name}</td>
                <td className="text-right py-1 font-bold whitespace-nowrap">Rs. {money(s.price_charged || s.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-[11px] border-t border-black pt-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>Rs. {money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Less Discount:</span>
              <span>-Rs. {money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-t border-black pt-1">
            <span>NET PAYABLE:</span>
            <span>Rs. {money(paid)}</span>
          </div>
          {cashTendered !== null && cashTendered > 0 && (
            <div className="flex justify-between text-[10px]">
              <span>Cash Given:</span>
              <span>Rs. {money(cashTendered)}</span>
            </div>
          )}
          {changeReturned !== null && changeReturned > 0 && (
            <div className="flex justify-between text-[10px] text-emerald-700 font-bold">
              <span>Change Returned:</span>
              <span>Rs. {money(changeReturned)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-[9px] text-gray-500 pt-2 border-t border-dashed border-gray-400 space-y-0.5">
          <p>* Computer generated cash memo. Goods/services verified upon release.</p>
          <p>{address}</p>
          <p>Helpline: {phone} · NTN: {ntn}</p>
        </div>
      </div>
    );
  }

  // Render Template 6: VIP_GOLD_PASS (Care Club & Loyalty)
  if (template === 'VIP_GOLD_PASS') {
    return (
      <div
        id={id}
        className="thermal-receipt loyalty-template text-left text-xs font-mono space-y-2 text-black p-4 bg-white"
        style={{ fontFamily: THERMAL_FONT_STYLE, fontWeight: '700', width: '72mm', margin: '0 auto', border: '2px solid #000', color: '#000' }}
      >
        {logoUrl && (
          <div className="text-center mb-1">
            <img
              src={logoUrl}
              alt="Club Logo"
              style={{
                maxWidth: `${logoWidth}px`,
                maxHeight: '85px',
                objectFit: 'contain',
                margin: '0 auto',
                display: 'block',
              }}
            />
          </div>
        )}

        {showBusinessName && (
          <div className="text-center font-black text-sm uppercase">
            ★ {businessName} ★
          </div>
        )}
        <div className="text-center text-[10px] font-bold bg-black text-white py-0.5 uppercase tracking-wider">
          CAR CARE CLUB · LOYALTY RECEIPT
        </div>

        <div className="border border-dashed border-black p-1.5 text-center my-1 space-y-0.5">
          <div className="font-black text-base tracking-widest">{vehiclePlate}</div>
          <div className="text-[10px] font-bold text-gray-700">{customer} {vehicleDesc ? `• ${vehicleDesc}` : ''}</div>
          <div className="text-[9px] text-gray-500">Invoice: #{invoiceNumber} | Date: {dateStr}</div>
        </div>

        <div className="py-1.5 border-t border-b border-black space-y-1">
          <div className="flex justify-between font-bold text-[10px] uppercase text-gray-600">
            <span>Service Performed</span>
            <span>Rate</span>
          </div>
          {servicesList.map((s, idx) => (
            <div key={s.id || idx} className="flex justify-between text-[11px]">
              <span>✔ {s.service?.name || s.name}</span>
              <strong>Rs. {money(s.price_charged || s.price)}</strong>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-[11px] pt-1">
          <div className="flex justify-between">
            <span>Gross Bill:</span>
            <span>Rs. {money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Club Member Savings:</span>
              <span>-Rs. {money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-t-2 border-black pt-1">
            <span>FINAL CHARGE:</span>
            <span>Rs. {money(paid)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Tender: {tender}</span>
            {cashTendered && <span>Cash: Rs. {money(cashTendered)}</span>}
          </div>
          {changeReturned !== null && changeReturned > 0 && (
            <div className="flex justify-between text-[10px] text-emerald-800 font-bold">
              <span>Change Returned:</span>
              <span>Rs. {money(changeReturned)}</span>
            </div>
          )}
        </div>

        {/* Loyalty Perk Meter */}
        <div className="border border-black p-1.5 rounded text-center bg-gray-50 text-[10px] space-y-0.5">
          <p className="font-bold">✦ LOYALTY REWARD TRACKER ✦</p>
          <p className="text-[9px] text-gray-600">Complete 5 wash visits to receive a Free Express Detail!</p>
          <p className="font-mono font-bold text-[10px]">Current Status: Active Member</p>
        </div>

        <div className="text-center text-[9px] text-gray-500 pt-1 border-t border-dashed border-gray-400">
          <p className="font-bold text-black">Thank you for being our valued patron!</p>
          <p>{address}</p>
          <p>Helpline: {phone}</p>
        </div>
      </div>
    );
  }

  // Default Template 1: CLASSIC_THERMAL
  return (
    <div
      id={id}
      className="thermal-receipt classic-template text-left text-xs space-y-2 text-black p-4 bg-white"
      style={{
        fontFamily: THERMAL_FONT_STYLE,
        fontWeight: '700',
        width: '72mm',
        margin: '0 auto',
        color: '#000',
      }}
    >
      {logoUrl && (
        <div className="text-center mb-2">
          <img
            src={logoUrl}
            alt="Business Logo"
            style={{
              maxWidth: `${logoWidth}px`,
              maxHeight: '85px',
              objectFit: 'contain',
              margin: '0 auto',
              display: 'block',
            }}
          />
        </div>
      )}

      {showBusinessName && (
        <div className="text-center font-black text-sm uppercase tracking-wide">
          {businessName}
        </div>
      )}
      {tagline && (
        <div className="text-center text-[11px] font-bold text-black">
          {tagline}
        </div>
      )}

      <div className="border-2 border-black p-2 my-2 text-center bg-slate-900 text-white font-mono font-black text-base tracking-wider rounded">
        VEHICLE: {vehiclePlate}
      </div>

      <div className="border-t-2 border-b-2 border-black py-1.5 my-2 text-xs flex justify-between font-extrabold">
        <span>Invoice #{invoiceNumber}</span>
        <span>{dateStr}</span>
      </div>

      <div className="text-xs space-y-1 font-bold">
        <div><span>Client:</span> <strong className="font-extrabold">{customer}</strong></div>
        {vehicleDesc && <div><span>Vehicle Info:</span> <span>{vehicleDesc}</span></div>}
        <div><span>Payment Method:</span> <span className="uppercase">{tender}</span></div>
      </div>

      <div className="py-2 border-t-2 border-b-2 border-black space-y-1.5">
        <div className="flex justify-between text-[11px] font-black uppercase tracking-wider border-b border-black pb-1">
          <span>Service Item</span>
          <span>Rate (PKR)</span>
        </div>
        {servicesList.map((s, idx) => (
          <div key={s.id || idx} className="flex justify-between text-xs font-bold">
            <span>• {s.service?.name || s.name}</span>
            <span className="font-mono font-black">Rs. {money(s.price_charged || s.price)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 pt-2 text-xs font-bold">
        <div className="flex justify-between">
          <span>Gross Subtotal:</span>
          <span className="font-mono font-extrabold">Rs. {money(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-red-600 font-black">
            <span>Discount:</span>
            <span className="font-mono">-Rs. {money(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black border-2 border-black bg-slate-100 p-2 rounded my-1 text-black">
          <span>TOTAL PAID:</span>
          <span className="font-mono">Rs. {money(paid)}</span>
        </div>
        {cashTendered !== null && cashTendered > 0 && (
          <div className="flex justify-between text-[11px]">
            <span>Cash Tendered:</span>
            <span className="font-mono font-black">Rs. {money(cashTendered)}</span>
          </div>
        )}
        {changeReturned !== null && changeReturned > 0 && (
          <div className="flex justify-between text-[11px] text-emerald-800 font-black">
            <span>Cash Returned:</span>
            <span className="font-mono">Rs. {money(changeReturned)}</span>
          </div>
        )}
        {balanceDue > 0 && (
          <div className="flex justify-between font-black text-red-600 border border-red-500 p-1.5 rounded">
            <span>Balance Due:</span>
            <span className="font-mono">Rs. {money(balanceDue)}</span>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-black font-bold pt-3 border-t-2 border-black space-y-0.5">
        <p className="font-black text-xs">Thank you for visiting{showBusinessName ? ` ${businessName}` : ''}!</p>
        <p>{address}</p>
        <p>Tel: {phone} · NTN: {ntn}</p>
      </div>
    </div>
  );
}

/**
 * TOKEN / WORK ORDER THERMAL TICKET (NO LOGO per user requirement)
 */
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
