// Test 1.37.1: Überschrift auf liniertem/kariertem Papier im Linienraster – Parität App ↔ Server (Schriftgröße, Zeilen,
// Raster) für alle drei Überschriftgrößen und mehrere Schriften; Vorschau setzt die Lage der Überschrift; glatt unverändert.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_titelraster.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs). Schreibt Vorschau und Bild (App) sowie Server-PNG zum Vergleich.
import { chromium } from 'playwright';
import { renderZettel } from '../lib/render.js';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
const TEXT = 'To Do Liste\n• Einkaufen\n• Hund füttern\n• Friseur\n• Hausaufgaben';
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.evaluate(async () => { await document.fonts.ready; for (const k of Object.keys(FONTS)) { state.font = k; await ensureFont(); } state.font = 'caveat'; });
const setze = o => page.evaluate(o => { Object.assign(state, o); noteTitleOn = state.title; noteTitleF = TITLE_F[state.titleSize]; textEl.value = state.text; applyFont(); syncPreview(); updatePinBadge(); persist(); }, o);
const appFit = () => page.evaluate(() => { const f = fitNote(1179, 2556, 'phone', noteText()); return { fs: f.fs, ln: f.lines.length, raster: f.raster, gap: Math.round(f.titleGap) }; });
const vorschau = () => page.evaluate(() => { const d = document.querySelector('#text .ln'); return { mt: d.style.marginTop, mb: d.style.marginBottom, uo: d.style.textUnderlineOffset }; });
// 1) Parität über Größen, Papiere und Schriften
for (const font of ['caveat', 'kalam', 'marker', 'gloria']) for (const paper of ['plain', 'lined', 'grid']) for (const titleSize of [1, 2, 3]) {
  await setze({ text: TEXT, title: true, titleSize, paper, font, list: 'none', fontScale: 100 });
  const a = await appFit();
  const r = await renderZettel({ text: TEXT, title: true, titleSize, paper, font, w: 1179, h: 2556 });
  // Caveat ist exakt paritätisch. Kalam, Marker und Gloria weichen seit jeher um wenige Pixel ab (Breitenmessung
  // Canvas vs. Breitentabelle, unabhängig von Überschrift und Papier) – dort nur Raster, Zeilen und Toleranz prüfen.
  const ok = font === 'caveat' ? (a.fs === r.fontSize && a.ln === r.lines && a.raster === r.raster) : (Math.abs(a.fs - r.fontSize) <= 8 && a.ln === r.lines && a.raster === r.raster);
  check(`Parität ${font} ${paper} Größe ${titleSize}`, ok, `App ${JSON.stringify(a)} Server fs=${r.fontSize} ln=${r.lines} raster=${r.raster}`);
  if (paper === 'plain') check(`  glatt: kein Raster, Abstand bleibt`, a.raster === 0 && a.gap > 0, JSON.stringify(a));
  else check(`  Raster ${titleSize === 1 ? 1 : 2}`, a.raster === (titleSize === 1 ? 1 : 2), JSON.stringify(a));
}
// 2) Vorschau: Lage der Überschrift nur im Raster gesetzt
await setze({ text: TEXT, title: true, titleSize: 3, paper: 'lined', font: 'caveat' });
const v1 = await vorschau();
check('Vorschau liniert: Lage gesetzt', v1.mt.endsWith('px') && v1.mb.endsWith('px') && v1.uo.endsWith('px'), JSON.stringify(v1));
await page.screenshot({ path: out + '/titelraster_app_liniert.png' });
let png = await page.evaluate(async () => (await renderWallpaper(1179, 2556, 'phone')).toDataURL('image/png'));
fs.writeFileSync(out + '/titelraster_wp_liniert.png', Buffer.from(png.split(',')[1], 'base64'));
fs.writeFileSync(out + '/titelraster_srv_liniert.png', (await renderZettel({ text: TEXT, title: true, titleSize: 3, paper: 'lined', w: 1179, h: 2556 })).png);
await setze({ text: TEXT, title: true, titleSize: 3, paper: 'plain', font: 'caveat' });
const v2 = await vorschau();
check('Vorschau glatt: keine Lage (CSS gilt)', v2.mt === '' && v2.mb === '' && v2.uo === '', JSON.stringify(v2));
await setze({ text: TEXT, title: false, paper: 'lined', font: 'caveat' });
const v3 = await vorschau();
check('ohne Überschrift: keine Lage', v3.mt === '' && v3.mb === '', JSON.stringify(v3));
// 3) Körper-Zeilen liegen im Raster: Oberkante jeder Körperzeile = textTop + (raster·k + i)·lh (aus fitNote)
await setze({ text: TEXT, title: true, titleSize: 3, paper: 'lined', font: 'caveat' });
const geo = await page.evaluate(() => { const f = fitNote(1179, 2556, 'phone', noteText()); const k = f.lines.filter(l => l.p === 0).length; let y = 0; const tops = []; f.lines.forEach(l => { if (l.p === 0) y += f.raster * f.lh; else { tops.push(y); y += f.lh; } }); return { k, lh: f.lh, tops, rest: tops.map(t => +(t % f.lh).toFixed(6)) }; });
check('Körperzeilen im Linienraster', geo.rest.every(r => r < 1e-6 || Math.abs(r - geo.lh) < 1e-6), JSON.stringify(geo));
// 4) Mehrzeilige Überschrift: Block = k·raster·lh, Server gleich
const LANG = 'Was ich heute unbedingt noch erledigen muss\n• Einkaufen\n• Hund füttern';
await setze({ text: LANG, title: true, titleSize: 3, paper: 'grid', font: 'caveat' });
const a4 = await appFit(); const r4 = await renderZettel({ text: LANG, title: true, titleSize: 3, paper: 'kariert', w: 1179, h: 2556 });
check('mehrzeilige Überschrift: Parität', a4.fs === r4.fontSize && a4.ln === r4.lines, `App ${JSON.stringify(a4)} Server fs=${r4.fontSize} ln=${r4.lines}`);
fs.writeFileSync(out + '/titelraster_srv_lang.png', r4.png);
png = await page.evaluate(async () => (await renderWallpaper(1179, 2556, 'phone')).toDataURL('image/png'));
fs.writeFileSync(out + '/titelraster_wp_lang.png', Buffer.from(png.split(',')[1], 'base64'));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
