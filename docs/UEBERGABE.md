# Übergabe: Zettel – Stand, Erkenntnisse, nächste Schritte

**Repository: `luperttrading-lab/Zettel`.** Diese Datei liegt dort unter `docs/UEBERGABE.md`. Eine neue Sitzung
muss in diesem Repository laufen, sonst fehlen Skripte, Motive, Schriften und Kontext.

Stand: 7. September 2026, App-Version **1.42.2**, Branch `claude/docs-uebergabe-readme-e8bkvo` (nach Abschluss per
Fast-Forward auf `main` gebracht; Vercel und GitHub Pages bauen aus `main`).

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

Zweite Sitzung (Auftrag aus 6b, alle sechs Punkte umgesetzt, Reihenfolge 1 · 3 · 4 · 2 · 5 · 6):

| Version | Was | Wichtig zu wissen |
|---|---|---|
| 1.35.3 | Punkt 1: `isPinnedCurrent()` prüft `title`, `titleSize` (nur bei Überschrift an) und das Foto | `state.pinned.bg` = Kennung `Länge:FNV-1a-Hash` der Data-URL (`fotoKennung`, ~7 ms bei 2,4 MB), gesetzt in `bgLaden` synchron aus der URL, geleert bei ✕ und Ladefehler. `pinned` ohne `title`/`bg` (ältere Versionen) gilt als veraltet |
| 1.35.4 | Punkt 3: Wortlaut „Bild bereit“ / „Kurzbefehl angefordert“ statt „angeheftet“ | `pinned.requested` = Kurzbefehl per URL aufgerufen. Nach Änderung „geändert · Bild veraltet“. `updatePinBadge` löscht Statuszeilen, die mit „Bild bereit“ oder „Kurzbefehl „“ beginnen, sobald der Stand nicht mehr passt |
| 1.35.5 | Punkt 4: `bgReady`-Promise, `fotoAbwarten()` in `renderPng()` | Ladefehler → `bgFehler`, Banner + Statuszeile `BG_FEHLER`, Ausgabe gesperrt, ✕ bleibt sichtbar („ohne Foto weitermachen“). `png.catch(() => {})` in `stickViaShortcut`, sonst meldet der Browser die Ablehnung als unbehandelt, weil `ClipboardItem` das Promise vor unserem Handler hält |
| 1.36.0 | Punkt 2: Knopf „Zettel ausblenden“ | `stickViaShortcut({ nurHintergrund: true })` → `renderWallpaper(…, { nurHintergrund })` zeichnet nur Foto/Verlauf. Ohne Foto Hinweis, keine Ausgabe. `pinned.bgOnly`; dann zählt für „aktuell“ nur noch die Foto-Kennung (Textänderungen lassen den Stand stehen, der Zettel ist ja nicht im Bild). Status überall „· mit Zettel“ / „· nur Hintergrund“ |
| 1.36.1 | Punkt 5: `fitNote` liefert `overflow`; Marke „⚠ Zu viel Text“ links unten, Statuszeile `OVERFLOW_HINT`, Kleben und Teilen gesperrt (`.btn.blocked`) | Vorschau wächst weiterhin (man sieht, was man tippt). `lib/render.js` gibt `overflow` zurück – **keine Layoutregel geändert**; Parität geprüft: 3–40 Zeilen gleiche Schriftgröße, Zeilenzahl und Flag, Grenze bei 22 Zeilen „Zeile n Einkauf“. Ausblenden bleibt möglich |
| 1.36.2 | Punkt 6: Beschriftung „zugeschnittener JPEG-Abzug, nicht das Original“ in Anleitung, Knopf-Titel und Bestätigung | Trennung `zettel.bg` / `zettel.v1` unverändert; `pinned` trägt nur die Kennung; Test prüft, dass Leeren das Foto stehen lässt |
| 1.36.3 | Altfehler: `.tsizes` hatte `display:flex`, das schlug das `hidden`-Attribut – die drei A-Knöpfe waren seit 1.34 immer sichtbar | Regel `.tsizes[hidden] { display: none }` |
| 1.36.4 | Neun Befunde aus einem Review (Abschnitt 7): Schnappschuss des Stands im Tipp (`pinSnapshot`/`gleicherStand`, Meldung `GEAENDERT` statt „bereit“, wenn währenddessen geändert), Laufnummer `bgGen` gegen überholte `Image`-Rückrufe, Überlauf in `renderPng` mit geladener Schrift erneut geprüft, Fallback ohne Zwischenablage meldet Fehler, kaputtes Foto bleibt bis ✕ liegen (Meldung in Banner **und** Statuszeile), kurzer Wortlaut in Kopfzeile/Marke („Bild bereit“, „Kurzbefehl angefordert“, „Hintergrund bereit“, „Hintergrund angefordert“ – die lange Form „· mit Zettel / · nur Hintergrund“ nur in Statuszeile und Banner), Marken stapeln sich, `OVERFLOW_HINT` nur beim Übergang, alter Eintrag „Bild veraltet · neu kleben“, Server-Header `X-Zettel-Overflow` | `renderWallpaper` liest alles Bildbestimmende **vor** dem ersten `await`. Wer neue bildbestimmende Felder einführt: `SNAP_FIELDS`, `pinSnapshot` und `isPinnedCurrent` gemeinsam pflegen. Test: `tests/app_review.mjs` bei 375 px |
| 1.37.0 | Auftraggeber-Wunsch nach dem ersten Test auf dem iPhone („Ausblenden klappt, aber der Zettel klebt in der App noch genauso“): „Zettel ausblenden“ ist jetzt ein **Umschalter** mit Zustand `state.hidden`. Ausgeblendet: `.note.weg` (visibility hidden, Fläche bleibt), Hinweis `#weghint` „Zettel ausgeblendet · antippen zum Bearbeiten“, Knopf heißt „Zettel einblenden“. Einblenden **lädt das Zettelbild hoch** (gleicher Weg wie Kleben) – kein weiteres Hochladen nötig. Tipp auf die Fläche = `peek` (nur in der App sichtbar, nichts hochgeladen, Zustand bleibt) | Der Zustand wechselt erst, wenn das Bild fertig ist (`png.then`), bei Ablehnung nicht. „Aufs Display kleben“ beendet das Ausblenden ebenfalls. Leerer Zettel + einblenden → Zettel erscheint zum Schreiben mit Hinweis. Test: `tests/app_umschalter.mjs` |
| 1.37.1 | Auftraggeber-Wunsch (Screenshot vom Sperrbildschirm): Überschrift auf liniertem Papier passte nicht ins Linienraster, alles darunter rutschte von den Linien. Jetzt **Linienraster**: auf liniertem/kariertem Papier belegt jede Überschriftzeile `raster = ceil(titleF)` Linienzeilen (1 bzw. 2) ohne Abstand darunter; die Überschrift sitzt unten bündig (Grundlinie auf der Grundlinie der letzten Rasterzeile, große Buchstaben ragen nach oben), der Unterstrich liegt mittig auf der Linie. Glattes Papier unverändert (1,55 Zeilen + 0,28 em) | **Layoutregel, dreifach**: `fitNote` (`raster`, `blockH`, `gapOf`), `render.js` (`raster`, `hoehe`, `titelLage`), Vorschau (`titleRasterStyle` → Inline-`marginTop/marginBottom/textUnderlineOffset` am ersten `.ln`, gesetzt über `textEl.titleStyle` in `applyIndents`). Dafür neu in beiden `FONTS`-Tabellen: `asc`/`desc` (hhea, em) – Grundlinie im Zeilenkasten = (lh + asc − desc)/2 · fs. Im Canvas dient `baselineOf(fs)` als Maß. satori setzt den Unterstrich selbst (Schriftmetrik, pro Wort) – dort nicht steuerbar. Test: `tests/app_titelraster.mjs` (Parität Größen × Papiere × Schriften, mehrzeilige Überschrift) |
| 1.37.3 | Auftraggeber nach dem Test auf dem iPhone: bei Größe 2 und 3 klaffte oben eine Lücke, weil die Überschrift zwei Rasterzeilen belegte und unten bündig saß. Jetzt belegt sie **eine** Linienzeile und ragt mit der größeren Schrift nach oben darüber hinaus (`ueber = (titleF − 1) · (lh + asc − desc)/2 · fs`), notfalls bis unter die Befestigung – ausdrücklich gewünscht („macht nichts, wenn der Magnet knapp drüber ist“). Grundlinie und Unterstrich bleiben auf der Linie, der Rest im Raster | `raster` ist jetzt immer 1 (Wert bleibt als Schalter „im Linienraster“). Sicherung: `ueber ≤ pad + inset`, sonst schrumpft die Schrift (greift erst bei Regler 140 % und Größe 3). In der Vorschau wird der **Kasten des Textfelds** um `ueber` nach oben erweitert (`marginTop` negativ, `paddingTop` und `height: calc(100% + …)` gegen), sonst schnitte sein `overflow: hidden` die Oberlängen ab |
| 1.37.4 | Frage des Auftraggebers: „Auf dem Home-Bildschirm erscheint mein Zettel unscharf mit – muss das so?“ Nein. Die Anleitung in der App erklärt jetzt bei Schritt 3 den Unterschied **Paar** (Home übernimmt automatisch das Sperrbildschirm-Bild, Zettel unscharf sichtbar) und **Foto** (eigenes Bild, bleibt dauerhaft) | Kein Code, nur Text. Die Kurzbefehl-Aktion schreibt nur die angehakte Hälfte; ein neu angelegtes Paar startet mit Home auf „Paar“ |
| 1.38.0 | Auftraggeber-Wunsch: „Wenn man am Schieber vorbeiscrollt, sollte die Auswahl gleich zu sehen sein – sonst merkt man nie, dass es außer dem Fuchs noch andere gibt.“ Jeder Wechsel der Befestigung öffnet jetzt ihre Auswahlleiste von selbst (`zeigeAuswahl` im `onSelect` des Schiebers) | Die Leiste liegt über dem Schieber, der bleibt bedienbar. Der `pointerdown`-Schließer nimmt jetzt den **ganzen** `#strip-fastener` aus (vorher nur `.item.active`), sonst schlösse der erste Wisch sie wieder. Ist die Papier-Karte offen, stellt der Wechsel auf die Befestigung um. Tipp auf die gewählte Befestigung (Schieber oder Zettel) schließt weiterhin. Test: `tests/app_auswahl.mjs` – dort **nicht** `page.click` für Schieber-Elemente: Playwright scrollt den Schieber und trifft dann ein anderes Element (kostete eine Fehlersuche); stattdessen `el.click()` per `evaluate`, echte Mausklicks nur für die `pointerdown`-Fälle |
| 1.39.0 → 1.40.0 | Bildmagnet `melody` (Melody, roter Pudel des Auftraggebers, fotorealistisch, Platte Himmelblau). Erst als `poodle`/Pudel auf Petrol gebaut, dann nach Rückmeldung (Fell rötlicher, Schnauze heller und kurz geschoren, Ohren kurz gelockt und eng am Kopf, Himmelblau gefällt) mit `gpt_image2_edit` aus erster Fassung + Foto neu erzeugt und umbenannt; `poodle` entfernt | Registry `lib/motifs.js` bei ~540 KB – Budget ~600 KB praktisch erreicht; vor dem nächsten Motiv WebP-Qualität in `prep_photo.mjs` senken oder ein Motiv entfernen. Entfernen eines Motivs: Registry laden, Schlüssel löschen, im selben Format zurückschreiben (siehe Commit 1.40.0), PNG unter `lib/motifs/` löschen |
| 1.41.0 | Bildmagnet `melodycomic` (Melody Comic): wie `lolacomic` mit `gpt_image2_edit`, Fuchs als Stilvorlage, `melody.png` als Motiv, Platte Himmelblau; die Fassung mit Reliefoptik gewählt, weil sie zu Fuchs/Panda passt | Registry `lib/motifs.js` jetzt 572 KB – **nächstes Motiv nur noch mit gesenkter WebP-Qualität oder nach Entfernen eines Motivs** |
| 1.42.0 | **Bedienleiste neu** (Entwurf A aus zwei Artifact-Runden mit dem Auftraggeber, siehe unten): eine **Zustandszeile** (Punkt + ein Satz, einzeilig), darunter **ein** Hauptknopf mit zwei Zeilen, darunter **drei** Symbolknöpfe (ausblenden/einblenden · teilen · leeren). Kopfzeilen-Status, Marke am Zettel und das Toast-Banner sind entfallen — alles steht an einer Stelle | Kern ist `lage()`: `leer` / `alt` / `geaendert` / `wartet` / `fertig`. Neu ist **`wartet`**: Das Bild liegt in der Zwischenablage, der Kurzbefehl fehlt noch (`state.pinned.warten`). Dann ersetzt eine **gelbe Ansage** den Knopf — kein Knopf, weil die App den Kurzbefehl nicht starten kann, ohne die Kurzbefehle-App in den Vordergrund zu holen; ein Tipp darauf zeigt die Erklärung `#hilfe`. `warten` endet bei `visibilitychange` auf sichtbar (Annahme, keine Messung). Wortlaut durchgehend **Sperrbildschirm**, nie „kleben“. Meldungen und Zustand teilen sich die Zeile (`meldung` hat Vorrang, `meldungAufraeumen()` bei Eingaben). Test: `tests/app_leiste.mjs` (ersetzt `app_status`, `app_wortlaut`, `app_ausblenden`, `app_umschalter`) |
| 1.42.1 | `melodycomic` neu erzeugt: der Kopf war kleiner als bei Fuchs/Panda/Lola/Bruno (zu viel freie Platte). `gpt_image2_edit` mit Fuchs als Maß für die Füllung und der ersten Comic-Fassung als Motiv; Vorgabe „Schopf, Ohren, Brust berühren den Rand“ | Rand prüfen heißt: Kontaktbogen der Bildmagnete bei 220 px nebeneinander rendern und **anschauen** – eine Pixelmessung der Motivfläche scheiterte an Glanz und Ecken der Platte |
| 1.42.2 | `melodycomic` wieder die erste Reliefversion mit **kleinerem Kopf** (mehr freie Platte als bei Fuchs/Panda) – Wunsch des Auftraggebers nach Ansicht beider Fassungen nebeneinander. Die Fassung mit großem Kopf liegt nicht mehr im Repo | Bei Motiven mit persönlichem Bezug entscheidet sein Geschmack, nicht die Gleichförmigkeit der Sammlung – wie schon bei den Plattenfarben |
| – | **Entscheidung zur Motivgröße (7.9.2026):** Registry bleibt vorerst so. Wenn verkleinert wird, dann **höchstens 480 px / WebP-Qualität 0,8** (−37 %). Der Auftraggeber hat im Vergleichsbild bei 0,7 und bei 400 px/0,8 Kontrast- und Farbverluste gesehen (die helle Schnauze wird dunkler) und lehnt das ab. Später mögliche Alternative: Motive einzeln nachladen statt als Bündel | Vergleichsbild: ein Motiv aus der Registry per Canvas mit `toDataURL('image/webp', q)` neu kodieren, bei 200 px und ca. 4-fach vergrößert nebeneinander zeigen; beim echten Umbau aus den Original-PNGs rechnen, nicht aus dem WebP |
| 1.43.0 | **Mehrere Befestigungen** auf einem Zettel (neun Artifact-Runden mit dem Auftraggeber, siehe unten). Aus `state.fastener` (ein Feld) wird `state.fasteners` — eine **Liste** `[{ art, x, y, vier?, color? }]`, Plätze als Anteile der Zettelbreite. Es liegt immer **eine Sorte** auf dem Zettel („nur Magnete, nur Pins – sonst wird alles zu unruhig und nicht mehr hübsch“). Ziehen mit dem Finger, `＋`/`✕` in der Auswahlkarte (Zeile „Anzahl“) | **Regeln in `lib/fasteners.js`, nicht in der App** – App und Server müssen sie gleich sehen: `FASTENER_RULE` (`frei` Nadeln/Magnete · `quer` Klebestreifen, nur waagerecht an Ober-/Unterkante · `oben` Büroklammer · `fest` Eckstreifen), `FASTENER_MAX` (2 Streifen, 4 Klammern, 4 Magnete/Nadeln), `fastenerHome`, `fastenerPlace`, `fastenersShapes`, `fastenersSvg`. **`fastenerInset(liste, …)` ist die kritische Stelle**: nur was oben an der Kante sitzt (`y ≤ p`), drückt den Text nach unten – der Wert geht in `fitNote` **und** in `render.js`, also Parität. Test `tests/app_befestigungen.mjs` prüft sie mit **langem** Text (kurzer Text erreicht ohnehin die Maximalgröße und zeigt den Unterschied nicht). Art wechseln: innerhalb derselben Regelgruppe tauschen **alle** Stücke und bleiben liegen; in eine andere Gruppe nur bei einem Stück, sonst blenden die Arten im Schieber ab (`.gesperrt`) und die Zustandszeile erklärt es – bewusst **kein** Infofenster. „Zwei Nadeln“ (`pin2`) ist aus der Auswahl raus und wird beim Laden in zwei einzelne umgeschrieben (zweite in der Gegenfarbe); die Art bleibt in `fasteners.js` für alte Server-Aufrufe. Server: `fpos=x,y[,farbe];…` in Prozent, `fvier=1`. **Griffe niemals beim Ziehen neu bauen** – wer das Element entfernt, das den Zeiger gefangen hält, bleibt nach 8 px stehen (genau dieser Fehler kostete eine Runde); `zeichneGriffe` baut nur bei geänderter Struktur neu. Regressionsprüfung: zehn Server-Fälle ohne `fpos` sind byteweise identisch zu 1.42.0 |
| 1.44.0 | Rückmeldung des Auftraggebers zu 1.43.0: (a) Muster ließ sich nicht je Stück wählen, nur die Farbe – er will „eine rote Büroklammer, eine grün-weiß gestreifte, eine gelb-schwarz gestreifte“; (b) **drei Büroklammern ließen sich nicht in drei Nadeln tauschen**, obwohl das offensichtlich geht: die Nadeln dürfen alles, was die Klammern durften, und mehr; (c) was nicht geht, soll man „gar nicht hin schieben“ können | **Die Regelgruppen als Kriterium waren falsch.** Neu entscheidet `wechselMoeglich(v)`: erlaubt, wenn alle Stücke Platz finden (`FASTENER_MAX`) **und** an ihrer Stelle liegen bleiben dürfen — `fastenerPlace(v, x, y)` verschiebt keines um mehr als 3 % der Breite. Das ist von Natur aus einseitig: Klammer → Nadel ja, Nadel (verteilt) → Klammer nein. Was nicht geht, wird im Schieber **ausgeblendet**, nicht abgeblendet; dafür rechnet `makeStrip` jetzt mit den *sichtbaren* Einträgen (`sichtbar`, `zeige(werte)`, `sichtbareEls()`) — sonst zeigte `Math.round(scrollLeft / itemW())` auf den falschen Eintrag. `aktualisiereArten()` läuft auch **nach jedem Ziehen**, sonst bliebe die Klammer wählbar, nachdem eine Nadel nach unten gezogen wurde (genau dieser Fehler war im ersten Anlauf drin). Muster/Motiv je Stück als `decor` neben `color`; `fastenersShapes` mischt beides in den Look, `normalizeLook` löst `decor` in `pattern`/`design` auf |
| 1.44.1 | Auftraggeber: der Rahmen um die angetippte Befestigung „ist sehr dezent, so dass man die fast manchmal gar nicht sieht“ | Ursache war nicht die Stärke, sondern die **Farbe**: ein gelber Ring (`rgba(255,214,10,.6)`) auf gelbem Papier. Jetzt zwei Ringe – innen 3 px volles Gelb, außen 2 px dunkel (`rgba(28,26,21,.55)`) als Abgrenzung. Auf allen vier Papierfarben geprüft (`rahmen_*.png`); ein erster Versuch mit umgekehrter Reihenfolge (dunkel innen, gelb außen) sah auf Gelb nur nach einer olivfarbenen Linie aus |
| 1.44.2 | Auftraggeber mit Nadeln in den unteren Zettelecken: „wenn ich unten in die Ecken Pins setze, kann ich sie nicht mehr richtig einfärben und markieren, weil dann die Steuerung drüber liegt“ | `placePalette` legte die Karte **oberhalb** des Befestigungs-Schiebers ab und damit über die untere Zettelhälfte. Jetzt sitzt sie unter **beidem**: `top = max(Unterkante Papier + 6, Unterkante Schieber + 8)`. Verdeckt werden dafür Schrift- und Listenschieber – die braucht man beim Befestigen nicht. Erster Anlauf legte sie nur unter den Zettel, dann verschwand der Befestigungs-Schieber (Regression gegen 1.38.0: beim Wischen soll man sehen, was es sonst noch gibt). Test in `app_befestigungen.mjs`: Karte tiefer als Papier **und** Schieber, kein Griff darunter |
| 1.44.3 | Drei Fehler nach dem Test auf dem iPhone: (a) beim Tippen ins Textfeld blieb eine Befestigung gelb markiert, obwohl gar nichts an ihr geändert wird; (b) „wenn ich auf Geist tippe, sind alle drei Geister“ – Motiv und Farbe schlugen auf alle Stücke durch; (c) beim Suchen dazu gefunden: mit mehreren verteilten Befestigungen war das **Textfeld gar nicht mehr antippbar** | (a) Der Rahmen hängt jetzt nur an der offenen Befestigungs-Auswahl (`!fcolorsEl.hidden && cardMode === 'fastener'`), nicht mehr an „mehr als eine liegt“; `toggleFcolors` ruft `syncPreview()`, sonst bliebe er bis zum nächsten Zeichnen stehen. (b) **Farbe und `decor` stehen jetzt immer im Stück**, nie nur im Grundton der Art – fehlten sie, kam der Wert aus `state.fastenerLook[art]` und ein Klick färbte alle mit um; beim Laden werden sie einmalig aus dem Grundton festgeschrieben, beim Artwechsel über `normalizeLook(v, b)` auf das umgestellt, was die neue Art kennt. (c) Das unsichtbare `.hit`-Rechteck über der Befestigung umspannte die **Bounding-Box aller** Stücke, also fast den ganzen Zettel, und fing jeden Tipp ins Textfeld ab – ersatzlos entfernt, getroffen wird über die Griffe. Test deckt alle drei ab |
| 1.45.0 | Zwei Rückmeldungen: (a) „unten wird was angezeigt, das oben ganz anders ist“ – der Schieber zeigte das Icon im **Grundton der Art**, auf dem Zettel lagen aber rot karierte Streifen; (b) das Ausblenden nicht wählbarer Arten aus 1.44.0 war doch falsch: „warum finde ich jetzt keinen Klebestreifen?“ – er will hinscrollen können und sehen, dass es sie gibt | (a) `applyFastener` setzt das Icon der gewählten Art jetzt mit dem Look des **angetippten Stücks** (`fastenerIcon(art, state.fasteners[aktiveBef])`). (b) `makeStrip.zeige(werte)` → **`sperre(werte, melden)`**: die Einträge bleiben sichtbar und nur `.gesperrt` (opacity .3); rastet der Schieber auf einem ein, ruft `commit()` die Rückmeldung auf und gleitet über `zurueck()` weich zum vorigen. Damit rechnet der Schieber wieder mit **allen** Einträgen — der Umbau auf `sichtbar` aus 1.44.0 ist rückgängig. Die Erklärung landet in der Zustandszeile (`zeigeMeldung`), mit unterschiedlichem Wortlaut für „zu viele“ und „passt nicht zu diesen Plätzen“ |
| 1.46.0 | **Ohne Scrollen.** Auftraggeber: der Ausgabe-Block passt nicht mehr auf den Bildschirm; „ob wir oben einen Button machen, wo wir das in einem Popup managen“ – und: „wichtig ist, dass man das Bild abschicken immer sieht ohne zu scrollen“ | Gemessen zuerst: die Seite war 1079 px hoch, verfügbar sind 852 (iPhone 15) bzw. 667 (SE). Der Ausgabe-Block ist 270 px, das allein reicht also nicht. Umgesetzt: **Zustandszeile und Hauptknopf bleiben oben**, ein „···“-Knopf rechts in der Zustandszeile (kostet keine Höhe) öffnet das Fenster **„Und jetzt?“** mit den drei Symbolknöpfen, dem Hintergrundfoto und dem Kurzbefehl. Dazu gibt die Vorschau nach: `--notez` skaliert Breite **und** `min-height` des Zettels (nur die Breite zu skalieren brachte fast nichts – die feste `min-height: 60vw` blieb stehen), `passeHoehe()` verkleinert in 4-%-Schritten bis 62 %, bis `scrollHeight ≤ innerHeight`. Ergebnis: iPhone 15 und Pro Max scrollfrei, **SE (667) nicht** – dort bleiben ~108 px, dafür müsste mehr aus der Gestaltung weichen. Fallen: (1) `passeHoehe` muss in `requestAnimationFrame`, sonst TDZ-Fehler mit `LAYOUTS` (dieselbe Falle wie 1.39.0); (2) `.sheet-inhalt` braucht `min-height: 0`, sonst wächst das scrollende Flex-Kind über `max-height`; (3) alle Tests, die `#hide`/`#share`/`#clear`/`#bgclear` klicken, brauchen den Helfer `imFenster(sel)` – aufmachen, tippen, **wieder zumachen**, sonst verdeckt das offene Fenster die nächste Prüfung |

