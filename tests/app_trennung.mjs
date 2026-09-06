// Test Punkt 6: Foto getrennt vom Zustand; Beschriftung „Abzug, nicht Original“; Größenknöpfe nur mit Überschrift.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_trennung.mjs <ausgabeverzeichnis>
//   Chromium-Pfad per PW_CHROMIUM überschreibbar (Standard: /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.click('#text'); await page.keyboard.type('Milch kaufen'); await page.waitForTimeout(400);
// Foto über den echten Weg (bgSetzen mit Datei) – Ergebnis: JPEG, Displaygröße, getrennter Schlüssel
const r = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 3000; c.height = 4000; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 3000, 4000);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await bgSetzen(new File([blob], 'foto.png', { type: 'image/png' })); await bgReady;
  const t = targetCanvas();
  const bg = localStorage.getItem('zettel.bg'), st = localStorage.getItem('zettel.v1');
  return { jpeg: bg.startsWith('data:image/jpeg'), groesse: bgImage.naturalWidth + 'x' + bgImage.naturalHeight, ziel: t.w + 'x' + t.h, imZustand: st.includes('data:image'), zustandLaenge: st.length, banner: document.getElementById('update-text').textContent };
});
check('als JPEG gespeichert', r.jpeg);
check('auf Displaygröße zugeschnitten', r.groesse === r.ziel, r.groesse + ' vs ' + r.ziel);
check('Foto nicht im Zustand zettel.v1', !r.imZustand && r.zustandLaenge < 2000, String(r.zustandLaenge));
check('Banner beschriftet Abzug', r.banner.includes('nicht das Original'), r.banner);
await page.evaluate(() => markPinned());
check('pinned enthält nur die Kennung', await page.evaluate(() => /^\d+:[0-9a-f]+$/.test(state.pinned.bg) && !JSON.stringify(state.pinned).includes('data:image')));
// Zettel leeren lässt das Foto stehen
page.once('dialog', d => d.accept());
await page.click('#clear'); await page.waitForTimeout(300);
check('Leeren: Text weg, Foto bleibt', await page.evaluate(() => state.text === '' && !!localStorage.getItem('zettel.bg') && !!bgImage));
// Anleitung nennt Abzug und Original
check('Anleitung beschriftet', await page.evaluate(() => /zugeschnittenen JPEG-Abzug/.test(document.querySelector('.setup').textContent) && /nicht das Original/.test(document.querySelector('.setup').textContent)));
// Größenknöpfe nur bei eingeschalteter Überschrift sichtbar
const sichtbar = () => page.evaluate(() => getComputedStyle(document.getElementById('tsizes')).display !== 'none');
check('Größenknöpfe ohne Überschrift unsichtbar', !(await sichtbar()));
await page.click('#titleon'); await page.waitForTimeout(100);
check('Größenknöpfe mit Überschrift sichtbar', await sichtbar());
await page.click('#titleon'); await page.waitForTimeout(100);
check('wieder unsichtbar', !(await sichtbar()));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
