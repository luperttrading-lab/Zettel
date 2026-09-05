// App-Test: Bildmagnet-Motive im WebKit-Browser (iPhone-Viewport) – Screenshot der App und gerendertes Wallpaper je Motiv.
//   Voraussetzung: lokaler Server auf Port 8766 im Repo-Verzeichnis, z. B.
//     (cd /home/user/Zettel && setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
//   Playwright samt WebKit: siehe docs/UEBERGABE.md.
//   node tests/app_photo.mjs <ausgabeverzeichnis> owl panda   (ohne Schlüssel: alle Bildmagnete)
import { webkit } from 'playwright';
import fs from 'node:fs';

const [,, outDir = '/tmp', ...keys] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const b = await webkit.launch();
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.click('#strip-list .item[data-value="check"]'); await page.waitForTimeout(300);
await page.click('#text'); await page.keyboard.type('Einkaufen'); await page.keyboard.press('Enter'); await page.keyboard.type('Hundespaziergang'); await page.keyboard.press('Enter'); await page.keyboard.type('Frisör');
await page.evaluate(() => { state.fastener = 'photo'; applyFastener(); persist(); }); await page.waitForTimeout(600);
await page.click('#fastener-preview rect.hit', { force: true }); await page.waitForTimeout(400);   // Palette öffnen
const chips = await page.evaluate(() => Object.entries(ZettelMotifs).filter(([, m]) => m.kind === 'photo').map(([k]) => k));
console.log('Bildmagnete in der Registry:', chips, 'Chips in der Palette:', await page.evaluate(() => [...document.querySelectorAll('#fcolors .chip')].map(c => c.title)));
for (const k of keys.length ? keys : chips) {
  await page.evaluate(k => { setFastenerLook({ decor: k }); }, k); await page.waitForTimeout(400);
  console.log(k, 'look', await page.evaluate(() => JSON.stringify(fastenerLook())));
  await page.screenshot({ path: `${outDir}/app_${k}.png` });
  const png = await page.evaluate(async () => { const t = targetCanvas(); const c = await renderWallpaper(t.w, t.h, t.layout); return c.toDataURL('image/png'); });
  fs.writeFileSync(`${outDir}/app_${k}_wp.png`, Buffer.from(png.split(',')[1], 'base64'));
}
console.log('Fehler:', JSON.stringify(errors));
await b.close();
if (errors.length) process.exit(1);
