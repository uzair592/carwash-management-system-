/**
 * Thermal Printing Engine (80mm ESC/POS & Browser Print Layouts)
 * Formats standardized 80mm (42 columns) thermal receipts and tickets
 * with optional Business Logo and customizable branding header.
 */

const prisma = require('../prisma');

const LINE_WIDTH = 42; // Standard 80mm thermal printer character width

function padCenter(text, width = LINE_WIDTH) {
  const str = String(text || '').slice(0, width);
  const leftPad = Math.floor((width - str.length) / 2);
  const rightPad = width - str.length - leftPad;
  return ' '.repeat(Math.max(0, leftPad)) + str + ' '.repeat(Math.max(0, rightPad));
}

function padRow(left, right, width = LINE_WIDTH) {
  const l = String(left || '');
  const r = String(right || '');
  const spaceCount = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaceCount) + r;
}

function divider(char = '-', width = LINE_WIDTH) {
  return char.repeat(width);
}

/**
 * Fetch current branding settings
 */
async function getBranding() {
  try {
    const branding = await prisma.businessBranding.findFirst();
    if (branding) return branding;
  } catch (e) {
    // fallback
  }
  return {
    business_name: 'DF PRO Car Wash & Detailing Center',
    tagline: 'Premium Auto Care & Ceramic Studio',
    address: 'Main Commercial Avenue, Phase 5, DHA',
    phone: '+92 300 1234567',
    ntn_number: '1234567-8',
    logo_url: null,
    logo_size: 120,
  };
}

/**
 * Printout 1: Intake Ticket
 * Handed to the Jack 1 / Jack 2 / Detailing bay workers.
 */
async function generateThermalIntakeTicket(ticket, customBranding = null) {
  const branding = customBranding || (await getBranding());
  const plate = ticket.registration_number || ticket.vehicle?.registration_number || 'N/A';
  const customer = ticket.customer_name || ticket.vehicle?.customer_name || 'Walk-in';
  const phone = ticket.customer_phone || ticket.vehicle?.customer_phone || 'N/A';
  const vehicle = `${ticket.make || ticket.vehicle?.make || ''} ${ticket.model || ticket.vehicle?.model || ''}`.trim() || 'Vehicle';
  const ticketNo = ticket.ticket_number || 'CW-TICKET';
  const dateStr = new Date(ticket.created_at || Date.now()).toLocaleString('en-GB');

  const services = ticket.services || [];

  const lines = [
    divider('='),
    padCenter(branding.business_name || 'DF PRO AUTO CARE'),
    padCenter('** BAY WORK ORDER TICKET **'),
    divider('='),
    padCenter(`TICKET: ${ticketNo}`),
    padCenter(dateStr),
    divider('-'),
    '',
    padCenter('============================'),
    padCenter(`  PLATE: ${plate}  `),
    padCenter('============================'),
    '',
    padRow('CUSTOMER:', customer),
    padRow('PHONE:', phone),
    padRow('VEHICLE:', vehicle),
    divider('-'),
    'ASSIGNED SERVICES & PACKAGES:',
  ];

  services.forEach((s, idx) => {
    const sName = s.service?.name || s.name || `Service #${idx + 1}`;
    lines.push(` [ ] ${sName}`);
  });

  if (ticket.intake_notes) {
    lines.push(divider('-'));
    lines.push(`NOTES: ${ticket.intake_notes}`);
  }

  lines.push(divider('-'));
  lines.push('WORKER SIGN-OFF:');
  lines.push(' [ ] Bay Work Complete');
  lines.push(' [ ] Microfiber Dry & Vacuum Done');
  lines.push(' [ ] QC Inspection Passed');
  lines.push('');
  lines.push('Worker Signature: ______________________');
  lines.push(divider('='));
  lines.push(padCenter('NO-TICKET, NO-WORK POLICY'));
  lines.push(divider('='));

  const logoHtml = branding.logo_url
    ? `<div class="text-center mb-2"><img src="${branding.logo_url}" alt="Logo" style="max-width: ${branding.logo_size || 120}px; max-height: 80px; object-fit: contain; margin: 0 auto; display: block;" /></div>`
    : '';

  return {
    plain_text: lines.join('\n'),
    formatted_html: `
      <div class="thermal-ticket font-mono text-black text-xs leading-tight w-[72mm] mx-auto p-2 bg-white" style="font-family: 'Courier New', Courier, monospace; width: 72mm; color: #000;">
        ${logoHtml}
        <div class="text-center font-bold text-sm border-b-2 border-black pb-1 mb-2">
          ${branding.business_name || 'DF PRO CAR WASH & DETAILING'}<br />
          <span class="text-xs font-black uppercase tracking-wider">Bay Work Order Ticket</span>
        </div>
        <div class="text-center text-[11px] mb-2">
          <strong>#${ticketNo}</strong><br />
          ${dateStr}
        </div>
        <div class="border-2 border-black p-2 my-2 text-center rounded">
          <div class="text-[10px] uppercase font-bold text-gray-700">Vehicle License Plate</div>
          <div class="text-xl font-black tracking-widest my-1">${plate}</div>
          <div class="text-[11px] font-semibold">${vehicle}</div>
        </div>
        <div class="text-xs space-y-1 mb-2 border-b border-dashed border-black pb-2">
          <div><strong>Customer:</strong> ${customer}</div>
          <div><strong>Phone:</strong> ${phone}</div>
        </div>
        <div class="pt-1 mb-2">
          <div class="font-bold text-[11px] uppercase mb-1">Services to Perform:</div>
          <ul class="space-y-1 text-xs">
            ${services.map((s) => `<li>[ ] ${s.service?.name || s.name}</li>`).join('')}
          </ul>
        </div>
        ${ticket.intake_notes ? `<div class="border-t border-dashed border-black pt-1 mb-2 text-[11px]"><strong>Notes:</strong> ${ticket.intake_notes}</div>` : ''}
        <div class="border-t border-black pt-2 mt-2 text-[10px]">
          <div class="font-bold mb-1">Worker Sign-Off:</div>
          <div>[ ] Work Complete  [ ] Dry Complete</div>
          <div>[ ] QC Passed</div>
          <div class="mt-3">Worker Sig: __________________</div>
        </div>
        <div class="text-center text-[10px] font-bold border-t-2 border-black pt-1 mt-2">
          STRICT 'NO-TICKET, NO-WORK' STANDARD
        </div>
      </div>
    `,
  };
}

