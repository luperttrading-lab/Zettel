# Übergabe: Magnet-Bilder für Zettel selbst erzeugen

**Repository: `luperttrading-lab/Zettel`** (nicht `wetter` oder ein anderes). Diese Datei liegt dort unter
`docs/UEBERGABE.md`; die Sitzung muss in diesem Repository gestartet sein, sonst fehlen Skripte, Motive und Kontext.

Stand: 6. September 2026, App-Version 1.29.0, Branch `claude/projekt-zettel-xjs5ko` (wird immer auf `main`
vorgespult; Vercel baut aus `main`). Diese Datei ist für eine neue Claude-Code-Sitzung gedacht, die in einer
Cloud-Umgebung mit dem RouteLLM-Schlüssel läuft. Der Auftraggeber schreibt Deutsch, wird geduzt, diktiert per
Sprache (Erkennungsfehler mitdenken), will Aussagen als [Sicher] / [Wahrscheinlich] / [Vermutung] markiert und
bekommt jedes Bild und jede Datei über SendUserFile zugeschickt, bevor die Sitzung endet.

## 1. Worum es geht

Zettel ist eine PWA (`index.html`, GitHub Pages) plus Vercel-Renderer (`api/zettel.js` → `lib/render.js`).
Ein Zettel wird als Sperrbildschirm-Bild gerendert. Oben am Zettel sitzt eine „Befestigung“
(Klebestreifen, Reißzwecke, Nadel, Klammer, Magnet, Bildmagnet). Zwei Befestigungen nehmen eigene Bilder:

| Befestigung | Schlüssel | Bildform | Datei | Was das Bild ist |
|---|---|---|---|---|
| Magnet | `magnet` | rund, Scheibe | JPEG 512 px, ohne Transparenz | Motiv **auf** einer runden Magnetscheibe; die Scheibe ist Teil des Bildes (Flächenfarbe) |
| Bildmagnet | `photo` | quadratisch, runde Ecken, puffig 3D | WebP 480 px mit Alpha (App) + PNG (Server) | Das Bild **ist** der Magnet, freigestellt auf Transparenz |

Größe auf dem iPhone-Wallpaper (1179 × 2556): Scheibe des runden Magneten ca. 196 px Durchmesser, Bildmagnet
ca. 200 px Kante. Deshalb reichen 512 bzw. 480 px Quellauflösung, mehr wird beim Einbauen ohnehin verkleinert.
Der Auftraggeber hat den Bildmagneten als Alternative gewählt, weil ihm der puffige 3D-Stil (Fuchs) besser gefiel
als die flachen runden Motive. Neue Bilder sollen vor allem **Bildmagnete** sein.

Vorhandene Motive (`lib/motifs.js`, Registry `{ key: { label, src, [kind:'photo', png] } }`):
rund: `wink` (Zwinker), `dog` (Hund), `ghost` (Geist), `ladybug` (Marienkäfer);
Bildmagnet: `fox` (Fuchs), `owl` (Eule), `panda` (Panda). Geschmacksurteil des Auftraggebers: Fuchs und Panda
(Mint) sehr gut, Eule gut aber Motiv etwas klein auf der Fläche, erste Panda-Versuche (schwarz auf schwarz,
vertieft mit dickem Rand) abgelehnt.

## 2. Bild-Prompts (bewährt)

### 2a. Bildmagnet (puffig 3D), bevorzugt

Zwei Variablen: OBJEKT (Motiv) und FLAECHE (Farbe des Magnetkörpers).

```
OBJEKT = [panda face]
FLAECHE = [soft mint green]

Puffy inflated 3D fridge magnet in cute kawaii style, rounded square, glossy soft plastic, seen exactly from the front, centered, on a pure white background, no shadow on the background, no table, no fridge, no text.
The magnet body is one solid color: FLAECHE, with only a thin margin visible around the motif.
The motif is OBJEKT, raised and embossed on top of the body, never sunken or recessed, filling about 85 % of the magnet.
Big expressive eyes with bright highlights, small friendly smile, soft rounded shapes, 4 to 6 flat colors with gentle shading, thin dark outlines.
```

