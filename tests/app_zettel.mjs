// Test 1.61.0: mehrere Zettel. Der aktive liegt flach in `state`, die übrigen in `state.zettel`;
// gezeichnet werden alle. Geprüft wird vor allem, dass beim Wechseln nichts verloren geht und dass
// jeder Zettel mit **seinen eigenen** Einstellungen im Bild landet.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_zettel.mjs <ausgabeverzeichnis>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
const plus = () => page.evaluate(() => document.querySelector('#zettelwahl button.plus').click());

await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); textEl.value = 'To Do Liste\n☐ Rasen wässern';
  onTextChanged(); state.title = true; state.list = 'check'; state.noteY = 0.35; state.noteScale = 0.85; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);

check('ein Zettel: nur Nummer und Plus', (await page.evaluate(() => [...document.querySelectorAll('#zettelwahl button')].map(b => b.textContent).join(''))) === '1+');

await plus(); await page.waitForTimeout(400);
await page.evaluate(() => { textEl.value = 'Fr 12:00 Friseur'; onTextChanged(); flush(); }); await page.waitForTimeout(300);
const zwei = await page.evaluate(() => ({ n: state.zettel.length, aktiv: state.aktiv, liste: state.list, scale: state.noteScale, farbe: state.color }));
check('zweiter Zettel: klein, Terminliste, andere Farbe',
  zwei.n === 2 && zwei.aktiv === 1 && zwei.liste === 'termin' && zwei.scale === 0.6 && zwei.farbe !== 'yellow', JSON.stringify(zwei));

await plus(); await page.waitForTimeout(400);
await page.evaluate(() => { textEl.value = 'Sa 18:00 Kino'; onTextChanged(); flush(); }); await page.waitForTimeout(300);
check('dritter Zettel, danach kein Plus mehr',
  await page.evaluate(() => state.zettel.length === 3 && !document.querySelector('#zettelwahl button.plus')));

// Die Voreinstellung darf keinen Zettel auf einen anderen setzen
check('neue Zettel überlappen nicht', await page.evaluate(() => {
  const t = targetCanvas();
  const r = alleZettel().map(z => { const h = mitZettel(z, () => fitNote(t.w, t.h, t.layout, (z.text || '').trim() || '…').noteH / t.h);
    return [z.noteY - h / 2, z.noteY + h / 2]; });
  let u = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i][0] < r[j][1] && r[j][0] < r[i][1]) u++;
  return u === 0; }));

// Wechseln darf nichts verlieren
await page.evaluate(() => zettelWechseln(0)); await page.waitForTimeout(300);
check('Wechsel zu 1: Text, Liste und Größe kommen mit', await page.evaluate(() =>
  textEl.value.startsWith('To Do Liste') && state.list === 'check' && Math.abs(state.noteScale - 0.85) < 1e-9),
  await page.evaluate(() => [state.list, state.noteScale].join(', ')));
await page.evaluate(() => zettelWechseln(1)); await page.waitForTimeout(300);
check('Wechsel zu 2: eigener Text und eigene Liste', await page.evaluate(() =>
  textEl.value === 'Fr 12:00 Friseur' && state.list === 'termin'));

await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
check('alles übersteht das Neuladen', await page.evaluate(() =>
  state.zettel.length === 3 && state.zettel[0].text.startsWith('To Do Liste') && state.zettel[2].text === 'Sa 18:00 Kino'));

// Jeder Zettel muss mit seiner eigenen Farbe im Bild stehen
const farben = await page.evaluate(async () => {
  const t = targetCanvas();
  const c = await renderWallpaper(t.w, t.h, t.layout, {});
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  const treffer = {};
  for (const z of alleZettel()) {
    const soll = COLORS[z.color].paper;
    const rr = parseInt(soll.slice(1, 3), 16), gg = parseInt(soll.slice(3, 5), 16), bb = parseInt(soll.slice(5, 7), 16);
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (Math.abs(d[i] - rr) < 10 && Math.abs(d[i+1] - gg) < 10 && Math.abs(d[i+2] - bb) < 10) n++;
    }
    treffer[z.color] = n;
  }
  return treffer;
});
check('alle drei Papierfarben stehen im Bild',
  Object.keys(farben).length === 3 && Object.values(farben).every(n => n > 20), JSON.stringify(farben));

// Der übertragene Stand muss alle Zettel umfassen
await page.evaluate(() => { state.pinned = { ...pinSnapshot({}), at: Date.now() }; persist(); });
check('nach dem Übertragen gilt der Stand als aktuell', await page.evaluate(() => isPinnedCurrent()));
await page.evaluate(() => { state.zettel[0].text += '!'; persist(); });
check('Änderung an einem anderen Zettel hebt den Stand auf', await page.evaluate(() => !isPinnedCurrent()));

// Entfernen
await page.evaluate(() => zettelWeg(2)); await page.waitForTimeout(300);
check('Entfernen lässt zwei übrig und wählt einen gültigen', await page.evaluate(() =>
  state.zettel.length === 2 && state.aktiv < 2 && !!document.querySelector('#zettelwahl button.plus')));

await page.screenshot({ path: out + '/zettel_drei.png', clip: { x: 0, y: 0, width: 393, height: 420 } });
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
