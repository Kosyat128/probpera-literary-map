import json
from pathlib import Path
ROOT=Path(r'C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map')
paths = sorted((ROOT/'public'/'articles').glob('*.json')) + sorted((ROOT/'public'/'cms'/'articles').glob('*.json'))

def c(s):
    return sum(1 for ch in s if '\u0400' <= ch <= '\u04FF')

def rec(s):
    try:
        return s.encode('cp1251').decode('utf-8')
    except:
        return None

def walk(o, p=''):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from walk(v, f"{p}.{k}" if p else str(k))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, f"{p}[{i}]")
    elif isinstance(o, str):
        yield p, o

found = False
for fp in paths:
    data = json.loads(fp.read_text(encoding='utf-8'))
    for path, text in walk(data):
        if not isinstance(text, str) or not text.strip():
            continue
        r = rec(text)
        if r and r != text and c(r) > c(text)+2:
            print(fp.name, path)
            print('  SRC:', text[:140])
            print('  REC:', r[:140])
            found = True
            raise SystemExit

if not found:
    print('none')
