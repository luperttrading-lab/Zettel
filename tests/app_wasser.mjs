// Test 1.65.0: Der Wasserzettel – Gläser eintragen, Summen, Tagessäule, Tageswechsel.
//
// Besonderheit gegenüber allen anderen Listenarten: Hier steht **kein Text** auf dem Zettel, sondern
// gezählte Gläser. Deshalb hat er ein eigenes Zustandsfeld (`wasser`), eine eigene Zeichnung
// (`zeichneWasser`) und in fitNote einen eigenen Zweig – ohne den zöge die Schriftautomatik ihre Größe
// aus dem leeren Text, machte die Schrift maximal groß und ließ für die Gläser keine Zeilenhöhe übrig
// (beim ersten Anlauf gemessen: negative Glashöhe, nichts zu sehen).
//
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_wasser.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FEHL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1100);

const stand = () => page.evaluate(() => { const w = wasserStand(); return { v12: w.v12, v18: w.v18, n18: w.n18, tag: +wasserTag(w).toFixed(2), gestern: w.gestern }; });
const glas = async i => { await page.evaluate(n => document.querySelectorAll('#wasser-glaeser button')[n].click(), i); await page.waitForTimeout(200); };
const fenster = async i => { await page.evaluate(n => document.querySelectorAll('#wasser-zeiten button')[n].click(), i); await page.waitForTimeout(150); };

// 1) Listenart wählen: Glasknöpfe erscheinen, das Textfeld tritt zurück
await page.evaluate(() => document.querySelector('#strip-list .item[data-value="wasser"]').click());
await page.waitForTimeout(400);
const start = await page.evaluate(() => ({
  leiste: !document.getElementById('wasserleiste').hidden,
  canvas: !document.getElementById('wasser-bild').hidden,
  editorVersteckt: getComputedStyle(document.getElementById('text')).visibility === 'hidden',
  knoepfe: document.querySelectorAll('#wasser-glaeser button').length,
  zeiten: document.querySelectorAll('#wasser-zeiten button').length,
  text: state.text,
}));
check('Wasser gewählt: Gläser und Zeitfenster erscheinen', start.leiste && start.knoepfe === 3 && start.zeiten === 3, JSON.stringify(start));
check('Wasser gewählt: gezeichneter Zettel statt Textfeld', start.canvas && start.editorVersteckt, JSON.stringify(start));
check('Wasser setzt keine Listenmarkierung in den Text', start.text === '', JSON.stringify(start.text));

// 2) Eintragen: jedes Glas landet im gewählten Zeitfenster, die Summen stimmen
await fenster(0); await glas(0); await glas(2);          // 0,2 + 0,5
await fenster(1); await glas(1); await glas(1);          // 0,3 + 0,3
await fenster(2); await glas(2);                         // 0,5
const s1 = await stand();
check('Gläser landen im gewählten Zeitfenster',
  JSON.stringify([s1.v12, s1.v18, s1.n18]) === JSON.stringify([['klein','gross'], ['mittel','mittel'], ['gross']]), JSON.stringify(s1));
check('Tagesmenge ist die Summe aller Gläser', Math.abs(s1.tag - 1.8) < 1e-9, s1.tag + ' l statt 1,8 l');
const reiter = await page.evaluate(() => [...document.querySelectorAll('#wasser-zeiten button')].map(b => b.textContent));
check('die Zeitfenster zeigen ihre Zwischensumme',
  reiter[0].includes('0,7') && reiter[1].includes('0,6') && reiter[2].includes('0,5'), JSON.stringify(reiter));

