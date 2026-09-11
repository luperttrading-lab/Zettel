// Bild über die RouteLLM-API (Abacus.AI ChatLLM) erzeugen und als Datei speichern.
//
//   ROUTELLM_API_KEY muss als Umgebungsvariable gesetzt sein (nie im Chat ausgeben).
//   node tools/gen_image.mjs <ausgabe.png> <modell> "<prompt>"  [--n 2] [--ratio 1:1] [--quality high] [--noconfig]
//
// Format nach der Abacus-Doku und dem Hermes-Plugin (github.com/ZoniBoy00/hermes-agent-abacus-ai):
//   POST https://routellm.abacus.ai/v1/chat/completions
//   { model, modalities: ['image','text'], messages: [{ role:'user', content:[{type:'text', text}] }], image_config: {...} }
//   Antwort: choices[0].message.images[].image_url.url (Data-URI) – oder Data-URI im content-Text.
// Seitenverhältnis: FLUX-Modelle erwarten Namen (square_hd, landscape_16_9, portrait_16_9),
//   midjourney/dalle/flux_pro_ultra/seedream erwarten '1:1', '16:9', '9:16'. Das Skript übersetzt '1:1' selbst.
// UNGEPRÜFT: dieses Skript wurde ohne Schlüssel geschrieben. Beim ersten Lauf die Antwort prüfen (--dump schreibt sie als JSON daneben).

import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = { n: 1, ratio: '1:1', quality: '', dump: false, noConfig: false };
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--n') opt.n = Number(args[++i]);
  else if (a === '--ratio') opt.ratio = args[++i];
  else if (a === '--quality') opt.quality = args[++i];
  else if (a === '--dump') opt.dump = true;
  else if (a === '--noconfig') opt.noConfig = true;
  else pos.push(a);
}
const [outPath, model, prompt] = pos;
if (!outPath || !model || !prompt) {
  console.error('Aufruf: node tools/gen_image.mjs <ausgabe.png> <modell> "<prompt>" [--n 2] [--ratio 1:1] [--quality high] [--noconfig] [--dump]');
  process.exit(2);
}
const key = process.env.ROUTELLM_API_KEY;
if (!key) { console.error('ROUTELLM_API_KEY fehlt (Umgebungsvariable der Cloud-Umgebung).'); process.exit(2); }

const FLUX_NAMES = { '1:1': 'square_hd', '16:9': 'landscape_16_9', '9:16': 'portrait_16_9' };
const usesNames = /^flux/.test(model) && model !== 'flux_pro_ultra';
const image_config = { aspect_ratio: usesNames ? (FLUX_NAMES[opt.ratio] || opt.ratio) : opt.ratio };
if (opt.n > 1) image_config.num_images = Math.min(4, opt.n);
if (opt.quality) image_config.quality = opt.quality;

const body = {
  model,
  modalities: ['image', 'text'],
  messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
};
// gpt_image2 lehnt aspect_ratio:'1:1' mit HTTP 400 ab (geprüft 6.9.2026), die Gemini-Bildmodelle
// ebenso – dort heißt der Vorwurf „Invalid image config param resolution“ (geprüft 11.9.2026 an
// gemini-2.5-flash-image). Faustregel: schlägt ein Modell mit HTTP 400 zu image_config fehl, ist das
// kein Schlüsselproblem (das wäre 401) – einfach --noconfig anhängen. Mit --noconfig
// wird image_config ganz weggelassen; das Modell nimmt dann sein Standardformat (quadratisch).
if (!opt.noConfig) body.image_config = image_config;

const t0 = Date.now();
const res = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const text = await res.text();
if (opt.dump) fs.writeFileSync(outPath.replace(/\.[a-z]+$/i, '') + '.response.json', text);
if (!res.ok) { console.error('HTTP', res.status, text.slice(0, 2000)); process.exit(1); }

let data; try { data = JSON.parse(text); } catch { console.error('Keine JSON-Antwort:', text.slice(0, 500)); process.exit(1); }
const msg = data.choices?.[0]?.message || {};
const urls = [];
for (const img of msg.images || []) { const u = img?.image_url?.url || img?.url; if (u) urls.push(u); }
if (!urls.length && typeof msg.content === 'string') {
  for (const m of msg.content.matchAll(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g)) urls.push(m[0]);
  for (const m of msg.content.matchAll(/https?:\/\/\S+\.(?:png|jpe?g|webp)/gi)) urls.push(m[0]);
}
if (!urls.length) { console.error('Kein Bild in der Antwort. Struktur:', JSON.stringify(data).slice(0, 1500)); process.exit(1); }

let i = 0;
for (const u of urls) {
  const path = urls.length === 1 ? outPath : outPath.replace(/(\.[a-z]+)$/i, `-${++i}$1`);
  if (u.startsWith('data:')) {
    const [, mime, b64] = u.match(/^data:([^;]+);base64,(.*)$/s);
    const ext = mime.includes('jpeg') ? '.jpg' : mime.includes('webp') ? '.webp' : '.png';
    const p = path.replace(/\.[a-z]+$/i, ext);
    fs.writeFileSync(p, Buffer.from(b64, 'base64')); console.log('gespeichert', p);
  } else {
    const r = await fetch(u); fs.writeFileSync(path, Buffer.from(await r.arrayBuffer())); console.log('geladen', path);
  }
}
if (data.usage) console.log('usage', JSON.stringify(data.usage));

// Kosten selbst festhalten, damit die Kostentabelle sie kennt (siehe docs/KOSTENTABELLE.md).
// Liefert die Antwort keinen Betrag, wird der Eintrag mit usd: null angelegt – sichtbar offen
// statt stillschweigend null. Nachtragen, sobald der Verbrauch in ChatLLM sichtbar ist.
try {
  const datei = 'tools/fremdkosten.json';
  const liste = fs.existsSync(datei) ? JSON.parse(fs.readFileSync(datei, 'utf8')) : [];
  const betrag = data.usage && (data.usage.cost ?? data.usage.total_cost ?? data.usage.usd);
  liste.push({
    ts: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    usd: typeof betrag === 'number' ? betrag : null,
    dienst: 'RouteLLM',
    was: `${model}, ${urls.length} Bild(er)`,
  });
  fs.writeFileSync(datei, JSON.stringify(liste, null, 2) + '\n');
  console.log(typeof betrag === 'number'
    ? `Kosten ${betrag} $ in ${datei} eingetragen`
    : `Eintrag in ${datei} angelegt, Betrag offen (usd: null) – in ChatLLM unter Credits nachsehen und nachtragen`);
} catch (e) { console.error('Kosten konnten nicht eingetragen werden:', e.message); }

console.log('Dauer', Date.now() - t0, 'ms');
