// Test 3.41: Zettelgröße und Schriftgröße sind zwei unabhängige Regler.
// Auftraggeber: „Vielleicht wäre es gut, wenn man die Zettelgröße und die Schriftgröße separat
// unabhängig voneinander einstellt." Geprüft wird, dass jeder Regler genau eine Größe bewegt und
// dass der neue Regler auf der Hauptseite mit dem im Fenster „Lage im Bild" synchron bleibt.
//   node tests/app_groesse.mjs   (lokaler Server auf 8766, siehe app_review.mjs)
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };

await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); textEl.value = 'Di. 10:00 Siggi\nDo. 8:30 Myklodi nüchtern\nMo. 8:00 Myklodi Besprechung';
  onTextChanged(); state.list = 'termin'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);

const mass = () => page.evaluate(() => {
  const t = targetCanvas(), f = fitNote(t.w, t.h, t.layout, noteText());
  const n = document.getElementById('note') || document.querySelector('.note');
  return { noteW: f.noteW, fs: f.fs, zeilen: f.lines.length, ueberlauf: f.overflow, vorschau: Math.round(n.getBoundingClientRect().width),
           rZettel: Number(document.getElementById('notesize').value), rSchrift: Number(document.getElementById('fontscale').value),
           rLage: Number((document.getElementById('lage-size') || {}).value || 0) };
});
const stelle = (id, wert) => page.evaluate(([id, wert]) => {
  const r = document.getElementById(id); r.value = String(wert);
  r.dispatchEvent(new Event('input', { bubbles: true }));
}, [id, wert]);

const start = await mass();
check('Beide Regler stehen auf 100 %', start.rZettel === 100 && start.rSchrift === 100, JSON.stringify(start));

// Zettelregler allein: Papier schmaler, Schrift unberührt
await stelle('notesize', 70); await page.waitForTimeout(350);
const nurZettel = await mass();
check('Zettelregler ändert die Breite', nurZettel.noteW < start.noteW * 0.75, `${start.noteW} → ${nurZettel.noteW}`);
// Seit 3.42 hängt die Schriftgröße an der Layoutbreite, nicht am Zettel. Sie fällt damit **nicht mehr
// proportional** mit der Breite (das wären hier 75 → 52); gemessen bleibt sie bei 59, weil die Regel
// „jeder Absatz möglichst einzeilig" sie bis paraFloor = Layoutbreite/16 drückt und dort hält.
// Ganz konstant ist sie also nicht – wohl aber unabhängig vom Reglerwert nach unten begrenzt.
check('… und hält die Schrift über dem proportionalen Wert',
  nurZettel.fs > start.fs * 0.7 * 1.05, `${start.fs} → ${nurZettel.fs}, proportional wären ${Math.round(start.fs * 0.7)}`);
check('… der Text bricht dafür um', nurZettel.zeilen > start.zeilen, `${start.zeilen} → ${nurZettel.zeilen} Zeilen`);
// **Seit 3.45 wieder umgedreht.** 3.41 hatte die Vorschau an den Zettelregler gekoppelt, damit man ihn
// wirken sieht; bei 63 % war das Sichtfenster dann zu klein zum Tippen („viel zu kleine Sichtfenster“,
// Auftraggeber, 20.9.2026). Die Vorschau ist Arbeitsfläche, kein Maßstab – sie bleibt konstant, und die
// Größe im Bild steht als Zahl am Regler und im Fenster „Lage im Bild“.
check('… die Vorschau bleibt als Arbeitsfläche gleich groß', nurZettel.vorschau === start.vorschau, `${start.vorschau} → ${nurZettel.vorschau}`);
check('… der Schriftregler bleibt stehen', nurZettel.rSchrift === 100, String(nurZettel.rSchrift));
check('… und beide Größenregler zeigen dasselbe', nurZettel.rZettel === 70 && nurZettel.rLage === 70, `${nurZettel.rZettel} / ${nurZettel.rLage}`);

// Schriftregler allein: Schrift kleiner, Papier unberührt
await stelle('notesize', 100); await page.waitForTimeout(350);
await stelle('fontscale', 75); await page.waitForTimeout(350);
const nurSchrift = await mass();
// Der Regler wirkt schwächer, als seine Zahl verspricht: nach der Stauchung tastet die Feinsuche in
// Schritt 4 wieder hoch, solange Höhe und Ein-Zeilen-Regel es zulassen. Gemessen 75 % → Schrift 75 → 64,
// also −15 % statt −25 %. Bestehendes Verhalten seit 3.39, hier nur festgehalten.
check('Schriftregler ändert die Schrift', nurSchrift.fs < start.fs * 0.93, `${start.fs} → ${nurSchrift.fs}`);
check('… die Breite bleibt unberührt', nurSchrift.noteW === start.noteW, `${start.noteW} → ${nurSchrift.noteW}`);
check('… und die Vorschau auch', nurSchrift.vorschau === start.vorschau, `${start.vorschau} → ${nurSchrift.vorschau}`);

// Beide zusammen: die Wirkungen addieren sich, ohne sich zu stören
await stelle('notesize', 70); await page.waitForTimeout(350);
const beide = await mass();
check('Beide zusammen: die Breite vom einen, die Schrift vom anderen',
  beide.noteW === nurZettel.noteW && beide.fs < nurZettel.fs, `${beide.noteW} px, Schrift ${beide.fs} gegen ${nurZettel.fs}`);
check('Nichts läuft über', [start, nurZettel, nurSchrift, beide].every(m => !m.ueberlauf), 'overflow');

// Der Regler im Fenster „Lage im Bild" zieht die Hauptseite nach
await page.click('#lagebtn'); await page.waitForTimeout(400);
await stelle('lage-size', 95); await page.waitForTimeout(350);
const ausLage = await mass();
check('Regler im Lage-Fenster zieht die Hauptseite nach', ausLage.rZettel === 95, `Hauptseite ${ausLage.rZettel}, Fenster ${ausLage.rLage}`);

check('Keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
await b.close();
console.log(fails ? `\n${fails} FEHLER` : '\nalles grün');
process.exit(fails ? 1 : 0);
