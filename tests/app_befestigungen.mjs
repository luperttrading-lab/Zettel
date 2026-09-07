// Test: mehrere Befestigungen auf einem Zettel – verschieben, dazulegen, wegnehmen, Art wechseln;
// dazu die Parität der Schriftgröße zwischen App (fitNote) und Server (renderZettel).
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_befestigungen.mjs <ausgabeverzeichnis>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { renderZettel } from '../lib/render.js';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log((ok ? 'OK  ' : 'FEHL') + ' ' + name + (info ? ' – ' + info : '')); };
const TEXT = 'To Do Liste\n· Rasen wässern\n· Nadine anrufen\n· Kleinanzeigen';

await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(700);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(800);
await page.evaluate(t => { $('text').value = t; $('text').dispatchEvent(new Event('input')); }, TEXT);
await page.waitForTimeout(300);

const liste = () => page.evaluate(() => state.fasteners.map(x => ({ a: x.art, x: x.x === undefined ? null : +x.x.toFixed(3), y: x.y === undefined ? null : +x.y.toFixed(3), v: !!x.vier, c: x.color || null })));
const waehle = async art => { await page.evaluate(a => waehleBefestigung(a), art); await page.waitForTimeout(250); };
const karteAuf = async () => { await page.evaluate(() => { if ($('fcolors').hidden) toggleFcolors(true); else buildPalette(); }); await page.waitForTimeout(150); };
const knopf = async cls => { await page.evaluate(c => document.querySelector('#fcolors .chip.' + c).click(), cls); await page.waitForTimeout(250); };
const griffMitte = i => page.evaluate(i => { const g = document.querySelectorAll('.griff')[i]; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
const ziehen = async (i, dx, dy) => { const g = await griffMitte(i); await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + dx, g.y + dy, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(250); };

// 1) Aus dem alten Zustand wird eine Liste
check('Start: eine Befestigung', (await liste()).length === 1, JSON.stringify(await liste()));
check('ein Griff da', await page.evaluate(() => document.querySelectorAll('.griff').length) === 1);

// 1b) Alte Zettel mit „Zwei Nadeln“ werden in zwei einzelne umgeschrieben
await page.evaluate(() => {
  const alt = JSON.parse(localStorage.getItem('zettel.v1') || '{}');
  delete alt.fasteners; alt.fastener = 'pin2';
  localStorage.setItem('zettel.v1', JSON.stringify(alt));
});
await page.reload(); await page.waitForTimeout(800);
const migriert = await liste();
check('pin2 wird zu zwei Nadeln', migriert.length === 2 && migriert.every(x => x.a === 'pin'), JSON.stringify(migriert));
check('die zweite in der Gegenfarbe', migriert[1].c === 'blue', String(migriert[1].c));
check('„Zwei Nadeln“ steht nicht mehr zur Wahl', await page.evaluate(() => !document.querySelector('#strip-fastener .item[data-value="pin2"]')));
await page.evaluate(t => { $('text').value = t; $('text').dispatchEvent(new Event('input')); }, TEXT);
// für die folgenden Punkte wieder auf eine einzelne zurück
await page.evaluate(() => { state.fasteners = [{ art: 'tape' }]; state.fastener = 'tape'; aktiveBef = 0; applyFastener(); persist(); });
await page.waitForTimeout(250);

// 2) Verschieben kommt an – und bleibt es auch nach dem Neuzeichnen
await waehle('magnet');
const vor = (await liste())[0];
await ziehen(0, 40, 90);
const nach = (await liste())[0];
check('Magnet verschoben', nach.x !== null && nach.y !== null && nach.y > 0.2, JSON.stringify(nach));
const wieder = await page.evaluate(() => { syncPreview(); return state.fasteners[0].y; });
check('Platz übersteht das Neuzeichnen', Math.abs(wieder - nach.y) < 0.001);

// 3) Dazulegen und wegnehmen
await karteAuf(); await knopf('plus');
check('zwei Magnete', (await liste()).length === 2, JSON.stringify(await liste()));
check('zwei Griffe', await page.evaluate(() => document.querySelectorAll('.griff').length) === 2);
await ziehen(1, -60, 30);
check('auch der zweite lässt sich ziehen', (await liste())[1].x !== null);
await karteAuf(); await knopf('minus');
check('wieder einer', (await liste()).length === 1);

// 4) Art wechseln: gleiche Regelgruppe behält die Plätze, andere Gruppe ist bei mehreren gesperrt
await karteAuf(); await knopf('plus');
const zwei = await liste();
await waehle('thumbtack');
const getauscht = await liste();
check('alle sind Zwecken', getauscht.every(x => x.a === 'thumbtack') && getauscht.length === 2);
check('Plätze bleiben', Math.abs(getauscht[0].x - zwei[0].x) < 0.001 && Math.abs(getauscht[1].y - zwei[1].y) < 0.001);
await waehle('tape');
check('Klebestreifen bei zwei Stück gesperrt', (await liste()).every(x => x.a === 'thumbtack'));
check('mit Erklärung statt stiller Ablehnung', /erst mit nur einer/.test(await page.evaluate(() => $('satz').textContent)), await page.evaluate(() => $('satz').textContent));
await karteAuf(); await knopf('minus');
await waehle('tape');
const t = await liste();
check('mit einem Stück geht der Wechsel', t.length === 1 && t[0].a === 'tape' && t[0].x === null, JSON.stringify(t));

// 5) Klebestreifen bleibt waagerecht an der Kante, Büroklammer oben
await ziehen(0, -80, 200);
const s1 = (await liste())[0];
check('Streifen springt an die Unterkante', s1.y === 1, JSON.stringify(s1));
await waehle('clip');
await ziehen(0, -80, 200);
const c1 = (await liste())[0];
check('Klammer bleibt oben', Math.abs(c1.y - 0.012) < 0.002 && c1.x < 0.86, JSON.stringify(c1));

// 6) Eckstreifen: + macht vier
await waehle('tape2');
await karteAuf(); await knopf('plus');
check('vier Eckstreifen', (await liste())[0].v === true);
check('vier Griffe', await page.evaluate(() => document.querySelectorAll('.griff').length) === 4);
await karteAuf(); await knopf('minus');
check('wieder zwei', (await liste())[0].v === false);

// 7) Parität App ↔ Server: derselbe Text, dieselben Plätze, dieselbe Schriftgröße
await waehle('magnet');
const faelle = [
  { name: 'einer am Standardplatz', pos: [] },
  { name: 'einer in der Blattmitte', pos: [[30, 55]] },
  { name: 'zwei, einer oben',        pos: [[50, 2], [20, 60]] },
  { name: 'zwei, beide unten',       pos: [[25, 55], [75, 55]] },
];
// Langer Text: nur dann hängt die Schriftgröße überhaupt vom Innenabstand ab. Bei kurzem Text
// erreicht sie ihr Maximum und der Unterschied fiele gar nicht auf.
const LANG = Array.from({ length: 11 }, (_, i) => 'Zeile ' + (i + 1) + ' mit etwas Text').join('\n');
for (const f of [...faelle.map(x => ({ ...x, text: TEXT })), ...faelle.map(x => ({ ...x, name: x.name + ' (langer Text)', text: LANG }))]) {
  await page.evaluate(p => {
    state.fasteners = p.length ? p.map(([x, y]) => ({ art: 'magnet', x: x / 100, y: y / 100 })) : [{ art: 'magnet' }];
    aktiveBef = 0; applyFastener();
  }, f.pos);
  await page.waitForTimeout(200);
  const app = await page.evaluate(t => { const f = fitNote(1179, 2556, 'phone', t); return { fs: f.fs, ln: f.lines.length }; }, f.text);
  const srv = await renderZettel({ text: f.text, fastener: 'magnet', fastenerPos: f.pos.map(([x, y]) => x + ',' + y).join(';'), w: 1179, h: 2556 });
  check('Parität: ' + f.name, app.fs === srv.fontSize && app.ln === srv.lines, `App fs=${app.fs} ln=${app.ln} · Server fs=${srv.fontSize} ln=${srv.lines}`);
}

// 8) Nichts läuft aus dem Bild
await page.evaluate(() => { state.fasteners = [{ art: 'magnet', x: 0.2, y: 0.15 }, { art: 'magnet', x: 0.8, y: 0.6 }]; aktiveBef = 0; applyFastener(); });
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/befestigungen.png' });
check('scrollWidth ≤ 408 bei 390 px', await page.evaluate(() => document.documentElement.scrollWidth) <= 408, String(await page.evaluate(() => document.documentElement.scrollWidth)));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? '\n' + fails + ' FEHLER' : '\nALLE TESTS OK');
process.exit(fails ? 1 : 0);
