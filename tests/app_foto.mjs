// Test Punkt 4: Ausgabe wartet auf das Hintergrundfoto; Ladefehler werden gemeldet und sperren die Ausgabe.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_foto.mjs <ausgabeverzeichnis>
//   Chromium-Pfad per PW_CHROMIUM überschreibbar (Standard: /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8766' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | '))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
const txt = sel => page.evaluate(s => document.querySelector(s).textContent, sel);
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.click('#text'); await page.keyboard.type('Milch kaufen'); await page.waitForTimeout(400);
// 1) Foto setzen und SOFORT rendern – das Bild muss das Foto enthalten, nicht den Verlauf
const r1 = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d');
  g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden();
  const warNull = bgImage === null;
  const blob = await renderPng();
  const bmp = await createImageBitmap(blob); const c2 = document.createElement('canvas'); c2.width = bmp.width; c2.height = bmp.height;
  const g2 = c2.getContext('2d'); g2.drawImage(bmp, 0, 0); const px = [...g2.getImageData(10, 10, 1, 1).data].slice(0, 3);
  return { warNull, px, geladen: !!bgImage, w: bmp.width, h: bmp.height };
});
check('Foto war beim Aufruf noch nicht dekodiert', r1.warNull, JSON.stringify(r1));
check('Bild enthält das Foto (blau), nicht den Verlauf', r1.px[2] > 100 && r1.px[0] < 60, JSON.stringify(r1.px));
check('Foto danach geladen', r1.geladen);
// 2) Ungültige Daten: Meldung, Sperre, ✕ sichtbar
await page.evaluate(() => navigator.clipboard.writeText('unverändert'));
const r2 = await page.evaluate(async () => {
  localStorage.setItem('zettel.bg', 'data:image/jpeg;base64,AAAAAAAA'); bgLaden();
  await bgReady;
  return { fehler: bgFehler, gespeichert: localStorage.getItem('zettel.bg'), clearSichtbar: !document.getElementById('bgclear').hidden, banner: document.getElementById('update').hidden ? '' : document.getElementById('update-text').textContent, kennung: bgKennung, bild: !!bgImage };
});
check('bgFehler gesetzt', r2.fehler === true);
check('Daten entfernt', r2.gespeichert === null, String(r2.gespeichert));
check('✕ sichtbar', r2.clearSichtbar);
check('Banner meldet Fehler', r2.banner.startsWith('Hintergrundfoto ließ sich nicht laden'), r2.banner);
check('Kennung leer, kein Bild', r2.kennung === '' && !r2.bild);
await page.click('#stick'); await page.waitForTimeout(1200);
check('Kleben gesperrt mit Meldung', (await txt('#status')).startsWith('Hintergrundfoto ließ sich nicht laden'), await txt('#status'));
check('kein Bild bereit', !(await page.evaluate(() => isPinnedCurrent())));
check('Zwischenablage unverändert', (await page.evaluate(() => navigator.clipboard.readText())) === 'unverändert');
await page.click('#share'); await page.waitForTimeout(800);
check('Teilen gesperrt mit Meldung', (await txt('#status')).startsWith('Hintergrundfoto ließ sich nicht laden'), await txt('#status'));
check('Vorschau-Overlay bleibt zu', await page.evaluate(() => document.getElementById('overlay').hidden));
await page.screenshot({ path: out + '/t4_fehler.png' });
// ✕ → Sperre weg, Banner weg, Kleben geht wieder
await page.click('#bgclear'); await page.waitForTimeout(300);
check('nach ✕ kein Fehler mehr', await page.evaluate(() => bgFehler === false && document.getElementById('bgclear').hidden));
check('Banner jetzt „entfernt“', (await txt('#update-text')) === 'Hintergrundfoto entfernt', await txt('#update-text'));
await page.click('#stick'); await page.waitForTimeout(1500);
check('Kleben geht wieder', (await txt('#status')).startsWith('Bild bereit'), await txt('#status'));
// 3) Bild MIT Foto bereitgestellt, danach ist das Foto kaputt: Banner beim Start, Status „Bild veraltet“
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady;
});
await page.click('#stick'); await page.waitForTimeout(1500);
check('mit Foto bereit', /^Bild bereit/.test(await txt('#saved')) && (await page.evaluate(() => state.pinned.bg !== '')), await txt('#saved'));
await page.evaluate(() => { localStorage.setItem('zettel.bg', 'data:image/jpeg;base64,AAAAAAAA'); });
await page.reload(); await page.waitForTimeout(800);
check('Banner beim Start', (await page.evaluate(() => !document.getElementById('update').hidden)) && (await txt('#update-text')).startsWith('Hintergrundfoto ließ sich nicht laden'), await txt('#update-text'));
check('Kopfzeile „geändert · Bild veraltet“', (await txt('#saved')) === 'geändert · Bild veraltet', await txt('#saved'));
// 4) Ohne Foto: Ausgabe sofort möglich (bgReady erfüllt), Verlauf im Bild
await page.click('#bgclear'); await page.waitForTimeout(200);
const r4 = await page.evaluate(async () => { const blob = await renderPng(); const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = 20; c.height = 20; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return [...g.getImageData(10, 10, 1, 1).data].slice(0, 3); });
check('ohne Foto dunkler Verlauf', r4[0] < 40 && r4[2] < 40, JSON.stringify(r4));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
