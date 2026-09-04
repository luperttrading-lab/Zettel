// Vercel-Funktion: GET /api/zettel?text=…&color=gelb&w=2360&h=2360  →  PNG
// Der Kurzbefehl „Zettel“ ruft diese URL mit „Inhalt der URL abrufen“ ab und setzt das Bild als Hintergrund.
import { renderZettel } from '../lib/render.js';

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const text = typeof q.text === 'string' ? q.text : '';
    if (!text.trim()) {
      res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send('Parameter text fehlt. Beispiel: /api/zettel?text=Milch%20kaufen&color=gelb');
    }
    if (text.length > 2000) {
      res.status(413).setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send('Text zu lang (max. 2000 Zeichen).');
    }
    const w = Number(q.w) || 2360, h = Number(q.h) || 2360;
    const { png } = await renderZettel({ text, color: q.color, w, h });
    res.status(200);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="zettel.png"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(png);
  } catch (e) {
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send('Render-Fehler: ' + (e && e.message));
  }
}