**Parität App ↔ Server ist die wichtigste Regel.** Für denselben Text müssen `fitNote` (App) und die
Schriftgrößenwahl in `render.js` dieselbe Größe und Zeilenzahl ergeben (zuletzt geprüft: 135 px / 105 px bei
Stufe 3, 4 bzw. 5 Zeilen, identisch). Wer Layoutregeln anfasst, ändert beide Dateien.
**Bekannte Abweichung (vorbestehend, am Stand 1.37.0 nachgemessen):** Caveat ist meist exakt paritätisch; Kalam, Marker und
Gloria weichen um 2–7 px ab (App 119/105/99 vs. Server 116/101/101 bei fünf Zeilen), unabhängig von Überschrift und Papier.
**Ursache gemessen (7.9.):** die Breitentabellen (`lib/*-widths.json`) summieren nur Vorschubbreiten ohne Kerning und liegen
damit 2–4 % über `measureText` im Canvas (Caveat, „To Do Liste“ bei 209 px: 805,5 vs. 790,9 bei 793 px Textbreite). An einer
solchen Kippgrenze bricht der Server eine Überschrift um, die die App noch einzeilig setzt, und wählt dann eine Stufe kleiner.
Der Test `app_titelraster.mjs` prüft deshalb die Layoutregel hart und die Schriftgröße mit 10 % Toleranz. Wer das beheben
will, müsste die Tabellen mit Kerning erzeugen – das verschöbe jedes bestehende Layout. Ebenfalls vorbestehend: im Canvas-Bild sitzt
der Text etwa 0,15 em höher über der Linie als in der Vorschau (Canvas `textBaseline: top` kennt keinen halben
Durchschuss); sichtbar als etwas mehr Luft zwischen Buchstaben und Linie im Bild.

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

