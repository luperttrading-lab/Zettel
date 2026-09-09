# Zettel – Regeln für jede Claude-Sitzung in diesem Repository

Diese Datei liest Claude Code beim Start automatisch. Sie ergänzt die persönlichen Einstellungen des
Auftraggebers (Deutsch, per Du, Aussagen als [Sicher] / [Wahrscheinlich] / [Vermutung] markieren, keine
Zustimmungsfloskeln, unbequeme Wahrheit zuerst).

## Zuerst lesen

`docs/UEBERGABE.md` vollständig, dann `README.md`. Dort stehen Stand, Entscheidungen und offene Punkte.

## Kostenanzeige am Ende jeder Antwort – Pflicht

Der Auftraggeber will nach **jeder** Antwort wissen, was sie gekostet hat. Ablauf: **erst**
`python3 tools/kostentabelle.py` ausführen, dann dessen Ausgabe **wörtlich** als letzten Block der
Antwort setzen. Nicht umformatieren, nicht schätzen, nichts danach anhängen. Sieht so aus:

```
| 08.09. 19:38 | Claude |
|---|---:|
| diese Frage | 0,30 $ |
| heute | 33,66 $ |
| dieser Chat | 303,35 $ |
```

Maßgeblich ist **`docs/KOSTENTABELLE.md`** (Stand 8.9.2026). Sie ersetzt die frühere einzeilige
Fassung `docs/KOSTENZEILE.md` und alle älteren Anweisungen aus dem Chatverlauf. Dort stehen auch die
Preise je Modell, die Cache-Falle (Stunden-Cache kostet beim Schreiben doppelt) und die Regeln zum
Eintragen fremder Dienste in `tools/fremdkosten.json` – für jeden Dienstnamen dort entsteht eine
eigene Spalte. Werkzeuge, die Geld kosten, tragen ihre Kosten **selbst** ein (Vorbild:
`tools/gen_image.mjs`); ein fehlender Betrag wird als `"usd": null` festgehalten und in der Tabelle
mit `?` hinter dem Dienstnamen angezeigt.

## Nachricht aufs Handy

Der Auftraggeber arbeitet über die App und will nicht im Chat sitzen bleiben. `PushNotification`
erreicht sein iPhone (am 9.9.2026 geprüft, kommt an).

**Am Ende JEDER fertigen Antwort geht eine Nachricht raus** – so ausdrücklich gewählt (9.9.2026), nachdem
eine engere Regel („nur bei neuer Version“) ihn ohne Nachricht ließ. Also auch nach einer reinen Auskunft,
einem Doku-Commit oder einer Rückfrage. Der Aufruf gehört an dieselbe Stelle wie die Kostentabelle: zum
Abschluss, bevor die Antwort steht. Nicht bei Zwischenschritten innerhalb einer Runde.

Für den Text: Die Überschrift der Benachrichtigung ist der **Sitzungstitel**, nicht der Text – der Satz
muss also für sich allein verständlich sein. Unter 200 Zeichen, eine Zeile, kein Markdown, und er soll
sagen, was passiert ist, nicht dass etwas passiert ist („1.63.0 live: Zettelhöhe folgt dem Text“ statt
„fertig“). Liest er ohnehin gerade mit, unterdrückt das Werkzeug die Nachricht selbst – die Antwort
„not sent“ ist kein Fehler. Das läuft über die laufende Sitzung: Ist sie beendet, geht nichts mehr raus.

## Arbeitsweise im Repo

- Eigener Branch `claude/…`, nach jedem abgeschlossenen Schritt auf `main` vorspulen (`--ff-only`) und pushen;
  Vercel baut aus `main`. Vor jedem Push `git fetch origin main` – es kann eine zweite Sitzung parallel arbeiten.
- `APP_VERSION` in `index.html` bei jeder Änderung hochzählen, sonst holt die App das Update nicht.
  **Seit 3.3 zwei Stellen** (so gewünscht): vorn die große Sache, hinten jede Änderung – aus 3.3 wird 3.4.
  Die Update-Prüfung vergleicht nur Zeichenketten, das Format ist ihr gleich.
- Layoutregeln stehen doppelt in `index.html` und `lib/render.js` (Vorschau/Bild-Parität). Wer eine ändert,
  ändert beide und prüft Schriftgröße und Zeilenzahl für denselben Text.
- Bilder vor dem Einbauen **anschauen** (Read), nicht nur messen. Jedes Bild, das für den Auftraggeber
  entsteht, per SendUserFile schicken, bevor die Antwort endet.
- Tests laufen in Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` mit `--no-sandbox`,
  Skripte im Repo-Verzeichnis ablegen (dort liegt `node_modules/playwright`). WebKit ist nicht verfügbar.
