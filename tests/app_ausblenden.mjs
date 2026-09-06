// Test Punkt 2: „Zettel ausblenden“ – nur das Hintergrundfoto über die Zwischenablage; ohne Foto Hinweis; Status mit/nur.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_ausblenden.mjs <ausgabeverzeichnis>
//   Chromium-Pfad per PW_CHROMIUM überschreibbar (Standard: /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8766' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
const txt = sel => page.evaluate(s => document.querySelector(s).textContent, sel);
// Pixel aus der Zwischenablage: Zettelmitte (w/2, 0,585 h) und Ecke oben links
const clipPixels = () => page.evaluate(async () => {
  const items = await navigator.clipboard.read(); const it = items.find(i => i.types.includes('image/png')); if (!it) return null;
  const blob = await it.getType('image/png'); const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
  return { w: bmp.width, h: bmp.height, ecke: px(10, 10), mitte: px(bmp.width / 2, bmp.height * 0.585) };
});
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
check('Knopf vorhanden', await page.evaluate(() => !!document.getElementById('hide') && document.getElementById('hide').textContent === 'Zettel ausblenden'));
await page.click('#text'); await page.keyboard.type('Milch kaufen'); await page.waitForTimeout(400);
// 1) Ohne Foto: Hinweis, keine Ausgabe
await page.evaluate(() => navigator.clipboard.writeText('unverändert'));
await page.click('#hide'); await page.waitForTimeout(800);
check('ohne Foto Hinweis', (await txt('#status')).startsWith('Kein Hintergrundfoto hinterlegt'), await txt('#status'));
check('ohne Foto nichts kopiert', (await page.evaluate(() => navigator.clipboard.readText())) === 'unverändert');
check('ohne Foto nichts gemerkt', await page.evaluate(() => state.pinned === null));
check('Text bleibt', (await page.evaluate(() => state.text)) === 'Milch kaufen');
// 2) Mit Foto: nur Hintergrund im Bild
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady;
});
await page.click('#hide'); await page.waitForTimeout(1500);
const p2 = await clipPixels();
check('Bild in der Zwischenablage', !!p2, JSON.stringify(p2));
check('Mitte zeigt das Foto, keinen Zettel', p2 && p2.mitte[2] > 100 && p2.mitte[0] < 60, JSON.stringify(p2 && p2.mitte));
check('Toast „Bild bereit“ mit Hinweis', (await txt('#toast-title')) === 'Bild bereit' && (await txt('#toast-sub')).startsWith('Nur Hintergrund, ohne Zettel.'), await txt('#toast-sub'));
check('Status „Bild bereit · nur Hintergrund.“', (await txt('#status')).startsWith('Bild bereit · nur Hintergrund. Jetzt den Kurzbefehl „Zettel“'), await txt('#status'));
check('Kopfzeile nur Hintergrund', /^Bild bereit · nur Hintergrund \d\d:\d\d$/.test(await txt('#saved')), await txt('#saved'));
check('Marke nur Hintergrund', /^✓ Bild bereit · nur Hintergrund \d\d:\d\d$/.test(await txt('#pin')), await txt('#pin'));
check('pinned.bgOnly', await page.evaluate(() => state.pinned.bgOnly === true && state.pinned.bg !== ''));
check('Text und Einstellungen bleiben', (await page.evaluate(() => state.text)) === 'Milch kaufen' && (await page.evaluate(() => textEl.value)) === 'Milch kaufen');
await page.screenshot({ path: out + '/t2_toast.png' });
// Textänderung ändert am ausgeblendeten Stand nichts (der Zettel ist ja nicht im Bild)
await page.evaluate(() => { document.getElementById('toast').hidden = true; textEl.insertText(' und Brot'); }); await page.waitForTimeout(400);
check('Textänderung: Stand bleibt „nur Hintergrund“', /^Bild bereit · nur Hintergrund/.test(await txt('#saved')), await txt('#saved'));
// 3) Danach „Aufs Display kleben“: mit Zettel, Mitte gelb
await page.click('#stick'); await page.waitForTimeout(1500);
const p3 = await clipPixels();
check('mit Zettel: Mitte gelb (Papier)', p3 && p3.mitte[0] > 200 && p3.mitte[1] > 200 && p3.mitte[2] < 200, JSON.stringify(p3 && p3.mitte));
check('mit Zettel: Ecke Foto', p3 && p3.ecke[2] > 100, JSON.stringify(p3 && p3.ecke));
check('Kopfzeile mit Zettel', /^Bild bereit · mit Zettel \d\d:\d\d$/.test(await txt('#saved')), await txt('#saved'));
check('pinned.bgOnly false', await page.evaluate(() => state.pinned.bgOnly === false));
await page.evaluate(() => { document.getElementById('toast').hidden = true; textEl.insertText('!'); }); await page.waitForTimeout(400);
check('mit Zettel: Textänderung → veraltet', (await txt('#saved')) === 'geändert · Bild veraltet', await txt('#saved'));
// 4) Foto entfernen → Stand veraltet; kaputtes Foto → Sperre mit Meldung
await page.click('#hide'); await page.waitForTimeout(1500);   // wieder „nur Hintergrund“ als Stand
await page.click('#bgclear'); await page.waitForTimeout(300);
check('Foto weg → veraltet', (await txt('#saved')) === 'geändert · Bild veraltet', await txt('#saved'));
await page.evaluate(async () => { localStorage.setItem('zettel.bg', 'data:image/jpeg;base64,AAAAAAAA'); bgLaden(); await bgReady; });
await page.click('#hide'); await page.waitForTimeout(500);
check('kaputtes Foto: Sperre', (await txt('#status')).startsWith('Hintergrundfoto ließ sich nicht laden'), await txt('#status'));
await page.click('#bgclear'); await page.waitForTimeout(300);
// Layout
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
await page.evaluate(() => { document.getElementById('update').hidden = true; window.scrollTo(0, 9999); }); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/t2_unten.png' });
// 5) Ausblenden mit autoRun (zuletzt: nach der shortcuts://-Navigation nimmt Chromium keine Klicks mehr an)
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady; state.autoRun = true; persist();
});
await page.click('#hide'); await page.waitForTimeout(1500);
check('autoRun: Status angefordert · nur Hintergrund', (await txt('#status')).startsWith('Kurzbefehl „Zettel“ angefordert · nur Hintergrund.'), await txt('#status'));
check('autoRun: Kopfzeile', /^Kurzbefehl angefordert · nur Hintergrund \d\d:\d\d$/.test(await txt('#saved')), await txt('#saved'));
const relevant = errors.filter(e => !/ERR_UNKNOWN_URL_SCHEME|ERR_ABORTED|shortcuts:/.test(e));
check('keine Fehler', relevant.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
