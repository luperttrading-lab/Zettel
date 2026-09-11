// Test 1.58.0: Lage und Größe des Zettels im Bild. Das Fenster „Lage im Bild" zeigt einen Rahmen im
// Seitenverhältnis des Displays; der Zettel darin lässt sich schieben, der Regler ändert die Größe.
// Geprüft wird vor allem, dass die Anteile aus dem Fenster **im fertigen Bild** ankommen.
//   Chromium-Test; Aufruf aus dem Repo-Verzeichnis: node tests/app_lage.mjs <ausgabeverzeichnis>
//   (lokaler Server auf 8766, siehe app_review.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, out = '/tmp'] = process.argv; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (extra ? ' – ' + extra : '')); if (!cond) fails++; };

await page.goto('http://localhost:8766/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); textEl.value = 'To Do Liste\n☐ Rasen wässern\n☐ Nadine anrufen';
  onTextChanged(); state.title = true; state.list = 'check'; persist(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);

check('Vorgabe: mittig, 58,5 % Höhe, volle Größe',
  await page.evaluate(() => state.noteX === 0.5 && state.noteY === 0.585 && state.noteScale === 1),
  await page.evaluate(() => [state.noteX, state.noteY, state.noteScale].join(', ')));

await page.click('#lagebtn'); await page.waitForTimeout(400);
check('Fenster öffnet', await page.evaluate(() => !document.getElementById('lage').hidden));
check('Rahmen im Seitenverhältnis des Displays', await page.evaluate(() => {
  const t = targetCanvas(), r = document.getElementById('lage-schirm').getBoundingClientRect();
  return Math.abs((r.width / r.height) - (t.w / t.h)) < 0.02;
}));

// Schieben: der Zettel folgt dem Finger
const p0 = await page.evaluate(() => { const r = document.getElementById('lage-zettel').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(p0.x, p0.y); await page.mouse.down();
await page.mouse.move(p0.x - 25, p0.y - 80, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(200);
const nachZug = await page.evaluate(() => ({ x: state.noteX, y: state.noteY }));
check('Schieben ändert die Lage', nachZug.y < 0.55 && nachZug.x < 0.5, JSON.stringify(nachZug));

await page.evaluate(() => { const r = document.getElementById('lage-size'); r.value = '70'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
await page.waitForTimeout(200);
check('Regler ändert die Größe', await page.evaluate(() => Math.abs(state.noteScale - 0.7) < 1e-9), await page.evaluate(() => String(state.noteScale)));

// 3.11: Der Zettel darf **über den Rand** – nur seine Mitte bleibt im Bild. Ein Zug weit nach links oben
// endet also mit der Mitte in der Ecke (0, 0), nicht mehr mit dem ganzen Zettel im Bild.
const p1 = await page.evaluate(() => { const r = document.getElementById('lage-zettel').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(p1.x, p1.y); await page.mouse.down();
await page.mouse.move(p1.x - 900, p1.y - 900, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(200);
const ecke = await page.evaluate(() => ({ x: state.noteX, y: state.noteY }));
check('über den Rand gezogen: die Mitte bleibt im Bild, der Rest hängt heraus',
  Math.abs(ecke.x) < 1e-9 && Math.abs(ecke.y) < 1e-9, JSON.stringify(ecke));

// Gespeicherter Wert und gezeichnete Lage müssen **gleich** sein. Bis 1.60.1 wurde auf 0…1 geklemmt,
// gezeichnet aber auf den Bereich, in dem der Zettel ganz ins Bild passt: nach einem Zug über den oberen
// Rand stand 0 im Speicher, gezeichnet wurde 0,18 – und der nächste Zug nach unten blieb wirkungslos.
const lageMessen = async (dx, dy) => {
  const c = await page.evaluate(() => { const r = document.getElementById('lage-zettel').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(150);
  return page.evaluate(() => { const s = document.getElementById('lage-schirm').getBoundingClientRect(),
      z = document.getElementById('lage-zettel').getBoundingClientRect();
    return { zustand: state.noteY, gezeichnet: ((z.top + z.height / 2) - s.top) / s.height }; });
};
const weitHoch = await lageMessen(0, -400);
check('nach dem Zug über den Rand: Zustand = gezeichnete Lage',
  Math.abs(weitHoch.zustand - weitHoch.gezeichnet) < 0.01,
  weitHoch.zustand.toFixed(4) + ' vs ' + weitHoch.gezeichnet.toFixed(4));
const kleinRunter = await lageMessen(0, 60);
check('kleiner Zug zurück wirkt sofort', kleinRunter.gezeichnet - weitHoch.gezeichnet > 0.02,
  weitHoch.gezeichnet.toFixed(4) + ' → ' + kleinRunter.gezeichnet.toFixed(4));

await page.click('#lage-fertig'); await page.waitForTimeout(300);
check('Fenster schließt', await page.evaluate(() => document.getElementById('lage').hidden));

// Die Anteile müssen im Bild ankommen: gelbes Papier suchen und mit der Rechnung vergleichen
const mass = await page.evaluate(async () => {
  const t = targetCanvas();
  const c = await renderWallpaper(t.w, t.h, t.layout, {});
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 4) for (let xx = 0; xx < c.width; xx += 4) {
    const i = (y * c.width + xx) * 4;
    if (d[i] > 200 && d[i+1] > 190 && d[i+2] < 190 && d[i] - d[i+2] > 45) {
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const f = fitNote(t.w, t.h, t.layout, noteText());
  // Soll ist die Lage der Mitte (auf 0…1 geklemmt); was über den Rand hängt, ist im Bild nicht zu sehen,
  // deshalb wird die Mitte des **sichtbaren** Papiers gegen die auf das Bild beschnittene Erwartung geprüft
  const kl = (v, a, c) => Math.max(a, Math.min(c, v));
  const cx = kl(state.noteX, 0, 1) * t.w, cy = kl(state.noteY, 0, 1) * t.h;
  const sollY = ((kl(cy - f.noteH / 2, 0, t.h) + kl(cy + f.noteH / 2, 0, t.h)) / 2) / t.h;
  // Der Zettel steht nach dem Zug in die Ecke halb im Bild: erwartet ist die **sichtbare** Breite
  const sollBreite = (kl(cx + f.noteW / 2, 0, t.w) - kl(cx - f.noteW / 2, 0, t.w)) / t.w;
  return { breite: (x1 - x0) / t.w, sollBreite, mitteY: ((y0 + y1) / 2) / t.h, sollY };
});
check('sichtbare Breite im Bild = Regler, beschnitten am Rand', Math.abs(mass.breite - mass.sollBreite) < 0.05,
  mass.breite.toFixed(3) + ' vs ' + mass.sollBreite.toFixed(3));
check('Lage im Bild folgt dem Fenster', Math.abs(mass.mitteY - mass.sollY) < 0.05,
  mass.mitteY.toFixed(3) + ' vs ' + mass.sollY.toFixed(3));

// Zurücksetzen
await page.click('#lagebtn'); await page.waitForTimeout(300);
await page.click('#lage-reset'); await page.waitForTimeout(200);
check('Zurücksetzen stellt die Vorgabe her',
  await page.evaluate(() => state.noteX === 0.5 && state.noteY === 0.585 && state.noteScale === 1));
await page.click('#lage-fertig'); await page.waitForTimeout(200);


// ── 1.64.0: Das Fenster zeigt die ECHTE Zeichnung, keine nachgebaute Miniatur ──────────────────────
// Bis 1.63.1 war der Zettel dort ein farbiges Rechteck mit Rohtext: ohne Papiermuster, Befestigung,
// Durchstreichung, grünen Haken, unterstrichene Überschrift und ohne die gemeinsame Terminspalte –
// der Auftraggeber hat den Unterschied fotografiert. Jetzt liegt derselbe Canvas darin, der aufs
// Display geht (nur ohne Hintergrund, darunter steht das Eichbild).
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(async () => {
  state.list = 'dash'; state.paper = 'grid'; state.title = true; state.noteScale = 0.9;
  textEl.value = 'To Do List:\n– Rasen wässern ✓\n– Nadine anrufen\n– Deutsche Bank';
  onTextChanged(); flush(); await ensureFont(); if (document.fonts) await document.fonts.ready; syncPreview(); zettelSichern();
  zettelDazu();
  state.list = 'termin'; state.color = 'pink'; state.paper = 'grid'; state.noteScale = 0.5; state.noteRot = 6;
  textEl.value = 'Fr. 7:45 Auto Werkstatt\nMo. 13:30 Molly Tierarzt';
  onTextChanged(); flush(); syncPreview(); zettelSichern();
});
await page.evaluate(() => lageOeffnen(true)); await page.waitForTimeout(900);
const gleich = await page.evaluate(async () => {
  const t = targetCanvas();
  const soll = await renderWallpaper(t.w, t.h, t.layout, { nurZettel: true });
  const ist = document.getElementById('lage-bild');
  if (ist.width !== soll.width || ist.height !== soll.height) return { fehler: 'Maße', ist: [ist.width, ist.height], soll: [soll.width, soll.height] };
  const a = ist.getContext('2d').getImageData(0, 0, ist.width, ist.height).data;
  const c2 = soll.getContext('2d').getImageData(0, 0, soll.width, soll.height).data;
  let anders = 0, gesetzt = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] > 10 || c2[i + 3] > 10) gesetzt++;
    if (Math.abs(a[i] - c2[i]) > 2 || Math.abs(a[i + 1] - c2[i + 1]) > 2 || Math.abs(a[i + 2] - c2[i + 2]) > 2 || Math.abs(a[i + 3] - c2[i + 3]) > 2) anders++;
  }
  return { anders, gesetzt };
});
check('im Fenster steht dasselbe Bild wie auf dem Display', gleich.anders === 0 && gleich.gesetzt > 10000, JSON.stringify(gleich));
// Die Griffflächen tragen keinen eigenen Text mehr – sonst gäbe es wieder zwei Quellen, die auseinanderlaufen
const flaechen = await page.evaluate(() => [...document.querySelectorAll('#lage-schirm .zettel')].map(d => ({
  text: d.textContent.trim(), hg: getComputedStyle(d).backgroundImage, aktiv: !d.classList.contains('andere'),
  rahmen: getComputedStyle(d).outlineStyle })));
check('Griffflächen sind leer und ohne eigene Farbe', flaechen.every(f => f.text === '' && f.hg === 'none'), JSON.stringify(flaechen));
check('nur der aktive Zettel ist umrandet', flaechen.filter(f => f.rahmen === 'dashed').length === 1 &&
  flaechen.find(f => f.aktiv).rahmen === 'dashed', JSON.stringify(flaechen.map(f => f.aktiv + ':' + f.rahmen)));
// Ein Tipp auf den anderen Zettel wechselt – und die Überschrift zieht mit
const titel = () => page.evaluate(() => document.getElementById('lage-titel').textContent);
const vorher = await titel();
const ziel = await page.evaluate(() => { const r = document.querySelector('#lage-schirm .zettel.andere').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.click(ziel.x, ziel.y); await page.waitForTimeout(500);
check('Wechsel im Fenster zieht die Überschrift mit', (await titel()) !== vorher && /Zettel \d/.test(await titel()),
  vorher + ' → ' + await titel());
await page.evaluate(() => lageOeffnen(false)); await page.waitForTimeout(200);

await page.screenshot({ path: out + '/lage_fenster.png' });

// 3.21: Zettel 2 + 3 – nebeneinander, untereinander, tauschen; und „Widerrufen“ auf den Stand beim Öffnen.
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(900);
await page.evaluate(() => {
  textEl.value = 'Eins'; onTextChanged(); flush(); zettelSichern();
  zettelDazu(); textEl.value = 'Zwei'; onTextChanged(); flush(); zettelSichern();
  zettelDazu(); textEl.value = 'Drei'; onTextChanged(); flush(); zettelSichern(); persist();
});
await page.waitForTimeout(300);
await page.click('#lagebtn'); await page.waitForTimeout(500);
const lagen = () => page.evaluate(() => alleZettel().map(z => ({ x: +z.noteX.toFixed(3), y: +z.noteY.toFixed(3), s: +z.noteScale.toFixed(2) })));
check('die Reihe für Zettel 2 + 3 ist bei drei Zetteln da',
  await page.evaluate(() => !document.getElementById('lage-paar').hidden));
// Stand beim Öffnen festhalten – genau darauf muss „Widerrufen“ zurückführen. (Beim dritten Zettel
// ordnet zettelDazu schon selbst nebeneinander an, der Ausgangsstand ist also nicht die Standardlage.)
const beimOeffnen = await lagen();
await page.click('#lage-neben'); await page.waitForTimeout(300);
const neben = await lagen();
check('nebeneinander: gleiche Höhe, links und rechts',
  Math.abs(neben[1].y - neben[2].y) < 0.001 && neben[1].x < 0.4 && neben[2].x > 0.6, JSON.stringify(neben));
// „untereinander“ gab es in 3.21 kurz – wieder entfernt, der Platz reicht nicht (Auftraggeber am Bild)
check('kein „untereinander“ mehr', await page.evaluate(() => !document.getElementById('lage-unter')));

// 3.30: Die Automatik muss einen **sichtbaren** Rand lassen, und zwar für den **gedrehten** Zettel.
// Vorher rechnete sie mit der ungedrehten Breite und stellte die Zettel „gerade noch hinein“: 3 %
// Luft, nach Abzug der Neigung knapp 2 % – der Zettel klebte am Rand. Am Sperrbildschirm des
// Auftraggebers (11.9.2026) stieß Zettel 3 bündig an die rechte Kante; gemessen war nichts gezoomt,
// alle Breiten stimmten auf unter ein Prozent, nur der Rand fehlte.
const ueberstand = () => page.evaluate(() => {
  const t = targetCanvas();
  return alleZettel().map(z => mitZettel(z, () => {
    const f = fitNote(t.w, t.h, t.layout, (z.text || '').trim() || '…');
    const rad = Math.abs((noteRot() || 0) * Math.PI / 180), cos = Math.cos(rad), sin = Math.sin(rad);
    const b = (f.noteW * cos + f.noteH * sin) / t.w, h = (f.noteH * cos + f.noteW * sin) / t.h;
    return { links: +(z.noteX - b / 2).toFixed(3), rechts: +(z.noteX + b / 2).toFixed(3),
             oben: +(z.noteY - h / 2).toFixed(3), unten: +(z.noteY + h / 2).toFixed(3) };
  }));
});
const raender = (await ueberstand()).slice(1);
check('Zettel 2 und 3 halten seitlich einen sichtbaren Rand – auch gedreht',
  raender.every(r => r.links >= 0.025 && r.rechts <= 0.975), JSON.stringify(raender));
check('und stoßen auch oben und unten nicht an die Kante',
  raender.every(r => r.oben >= 0 && r.unten <= 1), JSON.stringify(raender));
// Der Rand muss auch halten, wenn der Zettel durch mehr Text **höher** wird: die Neigung macht einen
// hohen Zettel waagerecht breiter, und genau das hatte die alte Rechnung nicht gesehen.
await page.evaluate(() => {
  zettelWechseln(2);
  textEl.value = 'Mo. 9:20 Miklody\nMo. 11:00 Nadine anrufen\nMo. 13:30 Molly Tierarzt\nMo 15:00 Lola Tierarzt\nSa. 19:00 Gabi Isy';
  onTextChanged(); flush(); state.list = 'termin'; applyList(); zettelSichern(); nebeneinander();
});
await page.waitForTimeout(400);
const langRand = (await ueberstand()).slice(1);
check('auch mit fünf Terminzeilen bleibt der Rand stehen',
  langRand.every(r => r.links >= 0.025 && r.rechts <= 0.975), JSON.stringify(langRand));
await page.evaluate(() => { zettelWechseln(2); textEl.value = 'Drei'; onTextChanged(); flush();
  state.list = 'none'; applyList(); zettelSichern(); nebeneinander(); zettelWechseln(0); });
await page.waitForTimeout(400);
const vorTausch = await lagen();
await page.click('#lage-tausch'); await page.waitForTimeout(300);
const nachTausch = await lagen();
check('tauschen vertauscht die Lage von 2 und 3, Zettel 1 bleibt',
  nachTausch[1].x === vorTausch[2].x && nachTausch[2].x === vorTausch[1].x
  && nachTausch[0].x === vorTausch[0].x, JSON.stringify({ vorTausch, nachTausch }));
check('die Texte bleiben bei ihrem Zettel – getauscht wird die Lage, nicht der Inhalt',
  JSON.stringify(await page.evaluate(() => alleZettel().map(z => z.text))) === '["Eins","Zwei","Drei"]',
  JSON.stringify(await page.evaluate(() => alleZettel().map(z => z.text))));
// Widerrufen: zurück auf den Stand beim Öffnen des Fensters
await page.click('#lage-zurueck'); await page.waitForTimeout(300);
const zurueck = await lagen();
check('„Zurück zum Stand beim Öffnen“ stellt ihn wieder her',
  JSON.stringify(zurueck) === JSON.stringify(beimOeffnen),
  JSON.stringify(zurueck) + ' statt ' + JSON.stringify(beimOeffnen));
check('danach ist der Zurück-Knopf wieder gesperrt', await page.evaluate(() => document.getElementById('lage-zurueck').disabled));
// Ein frisch geöffnetes Fenster hat nichts zu widerrufen
await page.click('#lage-fertig'); await page.waitForTimeout(250);
await page.click('#lagebtn'); await page.waitForTimeout(400);
check('frisch geöffnet ist der Zurück-Knopf gesperrt', await page.evaluate(() => document.getElementById('lage-zurueck').disabled));
// Tauschen statt „nebeneinander“: das ändert immer etwas, auch wenn schon nebeneinander gelegt war
await page.click('#lage-tausch'); await page.waitForTimeout(300);
check('nach einer Änderung ist der Zurück-Knopf frei', await page.evaluate(() => !document.getElementById('lage-zurueck').disabled));
await page.click('#lage-fertig'); await page.waitForTimeout(250);
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
