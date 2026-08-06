import json
from pathlib import Path
ROOT=Path(r'C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map')
paths=sorted((ROOT/'public'/'articles').glob('*.json')) + sorted((ROOT/'public'/'cms'/'articles').glob('*.json'))


def walk(o,p=''):
    if isinstance(o, dict):
        for k,v in o.items():
            yield from walk(v, f"{p}.{k}" if p else str(k))
    elif isinstance(o, list):
        for i,v in enumerate(o):
            yield from walk(v, f"{p}[{i}]")
    elif isinstance(o, str):
        yield p,o

bad=[]
for p in paths:
    data=json.loads(p.read_text(encoding='utf-8'))
    for path,val in walk(data):
        if any(ch in val for ch in ['\u0000','\ufffd']):
            bad.append((p.name,path,val[:200]))
        # control chars except newline/tab
        if any(ord(ch) < 32 and ch not in '\n\r\t' for ch in val):
            bad.append((p.name,path,'ctrl'))

print('bad',len(bad))
for item in bad[:80]:
    print(item)
