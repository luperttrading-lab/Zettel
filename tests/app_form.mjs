// Test 1.63.0: Höhe folgt dem Text (state.noteFit) und Neigung wählbar (state.noteRot).
//   Vorher war der Zettel immer quadratisch – bei fünf Terminzeilen blieb rund ein Drittel leer –
//   und die Neigung stand an fünf Stellen fest auf −2,5°.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_form.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import { renderZettel } from '../lib/render.js';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FEHL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
const masse = t => page.evaluate(async t => {
  textEl.value = t; onTextChanged(); flush(); await ensureFont(); if (document.fonts) await document.fonts.ready; syncPreview();
  const tc = targetCanvas(), f = fitNote(tc.w, tc.h, tc.layout, noteText());
  return { w: f.noteW, h: f.noteH, fs: f.fs, zeilen: f.lines.length, lh: f.lh, pad: f.pad, inset: f.inset };
}, t);

// 1) Wenig Text → flacher Zettel, viel Text → quadratisch (nie höher)
await page.evaluate(() => { state.list = 'termin'; state.noteScale = 0.58; });
const kurz = await masse('Fr. 7:45 Auto Werkstatt\nFr. 12:00 Frisör\nMo. 9:20 Melody');
check('wenig Text: Zettel flacher als breit', kurz.h < kurz.w * 0.9, JSON.stringify(kurz));
check('wenig Text: höchstens ein Zeilenabstand ungenutzt',
  kurz.h - (kurz.zeilen * kurz.lh + 2 * kurz.pad + kurz.inset) < kurz.lh, JSON.stringify(kurz));
const viel = await masse(Array.from({ length: 14 }, (_, i) => 'Mo. 1' + (i % 10) + ':30 Termin Nummer ' + i).join('\n'));
// Nie höher als breit – genau quadratisch wird der Zettel selten, weil die Schriftsuche vorher
// verkleinert, bis jeder Absatz auf eine Zeile passt. Viel Text füllt ihn aber fast aus.
check('viel Text: nie höher als breit', viel.h <= viel.w, JSON.stringify(viel));
check('viel Text: füllt den Zettel weitgehend', viel.h > viel.w * 0.85, JSON.stringify(viel));
// 2) Mindesthöhe: eine einzige Zeile macht keinen Strich
const eine = await masse('Milch');
check('eine Zeile: nicht flacher als 45 % der Breite', Math.abs(eine.h - Math.round(eine.w * 0.45)) <= 1, JSON.stringify(eine));
// 3) Umschalter „quadratisch“
await page.evaluate(() => { state.noteFit = false; syncPreview(); });
const quad = await masse('Fr. 7:45 Auto Werkstatt\nFr. 12:00 Frisör');
check('quadratisch: Höhe wie Breite', quad.h === quad.w, JSON.stringify(quad));
check('quadratisch: gleiche Schriftgröße wie mit Texthöhe', quad.fs === (await (async () => {
  await page.evaluate(() => { state.noteFit = true; syncPreview(); });
  return (await masse('Fr. 7:45 Auto Werkstatt\nFr. 12:00 Frisör')).fs;
})()), 'die Höhe darf die Schrift nicht verändern – sie hängt an der Breite');

// 4) Knöpfe im Fenster schalten den Zustand und zeigen ihn an
await page.evaluate(() => lageOeffnen(true)); await page.waitForTimeout(400);
const knopfStand = () => page.evaluate(() => ({ fit: state.noteFit,
  a: document.getElementById('lage-fit').getAttribute('aria-pressed'),
  b: document.getElementById('lage-quad').getAttribute('aria-pressed'),
  sichtbar: document.getElementById('lage-quad').getBoundingClientRect().width > 20 }));
check('Knopf „quadratisch“ ist sichtbar', (await knopfStand()).sichtbar, JSON.stringify(await knopfStand()));
await page.click('#lage-quad'); await page.waitForTimeout(250);
check('Tipp auf „quadratisch“ schaltet um', JSON.stringify(await knopfStand()) === JSON.stringify({ fit: false, a: 'false', b: 'true', sichtbar: true }), JSON.stringify(await knopfStand()));
await page.click('#lage-fit'); await page.waitForTimeout(250);
check('Tipp auf „nach Text“ schaltet zurück', (await knopfStand()).fit === true, JSON.stringify(await knopfStand()));

