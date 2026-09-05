// Vercel-Funktion: GET /api/zettel?text=…&color=gelb&device=iphone&font=caveat&fastener=tape&fcolor=rot&scale=100  →  PNG
//   font: caveat | patrick | kalam | marker · fastener: tape | tape2 | thumbtack | pushpin | pin | pin2 | clip | magnet
//   fcolor: rot | blau | gruen | gelb | silber | schwarz · fpattern: streifen | punkte | karo · fdesign (Magnet): smiley | herz | stern | pfote | blume | sonne
//   paper: glatt | liniert | kariert · pen: schwarz | blau | rot | gruen · scale: 60–140
// Der Kurzbefehl „Zettel“ ruft diese URL mit „Inhalt der URL abrufen“ ab und setzt das Bild als Hintergrund.
//
// Der Renderer wird erst im Handler geladen: schlägt das Laden fehl (z. B. natives Modul fehlt),
// kommt der Grund als Text zurück statt eines anonymen FUNCTION_INVOCATION_FAILED.

function text(res, code, body) {
  res.status(code);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(body);
}

export default async function handler(req, res) {
  let renderZettel;
  try {
    ({ renderZettel } = await import('../lib/render.js'));
  } catch (e) {
    return text(res, 500, 'Renderer konnte nicht geladen werden: ' + (e && (e.stack || e.message)));
  }
  try {
    const q = req.query || {};
    const t = typeof q.text === 'string' ? q.text : '';
    if (!t.trim()) return text(res, 400, 'Parameter text fehlt. Beispiel: /api/zettel?text=Milch%20kaufen&color=gelb');
    if (t.length > 2000) return text(res, 413, 'Text zu lang (max. 2000 Zeichen).');
    // device=iphone → Hochformat (Face-ID-iPhones), device=ipad → Quadrat; w/h überschreiben beides
    const preset = String(q.device || '').toLowerCase() === 'iphone' ? [1179, 2556] : [2360, 2360];
    const w = Number(q.w) || preset[0], h = Number(q.h) || preset[1];
    const { png } = await renderZettel({ text: t, color: q.color, font: q.font, fastener: q.fastener, fastenerColor: q.fcolor, fastenerPattern: q.fpattern, fastenerDesign: q.fdesign, paper: q.paper, pen: q.pen, fontScale: q.scale, list: q.list, w, h });
    res.status(200);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="zettel.png"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(png);
  } catch (e) {
    return text(res, 500, 'Render-Fehler: ' + (e && (e.stack || e.message)));
  }
}
