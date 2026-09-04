// Vercel-Funktion: GET /api/zettel?text=…&color=gelb&w=2360&h=2360  →  PNG
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
    const w = Number(q.w) || 2360, h = Number(q.h) || 2360;
    const { png } = await renderZettel({ text: t, color: q.color, w, h });
    res.status(200);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="zettel.png"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(png);
  } catch (e) {
    return text(res, 500, 'Render-Fehler: ' + (e && (e.stack || e.message)));
  }
}
