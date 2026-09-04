# Zettel

Ein Zettel, den du aufs Display klebst.

Du schreibst eine Notiz auf einen Zettel. „Aufs Display kleben" rendert den Zettel in
Display-Auflösung als Bild; das setzt du als Sperr- oder Homebildschirm-Hintergrund.
So ist die Notiz sichtbar, ohne die App zu öffnen.

## Was es ist

- Eine einzelne HTML-Datei, kein Build, keine Abhängigkeiten.
- PWA: installierbar auf dem Homebildschirm, läuft offline.
- Speicherung: `localStorage` im Browser (ein Gerät, kein Sync).

## Was es nicht ist

- Kein echtes Homebildschirm-Widget. Das können nur native Apps.
- Das Setzen als Hintergrund bleibt ein manueller Schritt (Web darf den Wallpaper nicht ändern).

## Nutzung

1. Seite öffnen (GitHub Pages) und „Zum Home-Bildschirm" hinzufügen.
2. Text schreiben, Farbe wählen.
3. „Aufs Display kleben" → Teilen-Dialog → „Bild sichern".
4. Einstellungen → Hintergrundbild → gesichertes Bild als Sperrbildschirm wählen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App (UI, Speicherung, Canvas-Rendering) |
| `manifest.webmanifest` | PWA-Manifest |
| `sw.js` | Service Worker für Offline-Betrieb |
| `icon-*.png` | App-Icons |
