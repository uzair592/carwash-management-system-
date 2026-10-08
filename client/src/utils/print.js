import axios from 'axios';
import { RECEIPT_CSS } from '../components/ThermalTemplates';
// Print a committed ticket/receipt in its own document, without the app layout.
// This is a browser print preview; printer hardware remains managed by the server.
export async function printThermal(elementId, options = {}) {
  const source = document.getElementById(elementId);
  if (!source) return false;
  const popup = window.open('', '_blank', 'width=440,height=700');
  if (!popup) return false;
  let config = {
    mode: 'BROWSER',
    paper_width: options.paperWidth || 80
  };
  if (!options.preview) {
    try {
      const r = await axios.get('/api/printer/settings');
      config = r.data.data || config;
    } catch {
      popup.close();
      window.alert('Printer settings could not load. Try again.');
      return false;
    }
    if (['NETWORK', 'WINDOWS'].includes(config.mode)) {
      popup.close();
      if (!source.dataset.printId) {
        window.alert('Save the ticket or invoice before direct printing.');
        return false;
      }
      try {
        let logo_raster;
        const image = source.querySelector('.receipt-logo');
        if (image) {
          if (!image.complete) await new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, {
              once: true
            });
            image.addEventListener('error', reject, {
              once: true
            });
          });
          const width = Math.min(config.paper_width === 58 ? 384 : 576, Math.round(image.getBoundingClientRect().width * 2)),
            height = Math.min(384, Math.round(width * image.naturalHeight / image.naturalWidth));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height).data,
            bytes = new Uint8Array(Math.ceil(width / 8) * height);
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if ((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 < 160) bytes[y * Math.ceil(width / 8) + (x >> 3)] |= 0x80 >> x % 8;
          }
          logo_raster = {
            width,
            height,
            data: btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
          };
        }
        await axios.post('/api/printer/print', {
          kind: source.dataset.printKind,
          document_id: source.dataset.printId,
          show_business_name: source.dataset.showBusinessName === undefined ? undefined : source.dataset.showBusinessName !== 'false',
          logo_raster
        });
        return true;
      } catch (e) {
        window.alert(e.response?.data?.message || 'Printer delivery is uncertain. Check the paper before printing again.');
        return false;
      }
    }
  }
  const width = config.paper_width === 58 ? 58 : 80;
  popup.document.title = 'DF PRO · Invoice & Thermal Print';
  const style = popup.document.createElement('style');
  style.textContent = `
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body {
      width: ${width === 58 ? 50 : 72}mm;
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
  style.textContent += RECEIPT_CSS + `.receipt-sheet,.ticket-sheet{width:${width === 58 ? 50 : 72}mm!important;max-width:100%!important;}`;
  popup.document.head.append(style);
  popup.document.body.append(source.cloneNode(true));
  popup.focus();
  popup.addEventListener('afterprint', () => popup.close(), {
    once: true
  });
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