// 3) Ein Tipp auf ein Glas im Zettel nimmt es wieder weg – die einzige Korrekturmöglichkeit
const ziel = await page.evaluate(() => {
  const q = wasserTreffer.find(x => x.key === 'v12' && x.n === 0);
  const r = document.getElementById('wasser-bild').getBoundingClientRect();
  return q ? { x: r.left + q.x + q.w / 2, y: r.top + q.y + q.h / 2 } : null;
});
check('jedes Glas hat ein Trefferfeld', !!ziel, JSON.stringify(await page.evaluate(() => wasserTreffer.length)));
if (ziel) { await page.mouse.click(ziel.x, ziel.y); await page.waitForTimeout(300); }
const s2 = await stand();
check('Tipp auf ein Glas entfernt genau dieses', JSON.stringify(s2.v12) === JSON.stringify(['gross']) && Math.abs(s2.tag - 1.6) < 1e-9, JSON.stringify(s2));

// 4) Der Mülleimer am Zettel leert die Gläser – dafür sitzt er dort
await page.evaluate(() => document.getElementById('clear').click()); await page.waitForTimeout(350);
const s3 = await stand();
check('Mülleimer leert den Wasserzettel', s3.tag === 0 && !s3.v12.length && !s3.v18.length && !s3.n18.length, JSON.stringify(s3));

// 5) Tageswechsel: neuer Tag beginnt bei null, der Vortag bleibt vermerkt
await page.evaluate(() => {
  state.wasser = { tag: '2020-01-01', v12: ['gross', 'gross'], v18: ['mittel'], n18: [], gestern: null };
  zettelSichern(); persist();
});
await page.reload(); await page.waitForTimeout(900);
const s4 = await stand();
check('neuer Tag beginnt bei null', s4.tag === 0, JSON.stringify(s4));
check('die Menge des Vortags bleibt stehen', Math.abs(s4.gestern - 1.3) < 1e-9, 'gestern ' + s4.gestern + ' statt 1,3');

// 6) Die Vorschau zeichnet nichts Eigenes: derselbe Aufruf muss Pixel für Pixel dasselbe liefern
await page.evaluate(() => { state.wasser = { tag: heuteKennung(), v12: ['klein','gross'], v18: ['mittel'], n18: [], gestern: 2.4 }; syncPreview(); });
await page.waitForTimeout(300);
const gleich = await page.evaluate(() => {
  const ist = document.getElementById('wasser-bild');
  const soll = document.createElement('canvas');
  soll.width = ist.width; soll.height = ist.height;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const g = soll.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const f = letzteMasse, scale = noteEl.clientWidth / f.noteW;
  zeichneWasser(g, (f.noteW - 2 * f.pad) * scale, (f.noteH - f.textTop - f.pad) * scale,
    { w: wasserStand(), ink: inkColor(), family: f.family, weight: f.weight, fs: f.fs * scale });
  const a = ist.getContext('2d').getImageData(0, 0, ist.width, ist.height).data;
  const c = g.getImageData(0, 0, soll.width, soll.height).data;
  let anders = 0, gesetzt = 0;
  for (let i = 0; i < a.length; i += 4) { if (a[i + 3] > 10) gesetzt++; if (a[i + 3] !== c[i + 3] || a[i] !== c[i]) anders++; }
  return { anders, gesetzt };
});
check('die Vorschau nutzt genau dieselbe Zeichnung wie das Bild', gleich.anders === 0 && gleich.gesetzt > 500, JSON.stringify(gleich));

