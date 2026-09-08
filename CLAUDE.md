# Zettel – Regeln für jede Claude-Sitzung in diesem Repository

Diese Datei liest Claude Code beim Start automatisch. Sie ergänzt die persönlichen Einstellungen des
Auftraggebers (Deutsch, per Du, Aussagen als [Sicher] / [Wahrscheinlich] / [Vermutung] markieren, keine
Zustimmungsfloskeln, unbequeme Wahrheit zuerst).

## Zuerst lesen

`docs/UEBERGABE.md` vollständig, dann `README.md`. Dort stehen Stand, Entscheidungen und offene Punkte.

## Kostenzeile am Ende jeder Antwort – Pflicht

Der Auftraggeber will nach **jeder** Antwort wissen, was sie gekostet hat. Ablauf: **erst**
`python3 tools/kosten.py` ausführen, dann dessen Ausgabe **wörtlich** als letzte Zeile der Antwort setzen.
Nicht umformatieren, nicht schätzen, nichts danach anhängen. Sieht so aus:

```
<sub>08.09. 19:11 Uhr · Frage 0,25 · heute 18,85 · ges. 229,16 $</sub>
```

`<sub>` macht die Schrift kleiner; das versteht die App. Deutsches Zahlenformat, Dollarzeichen nur am Ende,
Ortszeit. `-v` gibt zusätzlich Summen je Tag und Modell aus (nur auf Nachfrage zeigen).

**Zwei Zeilen sind in der App nicht möglich** – vom Auftraggeber alles durchprobiert: `<br>`, zwei Leerzeichen
und Backslash am Zeilenende werden verworfen; Leerzeile oder Liste reißen ein sichtbares Loch (126–133 statt
82 px); ein Codeblock steht in einem Kasten mit Kopfzeile „Code“ und Kopierknopf; `<div style=…>` erscheint als
roher HTML-Text. Deshalb genau **eine** Zeile.

Was das Skript macht und worauf es ankommt:
- Liest `~/.claude/projects/<Arbeitsverzeichnis mit - statt />/*.jsonl`, also **nur diese Sitzung**.
- Zählt jede Antwort **einmal** (nach `message.id`); ohne Entdopplung kommt etwa das Dreifache heraus.
- „Frage“ = alle Antworten seit dem letzten **echten** Nutzerbeitrag; Werkzeugergebnisse stehen im Protokoll
  ebenfalls als `user` und zählen nicht.
- Preise je Modell aus der Tabelle im Skript, **je Nachricht mit dem Preis ihres eigenen Modells** – bei einem
  Modellwechsel mitten im Chat darf nicht alles mit einem Preis gerechnet werden.
- **Cache-Schreibpreis:** Standard ist der **1-Stunden-Cache** (Opus 5: 10 $/Mio, Fable 5.1: 20 $/Mio), denn so
  läuft diese Umgebung. `--ttl5` rechnet mit dem 5-Minuten-Preis (6,25 / 12,50) – das ergibt für diesen Chat
  rund 30 $ weniger. Wer die Zahl anzweifelt, sollte zuerst hier nachsehen.
- Die Zeile entsteht, **bevor** die Antwort geschrieben ist; die Token der Antwort selbst fehlen und tauchen
  erst in der nächsten Zeile auf (10 bis 50 Cent).
- Zeitzone steht auf UTC+2, im Winter auf 1 ändern.

Zum Einordnen: Nach einem Modellwechsel oder einer Pause über einer Stunde kostet die nächste Frage 3 bis 10 $,
weil der ganze Verlauf neu in den Cache geschrieben wird; sonst liegt eine Frage bei 10 bis 30 Cent. Dem
Auftraggeber sagen, wenn ein neuer Chat billiger wäre. Der Betrag ist ein **Gegenwert zu API-Listenpreisen**,
keine Rechnung – im Abo zahlt er den Pauschalpreis.

Bilder über RouteLLM (Abacus.AI) rechnet das Skript nicht mit: `usage.compute_points_used` je Anfrage,
100 Punkte = 1 Credit, ChatLLM Pro 20 $/Monat für 30 000 Credits → 1 Credit ≈ 0,06 ct. Wenn in einer Antwort
Bilder erzeugt wurden, den Cent-Betrag im Text nennen.

## Arbeitsweise im Repo

- Eigener Branch `claude/…`, nach jedem abgeschlossenen Schritt auf `main` vorspulen (`--ff-only`) und pushen;
  Vercel baut aus `main`. Vor jedem Push `git fetch origin main` – es kann eine zweite Sitzung parallel arbeiten.
- `APP_VERSION` in `index.html` bei jeder Änderung hochzählen (Mitte: neue Funktion, hinten: Korrektur),
  sonst holt die App das Update nicht.
- Layoutregeln stehen doppelt in `index.html` und `lib/render.js` (Vorschau/Bild-Parität). Wer eine ändert,
  ändert beide und prüft Schriftgröße und Zeilenzahl für denselben Text.
- Bilder vor dem Einbauen **anschauen** (Read), nicht nur messen. Jedes Bild, das für den Auftraggeber
  entsteht, per SendUserFile schicken, bevor die Antwort endet.
- Tests laufen in Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` mit `--no-sandbox`,
  Skripte im Repo-Verzeichnis ablegen (dort liegt `node_modules/playwright`). WebKit ist nicht verfügbar.
