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

## Variante 2: reiner Kurzbefehl (empfohlen)

Der Kurzbefehl ist die App. Vom Home-Bildschirm-Icon oder per Siri gestartet, fragt er nach dem
Text, holt das fertige Bild vom Render-Server, setzt es als Hintergrund und sperrt das Gerät.
Keine Web-App, kein Fensterwechsel.

### Render-Server auf Vercel einrichten (einmalig, kostenlos)

1. https://vercel.com → „Sign Up" → „Continue with GitHub".
2. „Add New… → Project" → dieses Repository `Zettel` importieren → „Deploy". Keine Einstellungen nötig,
   `vercel.json` und `package.json` liegen bei.
3. Nach ca. einer Minute steht die Adresse. Für dieses Projekt: `https://zettel-beta.vercel.app`. Test im Browser:

   ```
   https://zettel-beta.vercel.app/api/zettel?text=Milch%20kaufen&color=gelb&device=iphone
   ```

   Es muss ein PNG mit gelbem Zettel erscheinen.

Parameter: `text` (Pflicht), `color` (`gelb`, `rosa`, `gruen`, `blau`), `device` (`iphone` = Hochformat
1179×2556, sonst iPad-Quadrat 2360×2360), `font` (`caveat`, `patrick`, `kalam`, `marker`, `indie`, `shadows`, `gloria`), `fastener`
(`tape`, `tape2`, `thumbtack`, `pushpin`, `pin`, `pin2`, `clip`, `magnet`; deutsch auch `klebestreifen`, `ecken`,
`reisszwecke`, `pinnadel`, `nadel`, `nadeln`, `klammer`), `fcolor` (Farbe der Befestigung: `rot`, `blau`, `gruen`,
`gelb`, `silber`, `schwarz`; Standard: Streifen und Klammer silber, Nadeln rot), `fpattern` (Muster: `streifen`,
`punkte`, `karo`; Klammer nur Streifen/Punkte), `fdesign` (Motiv auf dem Magneten: `smiley`, `herz`, `stern`, `pfote`,
`blume`, `sonne`; Muster und Motiv schließen sich aus, bei beiden gilt das Motiv), `paper` (`glatt`, `liniert`, `kariert`),
`pen` (Stiftfarbe: `schwarz`, `blau`, `rot`, `gruen`), `scale` (Schriftgröße 60–140 %), `list` (`num`, `dot`, `square`, `dash`,
`check`: jede Zeile bekommt eine Nummer bzw. ein Zeichen), optional `w`/`h` in Pixeln. Bei
quadratischem Bild wird das Tablet-Layout gewählt, sonst das Hochformat-Layout.

Beispiel: `…/api/zettel?device=iphone&color=gelb&font=kalam&fastener=pin&text=…`

Hinweis für Vercel: `vercel.json` packt `fonts/**` und `node_modules/harfbuzzjs/**` mit ein; ohne Letzteres
fehlt satori zur Laufzeit die Datei `hb.wasm`.

### Kurzbefehl „Zettel" anlegen

| # | Aktion | Einstellung |
|---|---|---|
| 1 | **Nach Eingabe fragen** | Typ Text, Frage „Was soll auf den Zettel?" |
| 2 | **URL codieren** | Eingabe: „Bereitgestellte Eingabe" aus Aktion 1 |
| 3 | **Inhalt der URL abrufen** | URL: `https://zettel-beta.vercel.app/api/zettel?device=iphone&color=gelb&text=` + Variable „Codierte URL" (iPad: `device=ipad`) |
| 4 | **Hintergrundbild-Foto festlegen** | Bild: „Inhalt der URL"; Sperrbildschirm anhaken; „Vorschau anzeigen" aus |
| 5 | **Bildschirm sperren** | – |

Dann: Kurzbefehl-Details (ⓘ) → „Zum Home-Bildschirm". Ab jetzt: Icon tippen → Text eingeben oder
diktieren → fertig. Oder „Hey Siri, Zettel".

Hinweis: Der Text wird bei jedem Aufruf als URL an Vercel geschickt und kann dort in Logs auftauchen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Web-App (UI, Speicherung, Canvas-Rendering im Browser) |
| `manifest.webmanifest` | PWA-Manifest |
| `sw.js` | Service Worker für Offline-Betrieb und Selbst-Aktualisierung |
| `icon-*.png` | App-Icons |
| `api/zettel.js` | Vercel-Funktion: Zettel als PNG per URL |
| `lib/render.js` | Serverseitiges Rendering (satori + resvg), gleiche Layout-Logik wie die Web-App |
| `fonts/Caveat-500.ttf` | Handschrift für den Server (SIL Open Font License, siehe `fonts/OFL-Caveat.txt`) |
| `vercel.json` | Vercel-Konfiguration (Schrift wird mitgepackt) |
