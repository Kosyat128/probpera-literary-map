import json,re
from pathlib import Path

root = Path(r"C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")
patterns = [
    '\8',
]

# suspicious unicode names in raw text
sus = ["\u00c2", "\\u00c2", "\u2019", "\u2014"]

# scan json files for suspicious escape sequences or mojibake chars
files = list(root.glob('public/articles/*.json')) + list(root.glob('public/cms/articles/*.json')) + [root/'public/articles/index.json', root/'public/cms/published-articles.json', root/'public/cms/published-content.json', root/'src/data/articles/cms.generated.ts', root/'src/data/countries/generated/writers.generated.json', root/'src/data/countries/generated/books.generated.json']

for p in files:
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8', errors='replace')
    issues = []

    # direct problematic escaped bytes
    if '\\u00c2' in text or '\\xC2' in text or '\\uFFFD' in text:
        issues.append('escaped marker')
    if 'вЂ' in text:
        issues.append('вЂ glyph')
    if 'Р“' in text or 'СЂ' in text or 'СЃ' in text or 'С€' in text:
        issues.append('UTF-mojibake runes')

    if issues:
        print(f'{p}\n  {'; '.join(issues)}')
