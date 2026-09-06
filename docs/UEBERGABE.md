# Übergabe: Zettel – Stand, Erkenntnisse, nächste Schritte

**Repository: `luperttrading-lab/Zettel`.** Diese Datei liegt dort unter `docs/UEBERGABE.md`. Eine neue Sitzung
muss in diesem Repository laufen, sonst fehlen Skripte, Motive, Schriften und Kontext.

Stand: 7. September 2026, App-Version **1.35.2**, Branch `claude/uebergabe-key-auth-5l0a1t` (wird nach jedem
Commit per Fast-Forward auf `main` gebracht; Vercel und GitHub Pages bauen aus `main`).

## 0. Arbeitsweise mit dem Auftraggeber

- Schreibt Deutsch, wird geduzt, diktiert per Sprache (Erkennungsfehler mitdenken: „Backen“ kam als „Päckchen“,
  „Katze“ als „Kratzer“, „Paar 10“ als „paar Zehen“). Im Zweifel kurz nachfragen statt raten.
- Will Aussagen als [Sicher] / [Wahrscheinlich] / [Vermutung] markiert. Unbequeme Wahrheit zuerst, kein Aufwärmen.
- Antworten kurz. Er hat ausdrücklich gebeten, nicht „so viel langen Text“ zu bekommen.
- **Am Ende jeder Antwort genau diese zwei Zeilen**, sonst nichts dazu:

  ```
  Diese Frage: 0,0 ct RouteLLM · ~0,30 $ Claude
  Heute gesamt: 72 ct RouteLLM · 148,9 $ Claude
  ```

  RouteLLM-Cent sind gemessen (`usage.compute_points_used`, siehe Abschnitt 4). Die Claude-Zahl wird aus dem
  Sitzungsprotokoll berechnet (`~/.claude/projects/<projekt>/<sitzung>.jsonl`, Feld `message.usage`, nach
  `message.id` dedupliziert, Preise des jeweiligen Modells; Opus 5: 5/25 $ pro Mio, Cache-Schreiben 1 h 10 $,
  Cache-Lesen 0,50 $; Fable 5.1: 10/50, 20, 0,25). Eine Tilde vor der Zahl heißt „geschätzt, nicht gemessen“.
  **Die Zahlen waren nie freie Schätzungen** – der Auftraggeber hat das einmal misstrauisch nachgefragt.
- Bilder und Dateien vor Sitzungsende per SendUserFile schicken. Achtung: auf seinem iPad (anderer
  Apple-Account) kommen Anhänge nicht an; dort war eine Artifact-Seite der funktionierende Kanal.
- Er gibt Richtung und logische Prüfung, Claude liefert Breite und Umsetzung („Mach du das bitte, ich verstehe
  nur die Hälfte“). Feature-Wünsche direkt bauen, testen, committen, auf `main` bringen – nicht erst fragen.

## 1. Was Zettel ist und wie es benutzt wird

Zettel ist eine PWA (`index.html`, kein Build) plus Vercel-Renderer (`api/zettel.js` → `lib/render.js`,
satori + resvg). Ein handgeschriebener Notizzettel wird als Sperrbildschirm-Bild gerendert (iPhone 1179 × 2556).

**Ablauf beim Auftraggeber (funktioniert, Stand 7.9. 00:31 Uhr):**

1. In der App Text schreiben, Gestaltung wählen. Einmalig ist sein Hintergrundfoto (Weltraum-Nebel) als
   „Eigenes Hintergrundfoto“ hinterlegt; die App zeichnet den Zettel darauf.
2. „Aufs Display kleben“ legt das fertige Bild in die Zwischenablage und startet den Kurzbefehl „Zettel“.
3. Kurzbefehl: *Zwischenablage abrufen → Hintergrundbild-Foto festlegen (nur Sperrbildschirm) → Bildschirm sperren.*

**Was wir über iOS gelernt haben (drei Abende, mehrfach reproduziert):**

- Ein Sperrbildschirm ist ein **Paar**: Sperrbildschirm + Home-Bildschirm + Uhrstil + Widgets.
- „Hintergrundbild-Foto festlegen“ legt beim **ersten** Lauf ein neues Paar an (beim Auftraggeber „Paar 10“).
  Das neue Paar hat keine Widgets, und seine Home-Hälfte ist einfarbig (mattes Grün). Danach **überschreibt
  der Kurzbefehl dieses Paar an Ort und Stelle** – Widgets und Home-Foto, die man einmal darauf einrichtet,
  bleiben. [Sicher für seine Konfiguration; Apple dokumentiert den Mechanismus nicht]
