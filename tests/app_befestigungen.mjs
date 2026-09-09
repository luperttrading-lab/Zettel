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
// Über den Schieber wählen (wie ein Tipp), damit auch die Sperre mit ihrer Erklärung greift
const waehle = async art => { await page.evaluate(a => document.querySelector(`#strip-fastener .item[data-value="${a}"]`).click(), art); await page.waitForTimeout(350); };
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
  // Ein Stand von vor 1.61.0 kennt weder `zettel` noch `fasteners` – beides weg, sonst überschreibt
  // das Zettelfeld beim Laden die alten Felder und die Migration käme gar nicht zum Zug.
  delete alt.zettel; delete alt.aktiv;
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
const gesperrt = () => page.evaluate(() => [...document.querySelectorAll('#strip-fastener .item.gesperrt')].map(d => d.dataset.value));
const alleDa = () => page.evaluate(() => [...document.querySelectorAll('#strip-fastener .item')].every(d => !d.hidden));
// Die Zwecken liegen verteilt – dorthin passt kein Klebestreifen. Er bleibt sichtbar (sonst sucht
// man ihn und findet ihn nicht mehr), lässt sich aber nicht wählen.
check('alle Arten bleiben sichtbar', await alleDa());
check('Klebestreifen ist gesperrt', (await gesperrt()).includes('tape'), (await gesperrt()).join(' '));
check('Magnete bleiben wählbar', !(await gesperrt()).includes('magnet'));
await waehle('tape');
check('Wechsel passiert nicht', (await liste()).every(x => x.a === 'thumbtack'));
check('Tipp auf den gesperrten erklärt es', /Klebestreifen/.test(await page.evaluate(() => $('satz').textContent)), await page.evaluate(() => $('satz').textContent));
await karteAuf(); await knopf('minus');
check('mit einem Stück ist nichts mehr gesperrt', (await gesperrt()).length === 0, (await gesperrt()).join(' '));
await waehle('tape');
const t = await liste();
check('mit einem Stück geht der Wechsel', t.length === 1 && t[0].a === 'tape', JSON.stringify(t));

// 4b) Drei Büroklammern oben werden zu drei Nadeln – die dürfen alles, was die Klammern durften
await page.evaluate(() => {
  state.fasteners = [[0.14, 0.012], [0.5, 0.012], [0.86, 0.012]].map(([x, y]) => ({ art: 'clip', x, y }));
  state.fastener = 'clip'; aktiveBef = 0; applyFastener();
});
await page.waitForTimeout(250);
check('bei drei Klammern sind Nadeln wählbar', !(await gesperrt()).includes('pin'), (await gesperrt()).join(' '));
await waehle('pin');
const n = await liste();
check('drei Nadeln an denselben Plätzen', n.length === 3 && n.every(x => x.a === 'pin') && Math.abs(n[2].x - 0.86) < 0.001, JSON.stringify(n));
// eine davon nach unten ziehen: jetzt ist die Klammer nicht mehr möglich
await ziehen(1, 0, 150);
check('Nadel nach unten gezogen', (await liste())[1].y > 0.2);
check('Klammer nun gesperrt', (await gesperrt()).includes('clip'), (await gesperrt()).join(' '));