Regeln für FLAECHE: nie Weiß oder sehr hell (sonst keine Freistellung vom weißen Hintergrund), nie eine
Hauptfarbe des Motivs (Panda: kein Schwarz/Weiß/Grau, Fuchs: kein Orange). Pastell funktioniert: mint green,
sky blue, soft coral, lavender, butter yellow, peach. Bei Motiven, die zu klein geraten (Eule), ergänzen:
„the motif fills 85 % of the square, feet or base touching the lower margin“.

Wichtig für die Freistellung: reines Weiß, **kein Schatten auf dem Hintergrund**. Das Skript entfernt Weiß per
Flutfüllung von den Bildrändern her; ein grauer Schatten bleibt sonst als Fahne stehen.

Ideen, die der Auftraggeber bekommen hat und gut fand: Frosch auf peach, Pinguin auf butter yellow, Biene auf
lavender, Katze, Koi, Hund, Igel, Faultier, Erdbeere, Avocado, Donut, Kaktus, Regenbogen, Rakete, Herz.

### 2b. Rundes Motiv (flach), nur falls gewünscht

```
OBJEKT = [cartoon dog face]

Flat vector-style illustration of a round fridge magnet face, seen exactly from the front, perfectly centered on a pure white background.
The design is a single filled circle that fills about 80 % of the image width, with a crisp, clean circular edge and no rim, no border ring, no shadow, no reflection, no 3D bevel, no perspective.
Motif inside the circle: OBJEKT.
Style: bold simple shapes, 3 to 5 flat colors, strong contrast, thick outlines, no gradients, no texture, no text, no letters, no numbers.
Keep all important details inside the inner 80 % of the circle; the outer 20 % is plain background color of the magnet.
Square image, 1024 x 1024 pixels.
```

## 3. Bilder per API erzeugen (RouteLLM, Abacus.AI ChatLLM)

- Schlüssel liegt als Umgebungsvariable `ROUTELLM_API_KEY` in der Cloud-Umgebung. **Nie ausgeben, nie in
  Dateien oder Commits schreiben.** Nur `process.env.ROUTELLM_API_KEY` lesen.
- Endpunkt: `POST https://routellm.abacus.ai/v1/chat/completions`, OpenAI-kompatibel, Header
  `Authorization: Bearer <key>`. Bilder laufen über denselben Endpunkt, nicht über `/images/generations`.
- **Schlüssel richtig prüfen** (geprüft 6.9.2026): `GET /v1/models` ist **nicht authentifiziert** und antwortet
  auch ganz ohne Header mit 200 – als Schlüsseltest also wertlos, nur als Netzwerktest brauchbar. Ein toter
  Schlüssel zeigt sich erst am `chat/completions`-Endpunkt als `403 {"error": "Invalid API Key"}`. Richtiger,
  fast kostenloser Test:

  ```
  curl -s -w '\nHTTP %{http_code}\n' https://routellm.abacus.ai/v1/chat/completions \
    -H "Authorization: Bearer $ROUTELLM_API_KEY" -H 'Content-Type: application/json' \
    -d '{"model":"route-llm-code","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
  ```

  Umgebungsvariablen werden beim Start des Containers gesetzt. Wird der Schlüssel in der Umgebungs-
  konfiguration ausgetauscht, greift das **erst in einer neu gestarteten Sitzung**, nicht in der laufenden.
- Anfrage: `{ model, modalities: ['image','text'], messages: [{ role:'user', content:[{type:'text', text}] }], image_config: { aspect_ratio, num_images?, quality?, resolution? } }`.
- Antwort: `choices[0].message.images[].image_url.url` als Data-URI, ersatzweise Data-URI im `content`-Text.
- Modell-Schlüssel laut `/v1/models` (geprüft 5.9.2026): `gpt_image2`, `gpt_image2_edit`, `nano_banana2`,
  `nano_banana_pro`, `flux2_pro`, `flux3`, `flux_pro_ultra`, `seedream5_pro`, `ideogram`, `recraft`,
  `gemini-3-pro-image`. Für den kawaii-3D-Stil zuerst `gpt_image2` und `nano_banana_pro` probieren [Vermutung].
  `gpt_image2_edit` nimmt zusätzlich ein Referenzbild als `{type:'image_url', image_url:{url: dataUri}}` im
  content, damit lassen sich Fuchs/Panda als Stilvorlage mitgeben [Wahrscheinlich].
