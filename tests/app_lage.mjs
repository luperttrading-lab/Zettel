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

// Der Zettel bleibt immer ganz im Bild – auch wenn man weit über den Rand zieht
const p1 = await page.evaluate(() => { const r = document.getElementById('lage-zettel').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(p1.x, p1.y); await page.mouse.down();
await page.mouse.move(p1.x - 900, p1.y - 900, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(200);
const drin = await page.evaluate(() => { const t = targetCanvas(), f = fitNote(t.w, t.h, t.layout, noteText());
  const kl = (v, a, c) => Math.max(a, Math.min(c, v));
  const cx = kl(state.noteX * t.w, f.noteW / 2, t.w - f.noteW / 2), cy = kl(state.noteY * t.h, f.noteH / 2, t.h - f.noteH / 2);
  return cx - f.noteW / 2 >= -0.5 && cy - f.noteH / 2 >= -0.5; });
check('Zettel bleibt ganz im Bild', drin);

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
  // Soll ist die **geklemmte** Lage: der Zettel bleibt ganz im Bild, ein Zug über den Rand hinaus zählt nicht
  const kl = (v, a, c) => Math.max(a, Math.min(c, v));
  const sollY = kl(state.noteY * t.h, f.noteH / 2, t.h - f.noteH / 2) / t.h;
  return { breite: (x1 - x0) / t.w, sollBreite: f.noteW / t.w, mitteY: ((y0 + y1) / 2) / t.h, sollY };
});
check('Breite im Bild folgt dem Regler', Math.abs(mass.breite - mass.sollBreite) < 0.05,
  mass.breite.toFixed(3) + ' vs ' + mass.sollBreite.toFixed(3));
check('Lage im Bild folgt dem Fenster', Math.abs(mass.mitteY - mass.sollY) < 0.05,
  mass.mitteY.toFixed(3) + ' vs ' + mass.sollY.toFixed(3));

// Zurücksetzen
await page.click('#lagebtn'); await page.waitForTimeout(300);
await page.click('#lage-reset'); await page.waitForTimeout(200);
check('Zurücksetzen stellt die Vorgabe her',
  await page.evaluate(() => state.noteX === 0.5 && state.noteY === 0.585 && state.noteScale === 1));
await page.click('#lage-fertig'); await page.waitForTimeout(200);

await page.screenshot({ path: out + '/lage_fenster.png' });
check('keine Fehler', errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
