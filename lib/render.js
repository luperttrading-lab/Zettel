// Rendert den Zettel als PNG – serverseitig, damit ein Kurzbefehl ihn per URL abholen kann.
// Gleiche Layout-Logik wie in index.html: Telefon = Hochformat, Tablet = Quadrat mit Zettel in der
// Zone, die in beiden Ausrichtungen sichtbar und unterhalb der Uhr liegt.
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export const COLORS = {
  yellow: { paper: '#fff59b', ink: '#2a2a2e' },
  pink:   { paper: '#ffc7dd', ink: '#3a1f2a' },
  green:  { paper: '#c9f2c4', ink: '#1d3320' },
  blue:   { paper: '#c5e4ff', ink: '#1a2a3d' },
};
// Deutsche Aliase, damit der Kurzbefehl auch „gelb“ schicken darf
const ALIAS = { gelb: 'yellow', rosa: 'pink', pink: 'pink', gruen: 'green', grün: 'green', blau: 'blue' };

const LAYOUTS = {
  phone:  (w, h) => ({ noteW: w * 0.80, maxNoteH: h * 0.52, cy: h * 0.56 }),
  tablet: (w, h) => ({ noteW: w * 0.60, maxNoteH: h * 0.42, cy: h * 0.61 }),
};

const AVG_GLYPH_EM = 0.35;   // mittlere Zeichenbreite von Caveat 500 (gemessen), für die Schriftgrößen-Schätzung
const LINE_HEIGHT = 1.15;

let fontData = null;
function loadFont() {
  if (!fontData) fontData = fs.readFileSync(path.join(process.cwd(), 'fonts', 'Caveat-500.ttf'));
  return fontData;
}

// Greedy-Umbruch mit geschätzten Breiten – nur zur Wahl der Schriftgröße; den echten Umbruch macht satori.
function estimateLines(text, fs, maxW) {
  const charW = fs * AVG_GLYPH_EM;
  let n = 0;
  for (const para of text.split('\n')) {
    if (!para.trim()) { n += 1; continue; }
    let line = 0;
    for (const word of para.split(/\s+/)) {
      const wl = word.length * charW;
      if (line === 0) line = wl;
      else if (line + charW + wl <= maxW) line += charW + wl;
      else { n += 1; line = wl; }
      while (line > maxW) { n += 1; line -= maxW; }
    }
    n += 1;
  }
  return n;
}

export function normalizeColor(c) {
  const k = String(c || 'yellow').toLowerCase();
  return COLORS[k] ? k : (ALIAS[k] || 'yellow');
}

export async function renderZettel({ text, color = 'yellow', w = 2360, h = 2360 }) {
  w = Math.max(200, Math.min(6000, Math.round(w)));
  h = Math.max(200, Math.min(6000, Math.round(h)));
  const layoutName = h / w < 1.6 ? 'tablet' : 'phone';
  const layout = LAYOUTS[layoutName](w, h);
  const c = COLORS[normalizeColor(color)];
  text = String(text || '').replace(/\r/g, '').trim() || '…';

  const noteW = Math.round(layout.noteW);
  const pad = Math.round(noteW * 0.08);
  const textW = noteW - 2 * pad;

  let fs = Math.round(noteW / 7), lines;
  for (;;) {
    lines = estimateLines(text, fs, textW);
    if (lines * fs * LINE_HEIGHT + 2 * pad <= layout.maxNoteH || fs <= noteW / 28) break;
    fs = Math.round(fs * 0.92);
  }
  const noteH = Math.max(Math.round(lines * fs * LINE_HEIGHT + 2 * pad), Math.round(noteW * 0.6));
  const left = Math.round(w / 2 - noteW / 2), top = Math.round(layout.cy - noteH / 2);

  // Schatten ohne Blur-Filter: ein echter box-shadow-Blur kostet in resvg bei 2360² über 40 s,
  // vier gestaffelte halbtransparente Flächen sehen gleich aus und rendern in Millisekunden.
  const shadowLayers = [1, 2, 3, 4].map(k => ({ type: 'div', props: { style: {
    position: 'absolute',
    left: left - Math.round(w * 0.004 * k), top: top + Math.round(w * 0.006 * k),
    width: noteW + Math.round(w * 0.008 * k), height: noteH + Math.round(w * 0.008 * k),
    background: 'rgba(0,0,0,0.16)', transform: 'rotate(-2.5deg)',
  } } }));

  const tree = {
    type: 'div',
    props: {
      style: { width: w, height: h, display: 'flex', background: 'linear-gradient(180deg, #1b1b1f 0%, #09090b 100%)', position: 'relative' },
      children: [
        ...shadowLayers,
        { type: 'div', props: { style: {
          position: 'absolute', left, top, width: noteW, height: noteH,
          display: 'flex', alignItems: 'center',
          background: c.paper, transform: 'rotate(-2.5deg)',
          padding: pad,
        }, children: [
          { type: 'div', props: { style: {
            width: textW, fontFamily: 'Caveat', fontSize: fs, lineHeight: LINE_HEIGHT, color: c.ink,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }, children: text } },
          // Klebestreifen
          { type: 'div', props: { style: {
            position: 'absolute', left: Math.round(noteW * 0.37), top: Math.round(-pad * 0.45),
            width: Math.round(noteW * 0.26), height: Math.round(pad * 0.9), background: 'rgba(255,255,255,0.55)',
          } } },
        ] } },
      ],
    },
  };

  const svg = await satori(tree, { width: w, height: h, fonts: [{ name: 'Caveat', data: loadFont(), weight: 500, style: 'normal' }] });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
  return { png: Buffer.from(png), w, h, layout: layoutName, fontSize: fs, lines };
}