/**
 * Printout 2: Customer Receipt
 * Handed to the customer upon checkout settlement.
 */
async function generateThermalCustomerReceipt(invoiceData, customBranding = null) {
  const branding = customBranding || (await getBranding());
  const invoiceNo = invoiceData.invoice_number || 'INV-0000';
  const plate = invoiceData.plate || invoiceData.job_card?.vehicle?.registration_number || 'N/A';
  const customer = invoiceData.customer_name || invoiceData.job_card?.customer_name || invoiceData.job_card?.vehicle?.customer_name || 'Walk-in Customer';
  const paymentMethod = invoiceData.payment_method || 'CASH';
  const totalAmount = parseFloat(invoiceData.total_amount || 0);
  const paidAmount = parseFloat(invoiceData.paid_amount || totalAmount);
  const discountAmount = parseFloat(invoiceData.discount_amount || 0);
  const balanceDue = parseFloat(invoiceData.balance_due || (totalAmount - paidAmount));
  const cashTendered = invoiceData.cash_tendered ? parseFloat(invoiceData.cash_tendered) : null;
  const changeReturned = invoiceData.change_returned ? parseFloat(invoiceData.change_returned) : null;
  const status = invoiceData.status || (balanceDue > 0 ? 'PARTIAL' : 'PAID');
  const dateStr = new Date(invoiceData.created_at || Date.now()).toLocaleString('en-GB');

  const services = invoiceData.services || invoiceData.job_card?.services || [];
  const subtotal = services.reduce((sum, s) => sum + parseFloat(s.price_charged || s.price || 0), totalAmount + discountAmount);

  const lines = [
    divider('='),
    padCenter(branding.business_name || 'DF PRO CAR WASH & DETAILING'),
    padCenter(branding.tagline || 'Premium Auto Care'),
    divider('='),
    padRow('INVOICE NO:', invoiceNo),
    padRow('DATE/TIME:', dateStr),
    divider('-'),
    padRow('VEHICLE:', plate),
    padRow('CUSTOMER:', customer),
    padRow('PAYMENT:', paymentMethod.toUpperCase()),
    padRow('STATUS:', status),
    divider('-'),
    padRow('ITEM / SERVICE', 'PRICE (PKR)'),
    divider('-'),
  ];

  services.forEach((s) => {
    const sName = (s.service?.name || s.name || 'Service').slice(0, 26);
    const sPrice = parseFloat(s.price_charged || s.price || 0).toLocaleString();
    lines.push(padRow(sName, `Rs. ${sPrice}`));
  });

  lines.push(divider('-'));
  lines.push(padRow('SUBTOTAL:', `Rs. ${subtotal.toLocaleString()}`));

  if (discountAmount > 0) {
    lines.push(padRow('DISCOUNT:', `-Rs. ${discountAmount.toLocaleString()}`));
  }

  lines.push(divider('='));
  lines.push(padRow('TOTAL AMOUNT:', `Rs. ${totalAmount.toLocaleString()}`));
  lines.push(padRow('AMOUNT PAID:', `Rs. ${paidAmount.toLocaleString()}`));

  if (cashTendered !== null) {
    lines.push(padRow('CASH TENDERED:', `Rs. ${cashTendered.toLocaleString()}`));
  }
  if (changeReturned !== null && changeReturned > 0) {
    lines.push(padRow('CHANGE RETURNED:', `Rs. ${changeReturned.toLocaleString()}`));
  }
  if (balanceDue > 0) {
    lines.push(divider('-'));
    lines.push(padRow('BALANCE DUE:', `Rs. ${balanceDue.toLocaleString()}`));
  }

  lines.push(divider('='));
  lines.push('');
  lines.push(padCenter('Thank you for choosing DF PRO!'));
  if (branding.address) lines.push(padCenter(branding.address.slice(0, LINE_WIDTH)));
  if (branding.phone) lines.push(padCenter(`Tel: ${branding.phone}`));
  if (branding.ntn_number) lines.push(padCenter(`NTN: ${branding.ntn_number}`));
  lines.push(divider('-'));
  lines.push(padCenter('Software by AutoWash Management'));

  const logoHtml = branding.logo_url
    ? `<div class="text-center mb-2"><img src="${branding.logo_url}" alt="Logo" style="max-width: ${branding.logo_size || 120}px; max-height: 85px; object-fit: contain; margin: 0 auto; display: block;" /></div>`
    : '';

  return {
    plain_text: lines.join('\n'),
    formatted_html: `
      <div class="thermal-receipt font-mono text-black text-xs leading-tight w-[72mm] mx-auto p-2 bg-white" style="font-family: 'Courier New', Courier, monospace; width: 72mm; color: #000;">
        ${logoHtml}
        <div class="text-center font-bold text-sm border-b-2 border-black pb-1 mb-2">
          ${branding.business_name || 'DF PRO CAR WASH & DETAILING'}<br />
          <span class="text-[11px] font-normal italic">${branding.tagline || 'Official Customer Receipt'}</span>
        </div>
        <div class="flex justify-between text-xs mb-1">
          <span><strong>Inv:</strong> ${invoiceNo}</span>
          <span>${dateStr}</span>
        </div>
        <div class="border-t border-b border-dashed border-black py-1 my-1 text-xs space-y-0.5">
          <div class="flex justify-between"><span><strong>Plate:</strong> ${plate}</span><span><strong>Status:</strong> ${status}</span></div>
          <div><strong>Customer:</strong> ${customer}</div>
          <div><strong>Method:</strong> ${paymentMethod}</div>
        </div>
        <table class="w-full text-xs my-2 border-collapse" style="width: 100%;">
          <thead>
            <tr class="border-b border-black text-left">
              <th class="py-1">Service</th>
              <th class="py-1 text-right">PKR</th>
            </tr>
          </thead>
          <tbody>
            ${services
              .map(
                (s) => `
              <tr>
                <td class="py-0.5">${s.service?.name || s.name}</td>
                <td class="py-0.5 text-right font-medium">Rs. ${parseFloat(s.price_charged || s.price || 0).toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <div class="border-t border-dashed border-black pt-1 space-y-0.5 text-xs">
          <div class="flex justify-between"><span>Subtotal:</span><span>Rs. ${subtotal.toLocaleString()}</span></div>
          ${discountAmount > 0 ? `<div class="flex justify-between text-red-600"><span>Discount:</span><span>-Rs. ${discountAmount.toLocaleString()}</span></div>` : ''}
          <div class="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
            <span>Total:</span><span>Rs. ${totalAmount.toLocaleString()}</span>
          </div>
          <div class="flex justify-between font-bold text-xs">
            <span>Paid:</span><span>Rs. ${paidAmount.toLocaleString()}</span>
          </div>
          ${cashTendered !== null ? `<div class="flex justify-between"><span>Cash Tendered:</span><span>Rs. ${cashTendered.toLocaleString()}</span></div>` : ''}
          ${changeReturned !== null && changeReturned > 0 ? `<div class="flex justify-between font-semibold"><span>Change Returned:</span><span>Rs. ${changeReturned.toLocaleString()}</span></div>` : ''}
          ${balanceDue > 0 ? `<div class="flex justify-between font-bold text-red-600 border-t border-dashed border-black pt-1"><span>Remaining Balance:</span><span>Rs. ${balanceDue.toLocaleString()}</span></div>` : ''}
        </div>
        <div class="text-center text-[10px] mt-4 pt-2 border-t border-black leading-tight">
          <p class="font-bold">Thank you for visiting DF PRO!</p>
          ${branding.address ? `<p>${branding.address}</p>` : ''}
          ${branding.phone ? `<p>Phone: ${branding.phone}</p>` : ''}
          ${branding.ntn_number ? `<p>NTN: ${branding.ntn_number}</p>` : ''}
          <p class="text-[9px] text-gray-500 mt-1">Software by AutoWash Management</p>
        </div>
      </div>
    `,
  };
}

module.exports = {
  getBranding,
  generateThermalIntakeTicket,
  generateThermalCustomerReceipt,
};
