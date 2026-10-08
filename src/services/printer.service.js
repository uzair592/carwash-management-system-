/**
 * Thermal Printing Engine (80mm ESC/POS & Browser Print Layouts)
 * Formats standardized 80mm (42 columns) thermal receipts and tickets.
 */

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
 * Printout 1: Intake Ticket
 * Handed to the Jack 1 / Jack 2 / Detailing bay workers.
 * Contains: Large Plate Number, Customer Name, Assigned Services, and blank checkboxes [ ] for worker sign-off.
 */
function generateThermalIntakeTicket(ticket) {
  const plate = ticket.registration_number || ticket.vehicle?.registration_number || 'N/A';
  const customer = ticket.customer_name || ticket.vehicle?.customer_name || 'Walk-in';
  const phone = ticket.customer_phone || ticket.vehicle?.customer_phone || 'N/A';
  const vehicle = `${ticket.make || ticket.vehicle?.make || ''} ${ticket.model || ticket.vehicle?.model || ''}`.trim() || 'Vehicle';
  const ticketNo = ticket.ticket_number || 'CW-TICKET';
  const dateStr = new Date(ticket.created_at || Date.now()).toLocaleString('en-GB');

  const services = ticket.services || [];

  const lines = [
    divider('='),
    padCenter('AUTOWASH & DETAILING'),
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
  lines.push(' [ ] Bay Washing Complete');
  lines.push(' [ ] Microfiber Dry & Vacuum Done');
  lines.push(' [ ] QC Inspection Passed');
  lines.push('');
  lines.push('Worker Signature: ______________________');
  lines.push(divider('='));
  lines.push(padCenter('NO-TICKET, NO-WORK POLICY'));
  lines.push(divider('='));

  return {
    plain_text: lines.join('\n'),
    formatted_html: `
      <div class="thermal-ticket font-mono text-black text-xs leading-tight w-[72mm] mx-auto p-2 bg-white">
        <div class="text-center font-bold text-sm border-b-2 border-black pb-1 mb-2">
          AUTOWASH & DETAILING<br />
          <span class="text-xs font-black uppercase">Bay Work Order Ticket</span>
        </div>
        <div class="text-center text-[11px] mb-2">
          <strong>#${ticketNo}</strong><br />
          ${dateStr}
        </div>
        <div class="border-2 border-black p-2 my-2 text-center rounded">
          <div class="text-[10px] uppercase font-bold">Vehicle License Plate</div>
          <div class="text-xl font-black tracking-widest">${plate}</div>
          <div class="text-[11px]">${vehicle}</div>
        </div>
        <div class="text-xs space-y-1 mb-2">
          <div><strong>Customer:</strong> ${customer}</div>
          <div><strong>Phone:</strong> ${phone}</div>
        </div>
        <div class="border-t border-dashed border-black pt-2 mb-2">
          <div class="font-bold text-[11px] uppercase mb-1">Services to Perform:</div>
          <ul class="space-y-1 text-xs">
            ${services.map((s) => `<li>[ ] ${s.service?.name || s.name}</li>`).join('')}
          </ul>
        </div>
        ${ticket.intake_notes ? `<div class="border-t border-dashed border-black pt-1 mb-2 text-[11px]"><strong>Notes:</strong> ${ticket.intake_notes}</div>` : ''}
        <div class="border-t border-black pt-2 mt-2 text-[10px]">
          <div class="font-bold mb-1">Worker Sign-Off:</div>
          <div>[ ] Wash Complete  [ ] Dry Complete</div>
          <div>[ ] QC Passed</div>
          <div class="mt-3">Worker Sig: __________________</div>
        </div>
        <div class="text-center text-[10px] font-bold border-t-2 border-black pt-1 mt-2">
          NO-TICKET, NO-WORK STRICT POLICY
        </div>
      </div>
    `,
  };
}

/**
 * Printout 2: Customer Receipt
 * Handed to the customer upon checkout settlement.
 * Contains: Shop Header, Invoice Number, Plate, Services Billed, Payment Mode, Total Paid, and "Thank you for visiting!".
 */
function generateThermalCustomerReceipt(invoiceData) {
  const invoiceNo = invoiceData.invoice_number || 'INV-0000';
  const plate = invoiceData.plate || invoiceData.job_card?.vehicle?.registration_number || 'N/A';
  const customer = invoiceData.customer_name || invoiceData.job_card?.customer_name || invoiceData.job_card?.vehicle?.customer_name || 'Walk-in Customer';
  const paymentMethod = invoiceData.payment_method || 'CASH';
  const totalAmount = parseFloat(invoiceData.total_amount || 0);
  const discountAmount = parseFloat(invoiceData.discount_amount || 0);
  const dateStr = new Date(invoiceData.created_at || Date.now()).toLocaleString('en-GB');

  const services = invoiceData.services || invoiceData.job_card?.services || [];
  const subtotal = services.reduce((sum, s) => sum + parseFloat(s.price_charged || s.price || 0), totalAmount + discountAmount);

  const lines = [
    divider('='),
    padCenter('AUTOWASH & DETAILING STUDIO'),
    padCenter('Official Customer Receipt'),
    divider('='),
    padRow('INVOICE NO:', invoiceNo),
    padRow('DATE/TIME:', dateStr),
    divider('-'),
    padRow('VEHICLE:', plate),
    padRow('CUSTOMER:', customer),
    padRow('TENDER:', paymentMethod.toUpperCase()),
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
  lines.push(padRow('TOTAL PAID:', `Rs. ${totalAmount.toLocaleString()}`));
  lines.push(divider('='));
  lines.push('');
  lines.push(padCenter('Thank you for visiting!'));
  lines.push(padCenter('Please visit us again soon.'));
  lines.push(divider('-'));
  lines.push(padCenter('Software by AutoWash Management'));

  return {
    plain_text: lines.join('\n'),
    formatted_html: `
      <div class="thermal-receipt font-mono text-black text-xs leading-tight w-[72mm] mx-auto p-2 bg-white">
        <div class="text-center font-black text-sm border-b-2 border-black pb-1 mb-2">
          AUTOWASH & DETAILING<br />
          <span class="text-xs font-normal">Customer Tax Invoice</span>
        </div>
        <div class="flex justify-between text-[11px] mb-1">
          <span>Inv: <strong>#${invoiceNo}</strong></span>
          <span>${paymentMethod}</span>
        </div>
        <div class="text-[10px] text-gray-700 mb-2">${dateStr}</div>
        <div class="border-t border-b border-black py-1.5 my-1 text-xs">
          <div class="flex justify-between">
            <span>Vehicle:</span>
            <strong>${plate}</strong>
          </div>
          <div class="flex justify-between">
            <span>Customer:</span>
            <span>${customer}</span>
          </div>
        </div>
        <div class="py-1 space-y-1">
          ${services
            .map(
              (s) => `
            <div class="flex justify-between text-xs">
              <span class="truncate pr-1">• ${s.service?.name || s.name}</span>
              <span class="font-bold shrink-0">Rs. ${parseFloat(s.price_charged || s.price || 0).toLocaleString()}</span>
            </div>
          `
            )
            .join('')}
        </div>
        ${
          discountAmount > 0
            ? `
          <div class="flex justify-between text-xs pt-1 border-t border-dashed border-gray-400">
            <span>Discount:</span>
            <span>-Rs. ${discountAmount.toLocaleString()}</span>
          </div>
        `
            : ''
        }
        <div class="border-t-2 border-black pt-2 mt-2 flex justify-between text-sm font-black">
          <span>TOTAL PAID:</span>
          <span>Rs. ${totalAmount.toLocaleString()}</span>
        </div>
        <div class="text-center text-[11px] mt-4 pt-2 border-t border-dashed border-black">
          Thank you for visiting!<br />
          Please visit us again.
        </div>
      </div>
    `,
  };
}

module.exports = {
  generateThermalIntakeTicket,
  generateThermalCustomerReceipt,
};
