# Kostenzeile unter jeder Antwort (Claude Code)

> **Überholt seit 8. September 2026.** Es gilt `docs/KOSTENTABELLE.md`: Tabelle mit einer Spalte je
> Dienst, Skript `tools/kostentabelle.py`. Diese Datei bleibt nur als Beschreibung der einzeiligen
> Fassung liegen; nicht mehr danach arbeiten.

## Wenn du diese Datei in einem Chat bekommst

Das ist ein **Auftrag, kein Hintergrundwissen**. Setze ihn sofort um, ohne Rückfrage:

1. Das Skript unten als `tools/kosten.py` im Arbeitsverzeichnis anlegen (`chmod +x` nicht nötig).
2. Einmal `python3 tools/kosten.py` ausführen und prüfen, dass eine Zeile herauskommt.
3. Diese Ausgabe **wörtlich** als letzte Zeile deiner Antwort setzen.
4. Ab jetzt **bei jeder weiteren Antwort** genauso: erst Skript, dann Ausgabe anhängen. Ohne Ausnahme,
   auch bei kurzen Antworten.
5. Den Ablauf zusätzlich in die `CLAUDE.md` des Projekts schreiben, damit er die nächste Sitzung überlebt.

Nicht umformatieren, nicht schätzen, nichts hinter die Zeile setzen. Läuft das Skript nicht (kein
Sitzungsprotokoll, anderes Werkzeug), das offen sagen statt eine Zahl zu erfinden.

---

Der übrige Text beschreibt, was gebaut wird, wie es aussehen muss und was beim Formatieren in der
Claude-App nicht funktioniert.

---

## Auftrag

Hänge an **jede** deiner Antworten eine kurze Kostenzeile an. Sie zeigt, was die letzte Frage,
was der heutige Tag und was der gesamte Chat gekostet hat, als API-Gegenwert in US-Dollar.

Ablauf pro Antwort: erst das Skript unten ausführen, dann seine Ausgabe **wörtlich**
als letzte Zeile der Antwort setzen. Nicht nachträglich umformatieren, nicht schätzen.

## So muss es aussehen

Eine einzige Zeile, klein gesetzt, ohne Rahmen, ohne Überschrift:

```
<sub>08.09. 19:11 Uhr · Frage 0,25 · heute 18,85 · ges. 229,16 $</sub>
```

Gerendert steht dort: `08.09. 19:11 Uhr · Frage 0,25 · heute 18,85 · ges. 229,16 $`

Regeln:
- Deutsches Zahlenformat mit Komma, Dollarzeichen nur einmal am Ende.
- Ortszeit, nicht UTC.
- `<sub>` sorgt für kleinere Schrift. Das versteht die App.

## Was in der Claude-App **nicht** funktioniert (alles selbst getestet)

