// Test 3.17: Zeilen umsortieren. Lang auf eine Zeile drücken → alle Zeilen wackeln, dann lassen sie
// sich ziehen. Der Bereich links auf der Markierung und rechts hinter dem Text gehört weiter dem
// Haken; gedrückt wird **im** Text. Nicht bei Terminen (dort ordnet die Uhrzeit) und nicht bei Wasser.
//
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_sortieren.mjs <ausgabeverzeichnis>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const kontext = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await kontext.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FEHL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1100);

// Text **ohne** Markierungen übergeben – relist setzt sie mit dem richtigen Trennzeichen (NB). Von
// Hand geschriebene Markierungen erkennt PREFIX_RE nicht, dann steht am Ende „1. 3. Gamma“ (gemessen).
const setze = (liste, text) => page.evaluate(([l, t]) => {
  document.querySelector('#strip-list .item[data-value="' + l + '"]').click();
  textEl.value = relist(t, l); onTextChanged(); flush(); syncPreview();
}, [liste, text]);
// Gegriffen wird **auf dem Text**, nicht in der Mitte der Zeilenbox: rechts hinter dem Text liegt der
// Haken-Bereich, und bei kurzen Zeilen fängt der schon vor der Boxmitte an (beim ersten Anlauf gemessen).
const zeilenKasten = i => page.evaluate(n => {
  const d = document.querySelectorAll('#text .ln')[n], r = d.getBoundingClientRect();
  const t = document.createRange(); t.selectNodeContents(d);
  const tr = t.getBoundingClientRect();
  const x = tr.width > 6 ? tr.left + Math.min(tr.width / 2, 24) : r.left + (parseFloat(getComputedStyle(d).paddingLeft) || 0) + 6;
  return { x, y: r.top + r.height / 2, h: r.height };
}, i);
const anSort = () => page.evaluate(() => document.getElementById('text').classList.contains('sortieren'));
const langDruecken = async i => {
  const k = await zeilenKasten(i);
  await page.mouse.move(k.x, k.y); await page.mouse.down();
  await page.waitForTimeout(700); await page.mouse.up(); await page.waitForTimeout(150);
  return k;
};

// 1) Modus an: alle Zeilen wackeln, der Editor nimmt keine Eingabe mehr
await setze('dash', 'Milch\nBrot\nButter\nKäse');
await page.waitForTimeout(200);
check('vorher kein Sortiermodus', !(await anSort()));
await langDruecken(1);
check('langes Drücken schaltet den Sortiermodus ein', await anSort());
const modus = await page.evaluate(() => ({
  editierbar: document.getElementById('text').isContentEditable,
  fertig: !document.getElementById('sortdone').hidden,
  animiert: getComputedStyle(document.querySelectorAll('#text .ln')[0]).animationName,
}));
check('Editor gesperrt, „Fertig“ da, Zeilen animiert',
  modus.editierbar === false && modus.fertig && modus.animiert === 'wackeln', JSON.stringify(modus));
// 3.18: Drehpunkt am linken Rand. Um die Mitte gedreht hob und senkte sich die linke Kante, und bei
// gegenläufigen Nachbarzeilen wirkte der Zeilenabstand dort ungleich (Auftraggeber am Bild).
const dreh = await page.evaluate(() => getComputedStyle(document.querySelectorAll('#text .ln')[0]).transformOrigin.split(' ')[0]);
check('gedreht wird um den linken Rand, nicht um die Mitte', dreh === '0px', dreh);

// 2) Ziehen ordnet um – zweite Zeile ganz nach oben, mit erneutem Greifen
const von = await zeilenKasten(1), nach = await zeilenKasten(0);
await page.mouse.move(von.x, von.y); await page.mouse.down();
await page.mouse.move(von.x, nach.y - von.h * 0.6, { steps: 12 }); await page.mouse.up();
await page.waitForTimeout(250);
check('Zeile nach oben gezogen', (await page.evaluate(() => state.text.replace(/[^\n]*?(\S+)$/gm, '$1'))) === 'Brot\nMilch\nButter\nKäse',
  JSON.stringify(await page.evaluate(() => state.text)));
check('der Modus bleibt nach dem Verschieben an', await anSort());

// 2b) **Ohne loszulassen**: langes Drücken und direkt weiterziehen, wie Icons auf dem Homescreen.
//     Der erste Anlauf verlangte Loslassen und neu Greifen – der Zug lief ins Leere (am Bild gesehen).
await page.evaluate(() => document.getElementById('sortdone').click()); await page.waitForTimeout(150);
await setze('dash', 'Eins\nZwei\nDrei\nVier'); await page.waitForTimeout(200);
const g = await zeilenKasten(3), z = await zeilenKasten(1);
await page.mouse.move(g.x, g.y); await page.mouse.down();
await page.waitForTimeout(700);                                   // Modus geht an, Finger bleibt unten
await page.mouse.move(g.x, z.y, { steps: 12 }); await page.mouse.up();
await page.waitForTimeout(250);
check('langes Drücken und direkt weiterziehen ordnet um',
  (await page.evaluate(() => state.text.replace(/^\S+\s*/gm, ''))) === 'Eins\nVier\nZwei\nDrei',
  JSON.stringify(await page.evaluate(() => state.text)));

