import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto('http://localhost:8766/index.html',{waitUntil:'networkidle'});
await p.evaluate(() => { localStorage.clear(); textEl.value='To Do Liste\n☐ Rasen wässern\n☐ Nadine anrufen';
  onTextChanged(); state.title=true; state.list='check'; persist(); });
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(600);
const mess = async (dx,dy) => {
  await p.click('#lagebtn'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => { const r=document.getElementById('lage-zettel').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await p.mouse.move(c.x,c.y); await p.mouse.down(); await p.mouse.move(c.x+dx,c.y+dy,{steps:10}); await p.mouse.up();
  await p.waitForTimeout(120);
  const st = await p.evaluate(()=>+state.noteY.toFixed(4));
  const gez = await p.evaluate(()=>{ const s=document.getElementById('lage-schirm').getBoundingClientRect(),
    z=document.getElementById('lage-zettel').getBoundingClientRect(); return +(((z.top+z.height/2)-s.top)/s.height).toFixed(4); });
  await p.click('#lage-fertig'); await p.waitForTimeout(150);
  return { st, gez };
};
console.log('weit nach oben:      ', await mess(0,-400));
console.log('ein Stück nach unten:', await mess(0,60));
console.log('noch ein Stück:      ', await mess(0,60));
await b.close();
