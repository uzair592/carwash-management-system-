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
    body { width: 72mm; margin: 0 auto; padding: 4mm 0; color: #000; font: 12px/1.35 'Courier New', Courier, monospace; }
    button, svg, .no-print { display: none !important; }
    img { display: block !important; margin: 0 auto 8px auto !important; max-width: 100% !important; height: auto !important; object-fit: contain !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .text-center { text-align: center; }
    .thermal-title { display: block; text-align: center; font-size: 15px; font-weight: bold; }
    .thermal-plate-box { border: 2px solid #000; padding: 5px; margin: 6px 0; text-align: center; font-size: 18px; font-weight: bold; }
    .ticket-line, .flex.justify-between { display: flex; justify-content: space-between; gap: 8px; }
    .ticket-line { padding: 3px 0; border-bottom: 1px dashed #666; }
    .ticket-line strong { text-align: right; }
    .border-t { border-top: 1px dashed #666; margin-top: 6px; padding-top: 4px; }
    .border-b { border-bottom: 1px dashed #666; margin-bottom: 6px; padding-bottom: 4px; }
    h3, h4, p { margin: 3px 0; }
  `;
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
