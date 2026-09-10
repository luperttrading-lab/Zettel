// Test der Review-Befunde (1.36.4): Schnappschuss im Tipp, Laufnummer beim Foto, Überlaufprüfung mit geladener Schrift,
// Fallback ohne Zwischenablage, Hinweise räumen, Überlauf-Hinweis nur beim Übergang, Marken stapeln, alter Eintrag.
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_review.mjs <ausgabeverzeichnis>
//   Chromium-Pfad per PW_CHROMIUM überschreibbar (Standard: /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3 });   // schmalstes aktuelles iPhone
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8766' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };const txt = sel => page.evaluate(s => document.querySelector(s).textContent, sel);
const zeile = () => page.evaluate(() => document.getElementById('satz').textContent);
const meldungText = () => page.evaluate(() => meldung);   // seit 1.39 teilen sich Zustand und Meldung eine Zeile

const zeilen = n => Array.from({ length: n }, (_, i) => 'Zeile ' + (i + 1) + ' Einkauf').join('\n');
const fotoSetzen = (farbe = '#204080') => page.evaluate(async f => { const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = f; g.fillRect(0, 0, 1179, 2556); localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady; }, farbe);
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.evaluate(() => { textEl.value = 'Milch kaufen'; onTextChanged(); flush(); });
// A) Änderung während des Renderns: toBlob künstlich verzögert, Text 100 ms nach dem Tipp geändert
await page.evaluate(() => { const orig = HTMLCanvasElement.prototype.toBlob; window._origToBlob = orig; HTMLCanvasElement.prototype.toBlob = function (cb, ...a) { setTimeout(() => orig.call(this, cb, ...a), 700); }; });
await page.click('#stick'); await page.waitForTimeout(100);
await page.evaluate(() => textEl.insertText(' und Brot')); await page.waitForTimeout(1500);
check('A: nicht als bereit gemeldet', await page.evaluate(() => state.pinned === null), await zeile());
check('A: Meldung „währenddessen geändert“', (await zeile()).startsWith('Der Zettel wurde währenddessen geändert'), await zeile());
await page.click('#stick'); await page.waitForTimeout(1500);
check('A: unverändert → Bild bereit', (await page.evaluate(() => lage() === 'wartet' && state.pinned.text === 'Milch kaufen und Brot')), await zeile());
await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window._origToBlob; });
// B) ✕ während des Dekodierens: das Foto darf nicht wiederauferstehen; zweites Foto direkt nach dem ersten gewinnt
const rB = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden();
  document.getElementById('bgclear').click();   // sofort, vor onload
  await new Promise(r => setTimeout(r, 400));
  return { bild: !!bgImage, kennung: bgKennung, gespeichert: localStorage.getItem('zettel.bg'), vorschau: document.querySelector('.top').classList.contains('foto') };
});
check('B: ✕ während Dekodieren → kein Foto', !rB.bild && rB.kennung === '' && rB.gespeichert === null && !rB.vorschau, JSON.stringify(rB));
const rB2 = await page.evaluate(async () => {
  const mk = f => { const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = f; g.fillRect(0, 0, 1179, 2556); return c.toDataURL('image/jpeg', 0.9); };
  localStorage.setItem('zettel.bg', mk('#204080')); bgLaden(); const k1 = bgKennung;
  localStorage.setItem('zettel.bg', mk('#802040')); bgLaden(); const k2 = bgKennung;
  await new Promise(r => setTimeout(r, 500));
  const c = document.createElement('canvas'); c.width = 4; c.height = 4; c.getContext('2d').drawImage(bgImage, 0, 0, 4, 4); const px = [...c.getContext('2d').getImageData(1, 1, 1, 1).data].slice(0, 3);
  return { k1, k2, kennung: bgKennung, px };
});
check('B: zweites Foto gewinnt', rB2.kennung === rB2.k2 && rB2.k1 !== rB2.k2 && rB2.px[0] > 100 && rB2.px[2] < 100, JSON.stringify(rB2));
// C) renderPng prüft den Überlauf selbst (mit geladener Schrift) und lehnt ab
await page.evaluate(() => { textEl.value = 'Zeile 1\n'.repeat(45); onTextChanged(); flush(); });
const rC = await page.evaluate(() => renderPng().then(() => 'ok', e => e.message));
check('C: renderPng lehnt Überlauf ab', rC.startsWith('Zu viel Text'), rC);
// D) Fallback ohne Zwischenablage meldet den Render-Fehler (hier: Überlauf) statt zu schweigen
const rD = await page.evaluate(async () => {
  const orig = navigator.clipboard; Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  textUeberlauf = false;   // Vorprüfung im Tipp umgehen, damit der Fehler im Fallback-Pfad auftritt
  const alt = ueberlauf; window.ueberlauf = () => false; stickViaShortcut(); window.ueberlauf = alt;
  await new Promise(r => setTimeout(r, 800));
  Object.defineProperty(navigator, 'clipboard', { value: orig, configurable: true });
  return meldung;
});
check('D: Fallback meldet Fehler', rD.startsWith('Zu viel Text'), rD);
await page.evaluate(() => { textEl.value = 'Milch kaufen'; onTextChanged(); flush(); }); await page.waitForTimeout(200);
// E) Hinweis „Kein Hintergrundfoto“ verschwindet, sobald ein Foto gewählt ist
await page.evaluate(() => document.getElementById('bgclear').click());   // seit 3.15 im Lage-Fenster, dort unsichtbar bis es offen ist
await page.waitForTimeout(100);
await page.click('#hide'); await page.waitForTimeout(500);
check('E: Hinweis ohne Foto', (await zeile()).startsWith('Kein Hintergrundfoto'), await zeile());
await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 3000; c.height = 4000; const g = c.getContext('2d'); g.fillStyle = '#204080'; g.fillRect(0, 0, 3000, 4000); const blob = await new Promise(r => c.toBlob(r, 'image/png')); await bgSetzen(new File([blob], 'f.png', { type: 'image/png' })); await bgReady; });
check('E: Hinweis nach Fotowahl weg', (await meldungText()) === '', await zeile());
// F) Überlauf + Ausblenden: der Hinweis „nur Hintergrund“ überlebt weitere syncPreview-Läufe; beide Marken sichtbar, nicht überlappend
await page.evaluate(() => { textEl.value = 'Zeile 1\n'.repeat(45); onTextChanged(); flush(); }); await page.waitForTimeout(200);
await page.click('#hide'); await page.waitForTimeout(1500);
check('F: ausgeblendet trotz Überlauf', (await page.evaluate(() => state.hidden === true && lage() === 'wartet')), await zeile());
await page.evaluate(() => { syncPreview(); window.dispatchEvent(new Event('resize')); }); await page.waitForTimeout(200);
check('F: Zustand überlebt syncPreview', (await page.evaluate(() => lage() === 'wartet')), await zeile());
const rF = await page.evaluate(() => { const o = document.getElementById('overpin').getBoundingClientRect(); const n = document.getElementById('note').getBoundingClientRect();
  return { over: !document.getElementById('overpin').hidden, imZettel: o.left >= n.left - 12 && o.right <= n.right + 12, overW: Math.round(o.width), noteW: Math.round(n.width),
           zeileH: Math.round(document.getElementById('status').getBoundingClientRect().height) }; });