- Löscht man das Paar, beginnt es von vorn (neues Paar, wieder grün, wieder ohne Widgets). Regel: **Paar aktiv
  lassen, nie löschen.**
- Ist ein anderes Paar aktiv, läuft der Kurzbefehl trotzdem in sein eigenes Paar – man sieht das Ergebnis nur nicht.
- iOS gibt ein gesetztes Hintergrundbild **nie** heraus. Sein Nebelfoto liegt nur in der Fotos-Mediathek
  (Sperrbildschirm bearbeiten → „Foto in Mediathek anzeigen“). Das ist die Quelle für die App.
- Die Aktion kennt nur: Bild, Sperrbildschirm, Home-Bildschirm, Vorschau anzeigen. **Keine** Zielauswahl eines
  vorhandenen Paars, **keine** zwei Bilder. Widgets kann keine Kurzbefehl-Aktion setzen. Die Aktion verlangt
  einen Sperrbildschirm im Modus „Foto“, nicht „Fotoshuffle“.
- Eine andere KI hat dem Auftraggeber eine „Zielauswahl in der Aktion“ als Lösung verkauft – die gibt es nach
  allen Quellen nicht. Der Auftraggeber weiß das.

Die Einrichtungsanleitung in der App (`<details class="setup">`) beschreibt seit 1.35.2 genau diese drei
Handgriffe beim ersten Mal. Mehr lässt sich am Erstlauf nicht glätten.

**Notausgänge, falls das In-Place-Überschreiben doch einmal ausbleibt** (nur beschrieben, nicht gebaut):

- **A – Fotoshuffle mit Ein-Bild-Album:** Sperrbildschirm auf Fotoshuffle → Album „Zettel“ → „Beim Sperren“.
  Kurzbefehl: Zwischenablage abrufen → Fotos suchen (Album „Zettel“) merken → In Fotoalbum sichern → gemerkte
  alte Fotos löschen → sperren. Erst sichern, dann löschen. **„Fotos löschen“ löscht aus der Mediathek**, das
  Nebel-Original darf nie in dieses Album. Ungeklärt: ob Fotoshuffle beim Sperren sofort umschaltet und ob es
  das Bild eigenständig rahmt.
- **B – manuell im bestehenden Paar:** Kurzbefehl sichert nur ins Album; Tausch per Sperrbildschirm lange
  drücken → Anpassen → Fotosymbol unten links → neuestes Bild. Fünf Tipper, garantiert alles erhalten.

## 2. Was in dieser Sitzung gebaut wurde (1.29.0 → 1.35.2)

| Version | Was | Wichtig zu wissen |
|---|---|---|
| 1.30–1.32 | Bildmagnete `rabbit` (Hase), `lola` (fotorealistisch, seine Französische Bulldogge), `lolacomic`, `brunocomic` (Britisch Kurzhaar) | Registry `lib/motifs.js` jetzt 438 KB von ~600 KB Budget; ca. 4 Motive passen noch, dann WebP-Qualität in `prep_photo.mjs` (0.9) senken |
| 1.32 | Alias-Fehler in `setMotifs` behoben | Vorher zeigte `fdesign=rabbit` den Fuchs: nur der deutsche Name war Alias. Jetzt auch der Schlüssel – aber nur, wenn er kein Symbol (`herz`, `stern` …) verdeckt |
| 1.33 | Überschrift an/aus (`title`) | Erste Zeile **unterstrichen**, nicht fett: Handschriften haben einen Schnitt, der Browser fettet künstlich, satori nicht → Vorschau ≠ Bild. Keine Listenmarke auf der ersten Zeile |
| 1.34 | Drei Überschriftgrößen (`tsize` 1/2/3 = 1 / 1,25 / 1,55) | `TITLE_F` und `TITLE_GAP` (0,28 em) stehen **doppelt** in `index.html` und `lib/render.js`. Überschrift zählt nicht für „jeder Absatz auf eine Zeile“, sonst schrumpfte der ganze Text; sie bricht lieber um |
| 1.35 | Eigenes Hintergrundfoto in der App; Server-Parameter `bg=transparent` | Foto wird formatfüllend auf Displaygröße geschnitten, JPEG, unter `localStorage['zettel.bg']` getrennt vom Zustand (`zettel.v1`). `bg=transparent` liefert PNG mit Alphakanal (nur Zettel + Schatten) für „Bild überlagern“ im Kurzbefehl |
| 1.35.1 | Zwei Fehler | ✕-Knopf erbte `width:100%` → Seite lief 100 px über, iOS zoomte heraus. Unterstrich lag bei Schrift Marker in den Buchstaben: fester Faktor 0,98 em ersetzt durch Grundlinie aus Schriftmetriken (`actualBoundingBoxAscent` von „H“ mit Baseline alphabetic minus top), Strich 0,1 em darunter, 0,05 em stark – wie das CSS |
| 1.35.2 | Einrichtungsanleitung in der App neu | Drei Schritte, sagt vorher, was beim ersten Lauf passiert |

