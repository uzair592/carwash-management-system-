import { RECEIPT_CSS } from '../components/ThermalTemplates';
// Print a committed ticket/receipt in its own document, without the app layout.
// This is a browser print preview; printer hardware remains managed by the server.
export function printThermal(elementId) {
  const source = document.getElementById(elementId);
  if (!source) return false;
  const popup = window.open('', '_blank', 'width=440,height=700');
  if (!popup) return false;
  popup.document.title = 'DF PRO · Invoice & Thermal Print';
  const style = popup.document.createElement('style');
  style.textContent = `
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 2mm 0;
      color: #000 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 13px;
      line-height: 1.4;
      font-weight: 700;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    button, svg, .no-print { display: none !important; }
    img { display: block !important; margin: 0 auto 8px auto !important; max-width: 100% !important; height: auto !important; object-fit: contain !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .text-center { text-align: center; }
    .thermal-title { display: block; text-align: center; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
    .thermal-plate-box { border: 2.5px solid #000; padding: 6px; margin: 8px 0; text-align: center; font-size: 19px; font-weight: 900; letter-spacing: 1px; }
    .ticket-line, .flex.justify-between { display: flex; justify-content: space-between; gap: 8px; }
    .ticket-line { padding: 4px 0; border-bottom: 1.5px solid #000; }
    .ticket-line strong { text-align: right; font-weight: 800; }
    .border-t { border-top: 1.5px solid #000; margin-top: 6px; padding-top: 4px; }
    .border-b { border-bottom: 1.5px solid #000; margin-bottom: 6px; padding-bottom: 4px; }
    h1, h2, h3, h4, strong, b { font-weight: 800 !important; color: #000 !important; }
    p, span, div { color: #000 !important; }
  `;
  style.textContent += RECEIPT_CSS;
  popup.document.head.append(style);
  popup.document.body.append(source.cloneNode(true));
  popup.focus();
  popup.addEventListener('afterprint', () => popup.close(), { once: true });

  const images = popup.document.images;
  if (images.length > 0) {
    let pending = images.length;
    const done = () => {
      pending--;
      if (pending <= 0) {
        popup.setTimeout(() => popup.print(), 100);
      }
    };
    for (let i = 0; i < images.length; i++) {
      if (images[i].complete) {
        done();
      } else {
        images[i].onload = done;
        images[i].onerror = done;
      }
    }
  } else {
    popup.setTimeout(() => popup.print(), 150);
  }
  return true;
}