check('F: Überlaufmarke sichtbar und im Zettel', rF.over && rF.imZettel, JSON.stringify(rF));
check('F: Marke schmaler als der Zettel (375 px)', rF.overW < rF.noteW, rF.overW + ' < ' + rF.noteW);
check('F: Zustandszeile bricht nur für Meldungen um', await page.evaluate(() => document.getElementById('status').classList.contains('lang')), String(rF.zeileH));
await page.screenshot({ path: out + '/review_375.png' });
// autoRun-Wortlaut in der Kopfzeile ebenfalls einzeilig (ohne Navigation: nur Marke/Kopfzeile aus einem Eintrag rechnen)
const rG = await page.evaluate(() => { const el = document.getElementById('satz'); return { passt: el.scrollWidth <= el.clientWidth + 1, t: el.textContent }; });
check('G: Zustandszeile passt bei 375 px', rG.passt, JSON.stringify(rG));
// H) alter Eintrag: „Stand unbekannt“, kein „geändert“ (Text vorher kürzen, sonst hat die Überlaufwarnung Vorrang)
await page.evaluate(() => { textEl.value = 'Milch'; onTextChanged(); flush(); }); await page.waitForTimeout(300);
await page.evaluate(() => { state.pinned = { text: state.text, color: state.color, at: Date.now() }; updatePinBadge(); });
check('H: alter Eintrag', (await zeile()) === 'Stand unbekannt', await zeile());
// Überlauf: die Befestigungsvorschau ragt seit jeher ~20 px über (harmlos); alles andere muss in 375 px passen
const sw = await page.evaluate(() => ({ gesamt: document.documentElement.scrollWidth, ohneVorschau: Math.round(Math.max(...[...document.querySelectorAll('body *')].filter(e => !e.closest('#fastener-preview, .strip, #fcolors') && e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect().right))) }));   // Schieber scrollen intern, die Vorschau ragt seit jeher über
check('scrollWidth ≤ 395 bei 375 px', sw.gesamt <= 395, String(sw.gesamt));
check('kein Element außer der Befestigungsvorschau breiter als 375 px', sw.ohneVorschau <= 375, String(sw.ohneVorschau));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
