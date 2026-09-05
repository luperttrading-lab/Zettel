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

// Schriften wie in index.html; Dateien liegen unter fonts/, Zeichenbreiten unter lib/
export const FONTS = {
  caveat:  { file: 'Caveat-500.ttf',          widths: 'caveat-widths.json',          weight: 500, lh: 1.15 },
  patrick: { file: 'PatrickHand-400.ttf',     widths: 'patrickhand-widths.json',     weight: 400, lh: 1.20 },
  kalam:   { file: 'Kalam-400.ttf',           widths: 'kalam-widths.json',           weight: 400, lh: 1.30 },
  marker:  { file: 'PermanentMarker-400.ttf', widths: 'permanentmarker-widths.json', weight: 400, lh: 1.25 },
};
export const FASTENERS = ['tape', 'tape2', 'thumbtack', 'pin', 'pin2', 'clip', 'magnet'];
const FASTENER_ALIAS = { klebestreifen: 'tape', streifen: 'tape', zwei: 'tape2', reisszwecke: 'thumbtack', reißzwecke: 'thumbtack', nadel: 'pin', nadeln: 'pin2', klammer: 'clip', bueroklammer: 'clip', magnet: 'magnet' };

const LAYOUTS = {
  phone:  (w, h) => ({ noteW: w * 0.80, maxNoteH: h * 0.56, cy: h * 0.585 }),
  tablet: (w, h) => ({ noteW: w * 0.60, maxNoteH: h * 0.42, cy: h * 0.61 }),
};
const AVG_GLYPH_EM = 0.35; // Ersatz für unbekannte Zeichen

const fontCache = {};
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; } }
function loadFont(key) {
  if (!fontCache[key]) {
    const f = FONTS[key];
    fontCache[key] = {
      data: fs.readFileSync(path.join(process.cwd(), 'fonts', f.file)),
      widths: readJson(path.join(process.cwd(), 'lib', f.widths)),
    };
  }
  return fontCache[key];
}
// Symbol-Schrift (Listenzeichen ▪ ☐ …), die den Handschriften fehlen – satori nimmt sie als Ersatz
let symbolFont = null;
function loadSymbols() {
  if (!symbolFont) symbolFont = { data: fs.readFileSync(path.join(process.cwd(), 'fonts', 'Symbols-subset.ttf')), widths: readJson(path.join(process.cwd(), 'lib', 'symbols-widths.json')) };
  return symbolFont;
}
function textWidth(table, s, fsPx) {
  const sym = loadSymbols().widths; let w = 0;
  for (const ch of s) w += (table[ch] ?? sym[ch] ?? AVG_GLYPH_EM) * fsPx;
  return w;
}

// Listen wie in index.html: Markierung als Text am Zeilenanfang, Zahlen fortlaufend
// Hinter der Markierung ein geschütztes Leerzeichen (U+00A0): dort wird nie umbrochen.
const NB = ' ';
const LIST_MARK = { num: i => (i + 1) + '.' + NB, dot: () => '•' + NB, square: () => '▪' + NB, dash: () => '–' + NB, check: () => '☐' + NB };
const PREFIX_RE = /^(\d+\.|•|▪|–|☐|☑)\s+/;
// Wortgrenzen: nur gewöhnliche Leerzeichen/Tabs – Markierung und erstes Wort bleiben zusammen
const WORD_SEP = /[ \t]+/;
export function applyList(text, mode) {
  if (!LIST_MARK[mode]) return text;
  let n = 0;
  return text.split('\n').map(line => { const had = PREFIX_RE.test(line); const bare = line.replace(PREFIX_RE, ''); return (bare.trim() === '' && !had) ? bare : LIST_MARK[mode](n++) + bare; }).join('\n');
}

// Greedy-Umbruch wie in index.html – nur zur Wahl der Schriftgröße; den echten Umbruch macht satori.
function estimateLines(table, text, fs, maxW) {
  const space = textWidth(table, ' ', fs);
  let n = 0;
  for (const para of text.split('\n')) {
    if (!para.trim()) { n += 1; continue; }
    let line = 0;
    for (const word of para.split(WORD_SEP)) {
      const wl = textWidth(table, word, fs);
      if (line === 0) line = wl;
      else if (line + space + wl <= maxW) line += space + wl;
      else { n += 1; line = wl; }
      while (line > maxW) { n += 1; line -= maxW; }
    }
    n += 1;
  }
  return n;
}

export function normalizeColor(c) { const k = String(c || 'yellow').toLowerCase(); return COLORS[k] ? k : (ALIAS[k] || 'yellow'); }
export function normalizeFont(f) { const k = String(f || 'caveat').toLowerCase(); return FONTS[k] ? k : 'caveat'; }
export function normalizeFastener(f) { const k = String(f || 'tape').toLowerCase(); return FASTENERS.includes(k) ? k : (FASTENER_ALIAS[k] || 'tape'); }