- Seitenverhältnis: FLUX-Modelle wollen `square_hd`, die anderen `1:1`. `tools/gen_image.mjs` übersetzt das.
  **`gpt_image2` lehnt `image_config.aspect_ratio` ab** (`400 Invalid image config param`); dort
  `--noconfig` benutzen, dann liefert das Modell 1024 x 1024 px. Die Doku-Seite unter `abacus.ai/help/...`
  ist vom Egress-Proxy der Cloud-Umgebung blockiert, die erlaubten Werte lassen sich dort nicht nachlesen.
- Verbrauch: die Antwort enthält `usage.compute_points_used` (Frosch mit `gpt_image2`, 1024 x 1024:
  **695,5 Punkte**, 19,4 s). Damit lässt sich pro Bild gegen das ChatLLM-Dashboard abgleichen.
- Kosten: ChatLLM Teams enthält laut Abacus 10 $ API-Guthaben pro Monat; ob Bildmodelle darin enthalten sind, ist
  ungeprüft. Deshalb **zuerst ein einzelnes Bild** erzeugen, dann in ChatLLM unter Credits nachsehen, was es
  abgezogen hat, und dem Auftraggeber die Zahl nennen, bevor Serien laufen.

Skript (ungeprüft, ohne Schlüssel geschrieben, beim ersten Lauf mit `--dump` die Antwortstruktur prüfen):

```
node tools/gen_image.mjs /tmp/panda.png gpt_image2 "OBJEKT = panda face ... (ganzer Prompt)" --dump
node tools/gen_image.mjs /tmp/frosch.png nano_banana_pro "..." --n 2      # zwei Varianten: frosch-1.png, frosch-2.png
```

Wenn die Antwort anders aussieht als erwartet: `*.response.json` neben der Ausgabe lesen und das Skript anpassen.
Fehler 401/403 = Schlüssel oder Kontingent (**erst mit dem Text-Request oben klären, ob der Schlüssel überhaupt
noch lebt**, bevor man das Modell verdächtigt), 400 = Parameter (dann `image_config` weglassen bzw. `--noconfig`).

Ergebnis des ersten echten Laufs (6.9.2026): `gpt_image2` liefert sauber freistellbare Bilder (Hintergrund
253–254 von 255, kein Schatten), setzt das Motiv aber **vertieft in eine Mulde mit dickem Rand** statt erhaben –
genau die Variante, die der Auftraggeber beim Panda abgelehnt hat. Die Prompt-Zeile „raised and embossed …,
never sunken or recessed“ reicht bei diesem Modell nicht. Nächster Versuch: eine Nano-Banana-Variante oder
`gpt_image2_edit` mit dem Fuchs als Stilvorlage.

## 4. Bilder einbauen

Beide Skripte brauchen Playwright mit Chromium (`/opt/pw-browsers/chromium` ist in der Cloud-Umgebung
vorinstalliert). Playwright einmalig ohne Änderung an package.json installieren:

```
cd /home/user/Zettel && npm install --no-save playwright@1.62.1
```

Bildmagnet (Bild auf reinem Weiß, Skript stellt frei, beschneidet, quadratisch 480 px, schreibt Registry + PNG):

```
cd /home/user/Zettel && node lib/prep_photo.mjs /tmp/frosch.png frog Frosch
```

Rundes Motiv (Kreis auf Weiß finden, quadratisch beschneiden, 512 px JPEG; optionaler Zoom > 1 zieht enger):

```
cd /home/user/Zettel && node lib/prep_motif.mjs /tmp/hund.jpg dog Hund 1.1
```

Argumente: Quelldatei, interner Schlüssel (englisch, klein, wird auch in `lib/motifs/<key>.png` verwendet),
Anzeigename (deutsch, erscheint als Chip-Tooltip und als URL-Alias `fdesign=<name klein>`).
Dann:

