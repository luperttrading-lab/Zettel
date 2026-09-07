// Test 1.37.0: „Zettel ausblenden“ als Umschalter – der Zettel verschwindet auch in der App, „Zettel einblenden“ lädt ihn hoch,
// Tipp auf die leere Fläche zeigt ihn nur zum Bearbeiten; Zustand überlebt das Neuladen.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_umschalter.mjs <ausgabeverzeichnis>
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
const lage = () => page.evaluate(() => ({ hidden: state.hidden, weg: document.getElementById('note').classList.contains('weg'), hint: !document.getElementById('weghint').hidden, knopf: document.getElementById('hide').textContent, sichtbar: getComputedStyle(document.getElementById('text')).visibility, marke: document.getElementById('pin').hidden ? '' : getComputedStyle(document.getElementById('pin')).visibility, saved: document.getElementById('saved').textContent }));
const mitte = () => page.evaluate(async () => { const items = await navigator.clipboard.read(); const it = items.find(i => i.types.includes('image/png')); const bmp = await createImageBitmap(await it.getType('image/png')); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return [...g.getImageData(Math.round(bmp.width / 2), Math.round(bmp.height * 0.585), 1, 1).data].slice(0, 3); });
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.evaluate(() => { textEl.value = 'Milch kaufen'; onTextChanged(); flush(); });
await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556); localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady; });
const l0 = await lage();
check('Start: Zettel sichtbar, Knopf „ausblenden“', !l0.hidden && !l0.weg && !l0.hint && l0.knopf === 'Zettel ausblenden' && l0.sichtbar === 'visible', JSON.stringify(l0));
// 1) Ausblenden: Bild nur Hintergrund, Zettel in der App weg, Knopf wird „einblenden“, Marke bleibt lesbar
await page.click('#hide'); await page.waitForTimeout(1500);
const l1 = await lage(), p1 = await mitte();
check('ausblenden: Zettel weg, Hinweis da, Knopf „einblenden“', l1.hidden && l1.weg && l1.hint && l1.knopf === 'Zettel einblenden' && l1.sichtbar === 'hidden', JSON.stringify(l1));
check('ausblenden: Marke „Hintergrund bereit“ sichtbar', l1.marke === 'visible' && /^Hintergrund bereit/.test(l1.saved), JSON.stringify(l1));
check('ausblenden: Bild ohne Zettel', p1[2] > 100 && p1[0] < 60, JSON.stringify(p1));
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await page.screenshot({ path: out + '/umschalter_weg.png' });
// 2) Zustand überlebt das Neuladen
await page.reload(); await page.waitForTimeout(800);
const l2 = await lage();
check('nach Neuladen weiter ausgeblendet', l2.hidden && l2.weg && l2.knopf === 'Zettel einblenden', JSON.stringify(l2));
// 3) Tipp auf die Fläche: nur in der App sichtbar, nichts hochgeladen, Zustand bleibt
await page.evaluate(() => navigator.clipboard.writeText('unverändert'));
await page.click('#weghint'); await page.waitForTimeout(200);
const l3 = await lage();
check('antippen: Zettel zum Bearbeiten sichtbar, Zustand bleibt', l3.hidden && !l3.weg && !l3.hint && l3.knopf === 'Zettel einblenden' && l3.sichtbar === 'visible', JSON.stringify(l3));
check('antippen: nichts hochgeladen', (await page.evaluate(() => navigator.clipboard.readText())) === 'unverändert');
await page.evaluate(() => { textEl.selectionStart = textEl.selectionEnd = textEl.value.length; textEl.insertText(' und Brot'); }); await page.waitForTimeout(300);
check('bearbeiten: Status bleibt „Hintergrund bereit“', /^Hintergrund bereit/.test(await txt('#saved')), await txt('#saved'));
// 4) Einblenden lädt das Zettelbild hoch – kein weiteres „Aufs Display kleben“ nötig
await page.click('#hide'); await page.waitForTimeout(1500);
const l4 = await lage(), p4 = await mitte();
check('einblenden: Zettel da, Knopf „ausblenden“', !l4.hidden && !l4.weg && !l4.hint && l4.knopf === 'Zettel ausblenden', JSON.stringify(l4));
check('einblenden: Bild mit Zettel (gelb)', p4[0] > 200 && p4[1] > 200 && p4[2] < 200, JSON.stringify(p4));
check('einblenden: Status „Bild bereit“ mit neuem Text', /^Bild bereit/.test(l4.saved) && (await page.evaluate(() => state.pinned.text === 'Milch kaufen und Brot')), l4.saved);
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
// 5) Ausgeblendet + „Aufs Display kleben“ = einblenden
await page.click('#hide'); await page.waitForTimeout(1500);
check('wieder ausgeblendet', (await lage()).weg);
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await page.click('#stick'); await page.waitForTimeout(1500);
const l5 = await lage();
check('kleben beendet das Ausblenden', !l5.hidden && !l5.weg && l5.knopf === 'Zettel ausblenden', JSON.stringify(l5));
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
// 6) Ausgeblendet, Zettel leer, „einblenden“: Zettel erscheint zum Schreiben, Hinweis, nichts hochgeladen
await page.click('#hide'); await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('toast').hidden = true; state.text = ''; textEl.value = ''; persist(); navigator.clipboard.writeText('unverändert'); });
await page.click('#hide'); await page.waitForTimeout(500);
const l6 = await lage();
check('leer + einblenden: Zettel zum Schreiben, Hinweis', l6.hidden && !l6.weg && (await txt('#status')) === 'Erst was draufschreiben.', JSON.stringify(l6) + ' ' + await txt('#status'));
check('leer + einblenden: nichts hochgeladen', (await page.evaluate(() => navigator.clipboard.readText())) === 'unverändert');
// 7) Ohne Foto lässt sich nichts ausblenden; Zustand unverändert
await page.evaluate(() => { textEl.value = 'Milch'; onTextChanged(); flush(); });
await page.click('#hide'); await page.waitForTimeout(1500);   // einblenden
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await page.click('#bgclear'); await page.waitForTimeout(200);
await page.click('#hide'); await page.waitForTimeout(500);
const l7 = await lage();
check('ohne Foto: Hinweis, nicht ausgeblendet', !l7.hidden && !l7.weg && (await txt('#status')).startsWith('Kein Hintergrundfoto'), JSON.stringify(l7));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