// ---------- Befestigungen: identische SVG-Zeichnung wie in index.html ----------
function fastenerShapes(kind, W, H, p) {
  const tape = (cx, cy, w, h, deg) => `<g transform="rotate(${deg} ${cx} ${cy})"><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="#fff" fill-opacity=".55"/><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h * 0.12}" fill="#fff" fill-opacity=".25"/></g>`;
  const thumbtack = (cx, cy, s, deg) => `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})">
    <rect x="-0.06" y="0.55" width="0.12" height="0.7" rx="0.06" fill="#d0d0d6"/><rect x="-0.06" y="0.55" width="0.05" height="0.7" fill="#9a9aa2"/>
    <rect x="-0.24" y="0.18" width="0.48" height="0.42" rx="0.08" fill="#c8281f"/>
    <ellipse cx="0" cy="0.12" rx="0.72" ry="0.44" fill="#c8281f"/><ellipse cx="0" cy="0" rx="0.72" ry="0.44" fill="#ff3b30"/>
    <ellipse cx="0" cy="-0.04" rx="0.6" ry="0.32" fill="#ff5147"/><ellipse cx="-0.22" cy="-0.16" rx="0.24" ry="0.12" fill="#ffa39d" fill-opacity=".75"/></g>`;
  const pin = (cx, cy, s, deg, color, hi) => `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})">
    <rect x="-0.05" y="0.3" width="0.1" height="1.5" rx="0.05" fill="#d8d8de"/><rect x="-0.05" y="0.3" width="0.04" height="1.5" fill="#9a9aa2"/>
    <circle cx="0" cy="0" r="0.5" fill="${color}"/><circle cx="-0.16" cy="-0.18" r="0.16" fill="${hi}" fill-opacity=".8"/>
    <ellipse cx="0.1" cy="0.32" rx="0.34" ry="0.14" fill="#000" fill-opacity=".18"/></g>`;
  const clip = (cx, cy, s, deg) => `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-0.3,1.5 V-0.9 a0.3,0.3 0 0 1 0.6,0 V1.6 a0.45,0.45 0 0 1 -0.9,0 V-0.4" stroke="#7a7a82" stroke-width="0.13"/>
    <path d="M-0.3,1.5 V-0.9 a0.3,0.3 0 0 1 0.6,0 V1.6 a0.45,0.45 0 0 1 -0.9,0 V-0.4" stroke="#d8d8de" stroke-width="0.08"/></g>`;
  const magnet = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s})">
    <circle cx="0" cy="0.08" r="0.72" fill="#000" fill-opacity=".25"/><circle cx="0" cy="0" r="0.7" fill="#c8281f"/>
    <circle cx="0" cy="-0.04" r="0.62" fill="#ff3b30"/><circle cx="0" cy="-0.04" r="0.3" fill="#e0342b"/><ellipse cx="-0.2" cy="-0.28" rx="0.22" ry="0.12" fill="#ffa39d" fill-opacity=".8"/></g>`;
  switch (kind) {
    case 'tape2':     return tape(0, 0, W * 0.2, p * 0.55, -45) + tape(W, 0, W * 0.2, p * 0.55, 45);
    case 'thumbtack': return thumbtack(W / 2, p * 0.45, p * 1.05, -10);
    case 'pin':       return pin(W / 2 - p * 0.35, -p * 0.35, p * 1.25, -28, '#ff3b30', '#ffa39d');
    case 'pin2':      return pin(W * 0.14, -p * 0.25, p * 1.1, -35, '#ff3b30', '#ffa39d') + pin(W * 0.86, -p * 0.25, p * 1.1, 35, '#2f7cf6', '#9cc4ff');
    case 'clip':      return clip(W * 0.86, p * 0.15, p * 0.95, -8);
    case 'magnet':    return magnet(W / 2, p * 0.5, p * 1.05);
    default:          return tape(W / 2, 0, W * 0.26, p * 0.9, 1);
  }
}

// Mini-Parser: unser eigenes, wohlgeformtes SVG-Markup → satori-Elementbaum
function parseSvgFragment(src) {
  const root = { type: 'g', props: { children: [] } };
  const stack = [root];
  const re = /<\/?([a-zA-Z]+)((?:\s+[a-zA-Z-]+="[^"]*")*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const closing = m[0].startsWith('</'), name = m[1], selfClose = m[3] === '/';
    if (closing) { stack.pop(); continue; }
    const props = { children: [] };
    for (const [, k, v] of m[2].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) props[k] = v;
    const node = { type: name, props };
    stack[stack.length - 1].props.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.props.children;
}

export async function renderZettel({ text, color = 'yellow', font = 'caveat', fastener = 'tape', fontScale = 100, list = 'none', w = 2360, h = 2360 }) {
  w = Math.max(200, Math.min(6000, Math.round(w)));
  h = Math.max(200, Math.min(6000, Math.round(h)));
  const layoutName = h / w < 1.6 ? 'tablet' : 'phone';
  const layout = LAYOUTS[layoutName](w, h);
  const c = COLORS[normalizeColor(color)];
  const fontKey = normalizeFont(font), F = FONTS[fontKey], { data: fontData, widths } = loadFont(fontKey);
  const kind = normalizeFastener(fastener);
  const scale = Math.max(60, Math.min(140, Number(fontScale) || 100)) / 100;
  text = applyList(String(text || '').replace(/\r/g, '').replace(/\s+$/, ''), String(list || 'none').toLowerCase()) || '…';

  const noteW = Math.round(layout.noteW);
  const pad = Math.round(noteW * 0.08);
  const textW = noteW - 2 * pad;

  // Wie in index.html: 1) kein Wort hart trennen, 2) Absätze möglichst einzeilig (bis noteW/16),
  // 3) Nutzer-Skalierung, 4) Höhe einhalten.
  const paras = text.split('\n');
  const longestWord = paras.flatMap(p => p.split(WORD_SEP)).reduce((a, b) => (textWidth(widths, b, 100) > textWidth(widths, a, 100) ? b : a), '');
  const minFs = noteW / 28, paraFloor = noteW / 16;
  let fs = Math.round(noteW / 7), lines;
  while (textWidth(widths, longestWord, fs) > textW && fs > minFs) fs = Math.round(fs * 0.94);
  lines = estimateLines(widths, text, fs, textW);
  while (lines > paras.length && fs > paraFloor) { fs = Math.round(fs * 0.95); lines = estimateLines(widths, text, fs, textW); }
  fs = Math.round(fs * scale);
  while (textWidth(widths, longestWord, fs) > textW && fs > minFs) fs = Math.round(fs * 0.94);
  lines = estimateLines(widths, text, fs, textW);
  const FASTENER_INSET = { tape: 0, tape2: 0, thumbtack: 0.9, pin: 0.7, pin2: 0.7, clip: 0, magnet: 0.9 };
  const inset = Math.round(pad * (FASTENER_INSET[kind] || 0));
  // Feste Zettelgröße wie in index.html: quadratisch, höchstens die Maximalhöhe des Layouts
  const noteH = Math.round(Math.min(noteW, layout.maxNoteH));
  while (lines * fs * F.lh + 2 * pad + inset > noteH && fs > minFs) { fs = Math.round(fs * 0.92); lines = estimateLines(widths, text, fs, textW); }
  const left = Math.round(w / 2 - noteW / 2), top = Math.round(layout.cy - noteH / 2);
  const m = pad * 2.2;

  // Schatten ohne Blur-Filter (Blur kostet in resvg bei 2360² über 40 s)
  const shadowLayers = [1, 2, 3, 4].map(k => ({ type: 'div', props: { style: {
    position: 'absolute', left: left - Math.round(w * 0.004 * k), top: top + Math.round(w * 0.006 * k),
    width: noteW + Math.round(w * 0.008 * k), height: noteH + Math.round(w * 0.008 * k),
    background: 'rgba(0,0,0,0.16)', transform: 'rotate(-2.5deg)',
  } } }));

  const fastenerSvg = { type: 'svg', props: {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: `${-m} ${-m} ${noteW + 2 * m} ${noteH + 2 * m}`,
    width: noteW + 2 * m, height: noteH + 2 * m,
    style: { position: 'absolute', left: -m, top: -m },
    children: parseSvgFragment(fastenerShapes(kind, noteW, noteH, pad)),
  } };

  const tree = {
    type: 'div',
    props: {
      style: { width: w, height: h, display: 'flex', background: 'linear-gradient(180deg, #1b1b1f 0%, #09090b 100%)', position: 'relative' },
      children: [
        ...shadowLayers,
        { type: 'div', props: { style: {
          position: 'absolute', left, top, width: noteW, height: noteH,
          display: 'flex', alignItems: 'flex-start',
          background: c.paper, transform: 'rotate(-2.5deg)',
          paddingTop: pad + inset, paddingRight: pad, paddingBottom: pad, paddingLeft: pad,
        }, children: [
          { type: 'div', props: { style: {
            width: textW, fontFamily: 'Note', fontSize: fs, lineHeight: F.lh, color: c.ink,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }, children: text } },
          fastenerSvg,
        ] } },
      ],
    },
  };

  const svg = await satori(tree, { width: w, height: h, fonts: [
    { name: 'Note', data: fontData, weight: F.weight, style: 'normal' },
    { name: 'Symbols', data: loadSymbols().data, weight: 400, style: 'normal' },
  ] });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
  return { png: Buffer.from(png), w, h, layout: layoutName, fontSize: fs, lines, font: fontKey, fastener: kind };
}
