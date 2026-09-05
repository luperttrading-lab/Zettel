// Bildmagnet vorbereiten: weißen Rand per Flutfüllung von außen entfernen, auf Inhalt beschneiden,
// quadratisch mit Rand, 480 px WebP mit Transparenz als Data-URI in lib/motifs.js (kind: 'photo') – dazu PNG in lib/motifs/ für den Server
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, src, key, label] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage();
const mime = src.endsWith('.png') ? 'image/png' : 'image/jpeg';
const data = `data:${mime};base64,` + fs.readFileSync(src).toString('base64');
const out = await page.evaluate(async (data) => {
  const img = new Image(); img.src = data; await img.decode();
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H), px = id.data;
  const isWhite = i => px[i] > 232 && px[i + 1] > 232 && px[i + 2] > 232 && Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) < 24;
  // Flutfüllung von allen Rändern über weiße Pixel
  const seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop(); if (seen[p]) continue; seen[p] = 1;
    const i = p * 4; if (px[i + 3] < 10 || isWhite(i)) { px[i + 3] = 0; const x = p % W, y = (p / W) | 0;
      if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1); if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W); }
  }
  // weiche Kante: Randpixel neben Transparenz leicht abschwächen
  ctx.putImageData(id, 0, 0);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, d = Math.max(bw, bh), S = 480, pad = Math.round(S * 0.02);
  const o = document.createElement('canvas'); o.width = S; o.height = S; const oc = o.getContext('2d');
  const s = (S - 2 * pad) / d;
  oc.drawImage(c, x0, y0, bw, bh, pad + (d - bw) / 2 * s, pad + (d - bh) / 2 * s, bw * s, bh * s);
  return { bbox: [x0, y0, x1, y1], url: o.toDataURL('image/webp', 0.9), png: o.toDataURL('image/png') };
}, data);
console.log('bbox', out.bbox, 'bytes', out.url.length);
const regPath = '/home/user/Zettel/lib/motifs.js';
let reg = {};
if (fs.existsSync(regPath)) { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(regPath, 'utf8'))(m, m.exports); reg = m.exports; }
fs.mkdirSync('/home/user/Zettel/lib/motifs', { recursive: true });
fs.writeFileSync(`/home/user/Zettel/lib/motifs/${key}.png`, Buffer.from(out.png.split(',')[1], 'base64'));   // PNG für den Server (resvg kann kein WebP)
reg[key] = { label, kind: 'photo', src: out.url, png: `${key}.png` };
const body = `// Eigene Magnet-Motive. Rund (Standard): ganze Magnetfläche, 512 px JPEG. Bildmagnet (kind: 'photo'): freigestelltes PNG, das Bild ist der Magnet.\n// Erzeugt mit lib/prep_motif.mjs bzw. lib/prep_photo.mjs – gleiche Datei für App (globalThis.ZettelMotifs) und Server (module.exports).\n(function (root, factory) { const api = factory(); if (typeof module === 'object' && module && module.exports) module.exports = api; else root.ZettelMotifs = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n  return ${JSON.stringify(reg, null, 2).replace(/^/gm, '  ').trimStart()};\n});\n`;
fs.writeFileSync(regPath, body);
fs.writeFileSync(`${process.env.SP}/motifs/${key}-cut.webp`, Buffer.from(out.url.split(',')[1], 'base64'));
console.log('registry', Object.keys(reg), (fs.statSync(regPath).size / 1024).toFixed(0), 'KB');
await b.close();
