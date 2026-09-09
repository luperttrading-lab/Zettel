// Test 1.64.1: Der Winkel jedes Zettels muss im FERTIGEN BILD stimmen, nicht nur im Zustand.
//
// Vorgeschichte, die diesen Test begründet: In 1.63.1 prüfte app_zettel.mjs die Trennung der Felder über
// `mitZettel(z, () => noteRot())` – synchron, und grün. Im Bild drehten sich trotzdem alle Zettel
// gemeinsam, weil `zeichneEinenZettel` den Winkel erst NACH seinem `await` las: `mitZettel` stellt den
// Zustand schon beim `return fn()` zurück (das finally läuft vor dem Auflösen des Promise), dort stand
// also wieder der aktive Zettel. Der Test war zu nah am Code. Dieser hier misst am Bild.
//
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_dreh.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FEHL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);

// Drei Zettel in gut unterscheidbaren Papierfarben, jeder mit eigenem Winkel und eigener Größe.
const WINKEL = [-12, 0, 9];
await page.evaluate(async ([w]) => {
  const farben = ['yellow', 'pink', 'blue'];
  const lage = [[0.5, 0.20], [0.5, 0.50], [0.5, 0.80]];
  // Erst alle drei anlegen: das Anlegen des dritten ruft `nebeneinander()`, das Lage und Größe von
  // Zettel 2 und 3 überschreibt. Würde man die Werte währenddessen setzen, schöbe es sie wieder
  // übereinander – die Farbflächen überlappten und die Messung unten wäre wertlos (so passiert).
  await ensureFont(); if (document.fonts) await document.fonts.ready;
  zettelDazu(); zettelDazu();
  for (let i = 0; i < 3; i++) {
    state.zettel[i] = { ...state.zettel[i], color: farben[i], paper: 'plain', texture: 'smooth',
      edge: 'straight', list: 'none', title: false, fastener: 'tape', fasteners: [{ art: 'tape' }],
      noteScale: 0.5, noteFit: false, noteX: lage[i][0], noteY: lage[i][1], noteRot: w[i],
      text: 'Zettel ' + (i + 1) };
  }
  state.aktiv = 0; Object.assign(state, state.zettel[0]);
  textEl.value = state.text; onTextChanged(); flush(); syncPreview();
}, [WINKEL]);

// Im Bild je Papierfarbe die Bounding-Box messen. Für ein um φ gedrehtes Rechteck gilt
//   Boxbreite = w·|cos φ| + h·|sin φ|,  Boxhöhe = w·|sin φ| + h·|cos φ|.
// Bei quadratischem Zettel (w = h) folgt daraus |cos φ| + |sin φ| = Box/w – daraus lässt sich |φ| zurückrechnen.
const gemessen = await page.evaluate(async () => {
  const t = targetCanvas();
  const c = await renderWallpaper(t.w, t.h, t.layout);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  // Papierfarben aus der Tabelle holen und im Bild wiederfinden (Toleranz gegen Körnung/Kanten)
  const ziel = ['yellow', 'pink', 'blue'].map(k => {
    const m = COLORS[k].paper.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  });
  const boxen = ziel.map(() => ({ x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0 }));
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    for (let k = 0; k < 3; k++) {
      const z = ziel[k]; if (!z) continue;
      if (Math.abs(d[i] - z[0]) < 8 && Math.abs(d[i + 1] - z[1]) < 8 && Math.abs(d[i + 2] - z[2]) < 8) {
        const bx = boxen[k];
        if (x < bx.x0) bx.x0 = x; if (x > bx.x1) bx.x1 = x;
        if (y < bx.y0) bx.y0 = y; if (y > bx.y1) bx.y1 = y; bx.n++;
        break;
      }
    }
  }
  const soll = alleZettel().map(z => mitZettel(z, () => {
    const f = fitNote(t.w, t.h, t.layout, noteText() || '…');
    return { noteW: f.noteW, noteH: f.noteH, rot: noteRot() };
  }));
  return boxen.map((bx, k) => {
    const s = soll[k], grad = Math.abs(s.rot) * Math.PI / 180;
    return {
      zettel: k + 1, sollWinkel: s.rot, pixel: bx.n,
      boxBreite: bx.x1 - bx.x0 + 1, boxHoehe: bx.y1 - bx.y0 + 1,
      erwarteteBreite: Math.round(s.noteW * Math.cos(grad) + s.noteH * Math.sin(grad)),
      erwarteteHoehe: Math.round(s.noteW * Math.sin(grad) + s.noteH * Math.cos(grad)),
    };
  });
});
for (const g of gemessen) {
  const dB = Math.abs(g.boxBreite - g.erwarteteBreite), dH = Math.abs(g.boxHoehe - g.erwarteteHoehe);
  check(`Zettel ${g.zettel} steht im Bild auf ${g.sollWinkel}°`, g.pixel > 5000 && dB <= 4 && dH <= 4,
    `Box ${g.boxBreite}×${g.boxHoehe}, erwartet ${g.erwarteteBreite}×${g.erwarteteHoehe} (${g.pixel} Pixel)`);
}
// Gegenprobe: die drei Boxen dürfen nicht alle gleich sein – sonst hätte der Test bei synchroner Drehung bestanden
const formen = new Set(gemessen.map(g => g.boxBreite + 'x' + g.boxHoehe));
check('die drei Zettel stehen wirklich verschieden', formen.size === 3, [...formen].join(' '));


// Am Bildrand: ein stark gedrehter Zettel darf nicht angeschnitten werden. Die Zeichnung muss auf den
// **gedrehten** Umriss klemmen, so wie es lageGrenzen() im Fenster tut – sonst zeigt das Fenster einen
// ganzen Zettel und das Display einen abgeschnittenen (gemessen ohne die Klemmung: 380 statt 417 px hoch).
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(900);
const rand = await page.evaluate(async () => {
  state.color = 'yellow'; state.paper = 'plain'; state.list = 'none'; state.title = false; state.fastener = 'tape';
  state.noteScale = 0.5; state.noteFit = false; state.noteX = 0.5; state.noteY = 0.02; state.noteRot = -14;
  textEl.value = 'Rand'; onTextChanged(); flush();
  await ensureFont(); if (document.fonts) await document.fonts.ready; syncPreview(); zettelSichern();
  const t = targetCanvas(), f = fitNote(t.w, t.h, t.layout, noteText());
  const dm = drehMasse(f.noteW, f.noteH, -14);
  const c = await renderWallpaper(t.w, t.h, t.layout);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const m = COLORS.yellow.paper.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const z = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  let y0 = 1e9, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (Math.abs(d[i] - z[0]) < 8 && Math.abs(d[i + 1] - z[1]) < 8 && Math.abs(d[i + 2] - z[2]) < 8) {
      if (y < y0) y0 = y; if (y > y1) y1 = y; break;
    }
  }
  return { hoehe: y1 - y0 + 1, erwartet: Math.round(dm.h), oben: y0, fensterMinY: g_minY() };
  function g_minY() { return +lageGrenzen().minY.toFixed(4); }
});
check('gedrehter Zettel am Bildrand bleibt ganz im Bild', Math.abs(rand.hoehe - rand.erwartet) <= 3 && rand.oben >= 0,
  `${rand.hoehe} px hoch, erwartet ${rand.erwartet}, beginnt bei y=${rand.oben}`);

await page.screenshot({ path: out + '/dreh.png' });
check('keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
console.log(fails ? fails + ' Prüfung(en) fehlgeschlagen' : 'alle Prüfungen bestanden');
await b.close();
process.exit(fails ? 1 : 0);
