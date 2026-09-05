// Server-Test: Bildmagnet-Motive über lib/render.js rendern (gleicher Weg wie /api/zettel).
//   Aus dem Repo-Verzeichnis starten (render.js liest Schriften relativ zum Arbeitsverzeichnis):
//   cd /home/user/Zettel && node tests/srv_photo.mjs <ausgabeverzeichnis> eule panda
//   Parameter wie in der URL: fastener=bildmagnet, fdesign=<deutscher oder interner Schlüssel>.
import { renderZettel } from '../lib/render.js';
import fs from 'node:fs';

const [,, outDir = '/tmp', ...designs] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
for (const d of designs.length ? designs : ['fuchs', 'eule', 'panda']) {
  const t0 = Date.now();
  const r = await renderZettel({ text: 'Einkaufen\nHundespaziergang\nFrisör', list: 'check', fastener: 'bildmagnet', fastenerDesign: d, w: 1179, h: 2556 });
  fs.writeFileSync(`${outDir}/srv_${d}.png`, r.png);
  console.log(d, Date.now() - t0, 'ms', r.png.length, 'Bytes, Befestigung', JSON.stringify(r.fastener));
}
