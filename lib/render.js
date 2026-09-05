// Rendert den Zettel als PNG – serverseitig, damit ein Kurzbefehl ihn per URL abholen kann.
// Gleiche Layout-Logik wie in index.html: Telefon = Hochformat, Tablet = Quadrat mit Zettel in der
// Zone, die in beiden Ausrichtungen sichtbar und unterhalb der Uhr liegt.
import fs from 'node:fs';
const { readFileSync } = fs;
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
  indie:   { file: 'IndieFlower-400.ttf',      widths: 'indie-widths.json',           weight: 400, lh: 1.25 },
  shadows: { file: 'ShadowsIntoLight-400.ttf', widths: 'shadows-widths.json',         weight: 400, lh: 1.30 },
  gloria:  { file: 'GloriaHallelujah-400.ttf', widths: 'gloria-widths.json',          weight: 400, lh: 1.35 },
};
// Befestigungen (Zeichnung, Farben, Muster, Motive): dieselbe Datei wie in der App (klassisches Skript, hier per Function geladen)
const Fx = (() => { const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'fasteners.js'), 'utf8'); const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; })();
try { const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'motifs.js'), 'utf8'); const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); Fx.setMotifs(m.exports); } catch (_) { /* keine eigenen Motive */ }
export const FASTENERS = Object.keys(Fx.FASTENERS);
export const { normalizeFastener, normalizeLook, FCOLORS, PATTERNS, DESIGNS } = Fx;

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

// Umbruchstücke wie in index.html: Wörter, zusätzlich Trennung hinter Bindestrich vor Buchstabe
function chunksOf(para) {
  const out = [];
  for (const word of para.split(WORD_SEP)) {
    let start = 0;
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === '-' && /[^\d\s-]/.test(word[i + 1]) && i > start) { out.push({ s: word.slice(start, i + 1), sep: start ? '' : ' ' }); start = i + 1; }
    }
    out.push({ s: word.slice(start), sep: start ? '' : ' ' });
  }
  return out;
}
// Einzug eines Listenpunkts: Breite der Markierung samt geschütztem Leerzeichen
function indentOf(table, para, fs) { const m = para.match(PREFIX_RE); return m ? textWidth(table, m[0], fs) : 0; }
// Greedy-Umbruch wie in index.html – nur zur Wahl der Schriftgröße; den echten Umbruch macht satori.
// Folgezeilen eines Listenpunkts sind um den Einzug schmaler (hängender Einzug).
function estimateLines(table, text, fs, maxW) {
  const space = textWidth(table, ' ', fs);
  let n = 0;
  for (const para of text.split('\n')) {
    if (!para.trim()) { n += 1; continue; }
    // Markierung steht links neben dem eingerückten Textblock: alle Zeilen des Punkts sind maxW - indent breit
    const indent = indentOf(table, para, fs), limit = maxW - indent;
    const body = para.replace(PREFIX_RE, '');
    let line = 0;
    for (const c of chunksOf(body)) {
      const wl = textWidth(table, c.s, fs), gap = c.sep ? space : 0;
      if (line === 0) line = wl;
      else if (line + gap + wl <= limit) line += gap + wl;
      else { n += 1; line = wl; }
      while (line > limit) { n += 1; line -= limit; }
    }
    n += 1;
  }
  return n;
}

export function normalizeColor(c) { const k = String(c || 'yellow').toLowerCase(); return COLORS[k] ? k : (ALIAS[k] || 'yellow'); }
export function normalizeFont(f) { const k = String(f || 'caveat').toLowerCase(); return FONTS[k] ? k : 'caveat'; }

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

const PAPER_ALIAS = { glatt: 'plain', plain: 'plain', liniert: 'lined', lined: 'lined', kariert: 'grid', grid: 'grid' };
const PENS = { black: null, schwarz: null, blue: '#1b3f9c', blau: '#1b3f9c', red: '#c0392b', rot: '#c0392b', green: '#1e6b3a', gruen: '#1e6b3a', grün: '#1e6b3a' };
const LINE_COLOR = 'rgba(0,0,0,0.14)';

