// Test 3.39: Die Schirmmaße sind nicht verlässlich. iOS meldet `screen.height` gelegentlich zu klein
// (am 8.9.2026 gemessen: 632 statt 852). Das Bild wird dann zu kurz, iOS bläst es formatfüllend auf –
// und die Zettel ragen über den Rand. Geprüft wird, dass das Gedächtnis in schirmMass() das abfängt,
// ohne im Normalfall etwas zu verändern.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_schirm.mjs
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
const frisch = (merk, screenH = 852) => page.evaluate(([m, sh]) => {
  localStorage.clear(); schirmMerk = m;
  if (m) localStorage.setItem('zettel.schirm', JSON.stringify(m));
  Object.defineProperty(screen, 'height', { value: sh, configurable: true });
}, [merk, screenH]);
const mass = () => page.evaluate(() => { const t = targetCanvas();
  return { w: t.w, h: t.h, korr: schirmKorr, roh: schirmRoh, merk: JSON.parse(localStorage.getItem('zettel.schirm')) }; });

await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });

// 1. Normalfall: nichts wird verbogen
await frisch({ w: 393, h: 852 });
const normal = await mass();
check('Normalfall unverändert 1179 × 2556', normal.w === 1179 && normal.h === 2556 && !normal.korr, JSON.stringify(normal));

// 2. Der Fehlerfall vom 8.9.2026: screen meldet 632 statt 852
await frisch({ w: 393, h: 852 }, 632);
const kurz = await mass();
check('Zu kurze Messung wird angehoben', kurz.h === 2556 && kurz.korr && kurz.roh === 632, JSON.stringify(kurz));

// 3. Die dokumentierte Grenze: ohne Gedächtnis ist die erste falsche Messung nicht erkennbar –
//    aber sie heilt, sobald einmal richtig gemessen wird.
await frisch(null, 632);
const erst = await mass();
check('Erststart mit falscher Messung: Bild zu kurz, Wert gelernt', erst.h === 1896 && !erst.korr && erst.merk.h === 632, JSON.stringify(erst));
await page.evaluate(() => Object.defineProperty(screen, 'height', { value: 852, configurable: true }));
const heil = await mass();
check('… und heilt beim nächsten richtigen Start', heil.h === 2556 && heil.merk.h === 852, JSON.stringify(heil));

// 4. Ausreißer nach oben abgewiesen – ein zu langes Bild beschneidet iOS oben und unten
await frisch({ w: 393, h: 3000 });
const gross = await mass();
check('Ausreißer nach oben abgewiesen', gross.h === 2556 && !gross.korr, JSON.stringify(gross));

// 5. Andere Gerätebreite (Anzeigezoom umgestellt): neu lernen statt hochrechnen
await frisch({ w: 430, h: 932 });
const neu = await mass();
check('Breite geändert: neu gelernt', neu.h === 2556 && neu.merk.w === 393 && neu.merk.h === 852, JSON.stringify(neu));

check('Keine Fehler in der Anlaufphase', errors.length === 0, errors.join(' | '));
await b.close();
console.log(fails ? `\n${fails} FEHLER` : '\nalles grün');
process.exit(fails ? 1 : 0);
