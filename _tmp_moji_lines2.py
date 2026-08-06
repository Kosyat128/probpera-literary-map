import re
from pathlib import Path

ROOT = Path(r"C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")
files = [
    ROOT / 'public/articles/index.json',
    ROOT / 'public/articles/page--words--3.json',
    ROOT / 'public/cms/articles/cms-5025240c-26c0-44fb-9a8a-be0805b9a07d.json',
    ROOT / 'public/cms/articles/cms-ffd09d2f-e6bc-4844-b71c-3c292c1c69af.json',
    ROOT / 'public/cms/published-articles.json',
    ROOT / 'public/cms/published-content.json',
    ROOT / 'src/data/articles/cms.generated.ts',
    ROOT / 'src/data/countries/generated/writers.generated.json',
    ROOT / 'src/data/countries/generated/books.generated.json',
]
patterns = [re.compile(r'Ð|Â|Ã|вЂ|в…|в№|СЃ|СЂ|С‹|СЏ|СЉ|Р°|Рѕ|Рї|В ')]

for p in files:
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8', errors='replace')
    print('--- ' + str(p) + ' ---')
    found = False
    for i,line in enumerate(text.splitlines(),1):
        if patterns[0].search(line):
            found = True
            esc = line.encode('unicode_escape').decode('ascii')
            print(f"{i}: {esc[:240]}")
    if not found:
        print('NO MATCH')
