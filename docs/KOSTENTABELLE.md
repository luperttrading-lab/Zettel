# Kostentabelle unter jeder Antwort (Claude Code)

Zweite Bauform neben der einzeiligen `docs/KOSTENZEILE.md`. **Nur eine von beiden verwenden.**
Diese hier zeigt zusätzlich eine Spalte für RouteLLM (Abacus.AI), also für Bildgenerierung und
andere fremde Dienste, die auf einer eigenen Rechnung landen.

## Wenn du diese Datei in einem Chat bekommst

Das ist ein **Auftrag, kein Hintergrundwissen**. Setze ihn sofort um, ohne Rückfrage:

1. Das Skript unten als `tools/kostentabelle.py` im Arbeitsverzeichnis anlegen.
2. Einmal `python3 tools/kostentabelle.py` ausführen und prüfen, dass eine Tabelle herauskommt.
3. Diese Ausgabe **wörtlich** als letzten Block deiner Antwort setzen.
4. Ab jetzt **bei jeder weiteren Antwort** genauso: erst Skript, dann Ausgabe anhängen. Ohne Ausnahme.
5. Den Ablauf zusätzlich in die `CLAUDE.md` des Projekts schreiben, damit er die nächste Sitzung überlebt.

Nicht umformatieren, nicht schätzen, nichts hinter die Tabelle setzen. Läuft das Skript nicht,
das offen sagen statt eine Zahl zu erfinden.

## So muss es aussehen

Datum und Uhrzeit stehen **in der Kopfzeile links**, dort wo sonst die Spaltenüberschrift stünde:

```
| 08.09. 19:26 | Claude | RouteLLM |
|---|---:|---:|
| diese Frage | 0,30 $ | 0,0 ct |
| heute | 29,65 $ | 0,0 ct |
| dieser Chat | 299,35 $ | 0,0 ct |
```

Gerendert:

| 08.09. 19:26 | Claude | RouteLLM |
|---|---:|---:|
| diese Frage | 0,30 $ | 0,0 ct |
| heute | 29,65 $ | 0,0 ct |
| dieser Chat | 299,35 $ | 0,0 ct |

Regeln:
- Zahlen rechtsbündig, deutsches Format mit Komma.
- Claude in Dollar, RouteLLM in Cent, weil dort meist Kleinbeträge stehen.
- Ortszeit, nicht UTC. Kein Jahr, das spart Breite auf dem Telefon.
- Drei Zeilen, immer dieselben Beschriftungen: diese Frage, heute, dieser Chat.

**Platzbedarf:** Die Tabelle braucht rund viermal so viel Höhe wie die einzeilige Fassung.
Wer es knapp will, nimmt `docs/KOSTENZEILE.md`. Wer RouteLLM getrennt sehen will, diese hier.

## Die zweite Spalte füttern

Das Skript kann fremde Dienste nicht messen. Es liest sie aus `tools/routellm.json`:

```json
[
  {"ts": "2026-09-08T17:20:00Z", "usd": 0.34, "was": "gpt_image2 Panda"},
  {"ts": "2026-09-08T17:41:00Z", "usd": 0.38, "was": "nano_banana_pro Frosch"}
]
```

Nach **jedem** erzeugten Bild einen Eintrag anhängen, Zeitstempel in UTC. Fehlt die Datei, steht
in der Spalte 0,0 ct. Den Dollarbetrag entnimmst du der Antwort der API oder dem Credits-Verbrauch
im Web; wenn beides fehlt, lieber nichts eintragen als raten.

## Preise, Stand September 2026

$ je Million Token:

| Modell | Eingabe | Ausgabe | Cache schreiben 1 h | Cache schreiben 5 min | Cache lesen |
|---|---:|---:|---:|---:|---:|
| Claude Fable 5.1 | 10,00 | 50,00 | 20,00 | 12,50 | 0,25 |
| Claude Opus 5 | 5,00 | 25,00 | 10,00 | 6,25 | 0,50 |
| Claude Sonnet 5 | 2,00 | 10,00 | 4,00 | 2,50 | 0,20 |
| Claude Haiku 4.5 | 1,00 | 5,00 | 2,00 | 1,25 | 0,10 |

**Zwei Cache-Preise, das ist die wichtigste Stellschraube.** Claude Code in der Cloud-Umgebung läuft
mit dem **Stunden-Cache**, dessen Schreibpreis doppelt so hoch ist. Deshalb ist das im Skript der
Standard; `--ttl5` rechnet mit dem Fünf-Minuten-Preis. Für einen langen Chat sind das schnell 70 $
Unterschied. Wer eine Zahl anzweifelt, prüft zuerst das hier.