// 5) Drehskala: Wischen ändert den Winkel, Doppeltipp stellt gerade, Grenzen halten
const winkel = () => page.evaluate(() => state.noteRot);
check('Start: Standardneigung −2,5°', await winkel() === -2.5, String(await winkel()));
const box = await page.evaluate(() => { const r = document.getElementById('lage-dreh').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x - 45, box.y, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(250);
check('nach links wischen dreht nach rechts', await winkel() > 0, String(await winkel()));
await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x - 900, box.y, { steps: 20 }); await page.mouse.up();
await page.waitForTimeout(250);
check('Winkel bleibt in den Grenzen (15°)', await winkel() === 15, String(await winkel()));
check('Anzeige stimmt mit dem Wert', (await page.evaluate(() => document.getElementById('lage-dreh-out').textContent)) === '15°',
  await page.evaluate(() => document.getElementById('lage-dreh-out').textContent));
await page.dblclick('#lage-dreh'); await page.waitForTimeout(250);
check('Doppeltipp stellt gerade', await winkel() === 0, String(await winkel()));
await page.screenshot({ path: out + '/form_fenster.png' });

// 6) Der gedrehte Zettel bleibt ganz im Bild: die Klemmung rechnet mit dem gedrehten Umriss
const grenzen = g => page.evaluate(async g => {
  state.noteRot = g; state.noteScale = 1; syncPreview();
  const q = lageGrenzen(), tc = targetCanvas();
  const f = fitNote(tc.w, tc.h, tc.layout, noteText());
  const a = Math.abs(g * Math.PI / 180);
  return { minX: q.minX, breite: (f.noteW * Math.cos(a) + f.noteH * Math.sin(a)) / 2 / tc.w };
}, g);
for (const g of [0, 10, -15]) {
  const q = await grenzen(g);
  check('Klemmung bei ' + g + '° rechnet mit dem gedrehten Umriss', Math.abs(q.minX - q.breite) < 1e-9, JSON.stringify(q));
}
await page.evaluate(() => { state.noteRot = -2.5; lageOeffnen(false); });

// 7) Parität App ↔ Server. Geprüft wird, dass die **textabhängige Höhe** keine neue Abweichung
//    erzeugt: derselbe Text muss mit „nach Text“ genau so weit auseinanderliegen wie mit „quadratisch“.
//    Eine Abweichung von 1 px in der Schriftgröße gibt es bei manchen Texten schon länger – Canvas misst
//    minimal anders als die Breitentabelle des Servers (nachgemessen am Stand vor 1.63.0, siehe UEBERGABE).
//    Die Zeilenzahl und die Zettelhöhe müssen dagegen exakt stimmen.
const paar = async (t, nfit) => {
  const app = await page.evaluate(([t, nfit]) => {
    state.noteFit = nfit; state.list = 'none'; state.noteScale = 0.8; textEl.value = t; onTextChanged(); flush(); syncPreview();
    const f = fitNote(1179, 2556, 'phone', noteText());
    return { fs: f.fs, ln: f.lines.length, h: f.noteH };
  }, [t, nfit]);
  const srv = await renderZettel({ text: t, noteScale: 0.8, noteFit: nfit, w: 1179, h: 2556 });
  return { app, srv: { fs: srv.fontSize, ln: srv.lines }, d: app.fs - srv.fontSize };
};
for (const [name, t] of [['kurz', 'Fr. 7:45 Auto Werkstatt\nFr. 12:00 Frisör'],
                         ['lang', Array.from({ length: 9 }, (_, i) => 'Zeile ' + i + ' mit Text').join('\n')],
                         ['eine Zeile', 'Milch kaufen']]) {
  const mit = await paar(t, true), ohne = await paar(t, false);
  check('Parität ' + name + ': Texthöhe bringt keine neue Abweichung', mit.d === ohne.d,
    `nach Text ${mit.app.fs}/${mit.srv.fs} · quadratisch ${ohne.app.fs}/${ohne.srv.fs}`);
  check('Parität ' + name + ': gleiche Zeilenzahl', mit.app.ln === mit.srv.ln,
    `App ${mit.app.ln} · Server ${mit.srv.ln}`);
  const srvH = await renderZettel({ text: t, noteScale: 0.8, noteFit: true, w: 1179, h: 2556 });
  check('Parität ' + name + ': gleiche Zettelhöhe', mit.app.h === srvH.noteH,
    `App ${mit.app.h} · Server ${srvH.noteH}`);
}

// 8) Doppelpflege der Konstanten
const q1 = fs.readFileSync('index.html', 'utf8'), q2 = fs.readFileSync('lib/render.js', 'utf8');
check('NOTE_MIN_H steht in beiden Dateien mit demselben Wert',
  /NOTE_MIN_H = 0\.45/.test(q1) && /NOTE_MIN_H = 0\.45/.test(q2));
check('NOTE_ROT_STD/-MAX stehen in beiden Dateien mit denselben Werten',
  /NOTE_ROT_STD = -2\.5, NOTE_ROT_MAX = 15/.test(q1) && /NOTE_ROT_STD = -2\.5, NOTE_ROT_MAX = 15/.test(q2));
check('keine feste −2,5-Drehung mehr im Code', !/rotate\(-2\.5deg\)/.test(q2) && !/rotate\(-2\.5 \* Math\.PI/.test(q1),
  'in render.js: ' + /rotate\(-2\.5deg\)/.test(q2) + ', in index.html: ' + /rotate\(-2\.5 \* Math\.PI/.test(q1));

check('keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
console.log(fails ? fails + ' Prüfung(en) fehlgeschlagen' : 'alle Prüfungen bestanden');
await b.close();
process.exit(fails ? 1 : 0);