// 7) Ein Wasserzettel neben einem Textzettel: das Bild darf NICHT davon abhängen, welcher gerade
//    aktiv ist. Genau daran scheiterte der erste Anlauf – `istWasser()` stand hinter dem `await` in
//    zeichneEinenZettel, und mitZettel hatte den Zustand da längst zurückgestellt: beide Zettel
//    erschienen als Wasserzettel. Zwei Bilder mit verschiedenem aktiven Zettel müssen gleich sein.
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(900);
const paar = await page.evaluate(async () => {
  await ensureFont(); if (document.fonts) await document.fonts.ready;
  state.list = 'dash'; state.color = 'yellow'; state.noteScale = 0.6; state.noteX = 0.5; state.noteY = 0.28; state.noteRot = 0;
  textEl.value = '– Milch\n– Brot'; onTextChanged(); flush(); syncPreview(); zettelSichern();
  zettelDazu();
  state.list = 'wasser'; state.color = 'blue'; state.noteScale = 0.6; state.noteX = 0.5; state.noteY = 0.7; state.noteRot = 0;
  state.wasser = { tag: heuteKennung(), v12: ['gross'], v18: ['klein'], n18: [], gestern: null };
  applyColor(); applyList(); onTextChanged(); flush(); syncPreview(); zettelSichern();
  const t = targetCanvas();
  const daten = async () => {
    const c = await renderWallpaper(t.w, t.h, t.layout);
    return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  };
  state.aktiv = 1; Object.assign(state, state.zettel[1]);   // Wasserzettel aktiv
  const a = await daten();
  state.aktiv = 0; Object.assign(state, state.zettel[0]);   // Textzettel aktiv
  const b2 = await daten();
  let anders = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b2[i] || a[i + 3] !== b2[i + 3]) anders++;
  return { anders, pixel: a.length / 4 };
});
check('das Bild hängt nicht davon ab, welcher Zettel gerade aktiv ist', paar.anders === 0,
  paar.anders + ' von ' + paar.pixel + ' Bildpunkten verschieden');

// 8) Übertragen: der Wasserzettel hat keinen Text – die Prüfung darauf sperrte ihn dauerhaft mit
//    „Erst was draufschreiben", obwohl Gläser darauf standen (vom Auftraggeber gemeldet, 1.65.2).
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(900);
const meldung = () => page.evaluate(() => (document.getElementById('satz') || {}).textContent || '');
await page.evaluate(() => document.querySelector('#strip-list .item[data-value="wasser"]').click());
await page.waitForTimeout(400);
await page.evaluate(() => stickViaShortcut()); await page.waitForTimeout(400);
check('leerer Wasserzettel: passender Hinweis statt „draufschreiben"', (await meldung()) === 'Erst ein Glas eintragen.', await meldung());
await page.evaluate(() => document.querySelectorAll('#wasser-glaeser button')[1].click()); await page.waitForTimeout(300);
await page.evaluate(() => stickViaShortcut()); await page.waitForTimeout(900);
check('mit einem Glas lässt sich der Wasserzettel übertragen', !/draufschreiben|Glas eintragen/.test(await meldung()), await meldung());
// Und: ein leerer aktiver Zettel neben einem beschriebenen darf nicht blockieren – ins Bild kommen alle
await page.evaluate(() => {
  state.wasser = wasserLeer(); zettelSichern();
  zettelDazu(); state.list = 'dash'; textEl.value = '– Milch'; onTextChanged(); flush(); zettelSichern();
  state.aktiv = 0; Object.assign(state, state.zettel[0]); applyList(); syncPreview();
});
await page.waitForTimeout(400);
await page.evaluate(() => stickViaShortcut()); await page.waitForTimeout(900);
check('leerer aktiver Zettel blockiert nicht, wenn ein anderer beschrieben ist',
  !/draufschreiben|Glas eintragen/.test(await meldung()), await meldung());

// 9) Regression: bei einer Textliste leert der Mülleimer weiterhin den Text
await page.evaluate(() => {
  state.aktiv = 1; Object.assign(state, state.zettel[1]); applyList(); syncPreview();
  document.querySelector('#strip-list .item[data-value="dash"]').click();
});
await page.waitForTimeout(300);
await page.evaluate(() => { textEl.value = '– Milch\n– Brot'; onTextChanged(); flush(); });
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('clear').click()); await page.waitForTimeout(300);
check('bei einer Textliste leert der Mülleimer den Text', (await page.evaluate(() => state.text)) === '',
  JSON.stringify(await page.evaluate(() => state.text)));
check('Glasknöpfe verschwinden wieder', await page.evaluate(() => document.getElementById('wasserleiste').hidden));

await page.screenshot({ path: out + '/wasser.png' });
check('keine Fehler in der Konsole', errors.length === 0, errors.join(' | '));
console.log(fails ? fails + ' Prüfung(en) fehlgeschlagen' : 'alle Prüfungen bestanden');
await b.close();
process.exit(fails ? 1 : 0);
