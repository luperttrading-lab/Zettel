// Server-Test: Papierstruktur und Kante (texture=koernig, edge=abgerissen) in Kombination mit Linien.
//   node tests/srv_paper.mjs <ausgabeverzeichnis>
import { renderZettel } from '../lib/render.js';
import fs from 'node:fs';
const [,, outDir = '/tmp'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const cases = [
  ['glatt_gerade', { texture: 'glatt', edge: 'gerade', paper: 'liniert' }],
  ['koernig_abgerissen', { texture: 'koernig', edge: 'abgerissen', paper: 'liniert', fastener: 'thumbtack' }],
  ['koernig_abgerissen_kariert_ipad', { texture: 'koernig', edge: 'abgerissen', paper: 'kariert', fastener: 'bildmagnet', fastenerDesign: 'fuchs', w: 2360, h: 2360 }],
];
for (const [name, o] of cases) {
  const t0 = Date.now();
  const r = await renderZettel({ text: 'Einkaufen\nHundespaziergang und Füttern\nHausaufgaben\nFrisör', list: 'check', w: 1179, h: 2556, ...o });
  fs.writeFileSync(`${outDir}/srv_${name}.png`, r.png);
  console.log(name, Date.now() - t0, 'ms', r.png.length, 'Bytes');
}
