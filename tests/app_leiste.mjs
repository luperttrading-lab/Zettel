// Test der Bedienleiste (1.39.0): Zustandszeile, Hauptknopf, Ansage für Schritt 2, Erklärung, Symbolreihe.
// Ersetzt die früheren Tests app_status/app_wortlaut/app_ausblenden/app_umschalter und deckt deren Logik mit ab
// (Schnappschuss, isPinnedCurrent samt Überschrift und Foto, bgOnly, veralteter Eintrag).
//   Chromium-Test (WebKit ist in der Umgebung nicht verfügbar; iPhone-Prüfung bleibt beim Menschen).
//   Voraussetzung: npm install && npm install --no-save playwright ; lokaler Server auf Port 8766 im Repo-Verzeichnis:
//     (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Aufruf aus dem Repo-Verzeichnis: node tests/app_leiste.mjs <ausgabeverzeichnis>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 3 });   // schmalstes gängiges iPhone
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
const leiste = () => page.evaluate(() => ({
  lage: lage(), satz: document.getElementById('satz').textContent, punkt: document.getElementById('punkt').className.replace('punkt', '').trim(),
  knopf: document.getElementById('stick').hidden ? null : document.getElementById('stick1').textContent,
  ansage: !document.getElementById('ansage').hidden,
  icon1: document.getElementById('hide-text').textContent.replace(/\s+/g, ' ').trim(),
  hoehe: Math.round(document.querySelector('.actions').getBoundingClientRect().height),
}));
const fotoSetzen = () => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d');
  g.fillStyle = '#204080'; g.fillRect(0, 0, 1179, 2556);
  localStorage.setItem('zettel.bg', c.toDataURL('image/jpeg', 0.9)); bgLaden(); await bgReady;
});
const zurueckInDieApp = () => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
});
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(900);

// 1) Leerer Anfang
const l0 = await leiste();
check('leer: „Noch nichts auf dem Sperrbildschirm“', l0.lage === 'leer' && l0.satz === 'Noch nichts auf dem Sperrbildschirm' && l0.punkt === '', JSON.stringify(l0));
check('leer: Knopf lädt ein zum Übertragen', l0.knopf === 'Neuen Zettel auf Sperrbildschirm' && !l0.ansage, JSON.stringify(l0));
await page.evaluate(() => { textEl.value = 'Milch kaufen'; onTextChanged(); flush(); }); await page.waitForTimeout(300);

// 2) Schritt 1: Bild bereitlegen → Ansage statt Knopf
await page.click('#stick'); await page.waitForTimeout(1500);
const l1 = await leiste();
check('wartend: Zeile nennt den Kurzbefehl', l1.lage === 'wartet' && l1.satz === 'Bild fertig · wartet auf den Kurzbefehl' && l1.punkt === 'gelb', JSON.stringify(l1));
check('wartend: Ansage statt Knopf', l1.ansage && l1.knopf === null, JSON.stringify(l1));
check('wartend: Leistenhöhe unverändert', l1.hoehe === l0.hoehe, l0.hoehe + ' → ' + l1.hoehe);
const clip = await page.evaluate(async () => { const i = await navigator.clipboard.read(); return i.map(x => x.types.join(',')).join(';'); });
check('wartend: PNG in der Zwischenablage', clip.includes('image/png'), clip);
check('wartend: pinned.warten gesetzt', await page.evaluate(() => state.pinned.warten === true && state.pinned.requested === false));
await page.screenshot({ path: out + '/leiste_wartet.png' });

// 3) Erklärung auf Tipp auf die Ansage
await page.click('#ansage'); await page.waitForTimeout(400);
check('Erklärung offen', await page.evaluate(() => !document.getElementById('hilfe').hidden));
check('Erklärung nennt den Kurzbefehl', (await page.evaluate(() => document.getElementById('hilfe-name').textContent)) === '„Zettel“');
await page.screenshot({ path: out + '/leiste_hilfe.png' });
await page.click('#hilfe'); await page.waitForTimeout(200);
check('Erklärung wieder zu', await page.evaluate(() => document.getElementById('hilfe').hidden));

// 4) Rückkehr in die App zählt als erledigt
await zurueckInDieApp(); await page.waitForTimeout(300);
const l2 = await leiste();
check('zurück: „Sperrbildschirm zeigt diesen Zettel“', l2.lage === 'fertig' && l2.satz === 'Sperrbildschirm zeigt diesen Zettel' && l2.punkt === 'gut', JSON.stringify(l2));
check('zurück: ruhiger Knopf', l2.knopf === 'Noch einmal auf Sperrbildschirm' && !l2.ansage, JSON.stringify(l2));
check('zurück: Leistenhöhe unverändert', l2.hoehe === l0.hoehe, String(l2.hoehe));

// 5) Änderungen am Zettel machen den Stand alt – jedes bildbestimmende Feld
const aenderungen = [
  ['Text', () => { textEl.selectionStart = textEl.selectionEnd = textEl.value.length; textEl.insertText('!'); }, () => { state.text = state.text.slice(0, -1); textEl.value = state.text; persist(); }],
  ['Überschrift', () => { state.title = true; noteTitleOn = true; onTextChanged(); flush(); }, () => { state.title = false; noteTitleOn = false; onTextChanged(); flush(); }],
  ['Papierfarbe', () => { state.color = 'blue'; applyColor(); persist(); }, () => { state.color = 'yellow'; applyColor(); persist(); }],
  ['Schrift', () => { state.font = 'kalam'; applyFont(); persist(); }, () => { state.font = 'caveat'; applyFont(); persist(); }],
];
for (const [name, hin, zurueck] of aenderungen) {
  await page.evaluate(hin); await page.waitForTimeout(250);
  const a = await leiste();
  check(`${name} geändert → „noch der alte Zettel“`, a.lage === 'geaendert' && a.satz === 'Sperrbildschirm: noch der alte Zettel' && a.punkt === 'warn', JSON.stringify(a));
  await page.evaluate(zurueck); await page.waitForTimeout(250);
  check(`${name} zurückgenommen → wieder aktuell`, (await leiste()).lage === 'fertig');
}