**Parität App ↔ Server ist die wichtigste Regel.** Für denselben Text müssen `fitNote` (App) und die
Schriftgrößenwahl in `render.js` dieselbe Größe und Zeilenzahl ergeben (zuletzt geprüft: 135 px / 105 px bei
Stufe 3, 4 bzw. 5 Zeilen, identisch). Wer Layoutregeln anfasst, ändert beide Dateien.

## 3. Bild-Prompts (bewährt, unverändert gültig)

### 3a. Bildmagnet (puffig 3D), bevorzugt

```
OBJEKT = [panda face]
FLAECHE = [soft mint green]

Puffy inflated 3D fridge magnet in cute kawaii style, rounded square, glossy soft plastic, seen exactly from the front, centered, on a pure white background, no shadow on the background, no table, no fridge, no text.
The magnet body is one solid color: FLAECHE, with only a thin margin visible around the motif.
The motif is OBJEKT, raised and embossed on top of the body, never sunken or recessed, filling about 85 % of the magnet.
Big expressive eyes with bright highlights, small friendly smile, soft rounded shapes, 4 to 6 flat colors with gentle shading, thin dark outlines.
```

FLAECHE nie weiß oder sehr hell (Freistellung), nie eine Hauptfarbe des Motivs. **Für ein individuelles Tier
(Lola, Bruno) zählt, dass das Bild in sich stimmig ist – nicht, dass es in die Palette der Sammlung passt.**
Das war eine ausdrückliche Vorgabe.

**Korrektur einer alten Fehldiagnose:** Ein Motiv, das leicht **vertieft** in einer Mulde sitzt, ist **kein**
Mangel – Eule und Fuchs haben denselben Look, der Auftraggeber findet ihn gut. Abgelehnt war beim Panda nur
Schwarz auf Schwarz. Frühere Fassungen dieser Datei behaupteten das Gegenteil.

### 3b. Rundes Motiv (flach), nur falls gewünscht

```
OBJEKT = [cartoon dog face]

Flat vector-style illustration of a round fridge magnet face, seen exactly from the front, perfectly centered on a pure white background.
The design is a single filled circle that fills about 80 % of the image width, with a crisp, clean circular edge and no rim, no border ring, no shadow, no reflection, no 3D bevel, no perspective.
Motif inside the circle: OBJEKT.
Style: bold simple shapes, 3 to 5 flat colors, strong contrast, thick outlines, no gradients, no texture, no text, no letters, no numbers.
Keep all important details inside the inner 80 % of the circle; the outer 20 % is plain background color of the magnet.
Square image, 1024 x 1024 pixels.
```

## 4. Bilder per API (RouteLLM, Abacus.AI ChatLLM) – gemessen, nicht vermutet

- Schlüssel: Umgebungsvariable `ROUTELLM_API_KEY`. **Nie ausgeben, nie in Dateien oder Commits schreiben.**
  Ein Tausch in der Umgebungskonfiguration greift erst in einer neuen Sitzung.
- Endpunkt `POST https://routellm.abacus.ai/v1/chat/completions`, OpenAI-kompatibel. `GET /v1/models` ist
  **unauthentifiziert** (antwortet ohne Schlüssel mit 200) – als Schlüsseltest wertlos. Test:
  `{"model":"route-llm-code","messages":[{"role":"user","content":"hi"}],"max_tokens":5}` → 200 oder
  `403 Invalid API Key`.
- `GET /v1/account` ist authentifiziert und liefert Name, E-Mail, Organisation, Plan, `credits_used`,
  `credits_granted`. `credits_used` wird **in Schüben** geschrieben, Verzögerung etwa eine Stunde – der
  Auftraggeber hat lange „nichts abgegangen“ gesehen und zwischendurch die falsche Zahl (Gesamtvolumen statt
  Verbrauch) angeschaut.
- **`usage.compute_points_used` pro Anfrage; 100 Punkte = 1 Credit** (gemessen 99,84 ± 0,03). ChatLLM Pro:
  20 $/Monat, 30 000 Credits → ~0,06 ct je Credit. Damit: `gpt_image2` ≈ 0,4 ct je Bild, `nano_banana_pro` ≈ 8 ct.
  Gesamt diese Sitzung: 72 ct.
