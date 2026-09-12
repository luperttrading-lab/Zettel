// Test 1.62.1: Terminliste – Vorschau und Bild brechen gleich um, und der Einzug springt beim Tippen nicht.
//   1) Parität: die Zeilenzahl aus wrap() (die das Bild zeichnet) stimmt mit der des echten Textfelds überein.
//      Vorher reservierte wrap() auch bei Terminen Platz für den Haken, den es dort gar nicht gibt
//      (das CSS blendet die Box aus, hakenZeile() sperrt den Tipp) – das Bild brach eine Zeile früher um.
//   2) Halbfertiger Terminkopf: „Fr. 7“ ist eine angefangene Uhrzeit, kein Kopf mit Rumpf „7“.
//      Vorher sprang der Rumpf beim fünften Zeichen in die gemeinsame Spalte und beim Weitertippen zurück.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_termine.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1000);

// 1) Parität über viele Textkombinationen, Listenarten und Schriften.
//    Der Schriftregler bleibt bei 100 %: bei 110 % liegen einzelne Zeilen so dicht an der Umbruchkante,
//    dass Canvas-Messung und Browser-Layout um Bruchteile eines Pixels auseinanderliegen (siehe UEBERGABE).
for (const font of ['caveat', 'kalam', 'marker', 'indie', 'gloria']) {
  await page.evaluate(async f => { state.font = f; await ensureFont(); if (document.fonts) await document.fonts.ready; }, font);
  await page.waitForTimeout(400);
  for (const art of ['termin', 'dash', 'check']) {
    const r = await page.evaluate(([art]) => {
      state.list = art; state.fontScale = 100;
      const w = ['Auto','Werkstatt','Termin','Tierarzt','Kontrolle','Elternabend','Einkaufen','Sport','Zahnarzt','Besuch','Oma','Kino','Anna','Markt'];
      const vorne = { termin: 'Mo. 13:30 ', dash: '– ', check: '☐ ' };
      let ab = 0, ges = 0, bsp = null;
      for (let n = 2; n <= 10; n++) for (let k = 0; k < 14; k++) {
        const z = []; for (let i = 0; i < n; i++) z.push(vorne[art] + w[(i + k) % 14] + ' ' + w[(i + k + 5) % 14]);
        textEl.value = z.join('\n'); onTextChanged(); flush(); syncPreview();
        const tc = targetCanvas(), f = fitNote(tc.w, tc.h, tc.layout, noteText());
        const sc = noteEl.clientWidth / f.noteW;
        const echt = [...document.querySelectorAll('.note .editor .ln')]
          .map(d => Math.round(d.getBoundingClientRect().height / (f.fs * f.LH * sc))).reduce((a, x) => a + x, 0);
        ges++;
        if (echt !== f.lines.length) { ab++; if (!bsp) bsp = { text: z[0], n, wrap: f.lines.length, textfeld: echt }; }
      }
      return { ab, ges, bsp };
    }, [art]);
    check(`Umbruch gleich: ${font} / ${art} (${r.ges} Fälle)`, r.ab === 0, r.bsp ? JSON.stringify(r.bsp) : '');
  }
}
await page.evaluate(async () => { state.font = 'caveat'; await ensureFont(); }); await page.waitForTimeout(400);

// 2) Halbfertiger Terminkopf: der Rumpf bleibt vorne, bis die Uhrzeit steht.
const lauf = await page.evaluate(() => {
  state.list = 'termin'; state.fontScale = 100;
  const fertig = 'Mo. 13:30 Molly Tierarzt\nDi. 9:00 Zahnarzt';
  const neu = 'Fr. 7:45 Auto Werkstatt';
  const aus = [];
  for (let i = 1; i <= neu.length; i++) {
    textEl.value = fertig + '\n' + neu.slice(0, i); onTextChanged(); flush(); syncPreview();
    const d = textEl.el.children[2];
    aus.push({ getippt: neu.slice(0, i), mk: d.dataset.mk || '', einzug: Math.round(parseFloat(d.style.paddingLeft) || 0) });
  }
  return aus;
});
const vorKopf = lauf.filter(z => !/^Fr\. \d{1,2}:\d{2} \S/.test(z.getippt));
const nachKopf = lauf.filter(z => /^Fr\. \d{1,2}:\d{2} \S/.test(z.getippt));
check('während der Uhrzeit kein Einzug', vorKopf.every(z => z.einzug === 0 && z.mk === ''),
  JSON.stringify(vorKopf.filter(z => z.einzug !== 0 || z.mk !== '')));
