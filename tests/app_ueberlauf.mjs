// Test Punkt 5: Zu viel Text – Warnung in Vorschau und Status, Kleben/Teilen gesperrt; Parität des Flags mit dem Server.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_ueberlauf.mjs <ausgabeverzeichnis>
//   Chromium-Pfad per PW_CHROMIUM überschreibbar (Standard: /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { renderZettel } from '../lib/render.js';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8766' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
// Seit 1.46.0 liegen ausblenden/teilen/leeren und das Hintergrundfoto im Fenster „Und jetzt?“:
// aufmachen, tippen, wieder zumachen – genau wie beim Menschen. Bleibt es offen, verdeckt es alles.
const imFenster = async (sel, opt) => {
  await page.evaluate(() => { const s = document.getElementById('sheet'); if (s && s.hidden) document.getElementById('mehr-btn').click(); });
  await page.waitForTimeout(150);
  try { await page.click(sel, opt); } finally {
    await page.evaluate(() => { const s = document.getElementById('sheet'); if (s && !s.hidden) document.getElementById('sheet-zu').click(); });
    await page.waitForTimeout(120);
  }
};
const txt = sel => page.evaluate(s => document.querySelector(s).textContent, sel);
const zeile = () => page.evaluate(() => meldung);   // seit 1.39 teilen sich Zustand und Meldung eine Zeile
const zeilen = n => Array.from({ length: n }, (_, i) => 'Zeile ' + (i + 1) + ' Einkauf').join('\n');
const setText = v => page.evaluate(v => { textEl.value = v; onTextChanged(); flush(); }, v);
// Rückkehr in die App: der Kurzbefehl gilt als gelaufen, der Hauptknopf ist wieder da (statt der Ansage)
const zurueckInDieApp = () => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
});
const lage = () => page.evaluate(() => ({ over: textUeberlauf, pin: !document.getElementById('overpin').hidden, blocked: document.getElementById('stick').classList.contains('blocked') && document.getElementById('share').classList.contains('blocked'), status: meldung, h: document.getElementById('note').offsetHeight }));
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
// 1) kurzer Text: nichts gesperrt
await setText('Milch kaufen'); await page.waitForTimeout(200);
const l1 = await lage();
check('kurz: kein Überlauf', !l1.over && !l1.pin && !l1.blocked && l1.status === '', JSON.stringify(l1));
// 2) langer Text: Warnung, Sperre, Vorschau gewachsen
await setText(zeilen(40)); await page.waitForTimeout(300);
const l2 = await lage();
check('lang: Überlauf erkannt', l2.over && l2.pin && l2.blocked, JSON.stringify({ ...l2, status: l2.status.slice(0, 30) }));
check('lang: Status warnt', l2.status.startsWith('Zu viel Text'), l2.status);
check('lang: Vorschau gewachsen', l2.h > l1.h + 20, l1.h + ' → ' + l2.h);
check('lang: Schrift auf Minimum', await page.evaluate(() => { const f = fitNote(1179, 2556, 'phone', noteText()); return f.overflow && f.fs <= Math.ceil(f.noteW / 28); }));
await page.screenshot({ path: out + '/t5_ueberlauf.png' });
await page.evaluate(() => navigator.clipboard.writeText('unverändert'));
await page.click('#stick'); await page.waitForTimeout(800);
check('Kleben gesperrt', (await zeile()).startsWith('Zu viel Text'), await zeile());
check('nichts kopiert', (await page.evaluate(() => navigator.clipboard.readText())) === 'unverändert');
check('nichts gemerkt', await page.evaluate(() => state.pinned === null));
await imFenster('#share'); await page.waitForTimeout(800);
check('Teilen gesperrt', (await zeile()).startsWith('Zu viel Text') && (await page.evaluate(() => document.getElementById('overlay').hidden)));
// Ausblenden bleibt möglich (Zettel ist nicht im Bild)
await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556); localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady; });
await imFenster('#hide'); await page.waitForTimeout(1500);
check('Ausblenden trotz Überlauf möglich', await page.evaluate(() => state.hidden === true && lage() === 'wartet'), await txt('#satz'));
// 3) kürzen: alles wieder frei
await zurueckInDieApp(); await page.waitForTimeout(200);
await imFenster('#hide'); await page.waitForTimeout(1500);   // wieder einblenden
await zurueckInDieApp(); await page.waitForTimeout(200);
await setText(zeilen(3)); await page.waitForTimeout(300);
const l3 = await lage();
check('gekürzt: frei', !l3.over && !l3.pin && !l3.blocked, JSON.stringify(l3));
check('gekürzt: Status ohne Warnung', !l3.status.startsWith('Zu viel Text'), l3.status);
await page.click('#stick'); await page.waitForTimeout(1500);
check('gekürzt: Kleben geht', await page.evaluate(() => state.hidden === false && lage() === 'wartet'), await txt('#satz'));
// 4) Grenze suchen und Parität mit dem Server
let grenze = 0;
for (let n = 4; n <= 60; n++) { const o = await page.evaluate(v => fitNote(1179, 2556, 'phone', v).overflow, zeilen(n)); if (o) { grenze = n; break; } }
check('Grenze gefunden', grenze > 4, 'erste Überlauf-Zeilenzahl ' + grenze);
const app = {}; const srv = {};
for (const n of [3, grenze - 2, grenze - 1, grenze, grenze + 1, 40]) {
  app[n] = await page.evaluate(v => { const f = fitNote(1179, 2556, 'phone', v); return { o: f.overflow, fs: f.fs, ln: f.lines.length }; }, zeilen(n));
  const r = await renderZettel({ text: zeilen(n), w: 1179, h: 2556 });
  srv[n] = { o: r.overflow, fs: r.fontSize, ln: r.lines };
  console.log('  n=' + n, 'App', JSON.stringify(app[n]), 'Server', JSON.stringify(srv[n]));
}
check('Parität klar unter der Grenze', app[3].o === false && srv[3].o === false && app[grenze - 2].o === false && srv[grenze - 2].o === false);
check('Parität klar über der Grenze', app[grenze + 1].o === true && srv[grenze + 1].o === true && app[40].o === true && srv[40].o === true);
check('Parität an der Grenze (±1 Zeile toleriert)', srv[grenze].o === true || srv[grenze + 1].o === true);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
