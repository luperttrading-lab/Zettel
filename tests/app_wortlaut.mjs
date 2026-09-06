// Test Punkt 3: Wortlaut nach „Aufs Display kleben“ – Bild bereit / Kurzbefehl angefordert, konsistent.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_wortlaut.mjs <ausgabeverzeichnis>
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
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.click('#text'); await page.keyboard.type('Milch kaufen'); await page.waitForTimeout(400);
const txt = sel => page.evaluate(s => document.querySelector(s).textContent, sel);
// Weg ohne autoRun: Bild in die Zwischenablage
await page.click('#stick'); await page.waitForTimeout(1500);
check('Toast-Titel „Bild bereit“', (await txt('#toast-title')) === 'Bild bereit', await txt('#toast-title'));
check('Toast sichtbar', await page.evaluate(() => !document.getElementById('toast').hidden));
check('Statuszeile beginnt mit „Bild bereit.“', (await txt('#status')).startsWith('Bild bereit · mit Zettel. Jetzt den Kurzbefehl „Zettel“'), await txt('#status'));
check('Kopfzeile „Bild bereit HH:MM“', /^Bild bereit · mit Zettel \d\d:\d\d$/.test(await txt('#saved')), await txt('#saved'));
check('Marke „✓ Bild bereit HH:MM“', /^✓ Bild bereit · mit Zettel \d\d:\d\d$/.test(await txt('#pin')), await txt('#pin'));
check('pinned.requested false', await page.evaluate(() => state.pinned.requested === false));
const clip = await page.evaluate(async () => { try { const items = await navigator.clipboard.read(); return items.map(i => i.types.join(',')).join(';'); } catch (e) { return 'err ' + e.message; } });
check('Zwischenablage enthält PNG', clip.includes('image/png'), clip);
await page.screenshot({ path: out + '/t3_toast.png' });
// Änderung → Status leer, Kopfzeile „geändert · Bild veraltet“
await page.evaluate(() => { document.getElementById('toast').hidden = true; }); await page.click('#text'); await page.keyboard.press('End'); await page.keyboard.type(' und Brot'); await page.waitForTimeout(400);
check('Text geändert', (await page.evaluate(() => state.text)) === 'Milch kaufen und Brot', await page.evaluate(() => state.text));
check('Status nach Änderung leer', (await txt('#status')) === '', await txt('#status'));
check('Kopfzeile „geändert · Bild veraltet“', (await txt('#saved')) === 'geändert · Bild veraltet', await txt('#saved'));
check('Marke versteckt', await page.evaluate(() => document.getElementById('pin').hidden));
// Weg mit autoRun: Kurzbefehl angefordert (die shortcuts://-URL kann Chromium nicht öffnen, die Seite bleibt)
await page.evaluate(() => { state.autoRun = true; persist(); });
await page.click('#stick'); await page.waitForTimeout(1500);
check('Status „Kurzbefehl „Zettel“ angefordert.“', (await txt('#status')).startsWith('Kurzbefehl „Zettel“ angefordert · mit Zettel.'), await txt('#status'));
check('Kopfzeile „Kurzbefehl angefordert HH:MM“', /^Kurzbefehl angefordert · mit Zettel \d\d:\d\d$/.test(await txt('#saved')), await txt('#saved'));
check('Marke „✓ Kurzbefehl angefordert“', /^✓ Kurzbefehl angefordert · mit Zettel \d\d:\d\d$/.test(await txt('#pin')), await txt('#pin'));
check('pinned.requested true', await page.evaluate(() => state.pinned.requested === true));
check('kein Toast bei autoRun', await page.evaluate(() => document.getElementById('toast').hidden));
await page.evaluate(() => textEl.insertText('!')); await page.waitForTimeout(400);   // nach der shortcuts://-Navigation nimmt Chromium keine Tastatur mehr an
check('Text geändert 2', (await page.evaluate(() => state.text)) === 'Milch kaufen und Brot!', await page.evaluate(() => state.text));
check('Status nach Änderung wieder leer', (await txt('#status')) === '', await txt('#status'));
// Nach Neuladen bleibt der Wortlaut (requested gespeichert)
await page.evaluate(() => { state.text = state.text.slice(0, -1); textEl.value = state.text; persist(); }); await page.waitForTimeout(100);
await page.reload(); await page.waitForTimeout(800);
check('nach Neuladen „Kurzbefehl angefordert“', /^Kurzbefehl angefordert · mit Zettel \d\d:\d\d$/.test(await txt('#saved')), await txt('#saved'));
check('nirgends mehr „angeheftet“ sichtbar', !/angeheftet/i.test(await page.evaluate(() => document.body.innerText)));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
const relevant = errors.filter(e => !/shortcuts:\/\//.test(e) && !/ERR_UNKNOWN_URL_SCHEME|ERR_ABORTED/.test(e));
check('keine Fehler (außer shortcuts://-Schema)', relevant.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