check('fertiger Kopf rückt in die gemeinsame Spalte', nachKopf.length > 0 && nachKopf.every(z => z.mk === 'Fr. 7:45' && z.einzug > 0),
  JSON.stringify(nachKopf[0]));
// Genau **ein** Sprung: der Einzug wechselt nur einmal von 0 auf die Spaltenbreite
const spruenge = lauf.filter((z, i) => i > 0 && (z.einzug === 0) !== (lauf[i - 1].einzug === 0)).length;
check('nur ein Wechsel des Einzugs beim Tippen', spruenge === 1, spruenge + ' Wechsel: ' + JSON.stringify(lauf.map(z => z.einzug)));

// 3) Der Kopf **mit** Uhrzeit gilt auch, wenn der Rumpf mit einer Ziffer beginnt („3 Kisten abholen“)
const ziffern = await page.evaluate(() => {
  state.list = 'termin';
  const proben = ['Mo. 13:30 3 Kisten abholen', '12.9. 2 Karten kaufen', 'Fr. 7', 'Fr. 7:4', 'Sonntag Brunch'];
  return proben.map(p => { const m = marke(p); return { p, mk: m ? m[0] : null }; });
});
check('„Mo. 13:30 3 Kisten“ bleibt ein Termin', ziffern[0].mk === 'Mo. 13:30 ', JSON.stringify(ziffern[0]));
check('„12.9. 2 Karten“ bleibt ein Termin', ziffern[1].mk === '12.9. ', JSON.stringify(ziffern[1]));
check('„Fr. 7“ ist kein Termin', ziffern[2].mk === null, JSON.stringify(ziffern[2]));
check('„Fr. 7:4“ ist kein Termin', ziffern[3].mk === null, JSON.stringify(ziffern[3]));
check('„Sonntag Brunch“ bleibt ein Termin', ziffern[4].mk === 'Sonntag ', JSON.stringify(ziffern[4]));

// 4) Doppelpflege: dieselbe Zusatzbedingung steht in index.html **und** in lib/render.js.
//    Der Server hat kein DOM, deshalb hier der Vergleich der beiden Quellzeilen statt eines Renderlaufs.
const REGEL = "if (!/\\d/.test(m[1]) && /^\\d/.test(line.slice(m[0].length))) return null;";
const quellen = ['index.html', 'lib/render.js'].map(d => ({ d, treffer: fs.readFileSync(d, 'utf8').includes(REGEL) }));
check('halbfertiger Kopf: gleiche Regel in App und Server', quellen.every(q => q.treffer),
  JSON.stringify(quellen));

await page.screenshot({ path: out + '/termine.png' });

// 3.26: Beim Tippen springt der Einzug. Die Markierung eines Termins steckt im Attribut `data-mk`, nicht
// im Text; der Einzug kommt aus applyIndents. Passt beides nicht zusammen, rückt die ganze Zeile ein,
// statt nur den Text hinter dem herausgezogenen Kopf (vom Auftraggeber am Bild gemeldet). Zwei Fälle:
// nach Return erbt die neue Zeile kein data-mk, und aus „Sa. 19:00 Gabi" wird erst mit dem Leerzeichen
// hinter der Uhrzeit ein Termin.
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(900);
await page.evaluate(() => {
  document.querySelector('#strip-list .item[data-value="termin"]').click();
  textEl.value = 'Fr. 7:45 Auto Werkstatt\nMo. 13:30 Molly Tierarzt'; onTextChanged(); flush(); syncPreview();
  textEl.focus(); textEl.setCaret(textEl.value.length);
});
await page.waitForTimeout(300);
const zeilenLage = () => page.evaluate(() => [...document.querySelectorAll('#text .ln')].map(d => ({
  txt: d.textContent, mk: d.getAttribute('data-mk'), pad: Math.round(parseFloat(getComputedStyle(d).paddingLeft) || 0) })));
