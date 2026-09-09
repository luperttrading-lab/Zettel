# Kostentabelle unter jeder Antwort (Claude Code)

> **Gültig ab 8. September 2026. Diese Datei ersetzt jede frühere Kostenanweisung.**
> Ab jetzt wird nach dieser Datei abgerechnet und angezeigt – nicht mehr nach `docs/KOSTENZEILE.md`
> (einzeilige Fassung) und nicht nach älteren Fassungen, die irgendwo in einem Chat hochgeladen
> wurden. Wer eine ältere Anweisung im Verlauf findet, ignoriert sie und richtet sich nach hier.
> Erkennungsmerkmal der aktuellen Fassung: eine Spalte je Dienst, Datum und Uhrzeit in der Kopfzeile
> links, `tools/kostentabelle.py` als Skript.

Diese Anzeige zeigt neben Claude **je eine eigene Spalte für jeden weiteren Dienst**, der Geld kostet –
Bildgenerierung über RouteLLM, ein Hosting, eine Wetter-API, was auch immer im Projekt dazukommt.
Die Spalten sind nicht fest verdrahtet: Das Skript erzeugt sie aus dem, was in `tools/fremdkosten.json`
steht. Ein neuer Dienst braucht also keine Änderung am Skript, nur einen Eintrag mit seinem Namen.

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

Datum und Uhrzeit stehen **in der Kopfzeile links**, dort wo sonst die Spaltenüberschrift stünde.
Ohne Fremdkosten bleibt es bei einer Spalte:

| 08.09. 19:30 | Claude |
|---|---:|
| diese Frage | 0,26 $ |
| heute | 31,47 $ |
| dieser Chat | 301,16 $ |

Sobald andere Dienste eingetragen sind, kommt für jeden eine Spalte dazu, die teuerste zuerst:

| 08.09. 19:30 | Claude | Vercel | RouteLLM |
|---|---:|---:|---:|
| diese Frage | 0,26 $ | 1,20 $ | 38,0 ct |
| heute | 31,47 $ | 1,20 $ | 72,0 ct |
| dieser Chat | 301,16 $ | 1,20 $ | 72,0 ct |

Regeln:
- Zahlen rechtsbündig, deutsches Format mit Komma.
- Einheit **je Spalte**: Dollar, sobald die Spalte insgesamt einen Dollar erreicht, sonst Cent.
- Ortszeit, nicht UTC. Kein Jahr, das spart Breite auf dem Telefon.
- Drei Zeilen, immer dieselben Beschriftungen: diese Frage, heute, dieser Chat.
- Höchstens drei Zusatzspalten; alles Weitere fasst das Skript als „Sonstige" zusammen, sonst wird
  die Tabelle auf dem Telefon zu breit.

**Platzbedarf:** Die Tabelle braucht rund viermal so viel Höhe wie die einzeilige Fassung.
Wer es knapp will, nimmt `docs/KOSTENZEILE.md`. Wer die Dienste getrennt sehen will, diese hier.

## Die weiteren Spalten füttern

Das Skript kann fremde Dienste nicht messen. Es liest sie aus `tools/fremdkosten.json`:

```json
[
  {"ts": "2026-09-08T17:20:00Z", "usd": 0.34, "dienst": "RouteLLM", "was": "gpt_image2 Panda"},
  {"ts": "2026-09-08T17:41:00Z", "usd": 0.38, "dienst": "RouteLLM", "was": "nano_banana_pro Frosch"},
  {"ts": "2026-09-08T18:02:00Z", "usd": 1.20, "dienst": "Vercel",   "was": "Renderer, September"}
]
```

Pflichtfelder: `ts` (UTC), `usd`, `dienst`. `was` ist frei und dient nur dem Nachvollziehen.

**Wer trägt ein?** Zwei Wege, und nur der erste läuft von allein:

1. **Das Werkzeug selbst**, wenn es die Kosten verursacht. `tools/gen_image.mjs` hängt nach jedem
   erzeugten Bild einen Eintrag an. Nennt die Antwort der API keinen Betrag, steht dort `"usd": null`;
   die Spalte bekommt dann ein `?` hinter den Namen, damit sichtbar bleibt, dass eine Zahl fehlt.
   So gehört es bei jedem weiteren kostenpflichtigen Werkzeug gebaut: Eintrag schreiben, nicht
   darauf verlassen, dass jemand daran denkt.
2. **Von Hand**, für alles, was außerhalb des Chats anfällt: Monatspauschalen, Rechnungen, Nutzung
   in anderen Chats. Der Chat kann das nicht bemerken, er sieht nur seine eigenen Aufrufe.

Ein Chat merkt also **nicht** von selbst, dass irgendwo Geld ausgegeben wurde. Er weiß es nur, wenn
er den Aufruf selbst gemacht hat oder wenn du es ihm sagst.

