// Test 1.62.1: Terminliste – Vorschau und Bild brechen gleich um, und der Einzug springt beim Tippen nicht.
//   1) Parität: die Zeilenzahl aus wrap() (die das Bild zeichnet) stimmt mit der des echten Textfelds überein.
//      Vorher reservierte wrap() auch bei Terminen Platz für den Haken, den es dort gar nicht gibt
//      (das CSS blendet die Box aus, hakenZeile() sperrt den Tipp) – das Bild brach eine Zeile früher um.
//   2) Halbfertiger Terminkopf: „Fr. 7“ ist eine angefangene Uhrzeit, kein Kopf mit Rumpf „7“.
//      Vorher sprang der Rumpf beim fünften Zeichen in die gemeinsame Spalte und beim Weitertippen zurück.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_termine.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1000);

// 1) Parität über viele Textkombinationen, Listenarten und Schriften.
//    Der Schriftregler bleibt bei 100 %: bei 110 % liegen einzelne Zeilen so dicht an der Umbruchkante,
//    dass Canvas-Messung und Browser-Layout um Bruchteile eines Pixels auseinanderliegen (siehe UEBERGABE).
for (const font of ['caveat', 'kalam', 'marker', 'indie', 'gloria']) {
  await page.evaluate(async f => { state.font = f; await ensureFont(); if (document.fonts) await document.fonts.ready; }, font);
  await page.waitForTimeout(400);
  for (const art of ['termin', 'dash', 'check']) {
    const r = await page.evaluate(([art]) => {
      state.list = art; state.fontScale = 100;
      const w = ['Auto','Werkstatt','Termin','Tierarzt','Kontrolle','Elternabend','Einkaufen','Sport','Zahnarzt','Besuch','Oma','Kino','Anna','Markt'];
      const vorne = { termin: 'Mo. 13:30 ', dash: '– ', check: '☐ ' };
      let ab = 0, ges = 0, bsp = null;
      for (let n = 2; n <= 10; n++) for (let k = 0; k < 14; k++) {
        const z = []; for (let i = 0; i < n; i++) z.push(vorne[art] + w[(i + k) % 14] + ' ' + w[(i + k + 5) % 14]);
        textEl.value = z.join('\n'); onTextChanged(); flush(); syncPreview();
        const tc = targetCanvas(), f = fitNote(tc.w, tc.h, tc.layout, noteText());
        const sc = noteEl.clientWidth / f.noteW;
        const echt = [...document.querySelectorAll('.note .editor .ln')]
          .map(d => Math.round(d.getBoundingClientRect().height / (f.fs * f.LH * sc))).reduce((a, x) => a + x, 0);
        ges++;
        if (echt !== f.lines.length) { ab++; if (!bsp) bsp = { text: z[0], n, wrap: f.lines.length, textfeld: echt }; }
      }
      return { ab, ges, bsp };
    }, [art]);
    check(`Umbruch gleich: ${font} / ${art} (${r.ges} Fälle)`, r.ab === 0, r.bsp ? JSON.stringify(r.bsp) : '');
  }
}
await page.evaluate(async () => { state.font = 'caveat'; await ensureFont(); }); await page.waitForTimeout(400);

// 2) Halbfertiger Terminkopf: der Rumpf bleibt vorne, bis die Uhrzeit steht.
const lauf = await page.evaluate(() => {
  state.list = 'termin'; state.fontScale = 100;
  const fertig = 'Mo. 13:30 Molly Tierarzt\nDi. 9:00 Zahnarzt';
  const neu = 'Fr. 7:45 Auto Werkstatt';
  const aus = [];
  for (let i = 1; i <= neu.length; i++) {
    textEl.value = fertig + '\n' + neu.slice(0, i); onTextChanged(); flush(); syncPreview();
    const d = textEl.el.children[2];
    aus.push({ getippt: neu.slice(0, i), mk: d.dataset.mk || '', einzug: Math.round(parseFloat(d.style.paddingLeft) || 0) });
  }
  return aus;
});
const vorKopf = lauf.filter(z => !/^Fr\. \d{1,2}:\d{2} \S/.test(z.getippt));
const nachKopf = lauf.filter(z => /^Fr\. \d{1,2}:\d{2} \S/.test(z.getippt));
check('während der Uhrzeit kein Einzug', vorKopf.every(z => z.einzug === 0 && z.mk === ''),
  JSON.stringify(vorKopf.filter(z => z.einzug !== 0 || z.mk !== '')));
check('fertiger Kopf rückt in die gemeinsame Spalte', nachKopf.length > 0 && nachKopf.every(z => z.mk === 'Fr. 7:45' && z.einzug > 0),
  JSON.stringify(nachKopf[0]));
// Genau **ein** Sprung: der Einzug wechselt nur einmal von 0 auf die Spaltenbreite
const spruenge = lauf.filter((z, i) => i > 0 && (z.einzug === 0) !== (lauf[i - 1].einzug === 0)).length;
check('nur ein Wechsel des Einzugs beim Tippen', spruenge === 1, spruenge + ' Wechsel: ' + JSON.stringify(lauf.map(z => z.einzug)));

// 3) Der Kopf **mit** Uhrzeit gilt auch, wenn der Rumpf mit einer Ziffer beginnt („3 Kisten abholen“)
const ziffern = await page.evaluate(() => {
  state.list = 'termin';
  const proben = ['Mo. 13:30 3 Kisten abholen', '12.9. 2 Karten kaufen', 'Fr. 7', 'Fr. 7:4', 'Sonntag Brunch'];
  return proben.map(p => { const m = marke(p); return { p, mk: m ? m[0] : null }; });
});
check('„Mo. 13:30 3 Kisten“ bleibt ein Termin', ziffern[0].mk === 'Mo. 13:30 ', JSON.stringify(ziffern[0]));
check('„12.9. 2 Karten“ bleibt ein Termin', ziffern[1].mk === '12.9. ', JSON.stringify(ziffern[1]));
check('„Fr. 7“ ist kein Termin', ziffern[2].mk === null, JSON.stringify(ziffern[2]));
check('„Fr. 7:4“ ist kein Termin', ziffern[3].mk === null, JSON.stringify(ziffern[3]));
check('„Sonntag Brunch“ bleibt ein Termin', ziffern[4].mk === 'Sonntag ', JSON.stringify(ziffern[4]));

// 4) Doppelpflege: dieselbe Zusatzbedingung steht in index.html **und** in lib/render.js.
//    Der Server hat kein DOM, deshalb hier der Vergleich der beiden Quellzeilen statt eines Renderlaufs.
const REGEL = "if (!/\\d/.test(m[1]) && /^\\d/.test(line.slice(m[0].length))) return null;";
const quellen = ['index.html', 'lib/render.js'].map(d => ({ d, treffer: fs.readFileSync(d, 'utf8').includes(REGEL) }));
check('halbfertiger Kopf: gleiche Regel in App und Server', quellen.every(q => q.treffer),
  JSON.stringify(quellen));

await page.screenshot({ path: out + '/termine.png' });
check('keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
console.log(fails ? fails + ' Prüfung(en) fehlgeschlagen' : 'alle Prüfungen bestanden');
await b.close();
process.exit(fails ? 1 : 0);