await page.keyboard.press('Enter'); await page.waitForTimeout(250);
await page.keyboard.type('Sa. 19:00 Gabi Isy', { delay: 20 }); await page.waitForTimeout(400);
const getippt = await zeilenLage();
check('die getippte Terminzeile trägt ihren Kopf im Attribut',
  getippt[2].mk === 'Sa. 19:00' && getippt[2].txt === 'Gabi Isy', JSON.stringify(getippt[2]));
check('alle Termine haben denselben Einzug – die Uhrzeiten fluchten',
  new Set(getippt.map(z => z.pad)).size === 1, JSON.stringify(getippt.map(z => z.pad)));
check('der Text bleibt vollständig',
  (await page.evaluate(() => state.text)).endsWith('Sa. 19:00 Gabi Isy'),
  JSON.stringify(await page.evaluate(() => state.text)));
// Auch beim schrittweisen Tippen: solange die Zeile kein Termin ist, darf sie keinen Einzug haben
await page.evaluate(() => { textEl.value = 'Fr. 7:45 Auto Werkstatt'; onTextChanged(); flush(); syncPreview();
  textEl.focus(); textEl.setCaret(textEl.value.length); });
await page.waitForTimeout(250);
await page.keyboard.press('Enter'); await page.waitForTimeout(200);
await page.keyboard.type('Sa. 19:00', { delay: 20 }); await page.waitForTimeout(300);
const halb = await zeilenLage();
check('halbfertige Zeile: kein Kopf, kein Einzug', halb[1].mk === null && halb[1].pad === 0, JSON.stringify(halb[1]));
await page.keyboard.type(' Gabi', { delay: 20 }); await page.waitForTimeout(300);
const fertig = await zeilenLage();
check('mit dem Leerzeichen wird daraus ein Termin mit Kopf und Einzug',
  fertig[1].mk === 'Sa. 19:00' && fertig[1].pad === fertig[0].pad, JSON.stringify(fertig[1]));

// 3.31: **Der Terminkopf muss erreichbar sein.** Er steht im Attribut data-mk, also nicht im DOM-Text –
// der Cursor kam nicht hinein, das Datum war nicht zu ändern, und ein Rückschritt am Rumpfanfang
// verschmolz die Zeile mit der darüber und verlor dabei den eigenen Kopf (Auftraggeber am Bild,
// 12.9.2026). Jetzt holt der erste Rückschritt – und ein Tipp in die Kopfspalte – den Kopf in den Text.
await page.evaluate(() => {
  state.list = 'termin'; applyList();
  textEl.value = 'Sa. 16:30 Jan-Niklas\nSo. 11:00 Wohnung Emely\nMo. 9:20 Miklody';
  onTextChanged(); flush(); persist();
});
await page.waitForTimeout(400);
const kopfStand = () => page.evaluate(() => ({
  text: textEl.value,
  mk: [...textEl.el.children].map(d => d.getAttribute('data-mk')),
  pad: [...textEl.el.children].map(d => Math.round(parseFloat(getComputedStyle(d).paddingLeft) || 0)),
  pos: textEl.selectionStart,
}));
const VOR = 'Sa. 16:30 Jan-Niklas\nSo. 11:00 Wohnung Emely\nMo. 9:20 Miklody';
await page.evaluate(() => { textEl.focus(); textEl.selectionStart = 'Sa. 16:30 Jan-Niklas\nSo. 11:00 '.length; });
await page.waitForTimeout(200);
await page.keyboard.press('Backspace'); await page.waitForTimeout(300);
const nachRueck = await kopfStand();
check('Rückschritt vorn im Rumpf verschluckt die Zeile darüber nicht',
  nachRueck.text === VOR, JSON.stringify(nachRueck.text));
