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

s = re.compile(r'.{0,60}(Ð|Â|Ã|вЂ|в…|в№|СЃ|СЂ|С‹|СЏ|СЉ|СЏ|Р°|Рѕ|Рѕ|Рї|Рі|Р»|В ).{0,80}')

for p in files:
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8', errors='replace')
    matches = s.findall(text)
    if not matches:
        print(f'--- {p.name} ---\nNO MATCH')
        continue
    print(f'--- {p} ---')
    lines = text.splitlines()
    for i,line in enumerate(lines, 1):
        if any(ch in line for ch in ('Ð','Â','Ã','в','С','Р','В')) and any(bad in line for bad in ('Ð','Â','Ã','вЂ','в…','в№','СЃ','СЂ','С‹','Рѕ','Рї','В ')):
            if '2026' in line or len(line.strip())==0:
                pass
            print(f'{i}: {line[:240]}')
