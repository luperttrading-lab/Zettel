// App-Test (WebKit, iPhone-Viewport): Karte Zettel → Struktur körnig, Kante abgerissen; Vorschau und Wallpaper.
//   node tests/app_paper.mjs <ausgabeverzeichnis>   (lokaler Server auf 8766, siehe app_photo.mjs)
import { webkit } from 'playwright';
import fs from 'node:fs';
const [,, outDir = '/tmp'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const b = await webkit.launch();
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:8766/index.html?t=' + Date.now()); await page.waitForTimeout(800);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(800);
await page.click('#strip-list .item[data-value="check"]'); await page.waitForTimeout(300);
await page.click('#text'); await page.keyboard.type('Einkaufen'); await page.keyboard.press('Enter'); await page.keyboard.type('Hundespaziergang und Füttern'); await page.keyboard.press('Enter'); await page.keyboard.type('Frisör');
await page.evaluate(() => { state.fastener = 'thumbtack'; applyFastener(); persist(); }); await page.waitForTimeout(400);
await page.tap('#colors button.edit'); await page.waitForTimeout(500);
console.log('Zeilen', await page.evaluate(() => [...document.querySelectorAll('#fcolors .lab')].map(l => l.textContent)));
await page.tap('#fcolors .row:nth-child(2) .chip:nth-of-type(2)'); await page.waitForTimeout(300);   // liniert
await page.tap('#fcolors .row:nth-child(3) .chip:nth-of-type(2)'); await page.waitForTimeout(300);   // körnig
await page.tap('#fcolors .row:nth-child(4) .chip:nth-of-type(2)'); await page.waitForTimeout(400);   // abgerissen
console.log('state', await page.evaluate(() => JSON.stringify({ paper: state.paper, texture: state.texture, edge: state.edge })));
console.log('clip', await page.evaluate(() => document.getElementById('paper').style.clipPath.slice(0, 60)), 'bg', await page.evaluate(() => document.getElementById('paper').style.backgroundImage.slice(0, 40)));
await page.screenshot({ path: `${outDir}/app_paper_card.png` });
await page.tap('#text'); await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/app_paper.png` });
const png = await page.evaluate(async () => { const t = targetCanvas(); const c = await renderWallpaper(t.w, t.h, t.layout); return c.toDataURL('image/png'); });
fs.writeFileSync(`${outDir}/app_paper_wp.png`, Buffer.from(png.split(',')[1], 'base64'));
// zurück auf glatt/gerade: clip weg, Hintergrund nur Linien
await page.tap('#colors button.edit'); await page.waitForTimeout(400);
await page.tap('#fcolors .row:nth-child(3) .chip:nth-of-type(1)'); await page.tap('#fcolors .row:nth-child(4) .chip:nth-of-type(1)'); await page.waitForTimeout(300);
console.log('zurück', await page.evaluate(() => JSON.stringify({ clip: document.getElementById('paper').style.clipPath, bg: document.getElementById('paper').style.backgroundImage.slice(0, 30) })));
console.log('Fehler:', JSON.stringify(errors));
await b.close();
if (errors.length) process.exit(1);
