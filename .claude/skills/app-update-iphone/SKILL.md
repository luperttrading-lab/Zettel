---
name: app-update-iphone
description: >
  Sorgt dafür, dass eine Web-App auf dem iPhone neue Fassungen wirklich erreicht – gemeint ist eine
  Seite, die über „Teilen → Zum Home-Bildschirm“ installiert wird und dort wie eine App liegt
  (Fachwort: PWA, Progressive Web App; ausgeliefert über GitHub Pages, Vercel oder Netlify). Und
  dafür, dass der Nutzer merkt, dass ein Update angekommen ist. Enthält Service-Worker
  (Netz-zuerst), Versionsmarke, aktive Prüfung, Meldebanner samt CSS und eine Prüfliste am Gerät.
  Nutze diese Skill immer, wenn es um Updates, Caching, Service Worker, APP_VERSION, „die App holt
  die neue Version nicht“, ein Update-Banner, „ist aktuell“-Meldungen, Offline-Betrieb oder das
  Ausliefern einer Web-App auf iOS oder Android geht – auch wenn nicht ausdrücklich nach einem
  Update-Mechanismus gefragt wird. Ebenso beim Anlegen einer neuen solchen App: der Mechanismus
  gehört von Anfang an hinein, nachrüsten ist teurer.
---

# Updates, die auf dem iPhone wirklich ankommen

## Wozu

Eine Home-Bildschirm-Web-App auf iOS wird praktisch nie geschlossen. Drei Schichten halten dabei
jeweils eine alte Fassung fest, und jede braucht ihre eigene Gegenmaßnahme:

1. **HTTP-Cache** – Safari liefert `index.html` aus dem eigenen Speicher, ohne nachzufragen.
2. **Service Worker** – die übliche Anleitung im Netz baut *Cache-first*; damit sieht die App eine
   neue Fassung **nie**.
3. **Die laufende Sitzung** – sie liegt im Hintergrund und wird hervorgeholt, statt neu zu starten.

Ein vierter Punkt ist kein Cache, sondern Wahrnehmung: Kommt das Update an, ohne dass jemand es
merkt, hält man einen behobenen Fehler für offen. Deshalb gehört eine Meldung dazu.

## Vorgehen

Arbeite in dieser Reihenfolge – die Bausteine greifen ineinander, einzeln bringt keiner etwas:

1. **Banner bauen** (Baustein 0) – HTML, CSS, `showInfo()`/`zeigeBanner()`. Ohne das sind die
   späteren Bausteine nicht lauffähig, sie rufen diese Funktionen auf.
2. **Service Worker** (Baustein 1) – eigene Dateien *Netz zuerst*, fremde *Cache zuerst*, dazu
   `skipWaiting()` und `clients.claim()`.
3. **Versionsmarke** (Baustein 2) – `const APP_VERSION = '1.2';` als Zeichenkette im HTML.
4. **Aktive Prüfung** (Baustein 3) – beim Öffnen, beim Zurückholen in den Vordergrund, auf Tipp.
5. **Meldung nach dem Update** (Baustein 4) – einmal sagen, welche Fassung jetzt läuft.

**Den vollständigen Code, die Begründungen und die Messwerte findest du in
`references/mechanik.md`.** Lies die Datei, bevor du Code schreibst – sie ist das Ergebnis mehrerer
Nachbauten, und fast jede Zeile darin steht dort, weil ihr Fehlen einmal einen Fehler erzeugt hat.

## Die Fallen, an denen es reihum scheitert

Diese fünf kosten am meisten Zeit, wenn man sie nicht kennt:

- **`skipWaiting()` / `clients.claim()` fehlen** – der neue Service Worker wartet, bis *alle* Fenster
  geschlossen sind. Bei einer Home-Bildschirm-App passiert das nie.
- **Das Banner steht im Textfluss** – `position: static` oder `sticky` schiebt beim Erscheinen den
  ganzen Inhalt nach unten. Es muss `fixed` sein und **direkt im `<body>`** hängen.
- **`.update[hidden] { display: none; }` fehlt** – dann ist das Banner *immer* sichtbar, weil das
  `display: flex` der Klasse das schwache `hidden`-Attribut überstimmt.
- **Vor `location.reload()` wird nicht gespeichert** – ungesicherte Eingaben sind weg.
- **Es wird neu geladen, während jemand tippt** – Tastatur weg, halber Satz fort. `activeElement`
  prüfen.

## Entscheidungen, die vom Projekt abhängen

Kläre sie, statt eine Vorgabe zu übernehmen:

- **Takt ja oder nein?** Ein `setInterval` lohnt nur, wenn die Prüfung billig ist. Holt sie die ganze
  `index.html` (in einem gemessenen Fall 275 KB roh, ~87 KB über die Leitung), kostet ein
  Minutentakt rund 5 MB je Stunde offener App – dafür streichen. Liest sie eine kleine
  `version.json` (~20 Byte), kostet derselbe Takt ~18 KB je Stunde und erreicht auch eine App, die
  offen liegen bleibt.
- **Wo erscheint die Meldung?** Was die App selbst meldet, steht **oben** – ein Ort, den man kennt.
  Die Antwort auf einen **Tipp** erscheint an der Kante, an der der Auslöser sitzt. Der Auslöser
  bleibt, wo das Design ihn hat; ihn nur wegen der Meldung zu verschieben, hat in einem Nachbau das
  Bild der App zerstört.
- **Fremde Adressen im Service Worker.** *Cache zuerst* ist für Schriften und Bibliotheken richtig.
  Läuft über eine fremde Adresse eine **Datenbank** (Firebase, eine API), lass sie unberührt
  durch – ein gecachter Datenabruf friert die App auf einem alten Stand ein.

## Zum Schluss: am Gerät prüfen

Die Prüfliste in `references/mechanik.md` (neun Punkte) Schritt für Schritt durchgehen, **am
Telefon, nicht am Schreibtisch**. Der häufigste Trugschluss dabei: gegen die alte Datei prüfen, weil
der Bauvorgang beim Hoster noch läuft – und den Mechanismus für kaputt halten.

Zwei Punkte, die man dabei gern übersieht:

- Die **erste** Fassung, die Baustein 4 trägt, meldet sich nach dem Update noch nicht: Für die App
  ist es ein Erststart, weil keine ältere Fassung je den Schlüssel im `localStorage` gesetzt hat.
  Erst der Sprung danach zeigt die Meldung.
- Der Tipp-Auslöser muss **sichtbar** sein. Ein `title`-Attribut reicht nicht – auf dem iPhone sieht
  das niemand. Eine gepunktete Unterstreichung der Versionsnummer genügt.
