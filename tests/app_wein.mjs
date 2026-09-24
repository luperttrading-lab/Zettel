// Test 3.44 / 3.46: Weinglas und Kaffeetasse stehen auf dem Wasserzettel, zählen aber nicht zur Flüssigkeit.
// Auftraggeber: „Kannst du mir ein Weinglas zusätzlich dazu machen – das zählt dann aber nicht zur
// Flüssigkeit." Es ist eine Notiz, keine Menge: es wird gezeichnet, erscheint in seiner Zeile, geht
// aber weder in die Zeilensumme noch in „Heute" noch in die Säule ein.
//   node tests/app_wein.mjs   (lokaler Server auf 8766, siehe app_review.mjs)
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };

await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  state.list = 'wasser'; state.noteScale = 1; state.fontScale = 100; state.noteFit = true;
  state.wasser = { tag: heuteKennung(), v12: ['klein', 'klein'], v18: ['mittel'], n18: [], gestern: 2.1, soll: 3 };
  persist();
});
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);

const stand = () => page.evaluate(() => {
  const w = wasserStand();
  return { heute: Math.round(wasserTag(w) * 100) / 100, n18: Math.round(wasserSumme(w, 'n18') * 100) / 100,
           glaeser: (w.n18 || []).length, inhalt: zettelInhalt() };
});
const vorher = await stand();
check('Ausgangslage: 0,7 l, nach 18 Uhr nichts', vorher.heute === 0.7 && vorher.n18 === 0 && vorher.glaeser === 0, JSON.stringify(vorher));

// Der Knopf ist da und heißt „Wein"
const knopf = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#wasser-glaeser button, .wasser-glaeser button')]
    .find(x => x.textContent.trim() === 'Wein');
  return { da: !!b, titel: b ? b.title : '' };
});
check('Weinglas steht in der Glasleiste', knopf.da, JSON.stringify(knopf));

// Zwei Weingläser eintragen
await page.evaluate(() => { wasserFenster = 2; wasserDazu('wein'); wasserDazu('wein'); });
await page.waitForTimeout(300);
const nachher = await stand();
check('Die Weingläser stehen in ihrer Zeile', nachher.glaeser === 2, JSON.stringify(nachher));
check('… zählen aber nicht zur Zeilensumme', nachher.n18 === 0, `nach 18 Uhr: ${nachher.n18} l`);
check('… und nicht zur Tagesmenge', nachher.heute === vorher.heute, `${vorher.heute} → ${nachher.heute} l`);

// Ein Zettel mit **nur** Weingläsern gilt trotzdem als beschrieben – sonst spränge beim Kleben
// „Erst ein Glas eintragen", obwohl etwas draufsteht.
await page.evaluate(() => {
  state.wasser = { tag: heuteKennung(), v12: [], v18: [], n18: ['wein'], gestern: 0, soll: 3 };
  persist();
});
const nurWein = await stand();
check('Ein Zettel mit nur Wein gilt als beschrieben', nurWein.inhalt && nurWein.heute === 0, JSON.stringify(nurWein));

// Gezeichnet wird es trotzdem: das Bild unterscheidet sich von dem ohne Weinglas
const diff = await page.evaluate(async () => {
  const t = targetCanvas(); const px = {};
  for (const [name, n18] of [['ohne', []], ['mit', ['wein']]]) {
    state.wasser = { tag: heuteKennung(), v12: ['klein'], v18: [], n18, gestern: 0, soll: 3 };
    syncPreview();
    px[name] = (await renderWallpaper(t.w, t.h, t.layout, {})).getContext('2d').getImageData(0, 0, t.w, t.h).data;
  }
  let n = 0;
  for (let i = 0; i < px.ohne.length; i += 4) if (px.ohne[i] !== px.mit[i] || px.ohne[i + 1] !== px.mit[i + 1] || px.ohne[i + 2] !== px.mit[i + 2]) n++;
  return n;
});
check('Das Weinglas wird auch wirklich gezeichnet', diff > 500, `${diff} verschiedene Bildpunkte`);

