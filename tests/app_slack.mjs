// Test 3.45: Der Umbruch-Sicherheitsfaktor gehört zum Zettel, nicht zur App.
// Auftraggeber (20.9.2026, mit zwei Sperrbildschirm-Fotos belegt): „Wenn ich von dem rosa Zettel auf
// speichern drücke, wird das Ergebnis gut. Wenn ich vom blauen Zettel drücke ohne was zu ändern, dann
// ist der rote Zettel falsch umgebrochen." Ursache: `widthSlack` war **eine** globale Zahl, in
// syncPreview nur für den aktiven Zettel bestimmt – beim Bild bekamen alle drei denselben Wert.
//   node tests/app_slack.mjs   (lokaler Server auf 8766, siehe app_review.mjs)
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
const TERMINE = 'Di. 10:00 Siggi\nDo. 8:30 Miklody nüchtern\nMo. 8:00 Miklody Besprechung';

await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
await page.evaluate(txt => {
  localStorage.clear();
  state.list = 'termin'; state.font = 'patrickhand'; state.paper = 'grid';
  state.noteScale = 0.7; state.fontScale = 85;
  textEl.value = txt; onTextChanged(); syncPreview(); persist();
}, TERMINE);
await page.waitForTimeout(400);

// Erst der Beleg, dass der Faktor überhaupt etwas ausmacht: derselbe Text, verschiedene Faktoren.
const wirkung = await page.evaluate(() => {
  const t = targetCanvas(), aus = {};
  for (const s of [1, 0.9]) { const f = fitNote(t.w, t.h, t.layout, noteText(), s); aus[s] = f.fs; }
  return aus;
});
check('Ein fremder Faktor ändert das Bild messbar',
  Math.abs(wirkung['1'] - wirkung['0.9']) >= 5, `Faktor 1 → ${wirkung['1']} px, Faktor 0,9 → ${wirkung['0.9']} px`);

// Zweiter Zettel: Wasser. Dort läuft die Umbruchsuche mangels Text anders aus.
await page.evaluate(() => zettelDazu()); await page.waitForTimeout(350);
await page.evaluate(() => { state.list = 'wasser'; applyList(); syncPreview(); }); await page.waitForTimeout(350);

const faktoren = await page.evaluate(() => ({ termin: state.zettel[0].slack, wasser: state.slack, aktiv: state.aktiv }));
check('Jeder Zettel hat seinen eigenen Faktor', faktoren.termin !== undefined && faktoren.wasser !== undefined, JSON.stringify(faktoren));

// Der Kern: So zeichnet das Bild – mitZettel auf den Terminzettel, während der Wasserzettel aktiv ist.
const vomWasser = await page.evaluate(() => {
  const t = targetCanvas(), z = state.zettel[0];
  return mitZettel(z, () => { const f = fitNote(t.w, t.h, t.layout, (z.text || '').trim()); return { zeilen: f.lines.length, fs: f.fs }; });
});
await page.evaluate(() => { zettelWechseln(0); syncPreview(); }); await page.waitForTimeout(350);
const vomTermin = await page.evaluate(() => {
  const t = targetCanvas(), f = fitNote(t.w, t.h, t.layout, noteText());
  return { zeilen: f.lines.length, fs: f.fs };
});
check('Der Terminzettel sieht gleich aus, egal von welchem Zettel aus geklebt wird',
  vomWasser.zeilen === vomTermin.zeilen && vomWasser.fs === vomTermin.fs,
  `vom Wasserzettel: ${JSON.stringify(vomWasser)}, vom Terminzettel: ${JSON.stringify(vomTermin)}`);

// Der Faktor ist ein Rechenergebnis: er darf den Zettel nicht als „geändert" markieren
const kennung = await page.evaluate(() => {
  const vorher = zettelKennung();
  state.slack = 0.9; zettelSichern();
  return { gleich: zettelKennung() === vorher, enthaeltSlack: zettelKennung().includes('slack') };
});
check('Der Faktor markiert den Zettel nicht als geändert', kennung.gleich && !kennung.enthaeltSlack, JSON.stringify(kennung));

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
await b.close();
console.log(fails ? `\n${fails} FEHLER` : '\nalles grün');
process.exit(fails ? 1 : 0);
