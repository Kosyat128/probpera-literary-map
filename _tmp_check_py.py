import json
from pathlib import Path
from collections import Counter

ROOT = Path('.')

def walk(obj,path=''):
    if isinstance(obj, dict):
        for k,v in obj.items():
            yield from walk(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i,v in enumerate(obj):
            yield from walk(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path,obj


def maybe_mojibake(s):
    # high-bit extended chars excluding typical curly quotes
    ex = [ord(c) for c in s if 0xC0 <= ord(c) <= 0xFF]
    if len(ex) < 2:
        return None
    if len(ex) / max(1,len(s)) < 0.05:
        return None
    if not any(0xD0 <= o <= 0xD7 for o in ex):
        return None
    # skip already-valid markdown-like punctuation « »
    if sum(1 for c in s if c in '«»„“‚‘') >= 2 and len(ex)/len(s) < 0.15:
        return None
    try:
        fixed = s.encode('latin1').decode('utf-8')
    except Exception:
        try:
            fixed = s.encode('cp1251').decode('utf-8')
        except Exception:
            return None
    # Keep when output looks substantially different and contains Cyrillic letters
    if fixed == s:
        return None
    cyr = sum(1 for c in fixed if 0x0400 <= ord(c) <= 0x04FF)
    if cyr < 1:
        return None
    return fixed

files = list((ROOT/'public/cms/articles').glob('cms-*.json'))
files += [ROOT/'public/cms/published-articles.json', ROOT/'public/cms/published-content.json', ROOT/'src/data/articles/catalog.generated.ts']

found = 0
for p in files:
    if not p.exists():
        continue
    txt = p.read_text(encoding='utf-8')
    if p.suffix == '.ts':
        # crude json extraction
        data_start = txt.find('=')
        data_start = txt.find('[', data_start+1)
        data_end = txt.rfind(']')
        payload = txt[data_start:data_end+1]
    else:
        payload = txt
    try:
        if p.suffix == '.ts':
            data = json.loads(payload)
        else:
            data = json.loads(payload)
    except Exception:
        # fallback simple line scan
        continue

    for path, s in walk(data):
        fixed = maybe_mojibake(s)
        if fixed:
            found += 1
            print(p.name, path)
            print('orig:', s[:90])
            print('fix :', fixed[:90])
            print('---')
            if found > 80:
                raise SystemExit
print('found', found)