check('stattdessen steht der Kopf jetzt im Text', nachRueck.mk[1] === null, JSON.stringify(nachRueck.mk));
// **Der Kopf darf beim Öffnen nicht springen** – man tippt ja auf ihn. Er stand als Etikett bei
// left:0 und muss dort bleiben; der Rumpf rutscht statt dessen an ihn heran, das ist das Signal
// „Zeile offen". Gemessen wird die linke Kante der Zeile ohne Einzug.
const kopfX = () => page.evaluate(() => [...textEl.el.children].map(d =>
  Math.round(d.getBoundingClientRect().left + (parseFloat(getComputedStyle(d).paddingLeft) || 0)
             - (d.hasAttribute('data-mk') ? parseFloat(getComputedStyle(d).paddingLeft) || 0 : 0))));
const xNachRueck = await kopfX();
check('der Kopf bleibt beim Öffnen an seiner Stelle',
  Math.abs(xNachRueck[1] - xNachRueck[0]) <= 2, JSON.stringify(xNachRueck));
check('die anderen Zeilen behalten ihren Kopf',
  nachRueck.mk[0] === 'Sa. 16:30' && nachRueck.mk[2] === 'Mo. 9:20', JSON.stringify(nachRueck.mk));
check('der Cursor steht hinter dem Kopf – von dort ist er zu löschen',
  nachRueck.pos === 'Sa. 16:30 Jan-Niklas\nSo. 11:00 '.length, String(nachRueck.pos));
// Der zweite Rückschritt löscht jetzt ein Zeichen des Kopfes, statt Zeilen zu verschmelzen
await page.keyboard.press('Backspace'); await page.waitForTimeout(300);
check('der nächste Rückschritt trifft den Kopf, nicht die Zeile darüber',
  (await kopfStand()).text === 'Sa. 16:30 Jan-Niklas\nSo. 11:00Wohnung Emely\nMo. 9:20 Miklody',
  JSON.stringify((await kopfStand()).text));

// Tipp in die Kopfspalte: Cursor landet **im** Kopf
await page.evaluate(v => { textEl.value = v; onTextChanged(); flush(); }, VOR);
await page.waitForTimeout(400);
const treffer = await page.evaluate(() => { const r = textEl.el.children[2].getBoundingClientRect();
  return { x: r.left + 14, y: r.top + r.height / 2 }; });
await page.mouse.click(treffer.x, treffer.y); await page.waitForTimeout(400);
const nachTipp = await kopfStand();
const zeile3Start = 'Sa. 16:30 Jan-Niklas\nSo. 11:00 Wohnung Emely\n'.length;
check('ein Tipp in die Kopfspalte öffnet genau diese Zeile',
  nachTipp.mk[2] === null && nachTipp.mk[0] === 'Sa. 16:30' && nachTipp.mk[1] === 'So. 11:00',
  JSON.stringify(nachTipp.mk));
check('und setzt den Cursor in den Kopf, nicht dahinter',
  nachTipp.pos >= zeile3Start && nachTipp.pos < zeile3Start + 'Mo. 9:20'.length,
  String(nachTipp.pos) + ' erwartet zwischen ' + zeile3Start + ' und ' + (zeile3Start + 8));
check('der Text bleibt beim Öffnen unverändert', nachTipp.text === VOR, JSON.stringify(nachTipp.text));
// Ein Tipp in eine andere Zeile schließt die offene wieder – es ist immer höchstens eine offen
const andere = await page.evaluate(() => { const r = textEl.el.children[0].getBoundingClientRect();
  return { x: r.right - 20, y: r.top + r.height / 2 }; });
await page.mouse.click(andere.x, andere.y); await page.waitForTimeout(400);
const nachWechsel = await kopfStand();
check('ein Tipp in eine andere Zeile schließt den Kopf wieder',
  nachWechsel.mk.every(m => m !== null), JSON.stringify(nachWechsel.mk));
check('und der Einzug steht wieder bei allen', (await kopfStand()).pad.every(p => p > 0),
  JSON.stringify((await kopfStand()).pad));

check('keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
console.log(fails ? fails + ' Prüfung(en) fehlgeschlagen' : 'alle Prüfungen bestanden');
await b.close();
process.exit(fails ? 1 : 0);