- `node_modules` fehlt in einer frischen Sitzung: `npm install && npm install --no-save playwright` (Playwright
  steht absichtlich nicht in `package.json`, Vercel braucht es nicht). Skripte **aus `/home/user/Zettel`** starten,
  sonst findet Node das Paket nicht (Skripte im Scratchpad: `import … from '/home/user/Zettel/node_modules/playwright/index.mjs'`).
  Chromium: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'] })` – ohne `executablePath` sucht Playwright eine andere Version und bricht ab.
- Lokaler Server statt `file://` (sonst CORS-Fehler der Versionsprüfung in der Konsole):
  `(setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &)`, dann `http://localhost:8766/index.html`.
- **Prüfskripte im Repo** (Chromium, Aufruf im Kopf jeder Datei, Ausgabeverzeichnis als Argument): `tests/app_status.mjs`
  (Punkt 1), `app_wortlaut.mjs` (3), `app_foto.mjs` (4), `app_ausblenden.mjs` (2), `app_ueberlauf.mjs` (5, inkl.
  Parität mit `lib/render.js`), `app_trennung.mjs` (6 + Größenknöpfe), `app_review.mjs` (Befunde 1.36.4, Viewport 375 px:
  verzögertes `toBlob` für die Änderung während des Renderns, ✕ während des Dekodierens, Marken ohne Überlappung),
  `app_leiste.mjs` (1.39.0: Zustandszeile, Ansage, Erklärung, Symbolreihe, Ausblenden, veralteter Eintrag).
  Jedes endet mit „ALLE TESTS OK“ oder „n FEHLER“. Der lokale Server auf 8766 stirbt bei längerer Pause – vor dem Lauf `curl` prüfen.
  `tests/app_photo.mjs` und `app_paper.mjs` sind für WebKit geschrieben; für Chromium die zwei `webkit`-Zeilen ersetzen.
