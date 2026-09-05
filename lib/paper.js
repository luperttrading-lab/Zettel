// Papier: abgerissene Kante – gemeinsame Geometrie für App (Vorschau + Canvas) und Server.
// Die Form ist deterministisch (fester Zufallsstartwert), damit Vorschau, Bild und Server dieselbe Kante zeigen.
// Die obere Kante ist gerissen (dort wird ein Blatt vom Block getrennt), die anderen drei sind gerade.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZettelPaper = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const AMP = 0.028;   // Tiefe der Risse, Anteil der Zettelbreite
  const SEGS = 64;     // Stützpunkte über die Breite

  // Normierte Punkte der oberen Kante: x in [0,1], y in [0, AMP] (Anteil der Breite, wird mit W skaliert)
  const edge = (() => {
    let s = 20240905;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const pts = [];
    let y = 0.5;
    for (let i = 0; i <= SEGS; i++) {
      // grobe Welle plus feine Zacken; an den Ecken auf halbe Tiefe zurück, damit die Seiten sauber bleiben
      y = Math.max(0, Math.min(1, y + (rnd() - 0.5) * 0.9));
      const fine = (rnd() - 0.5) * 0.45;
      const v = Math.max(0, Math.min(1, y * 0.7 + 0.15 + fine));
      pts.push([i / SEGS, v * AMP]);
    }
    return pts;
  })();

  // Umriss als Punktliste in Zettelkoordinaten (Breite W, Höhe H), optional verschoben
  function outline(W, H, ox = 0, oy = 0) {
    const pts = edge.map(([x, y]) => [ox + x * W, oy + y * W]);
    pts.push([ox + W, oy + H], [ox, oy + H]);
    return pts;
  }
  // CSS clip-path (Prozent), unabhängig von der Größe – für die Vorschau
  function clipCss() {
    const p = edge.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`);   // y in % der Breite ≈ Höhe bei quadratischem Zettel; genaue Werte kommen per clipCssFor
    return `polygon(${p.join(', ')}, 100% 100%, 0% 100%)`;
  }
  // CSS clip-path mit korrektem Höhenbezug (y-Werte sind Anteile der Breite, CSS-Prozent beziehen sich auf die Höhe)
  function clipCssFor(W, H) {
    const p = edge.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * W / H * 100).toFixed(2)}%`);
    return `polygon(${p.join(', ')}, 100% 100%, 0% 100%)`;
  }
  // SVG-Pfad
  function pathD(W, H, ox = 0, oy = 0) {
    return 'M' + outline(W, H, ox, oy).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
  }
  return { AMP, edge, outline, clipCss, clipCssFor, pathD };
});
