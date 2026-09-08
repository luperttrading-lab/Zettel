# Zettel – Regeln für jede Claude-Sitzung in diesem Repository

Diese Datei liest Claude Code beim Start automatisch. Sie ergänzt die persönlichen Einstellungen des
Auftraggebers (Deutsch, per Du, Aussagen als [Sicher] / [Wahrscheinlich] / [Vermutung] markieren, keine
Zustimmungsfloskeln, unbequeme Wahrheit zuerst).

## Zuerst lesen

`docs/UEBERGABE.md` vollständig, dann `README.md`. Dort stehen Stand, Entscheidungen und offene Punkte.

## Kostenzeile am Ende jeder Antwort – Pflicht

Der Auftraggeber will nach **jeder** Antwort wissen, was sie gekostet hat. Ganz am Ende der Antwort, genau
einmal, als **drei einfache Zeilen** – **kein Codeblock** (der graue Kasten ist zu auffällig für eine Fußnote,
gesagt am 8.9.2026), keine Tabelle, keine Fettschrift. Zeilenumbruch mit zwei Leerzeichen am Zeilenende:

Frage: 0,0 ct RouteLLM · 0,8 $ Claude
Heute: 0,0 ct RouteLLM · 51,9 $ Claude
Chat: 72,0 ct RouteLLM · 335,8 $ Claude

**Drei Zeilen seit 8.9.2026.** „Heute“ wird **nach Datum aus dem Protokoll** gerechnet, nicht kumulativ
weitergezählt – sonst wandert der Vortag mit über Mitternacht (genau dieser Fehler passierte am 8.9.:
gemeldet waren 471 $ „heute“, tatsächlich 40 $). „Chat“ ist die Summe dieser Sitzung **inklusive
Unteragenten**.

Komma als Dezimaltrenner, eine Nachkommastelle.

Regeln:
- **Gemessen, nicht geschätzt.** „Diese Frage“ umfasst alles seit der letzten Nachricht des Auftraggebers:
  jeden Befehl, jedes Bild, jeden Zwischentext. Nur die letzten Sätze der Antwort selbst sind noch nicht
  im Zähler; das sind Cent-Beträge.
- Ist eine Zahl doch geschätzt (z. B. nach einem Kontextwechsel), Tilde davor: `~0,40 $`.
- **RouteLLM** (Bilder über Abacus.AI): `usage.compute_points_used` je Anfrage; 100 Punkte = 1 Credit;
  ChatLLM Pro 20 $/Monat für 30 000 Credits → 1 Credit ≈ 0,06 ct. Beispiel: 730 Punkte = 7,3 Credits ≈ 0,44 ct.
- **Claude**: Tokens aus dem Sitzungsprotokoll summieren, **je API-Antwort einmal** (nach `message.id`
  entdoppeln – jeder Inhaltsblock steht sonst als eigene Zeile drin), mit den Preisen des jeweils
  servierenden Modells (`message.model`), pro Million Tokens:

  | Modell | input | output | cache write (1 h) | cache read |
  |---|---|---|---|---|
  | claude-opus-5 | 5 $ | 25 $ | 10 $ | 0,50 $ |
  | claude-fable-5-1 | 10 $ | 50 $ | 20 $ | 0,25 $ |

  Preise nur aus der Skill-Referenz `claude-api` übernehmen, nie aus dem Gedächtnis (die Sitzung am
  6.9.2026 hat mit 15/75 $ dreifach zu hoch gerechnet). Skript:

  ```
  cd /root/.claude/projects/-home-user-Zettel && python3 -c "
  import json,glob
  seen={}
  for f in glob.glob('*.jsonl'):
    for line in open(f):
      try: o=json.loads(line)
      except: continue
      if o.get('type')!='assistant': continue
      m=o.get('message',{}); u=m.get('usage')
      if u: seen[m.get('id')]=(u, m.get('model'))
  k=0
  for u,model in seen.values():
    i,o_,cw,cr = (10,50,20,0.25) if (model and 'fable' in model) else (5,25,10,0.5)
    k += u.get('input_tokens',0)*i/1e6+u.get('output_tokens',0)*o_/1e6+u.get('cache_creation_input_tokens',0)*cw/1e6+u.get('cache_read_input_tokens',0)*cr/1e6
  print(round(k,2))"
  ```

  Der Wert ist kumulativ für die Sitzung; die Differenz zur vorigen Messung ist der Aufwand seit der letzten
  Nachricht. Für **„Heute“ nach Datum gruppieren** (`o['timestamp'][:10]`) – nie den Vortag mitschleppen:

  ```
  python3 -c "
  import json,glob,collections
  seen={}
  for f in glob.glob('/root/.claude/projects/-home-user-Zettel/**/*.jsonl', recursive=True):
    for line in open(f, encoding='utf-8'):
      try: o=json.loads(line)
      except: continue
      m=o.get('message') if isinstance(o,dict) else None
      if isinstance(m,dict) and m.get('usage') and m.get('id'): seen[m['id']]=(m['usage'],m.get('model'),(o.get('timestamp') or '')[:10])
  tag=collections.defaultdict(float)
  for u,mo,d in seen.values():
    i,o_,cw,cr=(10,50,20,0.25) if (mo and 'fable' in mo) else (5,25,10,0.5)
    tag[d]+=u.get('input_tokens',0)*i/1e6+u.get('output_tokens',0)*o_/1e6+u.get('cache_creation_input_tokens',0)*cw/1e6+u.get('cache_read_input_tokens',0)*cr/1e6
  for d in sorted(tag): print(d, round(tag[d],2))
  print('CHAT', round(sum(tag.values()),2))"
  ```
- Der Claude-Betrag ist ein **Gegenwert zu API-Preisen**. Solange das Abo nicht in Überziehung ist, wird er
  nicht in Rechnung gestellt; der Auftraggeber will ihn trotzdem sehen.
- Nach einer Pause von mehr als einer Stunde muss der Gesprächsspeicher neu aufgebaut werden; das kostet bei
  langen Sitzungen mehrere Dollar auf einen Schlag. Dem Auftraggeber sagen, wenn ein neuer Chat billiger wäre.

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
