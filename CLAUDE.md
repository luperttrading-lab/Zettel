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