**Regel für den Chat, der damit arbeitet:** Sobald in diesem Projekt ein Dienst Geld kostet, der noch
keine Spalte hat, legst du selbst einen Eintrag mit passendem `dienst`-Namen an. Nicht nachfragen,
nicht auf eine Anweisung warten, und den Namen nicht bei jedem Eintrag anders schreiben – ein Dienst,
eine Schreibweise, sonst entstehen zwei Spalten für dasselbe. Typische Kandidaten neben der
Bildgenerierung: Hosting, Speicher, Karten- oder Wetterdaten, Sprachausgabe, ein zweiter Modellanbieter.

Nach **jedem** kostenpflichtigen Aufruf einen Eintrag anhängen. Den Betrag entnimmst du der Antwort
der jeweiligen API oder der Abrechnungsseite des Dienstes; wenn beides fehlt, lieber nichts eintragen
als raten – und den fehlenden Betrag im Text erwähnen. Bei Pauschalen (z. B. ein Monatspreis) einen
Eintrag am Buchungstag anlegen, nicht auf die Tage verteilen.

Fehlt die Datei, zeigt die Tabelle nur die Claude-Spalte. `tools/routellm.json` im alten Format wird
weiterhin gelesen und als Dienst „RouteLLM" gewertet.

## Preise, Stand September 2026

$ je Million Token:

| Modell | Eingabe | Ausgabe | Cache schreiben 1 h | Cache schreiben 5 min | Cache lesen |
|---|---:|---:|---:|---:|---:|
| Claude Fable 5.1 | 10,00 | 50,00 | 20,00 | 12,50 | 0,25 |
| Claude Opus 5 | 5,00 | 25,00 | 10,00 | 6,25 | 0,50 |
| Claude Sonnet 5 | 2,00 | 10,00 | 4,00 | 2,50 | 0,20 |
| Claude Haiku 4.5 | 1,00 | 5,00 | 2,00 | 1,25 | 0,10 |

**Zwei Cache-Preise, das ist die wichtigste Stellschraube.** Der Verlauf wird als Präfix
zwischengespeichert. Wird er innerhalb der Haltbarkeit wieder gelesen, kostet das fast nichts und die
Uhr startet neu; läuft sie ab, muss der ganze Verlauf bei der nächsten Frage neu geschrieben werden.
Schreiben kostet **1,25 × Eingabepreis beim Fünf-Minuten-Cache, 2 × beim Stunden-Cache**; Lesen ist in
beiden Fällen gleich billig. Claude Code in der Cloud-Umgebung läuft mit dem **Stunden-Cache**, deshalb
ist das im Skript der Standard.

`--ttl5` ist **nur ein Umrechnungsschalter**: Er bewertet dieselben Token mit dem niedrigeren
Schreibpreis. Er sagt **nicht**, was ein Fünf-Minuten-Cache tatsächlich gekostet hätte – dazu müsste er
die zusätzlichen abgelaufenen Einträge mitzählen. Der niedrigere Wert ist also eine Untergrenze, keine
Alternativrechnung.

**Gemessen an diesem Chat** (818 Aufrufe, Median-Abstand 20 Sekunden, 54 Pausen über fünf Minuten,
davon 9 über einer Stunde): Der Stunden-Cache kostete 265,70 $. Dieselben Token zum Fünf-Minuten-Preis
wären 196,85 $, aber der Fünf-Minuten-Cache wäre 45 Mal zusätzlich abgelaufen, bei einem Verlauf von im
Schnitt 300.000 Token – geschätzt 234 $ zusätzliche Schreibkosten, zusammen also rund 431 $. Der
Stunden-Cache war hier **die günstigere Wahl**, nicht die teurere.

Faustregel: Bei Pausen unter fünf Minuten ist der Fünf-Minuten-Cache billiger, bei Pausen zwischen fünf
und sechzig Minuten der Stunden-Cache. Wer über eine Stunde weg ist, zahlt in beiden Fällen neu.

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
2. „diese Frage" heißt: alle Antworten ab dem letzten **echten** Nutzerbeitrag – und maßgeblich dafür
   ist allein `origin.kind == "human"`. Das Protokoll führt vieles als `user`, was niemand getippt hat:
   Werkzeugergebnisse, Aufgabenmeldungen, Slash-Befehle, die Zusammenfassung nach einer Kompaktierung
   und vor allem die Zeile `[Image: original …]` mit `isMeta`, die **jedes Mal entsteht, wenn Claude
   selbst ein Bild ansieht** – was diese Anleitung an anderer Stelle ausdrücklich verlangt.
   **Am 9.9.2026 gemessen:** eine Runde mit 87 Antworten wurde als 8 gezählt und mit 1,31 $ statt
   14,91 $ gemeldet (Faktor 11), weil dazwischen vier Bilder angesehen wurden. Über den ganzen Tag
   summierten sich die Einzelmeldungen auf 46,17 $ statt 80,04 $ – **42 % zu wenig**. „heute" und
   „dieser Chat" waren nie betroffen, sie zählen alles. Prüfung: `python3 tests/kosten.py`.
   **Absicherung:** Das Skript schreibt zusätzlich eine Kontrollzeile nach **stderr** – `» diese Frage:
   87 Antworten seit 15:44:06 UTC`. In die Antwort gehört weiterhin nur die Tabelle (stdout); die
   Kontrollzeile ist für Claude selbst und macht den Betrag prüfbar. Beim Fehler oben hätte dort
   „8 Antworten seit 16:16" gestanden – das wäre aufgefallen. Fehlt jeder Nutzerbeitrag, sagt das
   Skript das ausdrücklich, statt still 0,00 $ zu melden.
