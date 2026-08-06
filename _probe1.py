import json
from pathlib import Path
ROOT=Path(r'C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map')
p=ROOT/'public'/'articles'/'page--article--nobel--prize--13.json'
data=json.loads(p.read_text(encoding='utf-8'))


def walk(o,p=''):
    if isinstance(o, dict):
        for k,v in o.items():
            yield from walk(v, f"{p}.{k}" if p else str(k))
    elif isinstance(o,list):
        for i,v in enumerate(o):
            yield from walk(v, f"{p}[{i}]")
    elif isinstance(o,str):
        yield p,o

def rec(s):
    try:
        return s.encode('cp1251').decode('utf-8')
    except Exception:
        return None

for path,text in walk(data):
    if not isinstance(text,str):
        continue
    r=rec(text)
    if r:
        print(path, len(text), len(r), text[:60], '=>', r[:60])
        break