// 4c) Farbe und Muster je Stück
await page.evaluate(() => { state.fasteners = [[0.2, 0.012], [0.5, 0.012], [0.8, 0.012]].map(([x, y]) => ({ art: 'clip', x, y })); state.fastener = 'clip'; aktiveBef = 0; applyFastener(); });
await page.waitForTimeout(200);
await page.evaluate(() => { aktiveBef = 0; setFastenerLook({ color: 'red' }); aktiveBef = 1; setFastenerLook({ color: 'green' }); setFastenerLook({ decor: 'stripes' }); aktiveBef = 2; setFastenerLook({ color: 'yellow' }); setFastenerLook({ decor: 'dots' }); });
await page.waitForTimeout(300);
const bunt = await liste();
check('drei Klammern, drei Farben', bunt.map(x => x.c).join(',') === 'red,green,yellow', JSON.stringify(bunt.map(x => x.c)));
check('Muster je Stück', await page.evaluate(() => state.fasteners.map(b => b.decor || '-').join(',')) === '-,stripes,dots', await page.evaluate(() => state.fasteners.map(b => b.decor || '-').join(',')));
const svg = await page.evaluate(() => $('fastener-preview').innerHTML);
check('drei Farben wirklich gezeichnet', /#ff3b30/.test(svg) && /#34c759/.test(svg) && /#ffcc00/.test(svg));
await page.screenshot({ path: out + '/klammern_bunt.png' });
await page.evaluate(() => { state.fasteners = [{ art: 'tape' }]; state.fastener = 'tape'; aktiveBef = 0; applyFastener(); });
await page.waitForTimeout(200);

// 5) Klebestreifen bleibt waagerecht an der Kante, Büroklammer oben
await ziehen(0, -80, 200);
const s1 = (await liste())[0];
// y ist ein Anteil der **Breite**, nicht der Höhe. Seit 1.63.0 folgt die Höhe dem Text, die Unterkante
// liegt also bei noteH/noteW (bei „Milch kaufen“ auf der Mindesthöhe 0,45) – nicht mehr fest bei 1.
const kante = await page.evaluate(() => { const f = letzteMasse; return f.noteH / f.noteW; });
check('Streifen springt an die Unterkante', Math.abs(s1.y - kante) < 0.01, JSON.stringify(s1) + ' Kante ' + kante.toFixed(3));
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
// 8b) Farbe und Motiv gelten NUR für das angetippte Stück – nie für alle
await page.evaluate(() => { waehleBefestigung('magnet'); });
await page.waitForTimeout(200);
await page.evaluate(() => { befDazu(); befDazu(); });
await page.waitForTimeout(300);
const look = () => page.evaluate(() => state.fasteners.map(b => b.color + '/' + b.decor));
check('drei Magnete gleich', new Set(await look()).size === 1, (await look()).join(' '));
await page.evaluate(() => { aktiveBef = 1; setFastenerLook({ decor: 'heart' }); });
await page.waitForTimeout(250);
let l = await look();
check('nur Nr. 2 bekommt das Herz', l[1].endsWith('/heart') && !l[0].endsWith('/heart') && !l[2].endsWith('/heart'), l.join(' '));
await page.evaluate(() => { aktiveBef = 2; setFastenerLook({ color: 'green' }); });
await page.waitForTimeout(250);
l = await look();
check('nur Nr. 3 wird grün', l[2].startsWith('green') && !l[0].startsWith('green') && !l[1].startsWith('green'), l.join(' '));
check('Nr. 2 behält ihr Herz', l[1].endsWith('/heart'), l.join(' '));

// 8c) Der Rahmen gehört nur zur offenen Auswahl – beim Schreiben im Text ist er weg
const rahmen = () => page.evaluate(() => document.querySelectorAll('.griff.aktiv').length);
await page.evaluate(() => toggleFcolors(true)); await page.waitForTimeout(250);
check('Karte offen: genau ein Rahmen', await rahmen() === 1, String(await rahmen()));
await page.evaluate(() => toggleFcolors(false)); await page.waitForTimeout(250);
check('Karte zu: kein Rahmen', await rahmen() === 0, String(await rahmen()));
await page.evaluate(() => toggleFcolors(true)); await page.waitForTimeout(200);
await page.click('#text'); await page.waitForTimeout(350);
check('Tipp ins Textfeld nimmt den Rahmen weg', await rahmen() === 0, String(await rahmen()));

// 8d) Mit mehreren verteilten Befestigungen bleibt das Textfeld erreichbar
await page.evaluate(() => {
  state.fasteners = [[0.2, 0.15], [0.8, 0.6], [0.8, 0.16], [0.2, 0.72]].map(([x, y]) => ({ art: 'magnet', x, y, color: 'red', decor: 'none' }));
  state.fastener = 'magnet'; aktiveBef = 0; applyFastener();
});
await page.waitForTimeout(300);
await page.click('#text', { timeout: 3000 }).then(() => check('Textfeld trotz vier Magneten antippbar', true))
  .catch(e => check('Textfeld trotz vier Magneten antippbar', false, String(e).split('\n')[0]));

// 9) Die Auswahlkarte verdeckt weder den Zettel noch den Befestigungs-Schieber
await page.evaluate(() => {
  state.fasteners = [{ art: 'pin', x: 0.12, y: 0.9 }, { art: 'pin', x: 0.88, y: 0.9 }];
  state.fastener = 'pin'; aktiveBef = 0; applyFastener(); if ($('fcolors').hidden) toggleFcolors(true);
});
await page.waitForTimeout(400);
const lage = await page.evaluate(() => {
  const n = document.querySelector('.note').getBoundingClientRect(), k = $('fcolors').getBoundingClientRect();
  const s = $('strip-fastener').getBoundingClientRect();
  return { zettel: n.bottom, schieber: s.bottom, karte: k.top,
    griffe: [...document.querySelectorAll('.griff')].map(g => g.getBoundingClientRect().bottom) };
});
check('Karte lässt den Zettel frei', lage.karte >= lage.zettel, JSON.stringify(lage));
check('Karte lässt den Befestigungs-Schieber frei', lage.karte >= lage.schieber);
check('kein Griff unter der Karte', lage.griffe.every(y => y <= lage.karte));

// 10) Es darf scrollen – aber die Zustandszeile steht ganz im Bild und der Hauptknopf
// schaut angeschnitten hervor. Das ist der Hinweis „hier geht es weiter“.
await page.evaluate(() => { $('text').value = ''; $('text').dispatchEvent(new Event('input')); });
await page.waitForTimeout(500);
const lage2 = await page.evaluate(() => {
  const st = $('status').getBoundingClientRect(), kn = $('stick').getBoundingClientRect();
  return { fenster: innerHeight, statusUnten: Math.round(st.bottom), knopfOben: Math.round(kn.top),
    vomKnopf: Math.round(Math.max(0, Math.min(kn.bottom, innerHeight) - kn.top)) };
});
check('Zustandszeile ganz im Bild', lage2.statusUnten <= lage2.fenster, JSON.stringify(lage2));
check('Hauptknopf schaut hervor', lage2.vomKnopf >= 24, lage2.vomKnopf + ' px sichtbar');
check('kein Fenster mehr, alles im Fluss', await page.evaluate(() => !document.getElementById('sheet') && !!document.getElementById('hide') && !!document.querySelector('.setup')));

// 11) Der Rahmen sitzt genau um die Zeichnung – nicht um ein geschätztes Rechteck
for (const art of ['pushpin', 'clip', 'magnet', 'tape']) {
  await page.evaluate(a => { state.fasteners = [{ art: a, color: 'red', decor: 'none' }]; state.fastener = a; aktiveBef = 0; applyFastener(); if ($('fcolors').hidden) toggleFcolors(true); }, art);
  await page.waitForTimeout(350);
  const d = await page.evaluate(() => {
    const g = document.querySelector('.griff.aktiv'), grp = document.querySelector('#fastener-preview [data-b="0"]');
    if (!g || !grp) return null;
    const a = g.getBoundingClientRect(), b = grp.getBoundingClientRect();
    return [b.left - a.left, a.right - b.right, b.top - a.top, a.bottom - b.bottom].map(x => Math.round(x));
  });
  check('Rahmen sitzt mittig um ' + art, d && d.every(x => x >= 0 && Math.abs(x - d[0]) <= 2), JSON.stringify(d));
}
await page.evaluate(() => toggleFcolors(false));

check('scrollWidth ≤ 408 bei 390 px', await page.evaluate(() => document.documentElement.scrollWidth) <= 408, String(await page.evaluate(() => document.documentElement.scrollWidth)));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? '\n' + fails + ' FEHLER' : '\nALLE TESTS OK');
process.exit(fails ? 1 : 0);
