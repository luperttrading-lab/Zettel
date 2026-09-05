// Papierkörnung für den Server: zufälliges Grau-Alpha-Rauschen als PNG (Data-URI), ohne Abhängigkeiten.
// Die App erzeugt dieselbe Art Rauschen zur Laufzeit auf einem Canvas.
import zlib from 'node:zlib';

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// w × h Pixel, Farbtyp 4 (Grau + Alpha). Helle und dunkle Körner, Deckkraft bis alphaMax (0–255).
export function grainPng(w, h, alphaMax = 26, seed = 7) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const raw = Buffer.alloc((w * 2 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 2 + 1); raw[o] = 0;   // Filtertyp 0
    for (let x = 0; x < w; x++) {
      const r = rnd(), a = rnd();
      raw[o + 1 + x * 2] = r < 0.5 ? 0 : 255;                 // dunkles oder helles Korn
      raw[o + 2 + x * 2] = Math.round(a * a * alphaMax);       // meist schwach, selten kräftig
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function grainDataUri(w, h, alphaMax, seed) { return 'data:image/png;base64,' + grainPng(w, h, alphaMax, seed).toString('base64'); }
