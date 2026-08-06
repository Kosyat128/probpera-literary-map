import re
from pathlib import Path

root = Path(r"C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")
patterns = [
    re.compile(r'[РСВ][\u0080-\u00BF]'),
    re.compile(r'Â|Ã|Ð|Ñ|â|вЂ|в…|в№'),
    re.compile(r'СЂ|Сѓ|В |С‹|СЃ'),
]
paths = list(root.glob('public/articles/*.json'))
paths += list(root.glob('public/cms/articles/*.json'))
paths += list(root.glob('public/cms/*.json'))
paths += [root / 'src/data/articles/cms.generated.ts', root / 'src/data/countries/generated/writers.generated.json', root / 'src/data/countries/generated/books.generated.json']

for p in paths:
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8', errors='replace')
    c = 0
    for pat in patterns:
        c += len(pat.findall(text))
    if c:
        print(f'{p}: {c}')