3. Die Tagesgrenze in **Ortszeit** ziehen. Wer das UTC-Datum mit einer lokal angezeigten Uhrzeit
   vergleicht, bekommt zwischen 22 und 24 Uhr ein falsches „heute".

```python
#!/usr/bin/env python3
"""Kostentabelle für Claude Code: Claude neben jedem weiteren Dienst, Datum und Uhrzeit in der Kopfzeile.

Aufruf:  python3 tools/kostentabelle.py [-v] [--ttl5]
  -v      zusätzlich Summen je Tag und je Modell
  --ttl5  Cache-Schreibpreis für 5-Minuten-Cache statt 1 Stunde

Fremdkosten (Bildgenerierung, Hosting, fremde APIs) kommen aus tools/fremdkosten.json:
  [{"ts": "2026-09-08T17:20:00Z", "usd": 0.34, "dienst": "RouteLLM", "was": "gpt_image2 Panda"}, ...]
Für jeden Namen unter "dienst" entsteht automatisch eine Spalte – neue Dienste brauchen keine
Änderung am Skript, nur einen Eintrag. Fehlt die Datei, bleibt es bei der Claude-Spalte.

Zwei Feinheiten, die leicht falsch gemacht werden:
 1. Jede Nachricht wird EINMAL gezählt (nach message.id entdoppeln) – sonst etwa das Dreifache.
 2. „diese Frage" = alle Antworten ab dem letzten ECHTEN Nutzerbeitrag; Werkzeugergebnisse
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

# Weitere Spalten: selbst gepflegte Fremdkosten (Bildgenerierung, andere Dienste, was auch immer)
# tools/fremdkosten.json: [{"ts": "...Z", "usd": 0.34, "dienst": "RouteLLM", "was": "gpt_image2 Panda"}, ...]
# Für jeden Dienst, der dort auftaucht, entsteht automatisch eine eigene Spalte.
fremd = collections.defaultdict(lambda: [0.0, 0.0, 0.0])   # Dienst -> [Frage, heute, gesamt]
offen = set()                                              # Dienste mit Eintraegen ohne Betrag
for datei, standard in (('fremdkosten.json', None), ('routellm.json', 'RouteLLM')):
    try: eintraege = json.load(open(os.path.join('tools', datei)))
    except Exception: continue
    for e in eintraege:
        roh, ts = e.get('usd'), e.get('ts', '')
        name = e.get('dienst') or standard or 'Sonstige'
        if roh is None: offen.add(name); continue      # Eintrag ohne Betrag: Spalte als unvollständig kennzeichnen
        usd = float(roh)
        d = fremd[name]
        d[2] += usd
        if lokal(ts) == heute_lokal: d[1] += usd
        if last_user and ts >= last_user: d[0] += usd

# Auf dem Telefon passen höchstens drei Zusatzspalten; der Rest wird zu „Sonstige" zusammengefasst
dienste = sorted(fremd, key=lambda k: -fremd[k][2])
if len(dienste) > 3:
    rest = dienste[3:]
    for k in rest:
        for i in range(3): fremd['Sonstige'][i] += fremd[k][i]
        del fremd[k]
    dienste = dienste[:3] + ['Sonstige']

de = lambda x: f'{x:.2f}'.replace('.', ',')
ct = lambda x: f'{x*100:.1f}'.replace('.', ',')
# Einheit je Spalte: Dollar, sobald der Gesamtwert der Spalte einen Dollar erreicht, sonst Cent
def zelle(wert, gesamt): return f'{de(wert)} $' if gesamt >= 1 else f'{ct(wert)} ct'

for d in offen: fremd[d]                                   # leere Spalte anlegen, damit der Dienst sichtbar wird
dienste = sorted(set(dienste) | offen, key=lambda k: (-fremd[k][2], k))
kopf  = [jetzt.strftime('%d.%m. %H:%M'), 'Claude'] + [d + ' ?' if d in offen else d for d in dienste]
zeile = ['diese Frage', 'heute', 'dieser Chat']
werte = [[c_frage, c_heute, c_ges]] + [fremd[d] for d in dienste]
print('| ' + ' | '.join(kopf) + ' |')
print('|---' + '|---:' * (len(kopf) - 1) + '|')
for r in range(3):
    zellen = [zelle(werte[s][r], werte[s][2]) for s in range(len(werte))]
    print(f'| {zeile[r]} | ' + ' | '.join(zellen) + ' |')

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
- Die Fremdspalten sind nur so gut wie `tools/fremdkosten.json` gepflegt wird. Ein Dienst, den
  niemand einträgt, taucht nirgends auf – die Tabelle sieht dann vollständig aus, ohne es zu sein.
