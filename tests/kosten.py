#!/usr/bin/env python3
"""Prüft tools/kostentabelle.py an einem gebauten Protokoll.

Kern der Prüfung ist der Fehler vom 9.9.2026: Sieht Claude während einer Runde ein Bild an, schreibt
das Protokoll eine `user`-Zeile „[Image: original …]" mit `isMeta`. Die frühere Erkennung hielt sie für
eine neue Nutzerfrage und zählte nur noch den Rest der Runde – gemeldet wurden 1,31 $ statt 14,91 $.

Aufruf aus dem Repo-Verzeichnis:  python3 tests/kosten.py
"""
import json, os, subprocess, sys, tempfile

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fehler = 0

def pruef(name, bedingung, extra=''):
    global fehler
    print(('OK   ' if bedingung else 'FEHL ') + name + (' – ' + extra if extra else ''))
    if not bedingung: fehler += 1

def zeile(**kw):
    return json.dumps(kw)

def antwort(ts, out, cache_read=0):
    return zeile(type='assistant', timestamp=ts, uuid=ts,
                 message={'id': 'm' + ts, 'model': 'claude-opus-5',
                          'usage': {'input_tokens': 0, 'output_tokens': out,
                                    'cache_creation_input_tokens': 0, 'cache_read_input_tokens': cache_read}})

def lauf(zeilen):
    """Skript in einem eigenen HOME laufen lassen, damit es das gebaute Protokoll liest."""
    with tempfile.TemporaryDirectory() as tmp:
        d = os.path.join(tmp, '.claude', 'projects', 'p')
        os.makedirs(d)
        with open(os.path.join(d, 's.jsonl'), 'w') as fh: fh.write('\n'.join(zeilen) + '\n')
        umg = dict(os.environ, HOME=tmp)
        r = subprocess.run([sys.executable, os.path.join(WURZEL, 'tools', 'kostentabelle.py')],
                           capture_output=True, text=True, cwd=tmp, env=umg)
        if r.returncode: raise SystemExit('Skript brach ab:\n' + r.stderr)
        return r.stdout, r.stderr

def frage_usd(paar):
    ausgabe = paar[0] if isinstance(paar, tuple) else paar
    for z in ausgabe.splitlines():
        if z.startswith('| diese Frage'):
            return float(z.split('|')[2].strip().replace(' $', '').replace(',', '.'))
    raise SystemExit('Zeile „diese Frage" fehlt:\n' + ausgabe)

# Opus 5: 25 $ je Million Ausgabe-Token → 40 000 Token = 1,00 $
MENSCH = {'kind': 'human'}
T = '2026-09-09T1%d:00:00.000Z'

# 1) Runde mit einem angesehenen Bild in der Mitte: beide Antworten zählen zur Frage
mit_bild = [
    zeile(type='user', timestamp=T % 0, origin=MENSCH, message={'role': 'user', 'content': 'erste Frage'}),
    antwort(T % 1, 40000),
    zeile(type='user', timestamp=T % 2, origin=MENSCH, message={'role': 'user', 'content': 'zweite Frage'}),
    antwort(T % 3, 40000),
    zeile(type='user', timestamp=T % 4, isMeta=True, turnCompanion=True,
          message={'role': 'user', 'content': '[Image: original 1290x2700, displayed at 956x2000.]'}),
    antwort(T % 5, 40000),
]
u = frage_usd(lauf(mit_bild))
pruef('Bild in der Runde beendet die Frage nicht', abs(u - 2.00) < 0.01, f'{u} $ statt 2,00 $')

# 2) Zum Vergleich: ohne das Bild derselbe Betrag
ohne_bild = [z for z in mit_bild if 'isMeta' not in z]
pruef('gleicher Betrag ohne die Bildzeile', abs(frage_usd(lauf(ohne_bild)) - 2.00) < 0.01)

# 3) Werkzeugergebnisse, Aufgabenmeldungen, Slash-Befehle und Kompaktierung zählen ebenfalls nicht
stoerer = mit_bild[:4] + [
    zeile(type='user', timestamp=T % 4, message={'role': 'user', 'content': [
        {'type': 'tool_result', 'content': 'ok'}]}),
    zeile(type='user', timestamp=T % 5, isCompactSummary=True, isVisibleInTranscriptOnly=True,
          message={'role': 'user', 'content': 'This session is being continued …'}),
    zeile(type='user', timestamp=T % 6, message={'role': 'user',
          'content': '<task-notification><task-id>x</task-id></task-notification>'}),
    antwort(T % 7, 40000),
]
u = frage_usd(lauf(stoerer))
pruef('Werkzeug, Kompaktierung und Aufgabenmeldung beenden die Frage nicht', abs(u - 2.00) < 0.01, f'{u} $ statt 2,00 $')

# 4) Ersatzregel: Protokoll ohne `origin` – dann darf „diese Frage" nicht stillschweigend 0 sein
ohne_origin = [
    zeile(type='user', timestamp=T % 0, message={'role': 'user', 'content': 'alte Fassung'}),
    antwort(T % 1, 40000),
    zeile(type='user', timestamp=T % 2, isMeta=True, message={'role': 'user', 'content': '[Image: …]'}),
    antwort(T % 3, 40000),
]
u = frage_usd(lauf(ohne_origin))
pruef('ohne origin greift die Ersatzregel', abs(u - 2.00) < 0.01, f'{u} $ statt 2,00 $')

# 5) Jede Nachricht zählt einmal, auch wenn sie mehrfach im Protokoll steht
doppelt = mit_bild + [mit_bild[-1]]
pruef('doppelte Fassung derselben Nachricht zählt einmal',
      abs(frage_usd(lauf(doppelt)) - frage_usd(lauf(mit_bild))) < 0.001)

# 6) Die Tabelle bleibt sauber: die Kontrollzeile geht nach stderr, nicht in die Antwort
aus, err = lauf(mit_bild)
pruef('Tabelle enthält nur Tabellenzeilen', all(z.startswith('|') for z in aus.strip().splitlines()),
      repr(aus))
pruef('Kontrollzeile nennt Zahl und Beginn der Runde', '»' in err and 'Antworten seit' in err, repr(err))

# 7) Fehlt jeder Nutzerbeitrag, sagt das Skript das – statt still 0,00 $ zu melden
nur_antwort = [antwort(T % 1, 40000)]
aus, err = lauf(nur_antwort)
pruef('ohne Nutzerbeitrag warnt das Skript', 'KEIN Nutzerbeitrag' in err, repr(err))

print(f'{fehler} Prüfung(en) fehlgeschlagen' if fehler else 'alle Prüfungen bestanden')
sys.exit(1 if fehler else 0)