// Die Höhe der übrigen Gläser darf sich durch das Weinglas nicht geändert haben (GLAS_INK)
const ink = await page.evaluate(() => ({ ink: Math.round(GLAS_INK * 100) / 100, hoechstes: Math.min(...Object.keys(GLAeSER).map(k => GLAeSER[k].y0)) }));
check('Das Weinglas verkleinert die anderen Gläser nicht', ink.hoechstes === -6, JSON.stringify(ink));

// ── 3.46: dieselbe Zusage für die Kaffeetasse ───────────────────────────────────────────────────
await page.evaluate(() => {
  state.wasser = { tag: heuteKennung(), v12: ['klein', 'kaffee', 'kaffee'], v18: [], n18: ['wein', 'kaffee'], gestern: 0, soll: 3 };
  persist();
});
const mitKaffee = await stand();
check('Drei Tassen und ein Weinglas lassen die Menge bei 0,2 l', mitKaffee.heute === 0.2, JSON.stringify(mitKaffee));
check('Auch ein Zettel mit nur Tassen gilt als beschrieben', mitKaffee.inhalt);

// Die Leiste muss **einzeilig** bleiben, und alle Knöpfe gleich breit (Auftraggeber: „sollte aber
// jetzt immer noch irgendwie in die eine Zeile passen"). Geprüft wird über die Unterkante: die Knöpfe
// sind verschieden hoch (die Flasche ragt höher), gleiche Zeile heißt gleiche Grundlinie.
const leiste = await page.evaluate(() => {
  const l = document.getElementById('wasser-glaeser');
  const kn = [...l.querySelectorAll('button')].map(x => x.getBoundingClientRect());
  return { anzahl: kn.length, zeilen: new Set(kn.map(r => Math.round(r.bottom))).size,
           breiten: kn.map(r => Math.round(r.width)),
           ueberlauf: Math.round(kn[kn.length - 1].right) > Math.round(l.getBoundingClientRect().right) + 1 };
});
check('Acht Gefäße in einer Zeile', leiste.anzahl === 8 && leiste.zeilen === 1 && !leiste.ueberlauf, JSON.stringify(leiste));
check('… und alle gleich breit', new Set(leiste.breiten).size === 1, leiste.breiten.join(', '));

// ── 3.47: Das Bier ist der Gegenfall – es **zählt** mit ─────────────────────────────────────────
await page.evaluate(() => {
  state.wasser = { tag: heuteKennung(), v12: ['klein'], v18: ['bier'], n18: ['bier', 'wein', 'kaffee'], gestern: 0, soll: 3 };
  persist();
});
const mitBier = await page.evaluate(() => {
  const w = wasserStand();
  return { heute: Math.round(wasserTag(w) * 100) / 100, v18: Math.round(wasserSumme(w, 'v18') * 100) / 100,
           n18: Math.round(wasserSumme(w, 'n18') * 100) / 100 };
});
check('Bier zählt zur Flüssigkeit, Wein und Kaffee daneben nicht',
  mitBier.heute === 0.8 && mitBier.v18 === 0.3 && mitBier.n18 === 0.3, JSON.stringify(mitBier));
