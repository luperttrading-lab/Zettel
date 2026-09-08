# Kosten dieser Sitzung: heute (nach Datum) und gesamt, inkl. Unteragenten.
import json, glob, collections, datetime
seen = {}
for f in glob.glob('/root/.claude/projects/-home-user-Zettel/**/*.jsonl', recursive=True):
    for line in open(f, encoding='utf-8'):
        try: o = json.loads(line)
        except: continue
        m = o.get('message') if isinstance(o, dict) else None
        if isinstance(m, dict) and m.get('usage') and m.get('id'):
            seen[m['id']] = (m['usage'], m.get('model'), (o.get('timestamp') or '')[:10])
tag = collections.defaultdict(float)
for u, mo, d in seen.values():
    i, o_, cw, cr = (10, 50, 20, 0.25) if (mo and 'fable' in mo) else (5, 25, 10, 0.5)
    tag[d] += (u.get('input_tokens',0)*i + u.get('output_tokens',0)*o_
               + u.get('cache_creation_input_tokens',0)*cw + u.get('cache_read_input_tokens',0)*cr) / 1e6
heute = tag.get(datetime.date.today().isoformat(), 0.0)
print(f'{heute:.1f} {sum(tag.values()):.1f}')