| Versuch | Ergebnis |
|---|---|
| `<br>` | wird verworfen, beide Zeilen kleben zusammen |
| Zwei Leerzeichen am Zeilenende | wird verworfen |
| Backslash am Zeilenende | wird verworfen |
| Leerzeile, also zwei Absätze | funktioniert, aber 133 Pixel Abstand statt 82, sichtbares Loch |
| Liste mit zwei Punkten | 126 Pixel, praktisch genauso weit |
| Codeblock mit ``` | Zeilenabstand korrekt eng, aber Kasten mit Kopfzeile „Code" und Kopierknopf drumherum |
| `<div style="line-height:…">` | erscheint als roher HTML-Text |

Fazit: **Zwei eng stehende Zeilen sind in dieser App nicht möglich.** Deshalb eine einzige Zeile.

## Preise, Stand September 2026

$ je Million Token:

| Modell | Eingabe | Ausgabe | Cache schreiben 1 h | Cache schreiben 5 min | Cache lesen |
|---|---:|---:|---:|---:|---:|
| Claude Fable 5.1 | 10,00 | 50,00 | 20,00 | 12,50 | 0,25 |
| Claude Opus 5 | 5,00 | 25,00 | 10,00 | 6,25 | 0,50 |
| Claude Sonnet 5 | 2,00 | 10,00 | 4,00 | 2,50 | 0,20 |
| Claude Haiku 4.5 | 1,00 | 5,00 | 2,00 | 1,25 | 0,10 |

**Zwei Cache-Preise, das ist die wichtigste Stellschraube.** Wie lange ein zwischengespeicherter Verlauf
gültig bleibt, entscheidet die Umgebung: fünf Minuten oder eine Stunde. Der Stundencache kostet beim
Schreiben doppelt so viel. Claude Code in der Cloud-Umgebung läuft mit **einer Stunde**, deshalb ist das
im Skript der Standard; `--ttl5` rechnet mit dem Fünf-Minuten-Preis. Für einen langen Chat sind das
schnell 30 $ Unterschied. Wer eine Zahl anzweifelt, prüft zuerst das hier.

Jede Nachricht wird mit dem Preis **ihres eigenen Modells** bewertet. Wird das Modell mitten im
Chat gewechselt, darf nicht alles mit einem Preis gerechnet werden.

Wichtig zum Verständnis: Nach jedem Modellwechsel und nach jeder Pause, die länger ist als die
Cache-Gültigkeit, kostet die nächste Frage 3 bis 10 $, weil der gesamte Verlauf neu in den Cache
geschrieben wird. Ohne Wechsel und ohne Pause liegt eine Frage bei 10 bis 30 Cent. Wenn ein neuer Chat
deutlich billiger wäre, sag es.

Und: Das sind API-Listenpreise, keine Rechnung. Bei einem Abo zahlt man den Pauschalpreis.

## Das Skript

Ablegen als `tools/kosten.py`, aufrufen mit `python3 tools/kosten.py`. Mit `-v` kommen zusätzlich die
Summen je Tag und je Modell dazu, mit `--ttl5` wird der Fünf-Minuten-Cachepreis gerechnet.

Es liest das Sitzungsprotokoll unter `~/.claude/projects/<Arbeitsverzeichnis mit - statt />/*.jsonl`.
Drei Feinheiten, die leicht falsch gemacht werden:

1. Jede Nachricht wird **einmal** gezählt. Im Protokoll steht dieselbe Nachricht bei Streaming
   mehrfach; ohne Entdopplung kommt etwa das Dreifache heraus.
2. „Letzte Frage" heißt: alle Antworten ab dem letzten **echten** Nutzerbeitrag. Werkzeugergebnisse
   stehen im Protokoll ebenfalls als `user`, zählen aber nicht als Frage.
3. Die Tagesgrenze muss in **Ortszeit** gezogen werden. Wer das UTC-Datum mit einer lokal angezeigten
   Uhrzeit vergleicht, bekommt zwischen 22 und 24 Uhr ein falsches „heute".

```python
#!/usr/bin/env python3
"""Kostenzeile für Claude Code: liest das Sitzungsprotokoll und gibt eine kurze Zeile aus.

Aufruf:  python3 tools/kosten.py [-v] [--ttl5]
  -v      zusätzlich Summen je Tag und je Modell
  --ttl5  Cache-Schreibpreis für 5-Minuten-Cache statt 1 Stunde (siehe CACHE unten)

Zwei Feinheiten, die leicht falsch gemacht werden:
 1. Jede Nachricht wird EINMAL gezählt (nach message.id entdoppeln) – sonst etwa das Dreifache.
 2. „Letzte Frage" = alle Antworten ab dem letzten ECHTEN Nutzerbeitrag; Werkzeugergebnisse
    stehen im Protokoll ebenfalls als `user`, zählen aber nicht als Frage.
"""
import json, os, glob, collections, datetime, sys

# $ je Million Token: Eingabe, Ausgabe, Cache schreiben (1 h / 5 min), Cache lesen
PREISE = {
    'claude-fable-5-1': (10, 50, 20.0, 12.5, 0.25),
    'claude-opus-5':    (5,  25, 10.0,  6.25, 0.5),
    'claude-sonnet-5':  (2,  10,  4.0,  2.5,  0.2),
    'claude-haiku-4-5': (1,   5,  2.0,  1.25, 0.1),
}
STD = (5, 25, 10.0, 6.25, 0.5)                  # Rückfall für unbekannte Modelle
TZ = 2                                          # Stunden Abstand zu UTC (Sommerzeit); im Winter 1
TTL5 = '--ttl5' in sys.argv                     # Standard: 1-Stunden-Cache, so läuft diese Umgebung

base = os.path.expanduser('~/.claude/projects')
slug = os.getcwd().replace('/', '-')
files = glob.glob(f'{base}/{slug}/*.jsonl') or glob.glob(f'{base}/*/*.jsonl')
f = max(files, key=os.path.getmtime)