// 3) Nummerierte Liste wird neu durchgezählt – die Markierung hängt an der Position
await page.evaluate(() => document.getElementById('sortdone').click()); await page.waitForTimeout(150);
await setze('num', 'Alpha\nBeta\nGamma');
await page.waitForTimeout(200);
await langDruecken(2);
const v3 = await zeilenKasten(2), n3 = await zeilenKasten(0);
await page.mouse.move(v3.x, v3.y); await page.mouse.down();
await page.mouse.move(v3.x, n3.y - v3.h * 0.6, { steps: 12 }); await page.mouse.up();
await page.waitForTimeout(250);
const num = await page.evaluate(() => state.text.split('\n').map(l => [l.replace(/\D.*$/, ''), l.replace(/^\S+\s*/, '')]));
check('nummerierte Liste zählt nach dem Verschieben neu',
  JSON.stringify(num) === JSON.stringify([['1', 'Gamma'], ['2', 'Alpha'], ['3', 'Beta']]), JSON.stringify(num));

// 4) „Fertig“ und ein Tipp daneben beenden den Modus
await page.evaluate(() => document.getElementById('sortdone').click()); await page.waitForTimeout(150);
check('„Fertig“ beendet den Modus', !(await anSort()) && await page.evaluate(() => document.getElementById('text').isContentEditable));
await langDruecken(1);
await page.mouse.click(10, 10); await page.waitForTimeout(200);
check('ein Tipp daneben beendet den Modus', !(await anSort()));

// 5) Nicht bei Terminen, nicht bei Wasser
await setze('termin', 'Fr. 7:45 Werkstatt\nMo. 9:20 Frisör\nMo. 15:00 Tierarzt');
await page.waitForTimeout(200);
await langDruecken(1);
check('bei Terminen kein Sortiermodus', !(await anSort()));
await page.evaluate(() => document.querySelector('#strip-list .item[data-value="wasser"]').click());
await page.waitForTimeout(400);
check('bei Wasser kein Sortiermodus', !(await anSort()) && await page.evaluate(() => sortierbar() === false));

// 6) Der Haken-Bereich behält Vorrang: langes Drücken auf die Markierung öffnet weiter das Haken-Fenster
await setze('check', 'Eins\nZwei');
await page.waitForTimeout(200);
const mk = await page.evaluate(() => { const d = document.querySelectorAll('#text .ln')[1], r = d.getBoundingClientRect();
  return { x: r.left + Math.max(2, (parseFloat(getComputedStyle(d).paddingLeft) || 0) / 2), y: r.top + r.height / 2 }; });
await page.mouse.move(mk.x, mk.y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
await page.waitForTimeout(200);
check('auf der Markierung öffnet langes Drücken weiter das Haken-Fenster',
  !(await anSort()) && !(await page.evaluate(() => document.getElementById('hcolors').hidden)));

// 7) Der Listenwechsel beendet einen laufenden Sortiermodus
await page.evaluate(() => document.getElementById('hcolors').hidden = true);
await setze('dash', 'Eins\nZwei\nDrei'); await page.waitForTimeout(200);
await langDruecken(1);
check('Modus an vor dem Listenwechsel', await anSort());
await page.evaluate(() => document.querySelector('#strip-list .item[data-value="dot"]').click());
await page.waitForTimeout(300);
check('Listenwechsel beendet den Sortiermodus', !(await anSort()));

// 8) **Mit echten Touch-Ereignissen** (3.19). Der Mauszeiger deckt den entscheidenden Fall nicht ab:
//    auf dem iPhone klassifiziert der Browser das Wischen nach wenigen Pixeln als Seitenscroll, schickt
//    pointercancel und der Zug ist nach „einem Millimeter“ vorbei. Gemessen war das genau so – sortZug
//    wurde null und die Seite scrollte 39 px. Fix: touch-action none plus preventDefault im touchmove.
const cdp = await kontext.newCDPSession(page);
const tippe = (art, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type: art, touchPoints: art === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
await setze('dash', 'Eins\nZwei\nDrei\nVier\nFünf'); await page.waitForTimeout(250);
const tg = await zeilenKasten(3), tz = await zeilenKasten(1);
await tippe('touchStart', tg.x, tg.y);
await page.waitForTimeout(700);
check('Touch: langes Drücken greift die Zeile', await page.evaluate(() => sortAn && !!sortZug));
for (let i = 1; i <= 10; i++) await tippe('touchMove', tg.x, tg.y + (tz.y - tg.y) * i / 10);
await page.waitForTimeout(150);
const zug = await page.evaluate(() => ({ zug: sortZug && { von: sortZug.von, ziel: sortZug.ziel }, scroll: window.scrollY }));
check('Touch: der Zug überlebt das Wischen und die Seite scrollt nicht',
  zug.zug && zug.zug.von === 3 && zug.zug.ziel === 1 && zug.scroll === 0, JSON.stringify(zug));
await tippe('touchEnd', 0, 0); await page.waitForTimeout(250);
check('Touch: die Zeile sitzt danach am Zielplatz',
  (await page.evaluate(() => state.text.replace(/^\S+\s*/gm, ''))) === 'Eins\nVier\nZwei\nDrei\nFünf',
  JSON.stringify(await page.evaluate(() => state.text)));

// 9) Der Modus ist zu sehen: helle Kästen hinter den Zeilen, nicht nur das Wackeln
const sicht = await page.evaluate(() => { const d = document.querySelectorAll('#text .ln')[0];
  return { grund: getComputedStyle(d).backgroundColor, ta: getComputedStyle(document.getElementById('text')).touchAction }; });
check('Zeilen sind im Sortiermodus hinterlegt und die Geste gehört uns',
  /rgba?\(0, 0, 0, 0\.0[5-9]/.test(sicht.grund) && sicht.ta === 'none', JSON.stringify(sicht));

await page.screenshot({ path: out + '/sortieren.png' });
check('keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
console.log(fails ? fails + ' Prüfung(en) fehlgeschlagen' : 'alle Prüfungen bestanden');
await b.close();
process.exit(fails ? 1 : 0);