export async function renderZettel({ text, color = 'yellow', font = 'caveat', fastener = 'tape', fastenerColor, fastenerPattern, fastenerDesign, paper = 'plain', pen = 'black', fontScale = 100, list = 'none', w = 2360, h = 2360 }) {
  w = Math.max(200, Math.min(6000, Math.round(w)));
  h = Math.max(200, Math.min(6000, Math.round(h)));
  const layoutName = h / w < 1.6 ? 'tablet' : 'phone';
  const layout = LAYOUTS[layoutName](w, h);
  const c = COLORS[normalizeColor(color)];
  const paperKind = PAPER_ALIAS[String(paper || 'plain').toLowerCase()] || 'plain';
  const penKey = String(pen || 'black').toLowerCase(), ink = (penKey in PENS ? PENS[penKey] : null) || c.ink;
  const fontKey = normalizeFont(font), F = FONTS[fontKey], { data: fontData, widths } = loadFont(fontKey);
  const kind = normalizeFastener(fastener);
  const look = normalizeLook(kind, { color: fastenerColor, pattern: fastenerPattern, design: fastenerDesign });
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
  const inset = Math.round(pad * (Fx.FASTENER_INSET[kind] || 0));
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

  // Eigenes Bild-Motiv auf dem Magneten: als eigenes <img> rund beschnitten über der Scheibe, Randglanz darüber
  const motif = kind === 'magnet' ? Fx.motifSrc(look.design) : null;
  const motifNodes = [];
  // Bildmagnet: das Bild (PNG aus lib/motifs/, resvg kann kein WebP) über einem weichen Schatten
  const photo = kind === 'photo' ? Fx.photoInfo(look.decor) : null;
  if (photo) {
    const g = Fx.magnetGeometry(noteW, noteH, pad), size = Math.round(g.r * 2), x = Math.round(g.cx - g.r), y = Math.round(g.cy - g.r);
    const pngData = 'data:image/png;base64,' + readFileSync(path.join(process.cwd(), 'lib', 'motifs', photo.png)).toString('base64'); // (fs ist hier die Schriftgröße)
    motifNodes.push({ type: 'div', props: { style: { position: 'absolute', left: x + size * 0.03, top: y + size * 0.07, width: size * 0.94, height: size * 0.94, borderRadius: size * 0.14, background: 'rgba(0,0,0,0.28)' } } });
    motifNodes.push({ type: 'img', props: { src: pngData, width: size, height: size, style: { position: 'absolute', left: x, top: y, width: size, height: size, objectFit: 'contain' } } });
  }
  if (motif) {
    const g = Fx.magnetGeometry(noteW, noteH, pad), d = Math.round(g.r * 2);
    motifNodes.push({ type: 'div', props: { style: { position: 'absolute', left: Math.round(g.cx - g.r), top: Math.round(g.cy - g.r), width: d, height: d, borderRadius: '50%', overflow: 'hidden', display: 'flex' },
      children: [{ type: 'img', props: { src: motif, width: d, height: d, style: { width: d, height: d, objectFit: 'cover' } } }] } });
    motifNodes.push({ type: 'svg', props: { xmlns: 'http://www.w3.org/2000/svg', viewBox: `${-m} ${-m} ${noteW + 2 * m} ${noteH + 2 * m}`, width: noteW + 2 * m, height: noteH + 2 * m,
      style: { position: 'absolute', left: -m, top: -m }, children: parseSvgFragment(Fx.magnetGlint(noteW, noteH, pad)) } });
  }
  const fastenerSvg = { type: 'svg', props: {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: `${-m} ${-m} ${noteW + 2 * m} ${noteH + 2 * m}`,
    width: noteW + 2 * m, height: noteH + 2 * m,
    style: { position: 'absolute', left: -m, top: -m },
    children: parseSvgFragment(Fx.fastenerShapes(kind, noteW, noteH, pad, look)),
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
          // Linien/Karos: Abstand = Zeilenhöhe, Linie knapp unter der Grundlinie
          ...(paperKind === 'plain' ? [] : [(() => {
            const lh = fs * F.lh, y0 = pad + inset + 0.95 * lh, lw = Math.max(1, Math.round(noteW / 470)), ls = [];
            for (let y = y0 - Math.floor(y0 / lh) * lh; y < noteH; y += lh) ls.push({ type: 'line', props: { x1: 0, y1: y, x2: noteW, y2: y, stroke: LINE_COLOR, 'stroke-width': lw } });
            if (paperKind === 'grid') for (let x = pad - Math.floor(pad / lh) * lh; x < noteW; x += lh) ls.push({ type: 'line', props: { x1: x, y1: 0, x2: x, y2: noteH, stroke: LINE_COLOR, 'stroke-width': lw } });
            return { type: 'svg', props: { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${noteW} ${noteH}`, width: noteW, height: noteH, style: { position: 'absolute', left: 0, top: 0 }, children: ls } };
          })()]),
          // Ein Block pro Absatz; Listenpunkte als Zeile [Markierung | Text] → hängender Einzug
          { type: 'div', props: { style: {
            width: textW, display: 'flex', flexDirection: 'column',
            fontFamily: 'Note', fontSize: fs, lineHeight: F.lh, color: ink,
          }, children: text.split('\n').map(para => {
            const m = para.match(PREFIX_RE);
            const body = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
            if (!m) return { type: 'div', props: { style: { ...body, width: textW, minHeight: fs * F.lh }, children: para || ' ' } };
            const indent = Math.ceil(indentOf(widths, para, fs));
            return { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', width: textW }, children: [
              { type: 'div', props: { style: { width: indent, flexShrink: 0, whiteSpace: 'pre' }, children: m[0] } },
              { type: 'div', props: { style: { ...body, width: textW - indent }, children: para.slice(m[0].length) } },
            ] } };
          }) } },
          fastenerSvg,
          ...motifNodes,
        ] } },
      ],
    },
  };

  const svg = await satori(tree, { width: w, height: h, fonts: [
    { name: 'Note', data: fontData, weight: F.weight, style: 'normal' },
    { name: 'Symbols', data: loadSymbols().data, weight: 400, style: 'normal' },
  ] });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
  return { png: Buffer.from(png), svg, w, h, layout: layoutName, fontSize: fs, lines, font: fontKey, fastener: kind };
}
