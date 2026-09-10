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
// Das unsichtbare Trefferfeld über der ganzen Befestigung gibt es seit 1.44.3 nicht mehr
// (es umspannte bei mehreren Stücken den halben Zettel) – getroffen wird über die Griffe.
await page.click('.note .griff'); await page.waitForTimeout(400);
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
// Senkrecht über einem Schieber wischen muss die Seite scrollen – mit touch-action: pan-x allein
// sperrte der Browser die Geste ganz und man wusste nicht, warum sich nichts bewegt (1.49.2).
check('Schieber lassen die senkrechte Geste durch',
  await page.evaluate(() => [...document.querySelectorAll('.strip')].every(e => /pan-y/.test(getComputedStyle(e).touchAction))),
  await page.evaluate(() => getComputedStyle(document.querySelector('.strip')).touchAction));

// Die Symbole werden an ihrer tatsächlichen Ausdehnung ausgerichtet – vorher saßen sie je nach
// Form verschieden hoch im Kasten, die Pinnadel am auffälligsten (1.50.1).
const mittig = await page.evaluate(() => [...document.querySelectorAll('#strip-fastener .item svg')].map(svg => {
  let bb; try { bb = svg.getBBox(); } catch { return null; }
  const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  if (!bb || !vb[3]) return null;
  return Math.abs((bb.y - vb[1]) - (vb[1] + vb[3] - bb.y - bb.height)) / vb[3];
}).filter(x => x !== null));
check('Symbole sitzen senkrecht mittig', mittig.length >= 6 && mittig.every(x => x < 0.02), JSON.stringify(mittig.map(x => +x.toFixed(3))));

// Gliederung wechseln darf den Fokus nicht in den Text ziehen: auf dem iPhone sprang die Ansicht
// in das Textfeld und die Tastatur ging auf, während man noch in der Auswahlleiste war (1.51.3).
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
const vorher = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
await page.evaluate(() => { const s = document.querySelector('#strip-list .item[data-value="dot"]') ||
  document.querySelectorAll('#strip-list .item')[1]; s.click(); });
await page.waitForTimeout(300);
const nachher = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
check('Gliederungswechsel öffnet nicht die Tastatur', nachher !== 'text' && nachher === vorher, vorher + ' → ' + nachher);