- Bilder: `modalities: ['image','text']`, Antwort in `choices[0].message.images[].image_url.url` (Data-URI).
  `gpt_image2` lehnt `image_config.aspect_ratio` ab → `--noconfig` in `tools/gen_image.mjs`.
- `gpt_image2_edit` nimmt **bis zu drei Referenzbilder** in einem Aufruf, ohne Aufpreis. Es kann aber **nicht
  lokal retuschieren** – es erzeugt alles neu – und **übertreibt kleine Korrekturen systematisch** („5 % schlanker“
  wird 20 %). Geometrische Nacharbeit am Pixel (Klonen, Füllen) ist zweimal gescheitert; besser neu erzeugen und
  messen.
- Qualitätsurteil des Auftraggebers: `gpt_image2` war für die kleine Darstellung oft besser als Nano Banana
  (dessen Plastizität ist für 200 px fast zu stark); die Comic-Fassungen von Lola und Bruno kamen aus `gpt_image2_edit`
  mit Fuchs/Panda als Stilvorlage.
- Messtechnik, die sich bewährt hat: Freistellen per Flutfüllung vom Rand, Rendern auf 200/120/60 px, Michelson-
  Kontrast, Wärmekarte (r − b), Belichtungsnormierung über die Stirnhelligkeit. Drei eigene Messkriterien waren
  falsch und wurden zurückgezogen (Kontrastmetrik brach bei Klassifizierer-Wechsel, Brauenmaß saturierte,
  Kopfbreite maß die Schnurrhaare). Autonome Schleifen brauchen ein **hartes Kriterium für die Magnetplatte**,
  sonst optimiert das Modell sie weg (sechs von sechs Kandidaten ohne Platte).

Skripte: `node tools/gen_image.mjs <out.png> <modell> "<prompt>" [--dump] [--noconfig] [--n 2]`,
`node lib/prep_photo.mjs <quelle.png> <key> <Anzeigename>` (Bildmagnet), `node lib/prep_motif.mjs …` (rund).

## 5. Prüfen (so, wie es in dieser Umgebung wirklich läuft)

- Playwright liegt in `node_modules` des Repos; Skripte **aus `/home/user/Zettel`** starten, sonst findet Node das
  Paket nicht. Chromium: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'] })` – ohne `executablePath` sucht Playwright eine andere Version und bricht ab.
- **WebKit ist nicht verfügbar** (Download scheitert am Egress-Proxy). Alle App-Tests liefen in Chromium; die
  lokalen Schriften aus `fonts/` werden über `@font-face` geladen, `document.fonts.check` bestätigt sie.
  **iPhone-Prüfung bleibt beim Menschen.**
- App-Test: `file:///home/user/Zettel/index.html` öffnen (Viewport 430 × 900), Text per `innerHTML` in `#text`
  setzen und `input` feuern, `renderWallpaper(1179, 2556, 'phone')` aufrufen und als PNG sichern. `fitNote(...)`
  liefert `fs` und `lines` zum Vergleich mit `renderZettel(...)` vom Server.
- Server-Test: `import { renderZettel } from './lib/render.js'` – gibt `png`, `fontSize`, `lines`, `titleSize`, `bg`.
- Bildmessung ohne PIL/sharp (beides fehlt): PNG in Chromium auf ein Canvas zeichnen, `getImageData` auswerten.
  Zettel finden über Gelb (R > 200, G > 180, B < 170); Tinte R+G+B < 330; Ränder und Ecken ausschließen.
- Überlaufprüfung: `document.documentElement.scrollWidth` muss beim 430-px-Viewport ≤ 448 bleiben (der Rest ist
  ein alter, harmloser Überlauf der Befestigungsvorschau). Bei 535 zoomte iOS die ganze App heraus.
- Sieben-Motive-Regression: alle Bildmagnete rendern und PNG-Größen vergleichen – gleiche Größe = gleiches Bild
  (so fiel der Alias-Fehler auf).
- Temporäre Skripte in den Scratchpad-Ordner, nicht ins Repo; vor dem Commit `git status` prüfen.

## 6. Nächste Schritte

### 6a. Auf dem iPhone zu bestätigen (kann kein Code)

1. Neuen Text anheften, Kurzbefehl laufen lassen: **bleiben Widgets, Uhrstil und Home-Foto auf Paar 10?**
   Der Screenshot vom 7.9., 00:31 sagt ja. Wenn nein → Notausgang A testen, B als Netz.
2. Falls der Home-Bildschirm den Zettel zeigt (unscharf oder scharf): Home-Hälfte steht auf „Paar“ oder der
   Kurzbefehl hat „Home-Bildschirm“ angehakt. Beides in Ordnung; „Nebel ohne Zettel“ nur über Anpassen → Foto.

