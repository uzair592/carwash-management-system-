// Print a committed ticket/receipt in its own document, without the app layout.
// This is a browser print preview; printer hardware remains managed by the server.
export function printThermal(elementId) {
  const source = document.getElementById(elementId);
  if (!source) return false;
  const popup = window.open('', '_blank', 'width=420,height=680');
  if (!popup) return false;
  popup.document.title = 'DF PRO · Print';
  const style = popup.document.createElement('style');
  style.textContent = `@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{width:72mm;margin:0 auto;padding:3mm 0;color:#000;font:12px/1.4 Arial,sans-serif}button,svg{display:none}*{background:transparent!important;color:#000!important;box-shadow:none!important}.thermal-title{display:block;text-align:center;font-size:16px;font-weight:700}.thermal-plate-box{border:2px solid;padding:6px;margin:8px 0;text-align:center;font-size:18px;font-weight:700}.ticket-line,.flex.justify-between{display:flex;justify-content:space-between;gap:8px}.ticket-line{padding:4px 0;border-bottom:1px dashed #aaa}.ticket-line strong{text-align:right}.text-center{text-align:center}.block{display:block}.grid-cols-2{display:grid;grid-template-columns:1fr 1fr}.border-t,.border-b{border-bottom:1px dashed;margin:6px 0;padding:4px 0}h4,p{margin:4px 0}.thermal-receipt{font:12px/1.4 Arial,sans-serif}`;
  popup.document.head.append(style);
  popup.document.body.append(source.cloneNode(true));
  popup.focus();
  popup.addEventListener('afterprint', () => popup.close(), { once: true });
  popup.setTimeout(() => popup.print(), 150);
  return true;
}