- **`[hidden]` und eigene `display`-Regeln:** Eine Klasse mit `display:flex/grid` schlägt das `hidden`-Attribut. Das ist
  dreimal passiert (Größenknöpfe der Überschrift 1.36.3, Ansage und Hauptknopf 1.39.0); seit 1.39.0 steht ganz oben im
  CSS `[hidden] { display: none !important; }`. Wer eine neue Komponente mit eigenem `display` anlegt, braucht nichts
  weiter zu tun – die Regel greift.
- **Reihenfolge im Skript:** `zeichneLeiste()` läuft schon beim Aufbau der Oberfläche (über `applyColor`). Alles, was es
  liest (`meldung`, `textUeberlauf`), muss **vor** dieser Stelle deklariert sein, sonst bricht das ganze Skript in der
  temporalen Totzone ab – und dann fehlt scheinbar `LAYOUTS`, was in die Irre führt.
- Im Zustand `wartet` gibt es **keinen** Hauptknopf (`#stick` ist `hidden`). Tests, die danach `#stick` klicken, laufen in
  einen Timeout – vorher `visibilitychange` auf sichtbar auslösen oder ein Symbol der unteren Reihe nehmen.
- Zwischenablage im Test: `context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })`, Klick per
  Playwright gilt als Geste. **Nach `location.href = 'shortcuts://…'` nimmt Chromium keine Klicks und Tasten mehr an**
  (Navigation zu unbekanntem Schema) – autoRun-Fälle deshalb ans Ende eines Tests, Textänderungen danach per
  `textEl.insertText(…)`. Nach dem Kleben liegt der Fokus auf dem Knopf und der Toast liegt über allem: erst
  `toast.hidden = true`, dann `#text` anklicken, dann tippen.
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
   **Neu am 7.9., 07:21:** Nach „Zettel ausblenden“ und wieder „einblenden“ zeigte der Sperrbildschirm den Zettel
   ≈ 1,35-fach vergrößert und nach oben verschoben (Zettel breiter als das Display). Die App rendert unverändert
   1179 × 2556 mit Zettel auf 80 % Breite; seit 1.37.2 steht die Bildgröße in der Statuszeile. Vermutung [Wahrscheinlich]:
   ein Zuschnitt des Paars, den iOS beim Überschreiben an Ort und Stelle beibehält (entstanden beim reinen Foto oder
   durch Zwei-Finger-Geste unter „Anpassen“). Abhilfe zu prüfen: Anpassen → Foto zusammenziehen, bis das ganze Bild
   sichtbar ist → Fertig → Kurzbefehl erneut. Falls es nach jedem Ausblenden wiederkehrt: Bild für „nur Hintergrund“
   mit unsichtbarem Rand versehen oder das Foto im Kurzbefehl per „Bild überlagern“ auf das Zettelbild legen.
