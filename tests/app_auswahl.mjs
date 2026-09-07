// Test 1.38.0: Beim Wechseln der Befestigung erscheint ihre Auswahl (Farben/Muster/Motive) von selbst;
// Wischen im Schieber schließt sie nicht, ein Tipp auf die gewählte Befestigung oder woanders schon.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_auswahl.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
// Tipp auf ein Element des Schiebers. Playwrights page.click scrollt den Schieber und trifft dann ein anderes
// Element – deshalb der Klick direkt am Element. Die Maus-Fälle unten prüfen den pointerdown-Weg echt.
const waehle = name => page.evaluate(n => document.querySelector(`#strip-fastener .item[data-value="${n}"]`).click(), name);
const lage = () => page.evaluate(() => ({
  offen: !document.getElementById('fcolors').hidden,
  modus: cardMode,
  zeilen: [...document.querySelectorAll('#fcolors .lab')].map(l => l.textContent),
  chips: document.querySelectorAll('#fcolors .chip').length,
  pulst: document.getElementById('fastener-preview').classList.contains('picking'),
  fastener: state.fastener,
}));
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(900);
await page.evaluate(() => { textEl.value = 'Milch kaufen'; onTextChanged(); flush(); }); await page.waitForTimeout(300);
check('Start: Auswahl zu', !(await lage()).offen, JSON.stringify(await lage()));
// 1) Befestigung wechseln → Auswahl erscheint von selbst
await waehle('thumbtack'); await page.waitForTimeout(500);
const l1 = await lage();
check('Wechsel zu Reißzwecke: Auswahl offen', l1.offen && l1.modus === 'fastener' && l1.fastener === 'thumbtack' && l1.pulst, JSON.stringify(l1));
check('Reißzwecke: Farben und Muster', l1.zeilen.includes('Farbe') && l1.chips > 4, JSON.stringify(l1.zeilen));
// 2) Weiter zum Bildmagneten → Motive statt Farben, ohne dass die Auswahl zwischendurch zugeht
await waehle('photo'); await page.waitForTimeout(500);
const l2 = await lage();
check('Wechsel zum Bildmagneten: Auswahl bleibt offen', l2.offen && l2.fastener === 'photo', JSON.stringify(l2));
check('Bildmagnet: Zeile „Bild“, keine Farben', l2.zeilen.includes('Bild') && !l2.zeilen.includes('Farbe'), JSON.stringify(l2.zeilen));
const motive = await page.evaluate(() => Object.entries(ZettelMotifs).filter(([, m]) => m.kind === 'photo').length);
check('alle Bildmagnete als Chips sichtbar', l2.chips >= motive && motive >= 4, l2.chips + ' Chips, ' + motive + ' Motive');
await page.screenshot({ path: out + '/auswahl_bildmagnet.png' });
// 3) Wischen im Schieber schließt die Auswahl nicht (pointerdown auf einem nicht aktiven Element)
const box = await page.evaluate(() => {   // sichtbares Nachbar-Element rechts der Mitte
  const s = document.getElementById('strip-fastener').getBoundingClientRect();
  const el = [...document.querySelectorAll('#strip-fastener .item')].find(d => { const r = d.getBoundingClientRect(); return !d.classList.contains('active') && r.left > s.left + 20 && r.right < s.right - 20; });
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, wert: el.dataset.value };
});
await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 30, box.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(600);
check('Wischen im Schieber: Auswahl bleibt offen', (await lage()).offen, box.wert + ' → ' + JSON.stringify(await lage()));
await waehle('photo'); await page.waitForTimeout(500);
// 4) Motiv wählen: Auswahl bleibt offen, Motiv übernommen
const chip = await page.evaluate(() => {   // sichtbarer Chip in der Motivzeile
  const row = document.querySelector('#fcolors .row:last-child').getBoundingClientRect();
  const c = [...document.querySelectorAll('#fcolors .row:last-child .chip')].find(b => { const r = b.getBoundingClientRect(); return b.getAttribute('aria-pressed') !== 'true' && r.left > row.left && r.right < row.right; });
  const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: c.getAttribute('aria-label') };
});
await page.mouse.click(chip.x, chip.y); await page.waitForTimeout(400);
const zweites = chip.name;
check('Motiv gewählt, Auswahl bleibt offen', (await lage()).offen && (await page.evaluate(() => DECOR_LABEL[fastenerLook().decor])) === zweites, zweites + ' → ' + await page.evaluate(() => DECOR_LABEL[fastenerLook().decor]));
// 5) Tipp auf die gewählte Befestigung im Schieber schließt
const mitte = await page.evaluate(() => { const r = document.querySelector('#strip-fastener .item.active').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.click(mitte.x, mitte.y); await page.waitForTimeout(400);
check('Tipp auf die gewählte Befestigung: zu', !(await lage()).offen, JSON.stringify(await lage()));
// 6) Wieder öffnen über den Zettel, dann Tipp auf den Text schließt
await page.click('#fastener-preview rect.hit', { force: true }); await page.waitForTimeout(400);
check('Tipp auf die Befestigung im Zettel: offen', (await lage()).offen);
await page.click('#text'); await page.waitForTimeout(400);
check('Tipp auf den Zettel: zu', !(await lage()).offen);
// 7) Papier-Karte offen, dann Befestigung wechseln → Auswahl der Befestigung
await page.click('#colors button.edit'); await page.waitForTimeout(400);
check('Papier-Karte offen', (await lage()).modus === 'paper', JSON.stringify(await lage()));
await waehle('clip'); await page.waitForTimeout(500);
const l7 = await lage();
check('Wechsel während Papier-Karte: jetzt Befestigung', l7.offen && l7.modus === 'fastener' && l7.fastener === 'clip' && !(await page.evaluate(() => document.body.classList.contains('picking-paper'))), JSON.stringify(l7));
// 8) Zustand überlebt: nach dem Neuladen ist die Auswahl zu
await page.reload(); await page.waitForTimeout(900);
check('nach Neuladen: Auswahl zu', !(await lage()).offen, JSON.stringify(await lage()));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check('scrollWidth ≤ 448', sw <= 448, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