Jede Nachricht wird mit dem Preis **ihres eigenen Modells** bewertet. Bei einem Modellwechsel mitten
im Chat darf nicht alles mit einem Preis gerechnet werden. Nach jedem Wechsel und nach jeder Pause,
die länger ist als die Cache-Gültigkeit, kostet die nächste Frage 3 bis 10 $, weil der gesamte
Verlauf neu geschrieben wird. Sonst liegt eine Frage bei 10 bis 30 Cent.

Das sind API-Listenpreise, keine Rechnung. Bei einem Abo zahlt man den Pauschalpreis.

## Das Skript

Ablegen als `tools/kostentabelle.py`. `-v` gibt zusätzlich Summen je Tag und Modell aus,
`--ttl5` rechnet mit dem Fünf-Minuten-Cachepreis.

Drei Feinheiten, die leicht falsch gemacht werden:

1. Jede Nachricht **einmal** zählen, nach `message.id`. Im Protokoll steht dieselbe Nachricht beim
   Streamen mehrfach; ohne Entdopplung kommt etwa das Dreifache heraus.
2. „diese Frage" heißt: alle Antworten ab dem letzten **echten** Nutzerbeitrag. Werkzeugergebnisse
   stehen im Protokoll ebenfalls als `user`, zählen aber nicht als Frage.
3. Die Tagesgrenze in **Ortszeit** ziehen. Wer das UTC-Datum mit einer lokal angezeigten Uhrzeit
   vergleicht, bekommt zwischen 22 und 24 Uhr ein falsches „heute".

```python
#!/usr/bin/env python3
"""Kostentabelle für Claude Code: Claude neben RouteLLM, Datum und Uhrzeit in der Kopfzeile."""
import json, os, glob, collections, datetime, sys

# $ je Million Token: Eingabe, Ausgabe, Cache schreiben (1 h / 5 min), Cache lesen
PREISE = {
    'claude-fable-5-1': (10, 50, 20.0, 12.5, 0.25),
    'claude-opus-5':    (5,  25, 10.0,  6.25, 0.5),
    'claude-sonnet-5':  (2,  10,  4.0,  2.5,  0.2),
    'claude-haiku-4-5': (1,   5,  2.0,  1.25, 0.1),
}
STD  = (5, 25, 10.0, 6.25, 0.5)                 # Rückfall für unbekannte Modelle
TZ   = 2                                        # Stunden Abstand zu UTC (Sommerzeit); im Winter 1
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
def lokal(ts):                                  # Tagesgrenze in Ortszeit, nicht in UTC
    try: return (datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
                 + datetime.timedelta(hours=TZ)).strftime('%Y-%m-%d')
    except: return ''

c_ges   = sum(cost(mo, u) for _, mo, u in seen.values())
c_heute = sum(cost(mo, u) for ts, mo, u in seen.values() if lokal(ts) == heute_lokal)
c_frage = sum(cost(mo, u) for ts, mo, u in seen.values() if last_user and ts >= last_user)

# Zweite Spalte: selbst gepflegte RouteLLM-Ausgaben (Bildgenerierung u. Ä.)
r_ges = r_heute = r_frage = 0.0
try:
    for e in json.load(open(os.path.join('tools', 'routellm.json'))):
        usd, ts = float(e.get('usd', 0)), e.get('ts', '')
        r_ges += usd
        if lokal(ts) == heute_lokal: r_heute += usd
        if last_user and ts >= last_user: r_frage += usd
except Exception: pass

de = lambda x: f'{x:.2f}'.replace('.', ',')
ct = lambda x: f'{x*100:.1f}'.replace('.', ',')
print(f"| {jetzt.strftime('%d.%m. %H:%M')} | Claude | RouteLLM |")
print('|---|---:|---:|')
print(f'| diese Frage | {de(c_frage)} $ | {ct(r_frage)} ct |')
print(f'| heute | {de(c_heute)} $ | {ct(r_heute)} ct |')
print(f'| dieser Chat | {de(c_ges)} $ | {ct(r_ges)} ct |')

if '-v' in sys.argv:
    days, mods = collections.Counter(), collections.Counter()
    for ts, mo, u in seen.values():
        days[lokal(ts)] += cost(mo, u); mods[mo] += cost(mo, u)
    print()
    print('Tage:   ', {d: round(c, 2) for d, c in sorted(days.items())})
    print('Modelle:', {m: round(c, 2) for m, c in mods.items()})
```

## Grenzen

- Die Tabelle entsteht, **bevor** die Antwort geschrieben ist. Die Token der Antwort selbst fehlen
  und tauchen erst beim nächsten Mal auf. Bei „diese Frage" sind das 10 bis 50 Cent.
- Nur diese eine Sitzung wird gezählt. Andere Chats zum selben Projekt stehen in eigenen Protokollen.
- Zeitzone fest auf UTC+2. Im Winter auf 1 ändern.
- Die RouteLLM-Spalte ist nur so gut wie `tools/routellm.json` gepflegt wird.