2. Falls der Home-Bildschirm den Zettel zeigt (unscharf oder scharf): Home-Hälfte steht auf „Paar“ oder der
   Kurzbefehl hat „Home-Bildschirm“ angehakt. Beides in Ordnung; „Foto ohne Zettel“ nur über Anpassen → Foto.
   **Am 7.9. gefragt und beantwortet:** Ein neu angelegtes Paar hat die Home-Hälfte auf „Paar“ – deshalb erschien das
   rosa Bild samt Zettel unscharf auch auf dem Home-Bildschirm. Einmal Anpassen → Home-Bildschirm → Foto → dasselbe
   Foto ohne Zettel, dann bleibt es dort [Wahrscheinlich: Apple dokumentiert es nicht, folgt aber daraus, dass die
   Aktion nur die angehakte Hälfte schreibt]. Hätte die Home-Hälfte schon ein eigenes Foto gehabt, wäre es erhalten
   geblieben. Seit 1.37.4 erklärt die App-Anleitung „Paar“ vs. „Foto“.

### 6b. Sechs Verbesserungen an der App – **erledigt** (1.35.3 bis 1.36.2, Nacharbeit 1.36.4; Tabelle in Abschnitt 2)

Vorlage einer anderen KI, vom Auftraggeber gebilligt. Der ursprüngliche Auftrag zum Nachlesen; was daraus wurde,
steht in Abschnitt 2. **Vom Auftraggeber auf dem iPhone bestätigt (7.9.):** „Zettel ausblenden“ funktioniert mit dem Kurzbefehl.
**Noch offen** (hier nur Chromium): Banner `BG_FEHLER` und ✕ nach Ladefehler, Toast-Wortlaut, Marke „⚠ Zu viel Text“
links unten neben der Befestigung, und der neue Umschalter 1.37.0 (leere Fläche mit gestricheltem Rahmen, Tipp zum
Bearbeiten, „Zettel einblenden“ lädt hoch).

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
- Offen nach der zweiten Sitzung: `state.pinned` wächst mit jedem Feld (`requested`, `bgOnly`); wer weitere
  bildbestimmende Einstellungen einführt, muss sie in `markPinned` **und** `isPinnedCurrent` eintragen – sonst
  zeigt die App wieder „Bild bereit“ nach einer Änderung (genau der alte Fehler aus Punkt 1).