1. `APP_VERSION` in `index.html` hochzählen (Mitte: neue Funktion, hinten: Korrektur), z. B. `1.28.0`.
   Die App meldet neue Versionen selbst; die Zeile enthält `const APP_VERSION = '…'`.
2. README-Liste der Bildmagnete ergänzen (Abschnitt Parameter, `fdesign`).
3. Tests (Abschnitt 5), Kontrollbild zusammenstellen, **anschauen** (Auftraggeber hat mehrfach Bilder
   zurückgewiesen, die ungeprüft hochgeladen wurden), dann dem Auftraggeber schicken.
4. Commit (deutsche Betreffzeile, z. B. „Bildmagnete Frosch und Pinguin, Version 1.28.0“) und
   `git push -u origin claude/projekt-zettel-xjs5ko`.

Größenbudget: `lib/motifs.js` liegt bei 238 KB für 7 Motive, wird vom Service Worker gecacht. Bis etwa 600 KB
unkritisch; darüber Bilder stärker komprimieren (WebP-Qualität in `prep_photo.mjs`, aktuell 0.9).

## 5. Prüfen

Server (aus dem Repo-Verzeichnis starten, sonst findet `render.js` die Schriften nicht):

```
cd /home/user/Zettel && node tests/srv_photo.mjs /tmp/out frosch panda
```

App im WebKit-Browser (iPhone-Viewport), Screenshot und Wallpaper je Motiv:

```
cd /home/user/Zettel && (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-webkit npx playwright install webkit --with-deps   # einmalig, dauert einige Minuten
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-webkit node tests/app_photo.mjs /tmp/out frog panda
```

Der lokale Server stirbt zwischen den Chat-Runden; vor jedem App-Test neu starten. Klicks auf die Befestigung
gehen über das unsichtbare `rect.hit` mit `{ force: true }`, sonst scrollt Playwright vor dem Klick und die
Schiebeleisten übernehmen einen falschen Wert.

Kontrollbild aus mehreren PNGs nebeneinander: mit Chromium eine HTML-Seite mit `<img>`-Elementen rendern und
per `page.screenshot` speichern (siehe Beispiel in `tests/app_photo.mjs`, gleiche Technik), dann per Read
ansehen und per SendUserFile schicken.

## 6. Technik, die man beim Einbauen kennen muss

- `lib/fasteners.js` ist die gemeinsame Zeichendatei für App und Server (UMD). `setMotifs(registry)` teilt
  Einträge mit `kind:'photo'` in `PHOTOS`, den Rest in `MOTIFS`/`DESIGNS`; der deutsche Name wird klein als
  Alias eingetragen. Im Server wird die Datei per `new Function('module','exports',src)` geladen.
- Server-Renderer (satori + resvg): resvg kann kein WebP und lädt keine `<image>` innerhalb eingebetteter SVGs.
  Deshalb liegt je Bildmagnet ein PNG in `lib/motifs/`, das `render.js` als eigenen `img`-Knoten mit
  `borderRadius` zeichnet; der Glanz kommt danach als SVG darüber.
- `lib/render.js`: innerhalb von `renderZettel` heißt eine Variable `fs` (Schriftgröße); Dateizugriffe dort über
  `const { readFileSync } = fs` am Modulanfang.
- Vercel deployt aus `main`. Bild-URL zum Testen nach dem Merge:
  `https://zettel-beta.vercel.app/api/zettel?device=iphone&text=Test&fastener=bildmagnet&fdesign=panda`

## 7. Offen (nicht beauftragt, nur angeboten)

- Bildmagnet ca. 25 % größer zeichnen (Auftraggeber fand ihn eventuell klein; Entscheidung steht aus).
- Aus der App-Durchsicht: Foto als Zettelhintergrund, abhakbare Kästchen, Verlauf/Vorlagen, Positionsregler,
  Datumsstempel, Sicherung, Tests ins Repo (hiermit begonnen), Option `autoRun` entfernen, Wortlaut
  „angeheftet“ ist optimistisch (Bild liegt nur bereit).