### 6b. Sechs Verbesserungen an der App (Auftrag liegt vor, noch nicht begonnen)

Vorlage einer anderen KI, vom Auftraggeber gebilligt, hier mit Prioritäten und Fallstricken:

1. **Status erfasst nicht alles** – `isPinnedCurrent()` prüft `title`, `titleSize` und das Hintergrundfoto nicht;
   nach dem Umschalten steht trotzdem „✓ angeheftet“. Für das Foto eine kurze Kennung (z. B. Länge + Hash der
   Data-URL) in `state.pinned` ablegen, nicht das Bild. Alte `pinned`-Einträge ohne die Felder gelten als veraltet.
   **Höchste Priorität, klein.**
2. **„Zettel ausblenden“** – nur den gespeicherten Hintergrund ohne Papier, Schrift, Befestigung ausgeben, über
   denselben Zwischenablage-Weg; Text und Einstellungen bleiben. Ohne hinterlegtes Foto ein Hinweis statt
   stiller Ausgabe des dunklen Verlaufs. Im Status unterscheiden: „mit Zettel“ / „nur Hintergrund“.
3. **„Angeheftet“ ist voreilig** – `stickViaShortcut()` ruft `markPinned()` nach dem Kopieren auf; der Kurzbefehl
   ist da noch nicht gelaufen. Wortlaut „Bild bereit“ bzw. „Kurzbefehl angefordert“ in Marke, Statuszeile und
   Toast konsistent. Die App kann den Erfolg nie bestätigen.
4. **Foto vor der Ausgabe abwarten** – `bgLaden()` ist asynchron; `renderPng()` wartet auf Schriften, nicht aufs
   Foto. Ein Promise für „Foto bereit“, das Ausgabe, „Teilen / sichern“ und Ausblenden abwarten. Ladefehler
   melden statt stumm den Verlauf zu nehmen. Fenster ist klein (Dekodierzeit), Fix trotzdem billig.
5. **Vorschau wächst, Bild nicht** – `syncPreview()` vergrößert den Vorschau-Zettel, wenn Text bei Mindestschrift
   nicht passt; der Export behält die feste Größe und schneidet ab. Warnen und Ausgabe sperren. **Aufwendigster
   Punkt.** Layoutregeln nur zusammen mit `lib/render.js` ändern (Parität). Eine Vollbild-Vorschau gibt es
   bereits: das Overlay `#preview` hinter „Teilen / sichern“ zeigt das gerenderte Bild.
6. **Trennung Foto/Zustand erhalten** – ist heute so (`zettel.bg` vs. `zettel.v1`), nur nicht kaputt machen. Das
   gespeicherte Foto ist zugeschnitten und JPEG-komprimiert, **kein Original** – so beschriften.

Für alle Punkte: `APP_VERSION` hochzählen (Mitte neue Funktion, hinten Korrektur), deutsche Commit-Betreffzeile,
Chromium-Tests wie in Abschnitt 5, danach Fast-Forward auf `main`. Am Ende trennen: geändert / hier getestet /
auf dem iPhone offen. Den Erhalt von Home-Bildschirm, Uhrstil und Widgets nie aus dem Code ableiten.

### 6c. Kleinere offene Punkte

- Regler für Ausschnitt und Zoom des Hintergrundfotos (falls der mittige Schnitt vom iOS-Ausschnitt abweicht).
- Der Auftraggeber möchte die Rechnungslogik „ein Paar pro Kurzbefehl“ nicht weiter automatisieren; Hintergrund
  wechselt er „selten bis nie“.
- `docs/` enthält außer dieser Datei nichts; die alte Fassung dieser Datei hatte falsche Angaben (Mulde,
  Kostenmodell, Alias), alle hier korrigiert.

## 7. Kosten dieser Sitzung und Rat für die nächste

- RouteLLM gesamt 72 ct (alle Bilder der drei Tage).
- Claude gesamt ≈ 149 $ (Opus 5 bis zum Modellwechsel, danach Fable 5.1). Ein sehr großer Teil davon ist
  Cache-Lesen des riesigen Verlaufs; **jeder Neustart nach mehr als einer Stunde Pause und jeder Modellwechsel
  kostet bei dieser Verlaufslänge rund 9 $**, weil der Cache neu geschrieben wird. Ein einzelner Feature-Schritt mit
  Tests kostete zuletzt 2–5 $, eine kurze Antwort 0,2–0,5 $.
- Empfehlung: **Neue Sitzung starten.** Diese Datei plus README plus die App-Anleitung reichen als Kontext; ein
  frischer Chat kostet pro Schritt einen Bruchteil.