- Statuszeile ist eine einzige Textzeile für alles (Hinweise, Fehler, Warnung); die Löschregeln in `updatePinBadge`
  (Präfix „Bild bereit“/„Kurzbefehl „“) und `syncPreview` (`OVERFLOW_HINT`) arbeiten mit Textvergleich. Neue
  Meldungen dort brauchen eine eigene Löschregel, sonst bleiben sie stehen.

## 7. Kosten und Rat für die nächste Sitzung

**Zweite Sitzung (6b, 7. September):** Claude ≈ 152 $ gemessen, davon **≈ 131 $ für einen Review-Workflow** mit
96 Unteragenten (sechs Prüfperspektiven, je Befund drei Widerleger; 3 Stunden, weil die Umgebung nur zwei Agenten
parallel erlaubt). Kostentreiber war das Cache-Schreiben: 5,4 Mio Token × 20 $/Mio = 108 $ – jeder Agent schreibt seinen
eigenen Cache. Die eigentliche Umsetzung aller sechs Punkte samt Tests kostete ≈ 19 $. Der Review fand 20 bestätigte
Befunde (neun Ursachen, alle in 1.36.4 behoben), aber gegen 3 Uhr UTC lief die Sitzung ins Nutzungslimit (Reset 3:20),
die Widerleger zweier Perspektiven fielen aus. **Rat: in dieser Umgebung keine Mehr-Agenten-Workflows.** Ein einzelner
Prüfagent oder die Prüfung im Hauptverlauf kostet 2–5 $ und hätte die wichtigsten Befunde (Schnappschuss, Laufnummer,
Wortlautbreite) ebenfalls geliefert.

**Erste Sitzung (1.29 → 1.35.2):**

- RouteLLM gesamt 72 ct (alle Bilder der drei Tage).
- Claude gesamt ≈ 149 $ (Opus 5 bis zum Modellwechsel, danach Fable 5.1). Ein sehr großer Teil davon ist
  Cache-Lesen des riesigen Verlaufs; **jeder Neustart nach mehr als einer Stunde Pause und jeder Modellwechsel
  kostet bei dieser Verlaufslänge rund 9 $**, weil der Cache neu geschrieben wird. Ein einzelner Feature-Schritt mit
  Tests kostete zuletzt 2–5 $, eine kurze Antwort 0,2–0,5 $.
- Empfehlung: **Neue Sitzung starten.** Diese Datei plus README plus die App-Anleitung reichen als Kontext; ein
  frischer Chat kostet pro Schritt einen Bruchteil.
