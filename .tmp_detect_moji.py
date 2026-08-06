# -*- coding: utf-8 -*-
import json
import pathlib
import re
from collections import defaultdict

files = [
    pathlib.Path('src/data/countries/generated/books.generated.json'),
    pathlib.Path('src/data/countries/generated/writers.generated.json'),
    pathlib.Path('public/cms/articles/cms-ffd09d2f-e6bc-4844-b71c-3c292c1c69af.json'),
    pathlib.Path('public/cms/published-articles.json'),
    pathlib.Path('public/cms/published-content.json'),
]
files.extend(list(pathlib.Path('public/articles').glob('*.json')))
files.extend(list(pathlib.Path('public/cms/articles').glob('cms-*.json')))

sus = defaultdict(list)


def try_fix(v: str):
    try:
        fixed = v.encode('cp1251').decode('utf-8')
    except Exception:
        return None

    if fixed == v:
        return None
    if '\uFFFD' in fixed:
        return None

    if sum(1 for ch in fixed if ('\u0410' <= ch <= '\u044f') or ch in '\u0401\u0451') < 2:
        return None

    if not re.search(r"[\u0420\u0421]", v):
        return None

    return fixed


def walk(obj, path, file_path):
    if isinstance(obj, dict):
        for k, value in obj.items():
            walk(value, f"{path}.{k}" if path else k, file_path)
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            walk(value, f"{path}[{i}]", file_path)
    elif isinstance(obj, str):
        fixed = try_fix(obj)
        if fixed and fixed != obj:
            sus[str(file_path)].append((path, obj, fixed))

for fp in files:
    if not fp.exists():
        continue
    data = json.loads(fp.read_text(encoding='utf-8'))
    walk(data, '', fp)

print('files', len(sus))
print('total', sum(len(v) for v in sus.values()))
for file_path, rows in list(sus.items())[:50]:
    print(file_path, 'count', len(rows))
    for row in rows[:5]:
        p, before, after = row
        print(' ', p)
        print('   BEFORE:', before)
        print('   AFTER :', after)
    if len(rows) > 5:
        print('   ...')
