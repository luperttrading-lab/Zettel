// Rendert den Zettel als PNG – serverseitig, damit ein Kurzbefehl ihn per URL abholen kann.
// Gleiche Layout-Logik wie in index.html: Telefon = Hochformat, Tablet = Quadrat mit Zettel in der
// Zone, die in beiden Ausrichtungen sichtbar und unterhalb der Uhr liegt.
import fs from 'node:fs';
const { readFileSync } = fs;
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { grainDataUri } from './grain.js';

export const COLORS = {
  yellow: { paper: '#fff59b', ink: '#2a2a2e' },
  pink:   { paper: '#ffc7dd', ink: '#3a1f2a' },
  green:  { paper: '#c9f2c4', ink: '#1d3320' },
  blue:   { paper: '#c5e4ff', ink: '#1a2a3d' },
};
// Deutsche Aliase, damit der Kurzbefehl auch „gelb“ schicken darf
const ALIAS = { gelb: 'yellow', rosa: 'pink', pink: 'pink', gruen: 'green', grün: 'green', blau: 'blue' };

// Schriften wie in index.html; Dateien liegen unter fonts/, Zeichenbreiten unter lib/.
// asc/desc = Ober-/Unterlänge (hhea) in em, gleiche Werte wie in index.html: satori legt die Grundlinie damit in den Zeilenkasten.
export const FONTS = {
  caveat:  { file: 'Caveat-500.ttf',          widths: 'caveat-widths.json',          weight: 500, lh: 1.15, asc: 0.960, desc: 0.300 },
  patrick: { file: 'PatrickHand-400.ttf',     widths: 'patrickhand-widths.json',     weight: 400, lh: 1.20, asc: 1.042, desc: 0.312 },
  kalam:   { file: 'Kalam-400.ttf',           widths: 'kalam-widths.json',           weight: 400, lh: 1.30, asc: 1.063, desc: 0.531 },
  marker:  { file: 'PermanentMarker-400.ttf', widths: 'permanentmarker-widths.json', weight: 400, lh: 1.25, asc: 1.109, desc: 0.317 },
  indie:   { file: 'IndieFlower-400.ttf',      widths: 'indie-widths.json',           weight: 400, lh: 1.25, asc: 0.971, desc: 0.488 },
  shadows: { file: 'ShadowsIntoLight-400.ttf', widths: 'shadows-widths.json',         weight: 400, lh: 1.30, asc: 1.175, desc: 0.432 },
  gloria:  { file: 'GloriaHallelujah-400.ttf', widths: 'gloria-widths.json',          weight: 400, lh: 1.35, asc: 1.405, desc: 0.577 },
};
// Befestigungen (Zeichnung, Farben, Muster, Motive): dieselbe Datei wie in der App (klassisches Skript, hier per Function geladen)
const Fx = (() => { const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'fasteners.js'), 'utf8'); const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; })();
try { const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'motifs.js'), 'utf8'); const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); Fx.setMotifs(m.exports); } catch (_) { /* keine eigenen Motive */ }
// Papier (abgerissene Kante): gleiche Geometrie wie in der App
const Paper = (() => { const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'paper.js'), 'utf8'); const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; })();
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
// Terminliste – gleiche Regel wie in index.html: der vordere Block (Wochentag, Datum, Uhrzeit, mindestens
// eines davon) wird erkannt und übernimmt die Rolle der Listenmarkierung; alle Blöcke teilen sich eine
// Spaltenbreite, damit die Uhrzeiten untereinander stehen.
const TAGE = 'Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag|heute|morgen|übermorgen';
const TERMIN_RE = new RegExp('^((?:(?:' + TAGE + ')\\.?)?(?:\\s*\\d{1,2}\\.\\d{1,2}\\.(?:\\d{2,4})?)?(?:\\s*\\d{1,2}[:.]\\d{2}(?:\\s*Uhr)?)?)\\s+(?=\\S)', 'i');
// Ein Kopf **ohne** Ziffer zählt nicht, solange der Rumpf mit einer Ziffer beginnt: „Fr. 7“ ist eine halb
// getippte Uhrzeit, kein Terminkopf mit Rumpf „7“. Gleiche Regel in index.html.
function marke(line, list) {
  if (list === 'termin') {
    const m = TERMIN_RE.exec(line);
    if (!m || !m[1].trim()) return null;
    if (!/\d/.test(m[1]) && /^\d/.test(line.slice(m[0].length))) return null;
    return m;
  }
  return PREFIX_RE.exec(line);
}
function terminSpalte(table, text, fs, list) {
  if (list !== 'termin') return 0;
  let max = 0;
  for (const p of String(text).split('\n')) { const m = marke(p, list); if (m) max = Math.max(max, textWidth(table, m[0], fs)); }
  return max;
}
// „Erledigt“ – gleiche Regel wie in index.html: ☑ im Kasten, sonst ein Haken hinten plus Strich durch den Text.
const DONE_RE = /\s*✓$/;
const DONE = '✓';
const durchgestrichen = l => { const m = l.match(PREFIX_RE); return !!((m && m[1] === '☑') || DONE_RE.test(l)) && !(m && m[1] === '☑'); };
// Wortgrenzen: nur gewöhnliche Leerzeichen/Tabs – Markierung und erstes Wort bleiben zusammen
const WORD_SEP = /[ \t]+/;
export function applyList(text, mode, skipFirst = false) {
  if (!LIST_MARK[mode]) return text;
  let n = 0;
  if (mode === 'termin') return text;   // hier setzt niemand eine Markierung
  return text.split('\n').map((line, i) => { const had = PREFIX_RE.test(line); const bare = line.replace(PREFIX_RE, '');
    if (skipFirst && i === 0) return bare;                       // Überschrift trägt keine Listenmarkierung
    return (bare.trim() === '' && !had) ? bare : LIST_MARK[mode](n++) + bare; }).join('\n');
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
function indentOf(table, para, fs, list, spalte) {
  const m = marke(para, list);
  return m ? (spalte || textWidth(table, m[0], fs)) : 0;
}
// Greedy-Umbruch wie in index.html – nur zur Wahl der Schriftgröße; den echten Umbruch macht satori.
// Folgezeilen eines Listenpunkts sind um den Einzug schmaler (hängender Einzug).
// titleFs: Schriftgröße des ersten Absatzes (Überschrift), sonst fs. Rückgabe: { n, t } –
// t sind die Zeilen der Überschrift, die höher zählen als die übrigen.
function estimateLines(table, text, fs, maxW, titleFs = 0, list = 'none') {
  const spalte = terminSpalte(table, text, fs, list);
  let n = 0, t = 0;
  text.split('\n').forEach((para, pi) => {
    const size = (titleFs && pi === 0) ? titleFs : fs;
    const space = textWidth(table, ' ', size);
    const vor = n;
    if (!para.trim()) { n += 1; if (titleFs && pi === 0) t += n - vor; return; }
    // Markierung steht links neben dem eingerückten Textblock: alle Zeilen des Punkts sind maxW - indent breit
    const indent = indentOf(table, para, size, list, spalte), limit = maxW - indent;
    const mm = marke(para, list), body = mm ? para.slice(mm[0].length) : para;
    let line = 0;
    for (const c of chunksOf(body)) {
      const wl = textWidth(table, c.s, size), gap = c.sep ? space : 0;
      if (line === 0) line = wl;
      else if (line + gap + wl <= limit) line += gap + wl;
      else { n += 1; line = wl; }
      while (line > limit) { n += 1; line -= limit; }
    }
    n += 1;
    if (titleFs && pi === 0) t += n - vor;
  });
  return { n, t };
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
const TEXTURE_ALIAS = { glatt: 'smooth', smooth: 'smooth', koernig: 'grain', körnig: 'grain', grain: 'grain' };
const EDGE_ALIAS = { gerade: 'straight', straight: 'straight', abgerissen: 'torn', torn: 'torn' };
const GRAIN_PX = 450;   // ein Korn = Zettelbreite / 450, wie in der App
const PENS = { black: null, schwarz: null, blue: '#1b3f9c', blau: '#1b3f9c', red: '#c0392b', rot: '#c0392b', green: '#1e6b3a', gruen: '#1e6b3a', grün: '#1e6b3a' };
const LINE_COLOR = 'rgba(0,0,0,0.14)';

export async function renderZettel({ text, color = 'yellow', font = 'caveat', fastener = 'tape', fastenerPos, fastenerVier, fastenerColor, fastenerPattern, fastenerDesign, paper = 'plain', pen = 'black', texture = 'smooth', edge = 'straight', fontScale = 100, list = 'none', title = false, titleSize = 1, noteScale, noteX, noteY, bg = 'dark', w = 2360, h = 2360 }) {
  w = Math.max(200, Math.min(6000, Math.round(w)));
  h = Math.max(200, Math.min(6000, Math.round(h)));
  const layoutName = h / w < 1.6 ? 'tablet' : 'phone';
  const layout = LAYOUTS[layoutName](w, h);
  const c = COLORS[normalizeColor(color)];
  const paperKind = PAPER_ALIAS[String(paper || 'plain').toLowerCase()] || 'plain';
  const textureKind = TEXTURE_ALIAS[String(texture || 'smooth').toLowerCase()] || 'smooth';
  const edgeKind = EDGE_ALIAS[String(edge || 'straight').toLowerCase()] || 'straight';
  const penKey = String(pen || 'black').toLowerCase(), ink = (penKey in PENS ? PENS[penKey] : null) || c.ink;
  const fontKey = normalizeFont(font), F = FONTS[fontKey], { data: fontData, widths } = loadFont(fontKey);
  const kind = normalizeFastener(fastener);
  const look = normalizeLook(kind, { color: fastenerColor, pattern: fastenerPattern, design: fastenerDesign });
  const scale = Math.max(60, Math.min(140, Number(fontScale) || 100)) / 100;
  const titleOn = title === true || /^(1|an|on|ja|true|yes)$/i.test(String(title || ''));
  const TITLE_F = { 1: 1, 2: 1.25, 3: 1.55 };          // gleiche Faktoren wie in index.html
  const tSize = [1, 2, 3].includes(Number(titleSize)) ? Number(titleSize) : 1;
  const tF = titleOn ? TITLE_F[tSize] : 1;
  text = applyList(String(text || '').replace(/\r/g, '').replace(/\s+$/, ''), String(list || 'none').toLowerCase(), titleOn) || '…';

  // Lage und Größe wie in index.html: noteScale ist ein Faktor auf die Layoutbreite, nx/ny sind Anteile des Bildes
  const klemm = (v, a, b) => Math.max(a, Math.min(b, v));
  const nScale = Number.isFinite(+noteScale) ? klemm(+noteScale, 0.55, 1.15) : 1;
  const nX = Number.isFinite(+noteX) ? klemm(+noteX, 0, 1) : 0.5;
  const nY = Number.isFinite(+noteY) ? klemm(+noteY, 0, 1) : layout.cy / h;
  const noteW = Math.round(layout.noteW * nScale);
  const pad = Math.round(noteW * 0.08);
  const textW = noteW - 2 * pad;

  // Wie in index.html: 1) kein Wort hart trennen, 2) Absätze möglichst einzeilig (bis noteW/16),
  // 3) Nutzer-Skalierung, 4) Höhe einhalten.
  const paras = text.split('\n');
  const longestWord = paras.flatMap(p => p.split(WORD_SEP)).reduce((a, b) => (textWidth(widths, b, 100) > textWidth(widths, a, 100) ? b : a), '');
  const minFs = noteW / 28, paraFloor = noteW / 16;
  let fs = Math.round(noteW / 7), lines;
  while (textWidth(widths, longestWord, fs) > textW && fs > minFs) fs = Math.round(fs * 0.94);
  const zeilen = f => estimateLines(widths, text, f, textW, titleOn ? Math.round(f * tF) : 0, list);
  let z = zeilen(fs); lines = z.n;
  // Die Überschrift zählt hier nicht mit: sie darf lieber umbrechen, als den ganzen Text zu verkleinern.
  const ueberzaehlig = () => (z.n - z.t) - (paras.length - (titleOn ? 1 : 0));
  while (ueberzaehlig() > 0 && fs > paraFloor) { fs = Math.round(fs * 0.95); z = zeilen(fs); lines = z.n; }
  // Feinsuche – **gleiche Regel wie fitNote in index.html**: die 5-%-Schritte schießen über und
  // verschenkten sichtbar Platz. Fehlt sie hier, weichen App und Server um 1–2 px in der Schriftgröße ab.
  const uVon = z2 => (z2.n - z2.t) - (paras.length - (titleOn ? 1 : 0));
  for (let i = 0; i < 8; i++) {
    const f2 = Math.round(fs * 1.01);
    if (f2 <= fs || textWidth(widths, longestWord, f2) > textW) break;
    const z2 = zeilen(f2);
    if (uVon(z2) > uVon(z)) break;
    fs = f2; z = z2; lines = z.n;
  }
  fs = Math.round(fs * scale);
  while (textWidth(widths, longestWord, fs) > textW && fs > minFs) fs = Math.round(fs * 0.94);
  z = zeilen(fs); lines = z.n;
  // Feste Zettelgröße wie in index.html: quadratisch, höchstens die Maximalhöhe des Layouts
  const noteH = Math.round(Math.min(noteW, layout.maxNoteH));
  // Mehrere Befestigungen derselben Sorte: fpos=x,y[,farbe];x,y[,farbe] in Prozent der Zettelbreite.
  // Ohne fpos bleibt es bei einer am Standardplatz – so sehen ältere Aufrufe unverändert aus.
  const befListe = (String(fastenerPos || '').split(';').map(t => t.trim()).filter(Boolean).map(t => {
    const [px, py, farbe] = t.split(',').map(v => v.trim());
    const x = parseFloat(px), y = parseFloat(py);
    if (!isFinite(x) || !isFinite(y)) return null;
    const q = Fx.fastenerPlace(kind, x / 100 * noteW, y / 100 * noteW, noteW, noteH, pad);
    return { art: kind, x: q.x, y: q.y, vier: !!fastenerVier, ...(farbe ? { color: Fx.FCOLORS[farbe] ? farbe : undefined } : {}) };
  }).filter(Boolean)).slice(0, Fx.FASTENER_MAX[kind] || 1);
  if (!befListe.length) befListe.push({ art: kind, vier: !!fastenerVier });
  // Nur was oben an der Kante sitzt, drückt den Text nach unten – dieselbe Funktion nutzt die App.
  const inset = Math.round(pad * Fx.fastenerInset(befListe, noteW, noteH, pad));
  const TITLE_GAP = 0.28;              // em unter der Überschrift, gleicher Wert wie im CSS von index.html
  // Linienraster wie fitNote in index.html: auf liniertem/kariertem Papier belegt jede Überschriftzeile **eine**
  // Linienzeile ohne Abstand darunter und ragt mit der größeren Schrift nach oben über sie hinaus;
  // glattes Papier wie bisher (1,55 Zeilen plus Abstand)
  const raster = titleOn && paperKind !== 'plain' ? 1 : 0;
  const ueberOf = f => (raster ? (tF - 1) * (F.lh + F.asc - F.desc) / 2 * f : 0);
  // Titelzeilen zählen mit dem größeren Faktor (bzw. einer Zeile im Raster), dazu der Abstand unter der Überschrift
  const hoehe = () => ((lines - z.t) + z.t * (raster || tF)) * fs * F.lh + (titleOn && !raster ? fs * tF * TITLE_GAP : 0);
  const passt = f => hoehe() + 2 * pad + inset <= noteH && ueberOf(f) <= pad + inset;   // auch: Überschrift bleibt im Papier
  while (!passt(fs) && fs > minFs) { fs = Math.round(fs * 0.92); z = zeilen(fs); lines = z.n; }
  for (let i = 0; i < 8; i++) {                       // auch hier fein nachziehen, wie in index.html
    const f2 = Math.round(fs * 1.01);
    if (f2 <= fs || textWidth(widths, longestWord, f2) > textW) break;
    const merk = { fs, z, lines }, z2 = zeilen(f2);
    fs = f2; z = z2; lines = z.n;                     // passt() liest z/lines aus dem Umfeld
    if (!passt(fs) || uVon(z2) > uVon(merk.z)) { fs = merk.fs; z = merk.z; lines = merk.lines; break; }
  }
  // overflow wie fitNote in index.html: auch in kleinster Schrift passt der Text nicht – das Bild schneidet ab
  const overflow = !passt(fs);
  const left = Math.round(klemm(w * nX, noteW / 2, w - noteW / 2) - noteW / 2);
  const top  = Math.round(klemm(h * nY, noteH / 2, h - noteH / 2) - noteH / 2);
  const m = pad * 2.2;
  // Lage der Überschrift: glatt = Abstand darunter; Linienraster = Block k·raster·lh, Text unten bündig, sodass die
  // Grundlinie auf der Grundlinie der letzten Rasterzeile liegt. b = (lh + asc − desc) / 2 · fs (wie index.html).
  let titelLage = { marginBottom: Math.round(fs * tF * TITLE_GAP) };
  if (raster) {
    const zh = fs * F.lh, k = Math.max(1, z.t), padTop = -ueberOf(fs);   // negativ: ragt über die eigene Zeile hinaus
    titelLage = { marginTop: Math.round(padTop), marginBottom: Math.round(k * raster * zh - padTop - k * tF * zh) };
  }

  // Schatten ohne Blur-Filter (Blur kostet in resvg bei 2360² über 40 s)
  // Bei abgerissener Kante folgen Schatten, Papier und Körnung derselben Form (clip-path)
  const torn = edgeKind === 'torn';
  const shadowLayers = [1, 2, 3, 4].map(k => ({ type: 'div', props: { style: {
    position: 'absolute', left: left - Math.round(w * 0.004 * k), top: top + Math.round(w * 0.006 * k),
    width: noteW + Math.round(w * 0.008 * k), height: noteH + Math.round(w * 0.008 * k),
    background: 'rgba(0,0,0,0.16)', transform: 'rotate(-2.5deg)',
    // path() mit Pixelkoordinaten: Prozentwerte in polygon() bezieht satori bei nicht quadratischen Zetteln falsch
    ...(torn ? { clipPath: `path('${Paper.pathD(noteW + Math.round(w * 0.008 * k), noteH + Math.round(w * 0.008 * k))}')` } : {}),
  } } }));
  // Körnung: zufälliges Rauschen in Kornauflösung, auf Zettelgröße gestreckt
  const grainNode = textureKind === 'grain' ? [{ type: 'img', props: {
    src: grainDataUri(GRAIN_PX, Math.round(GRAIN_PX * noteH / noteW), 26, 7), width: noteW, height: noteH,
    style: { position: 'absolute', left: 0, top: 0, width: noteW, height: noteH, objectFit: 'fill' },
  } }] : [];

  // Eigenes Bild-Motiv auf dem Magneten: als eigenes <img> rund beschnitten über der Scheibe, Randglanz darüber
  const motif = kind === 'magnet' ? Fx.motifSrc(look.design) : null;
  const motifNodes = [];
  // Bildmagnet: das Bild (PNG aus lib/motifs/, resvg kann kein WebP) über einem weichen Schatten
  const photo = kind === 'photo' ? Fx.photoInfo(look.decor) : null;
  // Bild und Motiv liegen als eigene Ebenen über der Scheibe – sie müssen dem Versatz jedes Stücks folgen.
  const home = Fx.fastenerHome(kind, noteW, noteH, pad);
  const versatz = befListe.map(b => ({ dx: Math.round((b.x ?? home.x) - home.x), dy: Math.round((b.y ?? home.y) - home.y) }));
  if (photo) {
    const g = Fx.magnetGeometry(noteW, noteH, pad), size = Math.round(g.r * 2), x = Math.round(g.cx - g.r), y = Math.round(g.cy - g.r);
    const pngData = 'data:image/png;base64,' + readFileSync(path.join(process.cwd(), 'lib', 'motifs', photo.png)).toString('base64'); // (fs ist hier die Schriftgröße)
    for (const v of versatz) {
      motifNodes.push({ type: 'div', props: { style: { position: 'absolute', left: x + v.dx + size * 0.03, top: y + v.dy + size * 0.07, width: size * 0.94, height: size * 0.94, borderRadius: size * 0.14, background: 'rgba(0,0,0,0.28)' } } });
      motifNodes.push({ type: 'img', props: { src: pngData, width: size, height: size, style: { position: 'absolute', left: x + v.dx, top: y + v.dy, width: size, height: size, objectFit: 'contain' } } });
    }
  }
  if (motif) {
    const g = Fx.magnetGeometry(noteW, noteH, pad), d = Math.round(g.r * 2);
    for (const v of versatz) {
      motifNodes.push({ type: 'div', props: { style: { position: 'absolute', left: Math.round(g.cx - g.r) + v.dx, top: Math.round(g.cy - g.r) + v.dy, width: d, height: d, borderRadius: '50%', overflow: 'hidden', display: 'flex' },
        children: [{ type: 'img', props: { src: motif, width: d, height: d, style: { width: d, height: d, objectFit: 'cover' } } }] } });
      motifNodes.push({ type: 'svg', props: { xmlns: 'http://www.w3.org/2000/svg', viewBox: `${-m} ${-m} ${noteW + 2 * m} ${noteH + 2 * m}`, width: noteW + 2 * m, height: noteH + 2 * m,
        style: { position: 'absolute', left: -m + v.dx, top: -m + v.dy }, children: parseSvgFragment(Fx.magnetGlint(noteW, noteH, pad)) } });
    }
  }
  const fastenerSvg = { type: 'svg', props: {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: `${-m} ${-m} ${noteW + 2 * m} ${noteH + 2 * m}`,
    width: noteW + 2 * m, height: noteH + 2 * m,
    style: { position: 'absolute', left: -m, top: -m },
    children: parseSvgFragment(Fx.fastenersShapes(befListe, noteW, noteH, pad, look)),
  } };

  // bg=transparent liefert ein PNG mit Alphakanal: nur Zettel und Schatten, kein Hintergrund.
  // Damit lässt sich der Zettel im Kurzbefehl über das vorhandene Hintergrundbild legen.
  const durchsichtig = /^(transparent|durchsichtig|keiner|keine|kein|none|ohne)$/i.test(String(bg || ''));
  const hintergrund = durchsichtig ? 'transparent' : 'linear-gradient(180deg, #1b1b1f 0%, #09090b 100%)';

  const tree = {
    type: 'div',
    props: {
      style: { width: w, height: h, display: 'flex', background: hintergrund, position: 'relative' },
      children: [
        ...shadowLayers,
        { type: 'div', props: { style: {
          position: 'absolute', left, top, width: noteW, height: noteH,
          display: 'flex', alignItems: 'flex-start',
          transform: 'rotate(-2.5deg)',
          paddingTop: pad + inset, paddingRight: pad, paddingBottom: pad, paddingLeft: pad,
        }, children: [
          // Papier als eigene Ebene (Farbe, Körnung, Linien) – nur diese wird bei abgerissener Kante beschnitten,
          // Befestigung und Motive ragen weiter über den Zettel hinaus
          { type: 'div', props: { style: {
            position: 'absolute', left: 0, top: 0, width: noteW, height: noteH, display: 'flex', background: c.paper,
            ...(torn ? { clipPath: `path('${Paper.pathD(noteW, noteH)}')` } : {}),
          }, children: [
            ...grainNode,
            // Linien/Karos: Abstand = Zeilenhöhe, Linie knapp unter der Grundlinie
            ...(paperKind === 'plain' ? [] : [(() => {
              const lh = fs * F.lh, y0 = pad + inset + 0.95 * lh, lw = Math.max(1, Math.round(noteW / 470)), ls = [];
              for (let y = y0 - Math.floor(y0 / lh) * lh; y < noteH; y += lh) ls.push({ type: 'line', props: { x1: 0, y1: y, x2: noteW, y2: y, stroke: LINE_COLOR, 'stroke-width': lw } });
              if (paperKind === 'grid') for (let x = pad - Math.floor(pad / lh) * lh; x < noteW; x += lh) ls.push({ type: 'line', props: { x1: x, y1: 0, x2: x, y2: noteH, stroke: LINE_COLOR, 'stroke-width': lw } });
              return { type: 'svg', props: { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${noteW} ${noteH}`, width: noteW, height: noteH, style: { position: 'absolute', left: 0, top: 0 }, children: ls } };
            })()]),
          ] } },
          // Ein Block pro Absatz; Listenpunkte als Zeile [Markierung | Text] → hängender Einzug
          { type: 'div', props: { style: {
            width: textW, display: 'flex', flexDirection: 'column',
            fontFamily: 'Note', fontSize: fs, lineHeight: F.lh, color: ink,
          }, children: text.split('\n').map((para, pi) => {
            const m = marke(para, list);
            const body = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
            const head = titleOn && pi === 0 ? { textDecoration: 'underline', fontSize: Math.round(fs * tF), ...titelLage } : {};
            const durch = durchgestrichen(para) ? { textDecoration: 'line-through' } : {};
            // Abweichung zur App, bewusst: dort steht der Haken größer und **außerhalb** des Strichs.
            // satori kann das nicht – ein <div> mit zwei Kindern verlangt display:flex, und ein Flex-Kind
            // bricht nicht mit dem Text um; der Haken landete bei langen Zeilen in einer eigenen Zeile und
            // die Zeilenzahl wiche von der App ab. Zeilenzahl schlägt Feinheit, darum bleibt er hier im Text.
            const inhalt = (t) => (t || ' ');
            if (!m) return { type: 'div', props: { style: { ...body, ...head, ...durch, width: textW, minHeight: fs * F.lh * (titleOn && pi === 0 ? tF : 1) }, children: inhalt(para) } };
            const indent = Math.ceil(indentOf(widths, para, titleOn && pi === 0 ? Math.round(fs * tF) : fs, list, terminSpalte(widths, text, fs, list)));
            return { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', width: textW, ...head }, children: [
              { type: 'div', props: { style: { width: indent, flexShrink: 0, whiteSpace: 'pre' }, children: m[0] } },
              { type: 'div', props: { style: { ...body, ...durch, width: textW - indent }, children: inhalt(para.slice(m[0].length)) } },
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
  return { png: Buffer.from(png), svg, w, h, layout: layoutName, fontSize: fs, lines, font: fontKey, fastener: kind, title: titleOn, titleSize: tSize, bg: durchsichtig ? 'transparent' : 'dark', overflow, raster };
}
