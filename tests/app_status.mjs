// Test Punkt 1: isPinnedCurrent() berücksichtigt Überschrift, Überschriftgröße und Hintergrundfoto.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_status.mjs <ausgabeverzeichnis>
//   Chromium-Pfad per PW_CHROMIUM überschreibbar (Standard: /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.click('#text'); await page.keyboard.type('Einkaufen'); await page.keyboard.press('Enter'); await page.keyboard.type('Hundespaziergang'); await page.keyboard.press('Enter'); await page.keyboard.type('Frisör');
await page.waitForTimeout(400);
const cur = () => page.evaluate(() => isPinnedCurrent());
const saved = () => page.evaluate(() => document.getElementById('saved').textContent);
await page.evaluate(() => markPinned());
check('nach markPinned aktuell', await cur(), await saved());
// Überschrift
await page.click('#titleon'); await page.waitForTimeout(100);
check('Überschrift an → nicht mehr aktuell', !(await cur()), await saved());
await page.click('#titleon'); await page.waitForTimeout(100);
check('Überschrift wieder aus → aktuell', await cur());
await page.click('#titleon'); await page.waitForTimeout(100);
await page.evaluate(() => markPinned());
check('mit Überschrift angeheftet', await cur());
await page.click('#tsizes button[data-s="2"]'); await page.waitForTimeout(100);
check('Größe 2 → nicht aktuell', !(await cur()));
await page.click('#tsizes button[data-s="1"]'); await page.waitForTimeout(100);
check('Größe 1 → aktuell', await cur());
await page.click('#titleon'); await page.waitForTimeout(100);   // aus
await page.evaluate(() => markPinned());
await page.evaluate(() => { state.titleSize = 3; updatePinBadge(); });
check('Größe ohne Überschrift egal', await cur());
// Hintergrundfoto
const kennung1 = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 2556); gr.addColorStop(0, '#204080'); gr.addColorStop(1, '#802040'); g.fillStyle = gr; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.8)); bgLaden();
  await new Promise(r => setTimeout(r, 300));
  return bgKennung;
});
check('Kennung gesetzt', /^\d+:[0-9a-f]+$/.test(kennung1), kennung1);
check('Foto neu → nicht aktuell', !(await cur()), await saved());
check('bgImage geladen', await page.evaluate(() => !!bgImage && bgImage.naturalWidth === 1179));
await page.evaluate(() => markPinned());
check('mit Foto angeheftet', await cur(), await saved());
// anderes Foto, gleiche Größe → andere Kennung
const kennung2 = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 2556); gr.addColorStop(0, '#204081'); gr.addColorStop(1, '#802040'); g.fillStyle = gr; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.8)); bgLaden();
  await new Promise(r => setTimeout(r, 300));
  return bgKennung;
});
check('anderes Foto → andere Kennung', kennung1 !== kennung2, kennung1 + ' vs ' + kennung2);
check('anderes Foto → nicht aktuell', !(await cur()));
await page.evaluate(() => markPinned());
// Neuladen: Kennung kommt sofort aus dem Speicher, Status bleibt
await page.reload(); await page.waitForTimeout(600);
check('nach Neuladen aktuell', await cur(), await saved());
check('nach Neuladen Foto geladen', await page.evaluate(() => !!bgImage));
// Foto entfernen
await page.click('#bgclear'); await page.waitForTimeout(100);
check('Foto entfernt → nicht aktuell', !(await cur()), await saved());
check('Kennung leer', (await page.evaluate(() => bgKennung)) === '');
// Alter Eintrag ohne Felder
await page.evaluate(() => { state.pinned = { text: state.text, color: state.color, fontScale: state.fontScale, fastener: state.fastener, fastenerLook: lookKey(fastenerLook()), paper: state.paper, pen: state.pen, texture: state.texture, edge: state.edge, font: state.font, at: Date.now() }; updatePinBadge(); });
check('alter Eintrag gilt als veraltet', !(await cur()), await saved());
check('Status alter Eintrag „Bild veraltet · neu kleben“', (await saved()) === 'Bild veraltet · neu kleben', await saved());
// Hash-Laufzeit bei 2,4 MB
const ms = await page.evaluate(() => { const s = 'x'.repeat(2400000); const t0 = performance.now(); fotoKennung(s); return performance.now() - t0; });
check('Hash 2,4 MB unter 100 ms', ms < 100, ms.toFixed(1) + ' ms');
// Regression
const fit = await page.evaluate(() => { const f = fitNote(1179, 2556, 'phone', 'Einkaufen\nHundespaziergang\nFrisör'); return f.fs + '/' + f.lines.length; });
check('fitNote unverändert 127/3', fit === '127/3', fit);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
const png = await page.evaluate(async () => { const t = targetCanvas(); const c = await renderWallpaper(1179, 2556, 'phone'); return c.toDataURL('image/png'); });
fs.writeFileSync(out + '/t1_wp.png', Buffer.from(png.split(',')[1], 'base64'));
await page.screenshot({ path: out + '/t1_app.png' });
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