// 6) Überschriftgröße zählt nur mit Überschrift
await page.evaluate(() => { state.titleSize = 3; updatePinBadge(); }); await page.waitForTimeout(150);
check('Größe ohne Überschrift ändert nichts', (await leiste()).lage === 'fertig');

// 7) Hintergrundfoto: neue Kennung macht den Stand alt
await fotoSetzen(); await page.waitForTimeout(300);
check('Foto gewählt → Stand alt', (await leiste()).lage === 'geaendert', JSON.stringify(await leiste()));
await page.click('#stick'); await page.waitForTimeout(1500); await zurueckInDieApp(); await page.waitForTimeout(300);
check('mit Foto übertragen → aktuell', (await leiste()).lage === 'fertig');

// 8) Ausblenden: nur das Foto, Zettel verschwindet auch in der App
await imFenster('#hide'); await page.waitForTimeout(1500);
const l3 = await leiste();
check('ausblenden: „Foto fertig · wartet …“', l3.lage === 'wartet' && l3.satz === 'Foto fertig · wartet auf den Kurzbefehl', JSON.stringify(l3));
check('ausblenden: Zettel in der App weg', await page.evaluate(() => document.getElementById('note').classList.contains('weg') && !document.getElementById('weghint').hidden));
check('ausblenden: Symbol heißt jetzt einblenden', l3.icon1.includes('einblenden'), l3.icon1);   // ohne Leerzeichen: der Umbruch steht als <br> im Knopf
const mitte = await page.evaluate(async () => {
  const items = await navigator.clipboard.read(); const bmp = await createImageBitmap(await items.find(i => i.types.includes('image/png')).getType('image/png'));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  return [...g.getImageData(Math.round(bmp.width / 2), Math.round(bmp.height * 0.585), 1, 1).data].slice(0, 3);
});
check('ausblenden: Bild zeigt nur das Foto', mitte[2] > 100 && mitte[0] < 60, JSON.stringify(mitte));
await zurueckInDieApp(); await page.waitForTimeout(300);
check('ausgeblendet: „Sperrbildschirm: nur dein Foto“', (await leiste()).satz === 'Sperrbildschirm: nur dein Foto', (await leiste()).satz);
check('ausgeblendet: Knopf blendet wieder ein', (await leiste()).knopf === 'Zettel wieder einblenden');
check('ausgeblendet: Textänderung ändert den Stand nicht', await page.evaluate(async () => { textEl.value = 'Milch und Brot'; onTextChanged(); flush(); await new Promise(r => setTimeout(r, 200)); return lage() === 'fertig'; }));
await page.screenshot({ path: out + '/leiste_ausgeblendet.png' });

// 9) Platzhalter antippen blendet ein (kein Bearbeiten-Modus mehr)
await page.click('#weghint'); await page.waitForTimeout(1500);
check('Platzhalter antippen → eingeblendet und übertragen', await page.evaluate(() => state.hidden === false && lage() === 'wartet'));
await zurueckInDieApp(); await page.waitForTimeout(300);

// 10) Symbolreihe bleibt dreiteilig und gleich breit
for (const zustand of [false, true]) {
  await page.evaluate(h => { state.hidden = h; zeigeZettel(); }, zustand); await page.waitForTimeout(150);
  const r = await page.evaluate(() => [...document.querySelectorAll('.icons button')].filter(e => !e.hidden).map(e => Math.round(e.getBoundingClientRect().width)));
  check(`Symbolreihe ${zustand ? 'ausgeblendet' : 'sichtbar'}: drei gleiche Knöpfe`, r.length === 3 && new Set(r).size === 1, JSON.stringify(r));
}
await page.evaluate(() => { state.hidden = false; zeigeZettel(); });

// 11) Meldungen haben Vorrang und verschwinden wieder
await page.evaluate(() => { state.text = ''; textEl.value = ''; persist(); }); await page.waitForTimeout(200);
await page.click('#stick'); await page.waitForTimeout(400);
check('leerer Zettel: Meldung statt Zustand', (await page.evaluate(() => document.getElementById('satz').textContent)) === 'Erst was draufschreiben.');
await page.evaluate(() => { textEl.value = 'Milch'; onTextChanged(); flush(); }); await page.waitForTimeout(300);
check('nach dem Tippen: wieder der Zustand', (await leiste()).satz.startsWith('Sperrbildschirm'), (await leiste()).satz);

// 12) Eintrag einer älteren Version
await page.evaluate(() => { state.pinned = { text: state.text, color: state.color, at: Date.now() }; updatePinBadge(); }); await page.waitForTimeout(150);
check('alter Eintrag: „Stand unbekannt“', (await leiste()).satz === 'Stand unbekannt · neu übertragen', (await leiste()).satz);

// 13) Kurzbefehlname landet in der Ansage
await page.evaluate(() => { const el = document.getElementById('shortcut'); el.value = 'Notiz'; el.dispatchEvent(new Event('input')); }); await page.waitForTimeout(200);
check('Ansage nennt den eingestellten Namen', (await page.evaluate(() => document.querySelector('#ansage .z2').textContent)).includes('„Notiz“'), await page.evaluate(() => document.querySelector('#ansage .z2').textContent));

const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 408 bei 390 px', sw <= 408, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
