import json
from pathlib import Path
ROOT=Path(r'C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map')
p=ROOT/'public'/'cms'/'articles'/'cms-f613cf8b-7c84-4cc5-94cc-83a7fdac3483.json'
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

for path,text in walk(data):
    if not isinstance(text,str):
        continue
    try:
        r=text.encode('cp1251').decode('utf-8')
    except Exception:
        continue
    if r!=text and 'title' in path:
        pass
    if r != text and len(text) < 400:
        print(path)
        print('SRC:',text[:120])
        print('REC:',r[:120])
        print('---')
        break