// Die Schaumkrone ist das, was den Pokal vom Weinglas unterscheidet – ohne sie wären beide nur zwei
// Kelche in verschiedenen Farben.
// Seit 3.48 beginnt die Krone **am Glasrand**, nicht beim Flüssigkeitsstand: „den Rest, der oben fehlt,
// bitte weiß machen, das ist der Schaum". Seit 3.49 reicht sie bis an die Kante selbst (0,3 Abstand für
// die Strichstärke) statt bis zum Innenrand von 1,6: „das Weiß oben bis zum Glasrand".
const schaum = await page.evaluate(() => {
  const g = GLAeSER.bier;
  const yVon = d => Number(d.match(/^M[-\d.]+ ([-\d.]+)/)[1]);
  return { hat: !!g.schaum, oben: yVon(kelchBand(g, 1, 1 - g.schaum, g.schaumUeber || 0)), rand: Math.round(g.y0 * 100) / 100,
           hoechstes: Math.min(...Object.keys(GLAeSER).map(k => GLAeSER[k].y0)) };
});
check('Die Schaumkrone beginnt am Glasrand, nicht beim Flüssigkeitsstand',
  schaum.hat && Math.abs(schaum.oben - schaum.rand) < 0.01, JSON.stringify(schaum));
check('Der Pokal verkleinert die anderen Gläser nicht', schaum.hoechstes === -6, String(schaum.hoechstes));

// `schaumUeber` wölbt die Krone über den Rand: der Pfad bekommt dann eine Kurve (Q) und ragt höher
// als die Glaskante. Bei 0 ist er gerade. Beide Varianten müssen zeichenbar bleiben.
const woelbung = await page.evaluate(() => {
  const g = GLAeSER.bier;
  const buendig = kelchBand(g, 1, 1 - g.schaum, 0);
  const ueber = kelchBand(g, 1, 1 - g.schaum, 2.4);
  return { buendigGerade: !buendig.includes('Q'), ueberGewoelbt: ueber.includes('Q'),
           kuppe: Number((ueber.match(/Q[\d.-]+ ([\d.-]+)/) || [])[1]), kante: g.y0 };
});
check('Die Wölbung ist ein Schalter: 0 bündig, sonst eine Kuppe über der Kante',
  woelbung.buendigGerade && woelbung.ueberGewoelbt && woelbung.kuppe < woelbung.kante, JSON.stringify(woelbung));

// ── 3.50: Die Füllung muss an der Glaswand sitzen, ohne Spalt ───────────────────────────────────
// „Da fehlt im Glas ein bisschen Rot, was nicht ganz von innen bis ans Glas geht." Ursache war eine
// genäherte Breitenkurve (Potenz 1,7), während der Umriss eine Bézier ist. Hier wird die Bézier
// **unabhängig abgetastet** und mit glasBreiteBei verglichen – eine Näherung fiele sofort auf.
const spalt = await page.evaluate(() => {
  const umriss = (g, yy) => {
    const a = g.y0 + 5.5, b = g.kelch - 2.5, c = g.kelch;
    if (yy <= a) return g.bo;
    if (yy >= c) return g.bu;
    let best = null, bestD = 1e9;
    for (let i = 0; i <= 4000; i++) {
      const t = i / 4000;
      const y = a * (1 - t) ** 2 + 2 * b * t * (1 - t) + c * t * t;
      const d = Math.abs(y - yy);
      if (d < bestD) { bestD = d; best = g.bo * (1 - t * t) + g.bu * t * t; }
    }
    return best;
  };
  const aus = {};
  for (const art of ['wein', 'bier']) {
    const g = GLAeSER[art], f = glasBreiteBei(g);
    let groesster = 0;
    for (let s = 0.05; s <= 0.95; s += 0.05) {
      const yy = g.y0 + (g.kelch - g.y0) * s;
      groesster = Math.max(groesster, Math.abs(umriss(g, yy) - f(yy)));
    }
    aus[art] = Math.round(groesster * 1000) / 1000;
  }
  return aus;
});
check('Wein: die Füllung folgt der Glaswand ohne Spalt', spalt.wein < 0.02, `größte Abweichung ${spalt.wein} Einheiten`);
check('Bier: dasselbe', spalt.bier < 0.02, `größte Abweichung ${spalt.bier} Einheiten`);

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
await b.close();
console.log(fails ? `\n${fails} FEHLER` : '\nalles grün');
process.exit(fails ? 1 : 0);
