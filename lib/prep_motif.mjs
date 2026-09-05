// Motiv vorbereiten: Kreis auf Weiß finden, quadratisch beschneiden, 512 px JPEG als Data-URI (rund geschnitten wird beim Zeichnen)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, src, key, label, zoomArg] = process.argv;
const zoom = Number(zoomArg) || 1;   // > 1 = enger ausschneiden, Motiv erscheint größer (Kreis muss außen weiter reichen)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage();
const data = 'data:image/jpeg;base64,' + fs.readFileSync(src).toString('base64');
const out = await page.evaluate(async ({ data, zoom }) => {
  const img = new Image(); img.src = data; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const { data: px } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4; if (px[i] + px[i + 1] + px[i + 2] < 720) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, d = (Math.max(x1 - x0, y1 - y0) + 1) / zoom;
  const o = document.createElement('canvas'); o.width = 512; o.height = 512; const oc = o.getContext('2d');
  oc.fillStyle = '#fff'; oc.fillRect(0, 0, 512, 512);
  oc.drawImage(c, cx - d / 2, cy - d / 2, d, d, 0, 0, 512, 512);
  return { bbox: [x0, y0, x1, y1], d, url: o.toDataURL('image/jpeg', 0.85) };
}, { data, zoom });
console.log('bbox', out.bbox, 'd', out.d, 'bytes', out.url.length);

// Registry-Datei ergänzen
const regPath = new URL('./motifs.js', import.meta.url).pathname;
let reg = {};
if (fs.existsSync(regPath)) { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(regPath, 'utf8'))(m, m.exports); reg = m.exports; }
reg[key] = { label, src: out.url };
const body = `// Eigene Magnet-Motive (ganze Magnetfläche, quadratisch auf den Kreis beschnitten, 512 px JPEG als Data-URI; rund geschnitten wird beim Zeichnen).\n// Erzeugt mit scratchpad/prep_motif.mjs – gleiche Datei für App (globalThis.ZettelMotifs) und Server (module.exports).\n(function (root, factory) { const api = factory(); if (typeof module === 'object' && module && module.exports) module.exports = api; else root.ZettelMotifs = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n  return ${JSON.stringify(reg, null, 2).replace(/^/gm, '  ').trimStart()};\n});\n`;
fs.writeFileSync(regPath, body);
console.log('registry', Object.keys(reg), (fs.statSync(regPath).size / 1024).toFixed(0), 'KB');
await b.close();