// Erledigt: Tipp auf das Kästchen setzt den Haken, der Wechsel der Listenart behält ihn (1.53.0).
// **Nur bei Kästchen** – seit 3.22 ist die Trefferzone bei Strichen, Punkten und Zahlen abgeschaltet
// (Auftraggeber: „dieser Bereich sollte nur bei den Kästchen funktionieren, bei den anderen sollte dort
// nichts passieren“). Dort ist ein Tipp jetzt ein gewöhnlicher Tipp in den Text.
await page.evaluate(() => { textEl.value = 'Kopf\nRasen wässern\nNadine anrufen'; onTextChanged();
  state.title = true; state.list = 'check'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
const treffer = await page.evaluate(() => { const d = textEl.el.children[1]; const r = d.getBoundingClientRect();
  return { x: r.left + 4, y: r.top + r.height / 2 }; });
await page.mouse.click(treffer.x, treffer.y); await page.waitForTimeout(250);
check('Tipp auf das Kästchen setzt den Haken',
  (await page.evaluate(() => textEl.value)) === 'Kopf\n☑ Rasen wässern\n☐ Nadine anrufen',
  JSON.stringify(await page.evaluate(() => textEl.value)));
check('im Kasten kein zusätzlicher Strich',
  !(await page.evaluate(() => textEl.el.children[1].classList.contains('durch'))));
check('Tastatur bleibt zu', (await page.evaluate(() => document.activeElement.id || document.activeElement.tagName)) !== 'text');
await page.evaluate(() => { state.list = 'dot'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
check('Wechsel auf Punkte macht aus dem ☑ einen Haken hinter der Zeile',
  (await page.evaluate(() => textEl.value)) === 'Kopf\n• Rasen wässern ✓\n• Nadine anrufen',
  JSON.stringify(await page.evaluate(() => textEl.value)));
check('erledigte Zeile wird dort durchgestrichen',
  await page.evaluate(() => textEl.el.children[1].classList.contains('durch')));
// 3.22: derselbe Tipp an derselben Stelle – bei Punkten darf er nichts abhaken
await page.mouse.click(treffer.x, treffer.y); await page.waitForTimeout(250);
check('bei Punkten hakt der Tipp auf die Markierung nichts ab',
  (await page.evaluate(() => textEl.value)) === 'Kopf\n• Rasen wässern ✓\n• Nadine anrufen',
  JSON.stringify(await page.evaluate(() => textEl.value)));
await page.evaluate(() => { state.list = 'check'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.mouse.click(treffer.x, treffer.y); await page.waitForTimeout(250);
check('nochmal tippen nimmt den Haken zurück',
  (await page.evaluate(() => textEl.value)) === 'Kopf\n☐ Rasen wässern\n☐ Nadine anrufen',
  JSON.stringify(await page.evaluate(() => textEl.value)));

// Langes Drücken auf das Kästchen öffnet die Auswahl für Form und Farbe des Hakens (1.54.0).
await page.evaluate(() => { textEl.value = 'Kopf\n☑ Rasen wässern\n☐ Nadine anrufen'; onTextChanged();
  state.title = true; state.list = 'check'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
const mk = await page.evaluate(() => { const d = textEl.el.children[1], r = d.getBoundingClientRect();
  return { x: r.left + 4, y: r.top + r.height / 2 }; });
await page.mouse.move(mk.x, mk.y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
await page.waitForTimeout(250);
check('langes Drücken öffnet die Hakenauswahl', await page.evaluate(() => !document.getElementById('hcolors').hidden));
check('langes Drücken schaltet nicht um',
  (await page.evaluate(() => textEl.value)) === 'Kopf\n☑ Rasen wässern\n☐ Nadine anrufen',
  JSON.stringify(await page.evaluate(() => textEl.value)));
await page.evaluate(() => { document.querySelectorAll('#hcolors .row')[0].querySelectorAll('.chip')[3].click();
  document.querySelectorAll('#hcolors .row')[1].querySelectorAll('.chip')[1].click(); });
await page.waitForTimeout(300);
check('Form und Farbe kommen im Zustand an',
  (await page.evaluate(() => [state.doneForm, state.doneColor].join(','))) === 'kreuz,rot',
  await page.evaluate(() => [state.doneForm, state.doneColor].join(',')));
check('Haken zählt zum bildbestimmenden Stand',
  await page.evaluate(() => SNAP_FIELDS.includes('doneForm') && SNAP_FIELDS.includes('doneColor')));
// Vorschau und Bild müssen gleich umbrechen – der Haken belegt in beiden HAKEN_EM breit Platz
check('Vorschau und Bild haben gleich viele Zeilen',
  await page.evaluate(() => { const t = targetCanvas();
    return fitNote(t.w, t.h, t.layout, noteText()).lines.length === textEl.el.children.length; }));
await page.evaluate(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
await page.waitForTimeout(200);
check('Tipp daneben schließt die Auswahl', await page.evaluate(() => document.getElementById('hcolors').hidden));

// Antippen hinter dem Text erledigt die Zeile – dort steht auch der blasse Wegweiser (1.55.0).
await page.evaluate(() => { textEl.value = 'Kopf\n• Rasen wässern\n• Nadine anrufen'; onTextChanged();
  state.title = true; state.list = 'dot'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
const hinten = await page.evaluate(() => { const d = textEl.el.children[1], r = d.getBoundingClientRect();
  const rr = document.createRange(); rr.selectNodeContents(d);
  return { x: (rr.getBoundingClientRect().right + r.right) / 2, y: r.top + r.height / 2 }; });
await page.mouse.click(hinten.x, hinten.y); await page.waitForTimeout(250);
check('Tipp hinter dem Text erledigt die Zeile',
  (await page.evaluate(() => textEl.value)) === 'Kopf\n• Rasen wässern ✓\n• Nadine anrufen',
  JSON.stringify(await page.evaluate(() => textEl.value)));
// Die Box am Zeilenende gibt es auf **jeder** Punktzeile – offen zeigt sie den Wegweiser, erledigt den Haken.
// Nur so hält der Browser denselben Platz frei wie die Breitenrechnung, und der Wegweiser bleibt antippbar.
const boxen = await page.evaluate(() => [...textEl.el.children].map(d => {
  const c = getComputedStyle(d, '::after');
  return c.content === 'none' ? 'keine' : (c.backgroundImage.includes('%230') || c.backgroundImage.includes('0.22') ? 'geist' : 'haken');
}));
check('Überschrift ohne Box, Punktzeilen mit', boxen[0] === 'keine' && boxen[1] !== 'keine' && boxen[2] !== 'keine', JSON.stringify(boxen));
check('erledigt zeigt den Haken, offen den Wegweiser', boxen[1] !== boxen[2], JSON.stringify(boxen));
await page.evaluate(() => { state.list = 'check'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
check('Kästchenliste ohne Box am Zeilenende', await page.evaluate(() =>
  [...textEl.el.children].every(d => getComputedStyle(d, '::after').content === 'none')));

// Terminliste (1.59.0): der vordere Block wird erkannt, nicht gesetzt – und alle bekommen dieselbe Spalte.
await page.evaluate(() => { textEl.value = 'Termine\nFr 12:00 Friseur\nMi 9:30 Zahnarzt\n12.9. Elternabend\nOhne Zeit';
  onTextChanged(); state.title = true; state.list = 'termin'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
check('Text bleibt unverändert – die App setzt hier keine Markierung',
  (await page.evaluate(() => textEl.value)) === 'Termine\nFr 12:00 Friseur\nMi 9:30 Zahnarzt\n12.9. Elternabend\nOhne Zeit',
  JSON.stringify(await page.evaluate(() => textEl.value)));
const mks = await page.evaluate(() => [...textEl.el.children].map(d => d.getAttribute('data-mk')));
check('Wochentag, Uhrzeit und Datum werden erkannt',
  mks[1] === 'Fr 12:00' && mks[2] === 'Mi 9:30' && mks[3] === '12.9.', JSON.stringify(mks));
check('Überschrift und Zeile ohne Zeitangabe bleiben ohne Block', mks[0] === null && mks[4] === null, JSON.stringify(mks));
const einz = await page.evaluate(() => [...textEl.el.children].slice(1, 4).map(d => Math.round(parseFloat(getComputedStyle(d).paddingLeft))));
check('alle Termine teilen sich eine Spalte', new Set(einz).size === 1 && einz[0] > 0, JSON.stringify(einz));
check('in der Terminliste kein Haken am Zeilenende',
  (await page.evaluate(() => getComputedStyle(textEl.el.children[1], '::after').content)) === 'none');
check('Vorschau und Bild brechen gleich um', await page.evaluate(() => {
  const t = targetCanvas(), f = fitNote(t.w, t.h, t.layout, noteText());
  const sicht = [...textEl.el.children].reduce((a, d) => {
    const lh = parseFloat(getComputedStyle(d).lineHeight) || 1;
    return a + Math.max(1, Math.round(d.getBoundingClientRect().height / lh)); }, 0);
  return f.lines.length === sicht; }));

check('scrollWidth ≤ 448', sw <= 448, String(sw));
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
