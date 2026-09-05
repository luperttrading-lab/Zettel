// Befestigungen: Zeichnung, Farben, Muster und Motive – EINE Quelle für App (index.html) und Server (lib/render.js).
// Läuft als klassisches Browser-Skript (globalThis.ZettelFasteners) und als CommonJS-Modul (module.exports).
//
// Koordinaten: Zettel-System, 0/0 = linke obere Ecke des Zettels, W/H = Zettelmaße, p = Innenabstand.
// Grundformen sind in Einheiten von s gezeichnet (Ursprung im Kopf der Befestigung).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.ZettelFasteners = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FASTENERS = {
    tape:      { label: 'Klebestreifen', short: 'Streifen' },
    tape2:     { label: 'Zwei Streifen', short: 'Ecken' },
    thumbtack: { label: 'Reißzwecke',    short: 'Zwecke' },
    pushpin:   { label: 'Pinnadel',      short: 'Pinnadel' },
    pin:       { label: 'Nadel',         short: 'Nadel' },
    pin2:      { label: 'Zwei Nadeln',   short: '2 Nadeln' },
    clip:      { label: 'Büroklammer',   short: 'Klammer' },
    magnet:    { label: 'Magnet',        short: 'Magnet' },
  };
  const FASTENER_ALIAS = { klebestreifen: 'tape', streifen: 'tape', zwei: 'tape2', ecken: 'tape2', reisszwecke: 'thumbtack', reißzwecke: 'thumbtack', zwecke: 'thumbtack', pinnadel: 'pushpin', nadel: 'pin', nadeln: 'pin2', klammer: 'clip', bueroklammer: 'clip', büroklammer: 'clip', magnet: 'magnet' };
  // Wie weit die Befestigung ins Papier ragt (Vielfaches von p): darunter beginnt erst der Text
  const FASTENER_INSET = { tape: 0, tape2: 0, thumbtack: 0.6, pushpin: 0.9, pin: 0.7, pin2: 0.7, clip: 0, magnet: 1.1 };

  // Farben: main = Grundton, mid = heller, hi = Glanz, dark/darker = Schatten, tape = Streifenfarbe,
  // deco = Musterfarbe (halbtransparent), ink = Motivfarbe
  const LIGHT = { deco: 'rgba(0,0,0,.28)', ink: '#2a2a2e' }, DARK = { deco: 'rgba(255,255,255,.6)', ink: '#ffffff' };
  const FCOLORS = {
    red:    { label: 'Rot',     main: '#ff3b30', mid: '#ff5147', hi: '#ffa39d', dark: '#c8281f', darker: '#9c1e17', tape: '#ff3b30', ...DARK },
    blue:   { label: 'Blau',    main: '#2f7cf6', mid: '#4c90ff', hi: '#9cc4ff', dark: '#1f5fc4', darker: '#174a99', tape: '#2f7cf6', ...DARK },
    green:  { label: 'Grün',    main: '#34c759', mid: '#4fd370', hi: '#a8f0b8', dark: '#248f40', darker: '#1a6e31', tape: '#34c759', ...DARK },
    yellow: { label: 'Gelb',    main: '#ffcc00', mid: '#ffd633', hi: '#fff0a0', dark: '#cc9f00', darker: '#9a7800', tape: '#ffcc00', ...LIGHT },
    white:  { label: 'Silber',  main: '#d8d8de', mid: '#e8e8ec', hi: '#ffffff', dark: '#9a9aa2', darker: '#7a7a82', tape: '#ffffff', ...LIGHT },
    black:  { label: 'Schwarz', main: '#3a3a40', mid: '#4a4a52', hi: '#8a8a94', dark: '#232327', darker: '#141416', tape: '#3a3a40', ...DARK },
  };
  const FCOLOR_ALIAS = { rot: 'red', blau: 'blue', gruen: 'green', grün: 'green', gelb: 'yellow', weiss: 'white', weiß: 'white', silber: 'white', schwarz: 'black' };
  const FCOLOR_DEFAULT = { tape: 'white', tape2: 'white', thumbtack: 'red', pushpin: 'red', pin: 'red', pin2: 'red', clip: 'white', magnet: 'red' };

  // Muster (auf Streifen, Köpfen, Kappen, Magnet; Klammer nur Streifen/Punkte) und Motive (nur Magnet)
  const PATTERNS = { none: 'Einfarbig', stripes: 'Streifen', dots: 'Punkte', checks: 'Karo' };
  const PATTERN_ALIAS = { einfarbig: 'none', ohne: 'none', streifen: 'stripes', gestreift: 'stripes', punkte: 'dots', gepunktet: 'dots', karo: 'checks', kariert: 'checks' };
  const PATTERN_SUPPORT = { tape: ['stripes', 'dots', 'checks'], tape2: ['stripes', 'dots', 'checks'], thumbtack: ['stripes', 'dots', 'checks'], pushpin: ['stripes', 'dots', 'checks'], pin: ['stripes', 'dots', 'checks'], pin2: ['stripes', 'dots', 'checks'], clip: ['stripes', 'dots'], magnet: ['stripes', 'dots', 'checks'] };
  const DESIGNS = { none: 'Ohne', smiley: 'Smiley', heart: 'Herz', star: 'Stern', paw: 'Pfote', flower: 'Blume', sun: 'Sonne' };
  const DESIGN_ALIAS = { ohne: 'none', herz: 'heart', stern: 'star', pfote: 'paw', blume: 'flower', sonne: 'sun' };
  const DESIGN_SUPPORT = { magnet: Object.keys(DESIGNS).filter(k => k !== 'none') };

  function normalizeFastener(f) { const k = String(f || 'tape').toLowerCase(); return FASTENERS[k] ? k : (FASTENER_ALIAS[k] || 'tape'); }
  // „Dekor“ = eine Wahl aus Mustern und Motiven (schließen sich gegenseitig aus); Farbe kommt dazu.
  const DECOR_LABEL = { ...PATTERNS, ...DESIGNS, none: 'Einfarbig' };
  function decorsFor(kind) { return ['none', ...(PATTERN_SUPPORT[kind] || []), ...(DESIGN_SUPPORT[kind] || [])]; }
  // Aussehen einer Befestigung: { color, decor } (auch alt: { color, pattern, design }); unpassende Werte → Standard.
  // Ergebnis enthält zusätzlich pattern/design für die Zeichnung.
  function normalizeLook(kind, look) {
    const l = look || {};
    const c = String(l.color || '').toLowerCase();
    const color = FCOLORS[c] ? c : (FCOLOR_ALIAS[c] || FCOLOR_DEFAULT[kind] || 'red');
    let decor = String(l.decor || '').toLowerCase();
    if (!decor) { // alte Form: Motiv hat Vorrang vor Muster
      const d = String(l.design || '').toLowerCase(), p = String(l.pattern || '').toLowerCase();
      const dd = DESIGNS[d] ? d : (DESIGN_ALIAS[d] || 'none'), pp = PATTERNS[p] ? p : (PATTERN_ALIAS[p] || 'none');
      decor = dd !== 'none' ? dd : pp;
    } else if (!DECOR_LABEL[decor]) decor = PATTERN_ALIAS[decor] || DESIGN_ALIAS[decor] || 'none';
    if (!decorsFor(kind).includes(decor)) decor = 'none';
    const pattern = PATTERNS[decor] && decor !== 'none' ? decor : 'none';
    const design = DESIGNS[decor] && decor !== 'none' ? decor : 'none';
    return { color, decor, pattern, design };
  }
  const lookKey = look => `${look.color}/${look.decor}`;

  // ---------- Zeichnung ----------
  let seq = 0;
  const uid = () => 'zp' + (++seq).toString(36);
  // Musterkachel (Kantenlänge t) im Koordinatensystem der Form; liefert defs-Markup und die Füllung
  function pattern(key, deco, t, rot) {
    if (!key || key === 'none') return { defs: '', fill: null };
    const id = uid();
    let body;
    if (key === 'stripes') body = `<rect x="0" y="0" width="${t / 2}" height="${t}" fill="${deco}"/>`;
    else if (key === 'dots') body = `<circle cx="${t / 2}" cy="${t / 2}" r="${t * 0.22}" fill="${deco}"/>`;
    else body = `<rect x="0" y="0" width="${t / 2}" height="${t / 2}" fill="${deco}"/><rect x="${t / 2}" y="${t / 2}" width="${t / 2}" height="${t / 2}" fill="${deco}"/>`;
    const defs = `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${t}" height="${t}"${key === 'stripes' ? ` patternTransform="rotate(${rot == null ? 45 : rot})"` : ''}>${body}</pattern></defs>`;
    return { defs, fill: `url(#${id})` };
  }
  // Motiv auf dem Magneten (Einheitskoordinaten, Scheibe r ≈ 0,62 um 0/0)
  function design(key, ink, base) {
    switch (key) {
      case 'smiley': return `<circle cx="-0.2" cy="-0.16" r="0.075" fill="${ink}"/><circle cx="0.2" cy="-0.16" r="0.075" fill="${ink}"/><path d="M-0.3,0.1 Q0,0.42 0.3,0.1" fill="none" stroke="${ink}" stroke-width="0.07" stroke-linecap="round"/>`;
      case 'heart':  return `<path d="M0,0.34 C-0.52,0 -0.38,-0.42 0,-0.18 C0.38,-0.42 0.52,0 0,0.34 Z" fill="${ink}"/>`;
      case 'star':   return `<polygon points="0,-0.44 0.13,-0.14 0.44,-0.14 0.19,0.06 0.28,0.37 0,0.19 -0.28,0.37 -0.19,0.06 -0.44,-0.14 -0.13,-0.14" fill="${ink}"/>`;
      case 'paw':    return `<ellipse cx="0" cy="0.14" rx="0.21" ry="0.17" fill="${ink}"/><circle cx="-0.26" cy="-0.08" r="0.085" fill="${ink}"/><circle cx="-0.1" cy="-0.25" r="0.085" fill="${ink}"/><circle cx="0.1" cy="-0.25" r="0.085" fill="${ink}"/><circle cx="0.26" cy="-0.08" r="0.085" fill="${ink}"/>`;
      case 'flower': return [0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="0" cy="-0.3" rx="0.11" ry="0.17" fill="${ink}" transform="rotate(${a})"/>`).join('') + `<circle cx="0" cy="0" r="0.12" fill="${ink}"/><circle cx="0" cy="0" r="0.07" fill="${base}"/>`;
      case 'sun':    return `<circle cx="0" cy="0" r="0.2" fill="${ink}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="-0.035" y="-0.46" width="0.07" height="0.15" rx="0.035" fill="${ink}" transform="rotate(${a})"/>`).join('');
      default:       return '';
    }
  }

  const SHAPE = {
    // Klebestreifen: halbtransparent, oben ein hellerer Saum; Muster in Streifen-Koordinaten
    tape: (cx, cy, w, h, deg, c, pat) => {
      const P = pattern(pat, c.deco, h * 0.55, 45);
      return `<g transform="rotate(${deg} ${cx} ${cy})">${P.defs}<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${c.tape}" fill-opacity=".55"/>`
        + (P.fill ? `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${P.fill}"/>` : '')
        + `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h * 0.12}" fill="#fff" fill-opacity=".25"/></g>`;
    },
    thumbtack: (cx, cy, s, deg, c, pat) => {
      const P = pattern(pat, c.deco, 0.3);
      return `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})">${P.defs}
        <rect x="-0.06" y="0.55" width="0.12" height="0.7" rx="0.06" fill="#d0d0d6"/><rect x="-0.06" y="0.55" width="0.05" height="0.7" fill="#9a9aa2"/>
        <rect x="-0.24" y="0.18" width="0.48" height="0.42" rx="0.08" fill="${c.dark}"/>
        <ellipse cx="0" cy="0.12" rx="0.72" ry="0.44" fill="${c.dark}"/><ellipse cx="0" cy="0" rx="0.72" ry="0.44" fill="${c.main}"/>
        <ellipse cx="0" cy="-0.04" rx="0.6" ry="0.32" fill="${c.mid}"/>${P.fill ? `<ellipse cx="0" cy="0" rx="0.72" ry="0.44" fill="${P.fill}"/>` : ''}
        <ellipse cx="-0.22" cy="-0.16" rx="0.24" ry="0.12" fill="${c.hi}" fill-opacity=".75"/></g>`;
    },
    pin: (cx, cy, s, deg, c, pat) => {
      const P = pattern(pat, c.deco, 0.24);
      return `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})">${P.defs}
        <rect x="-0.05" y="0.3" width="0.1" height="1.5" rx="0.05" fill="#d8d8de"/><rect x="-0.05" y="0.3" width="0.04" height="1.5" fill="#9a9aa2"/>
        <circle cx="0" cy="0" r="0.5" fill="${c.main}"/>${P.fill ? `<circle cx="0" cy="0" r="0.5" fill="${P.fill}"/>` : ''}<circle cx="-0.16" cy="-0.18" r="0.16" fill="${c.hi}" fill-opacity=".8"/>
        <ellipse cx="0.1" cy="0.32" rx="0.34" ry="0.14" fill="#000" fill-opacity=".18"/></g>`;
    },
    // Büroklammer: Muster als Strichelung des hellen Drahts (Zuckerstangen-Streifen bzw. Punkte)
    clip: (cx, cy, s, deg, c, pat) => {
      const dash = pat === 'stripes' ? ' stroke-dasharray="0.14 0.14"' : pat === 'dots' ? ' stroke-dasharray="0.001 0.2"' : '';
      return `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-0.3,1.5 V-0.9 a0.3,0.3 0 0 1 0.6,0 V1.6 a0.45,0.45 0 0 1 -0.9,0 V-0.4" stroke="${c.darker}" stroke-width="0.13"/>
        <path d="M-0.3,1.5 V-0.9 a0.3,0.3 0 0 1 0.6,0 V1.6 a0.45,0.45 0 0 1 -0.9,0 V-0.4" stroke="${c.main}" stroke-width="0.08"${dash}/></g>`;
    },
    // Magnet: flache Scheibe, nur ein schmaler Glanz am oberen Rand (kein Glanzfleck auf der Fläche)
    magnet: (cx, cy, s, c, pat, des) => {
      const P = pattern(pat, c.deco, 0.3);
      const D = design(des, c.ink, c.main);
      return `<g transform="translate(${cx} ${cy}) scale(${s})">${P.defs}
        <circle cx="0" cy="0.08" r="0.72" fill="#000" fill-opacity=".25"/><circle cx="0" cy="0" r="0.7" fill="${c.dark}"/>
        <circle cx="0" cy="-0.04" r="0.62" fill="${c.main}"/>${P.fill ? `<circle cx="0" cy="-0.04" r="0.62" fill="${P.fill}"/>` : ''}
        ${D ? `<g transform="translate(0 -0.04)">${D}</g>` : `<circle cx="0" cy="-0.04" r="0.3" fill="${c.dark}"/>`}
        <path d="M-0.5,-0.3 A0.56,0.56 0 0 1 -0.12,-0.58" fill="none" stroke="${c.hi}" stroke-opacity=".8" stroke-width="0.05" stroke-linecap="round"/></g>`;
    },
    // Pinnadel: flache Kappe, Schaft, breiter Fuß, Nadel (Ursprung = Mitte der Kappenoberseite)
    pushpin: (cx, cy, s, deg, c, pat) => {
      const P = pattern(pat, c.deco, 0.24);
      return `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${s})">${P.defs}
        <ellipse cx="0.12" cy="1.0" rx="0.64" ry="0.17" fill="#000" fill-opacity=".18"/>
        <rect x="-0.04" y="0.9" width="0.08" height="0.5" rx="0.04" fill="#d8d8de"/><rect x="-0.04" y="0.9" width="0.03" height="0.5" fill="#9a9aa2"/>
        <ellipse cx="0" cy="0.93" rx="0.56" ry="0.2" fill="${c.darker}"/><rect x="-0.56" y="0.85" width="1.12" height="0.08" fill="${c.darker}"/><ellipse cx="0" cy="0.85" rx="0.56" ry="0.2" fill="${c.main}"/>
        <rect x="-0.2" y="0.1" width="0.4" height="0.78" fill="${c.dark}"/><rect x="-0.2" y="0.1" width="0.13" height="0.78" fill="${c.mid}" fill-opacity=".55"/>
        <ellipse cx="0" cy="0.14" rx="0.5" ry="0.25" fill="${c.darker}"/><rect x="-0.5" y="0" width="1" height="0.14" fill="${c.dark}"/><ellipse cx="0" cy="0" rx="0.5" ry="0.25" fill="${c.main}"/>
        ${P.fill ? `<ellipse cx="0" cy="0" rx="0.5" ry="0.25" fill="${P.fill}"/>` : ''}
        <ellipse cx="-0.16" cy="-0.07" rx="0.17" ry="0.08" fill="${c.hi}" fill-opacity=".8"/></g>`;
    },
  };
  // Zweite Nadel bei „Zwei Nadeln“: Gegenfarbe zur gewählten
  const partner = key => FCOLORS[key === 'red' ? 'blue' : 'red'];

  // Befestigung auf dem Zettel (W × H, Innenabstand p)
  function fastenerShapes(kind, W, H, p, look) {
    const { tape, thumbtack, pin, clip, magnet, pushpin } = SHAPE;
    const L = normalizeLook(kind, look), c = FCOLORS[L.color], pat = L.pattern;
    switch (kind) {
      case 'tape2':     return tape(p * 0.7, p * 0.7, W * 0.24, p * 0.8, -45, c, pat) + tape(W - p * 0.7, p * 0.7, W * 0.24, p * 0.8, 45, c, pat); // über die Ecken, etwas ins Papier
      case 'thumbtack': return thumbtack(W / 2, -p * 0.12, p * 1.05, -10, c, pat); // Kopf ragt über die Oberkante
      case 'pushpin':   return pushpin(W / 2, -p * 0.75, p * 1.7, -12, c, pat);
      case 'pin':       return pin(W / 2 - p * 0.35, -p * 0.35, p * 1.25, -28, c, pat);
      case 'pin2':      return pin(W * 0.14, -p * 0.25, p * 1.1, -35, c, pat) + pin(W * 0.86, -p * 0.25, p * 1.1, 35, partner(L.color), pat);
      case 'clip':      return clip(W * 0.86, p * 0.15, p * 0.95, -8, c, pat);
      case 'magnet':    return magnet(W / 2, p * 0.3, p * 2.1, c, pat, L.design); // doppelt so groß wie die Nadelköpfe, ragt über die Kante
      default:          return tape(W / 2, 0, W * 0.26, p * 0.9, 1, c, pat);
    }
  }
  // Symbol für die Auswahl: nur die Befestigung, groß, ohne Papier (Zeichenfläche 60×40)
  function fastenerIcon(kind, look) {
    const { tape, thumbtack, pin, clip, magnet, pushpin } = SHAPE;
    const L = normalizeLook(kind, look), c = FCOLORS[L.color], pat = L.pattern;
    let s;
    switch (kind) {
      case 'tape2':     s = tape(17, 20, 28, 11, -45, c, pat) + tape(43, 20, 28, 11, 45, c, pat); break;
      case 'thumbtack': s = thumbtack(30, 11, 15, -10, c, pat); break;
      case 'pushpin':   s = pushpin(30, 6, 14, -12, c, pat); break;
      case 'pin':       s = pin(30, 11, 13, -28, c, pat); break;
      case 'pin2':      s = pin(19, 11, 12, -35, c, pat) + pin(41, 11, 12, 35, partner(L.color), pat); break;
      case 'clip':      s = clip(30, 14, 11, -8, c, pat); break;
      case 'magnet':    s = magnet(30, 20, 18, c, pat, L.design); break;
      default:          s = tape(30, 20, 46, 14, -3, c, pat);
    }
    return `<svg viewBox="0 0 60 40" aria-hidden="true">${s}</svg>`;
  }
  // Overlay-SVG: deckt den Zettel plus Rand m ab, damit überstehende Teile (Nadelkopf, Klammer) Platz haben
  function fastenerSvg(kind, W, H, p, look) {
    const m = p * 2.2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${W + 2 * m} ${H + 2 * m}" width="${W + 2 * m}" height="${H + 2 * m}">${fastenerShapes(kind, W, H, p, look)}</svg>`;
  }

  return { FASTENERS, FASTENER_INSET, FCOLORS, FCOLOR_DEFAULT, PATTERNS, PATTERN_SUPPORT, DESIGNS, DESIGN_SUPPORT, DECOR_LABEL, decorsFor,
    normalizeFastener, normalizeLook, lookKey, fastenerShapes, fastenerIcon, fastenerSvg };
});