seen, last_user = {}, None
for line in open(f):
    try: d = json.loads(line)
    except: continue
    t, m = d.get('type'), d.get('message', {})
    if t == 'user':                             # nur echte Nutzerfragen, keine Werkzeugergebnisse
        c = m.get('content')
        if isinstance(c, str) or (isinstance(c, list)
                and any(b.get('type') == 'text' for b in c if isinstance(b, dict))
                and not any(b.get('type') == 'tool_result' for b in c if isinstance(b, dict))):
            last_user = d.get('timestamp')
    if t == 'assistant' and m.get('usage'):     # je Nachricht nur die letzte Fassung zählen
        seen[m.get('id') or d.get('uuid')] = (d.get('timestamp', ''), m.get('model'), m['usage'])

def cost(model, u):
    p = PREISE.get(model, STD)
    cw = p[3] if TTL5 else p[2]
    return ((u.get('input_tokens', 0) or 0) * p[0]
            + (u.get('output_tokens', 0) or 0) * p[1]
            + (u.get('cache_creation_input_tokens', 0) or 0) * cw
            + (u.get('cache_read_input_tokens', 0) or 0) * p[4]) / 1e6

jetzt = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=TZ)
heute_lokal = jetzt.strftime('%Y-%m-%d')
def lokal(ts):
    try: return (datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
                 + datetime.timedelta(hours=TZ)).strftime('%Y-%m-%d')
    except: return ''

tot   = sum(cost(mo, u) for _, mo, u in seen.values())
heute = sum(cost(mo, u) for ts, mo, u in seen.values() if lokal(ts) == heute_lokal)
frage = sum(cost(mo, u) for ts, mo, u in seen.values() if last_user and ts >= last_user)
de = lambda x: f'{x:.2f}'.replace('.', ',')
print(f"<sub>{jetzt.strftime('%d.%m. %H:%M')} Uhr · Frage {de(frage)} · heute {de(heute)} · ges. {de(tot)} $</sub>")

if '-v' in sys.argv:
    days, mods = collections.Counter(), collections.Counter()
    for ts, mo, u in seen.values():
        days[lokal(ts)] += cost(mo, u); mods[mo] += cost(mo, u)
    print('Tage:   ', {d: round(c, 2) for d, c in sorted(days.items())})
    print('Modelle:', {m: round(c, 2) for m, c in mods.items()})
```

## Grenzen

- Die Zeile entsteht, **bevor** die Antwort geschrieben ist. Die Token der Antwort selbst fehlen
  also und tauchen erst in der nächsten Zeile auf. Bei „Frage" sind das 10 bis 50 Cent.
- Nur diese eine Sitzung wird gezählt. Andere Chats zum selben Projekt stehen in eigenen Protokollen.
- Zeitzone steht fest auf UTC+2. Im Winter auf 1 ändern.
- Bilder oder andere Dienste (z. B. RouteLLM/Abacus.AI) rechnet das Skript nicht mit. Wer so etwas
  nutzt, nennt den Betrag zusätzlich im Text.
