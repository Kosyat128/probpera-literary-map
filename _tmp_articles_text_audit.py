import json
import re
from pathlib import Path
from collections import defaultdict

root = Path(r"C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")
article_dirs = [root / 'public' / 'articles', root / 'public' / 'cms' / 'articles']

files = []
for d in article_dirs:
    if d.exists():
        files.extend(sorted(d.glob('*.json')))

PLACEHOLDER = re.compile(r'\b(?:TODO|TBD|FIXME|lorem\s+ipsum|ipsum\s+dolor|undefined|null)\b', re.IGNORECASE)

results = defaultdict(list)


def collect_strings(obj, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else k
            yield from collect_strings(v, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            p = f"{path}[{i}]"
            yield from collect_strings(v, p)
    elif isinstance(obj, str):
        yield (path, obj)


def try_fix_encoding(s: str):
    try:
        return s.encode('cp1251').decode('utf-8')
    except Exception:
        return None


def cyr_count(s: str) -> int:
    return sum(1 for ch in s if '\u0400' <= ch <= '\u04FF')


def suspicious_mojibake(s: str) -> bool:
    fixed = try_fix_encoding(s)
    if fixed is None or fixed == s:
        return False
    if cyr_count(fixed) < 3:
        return False
    if '\ufffd' in fixed:
        return False
    return True


scanned = 0
for fp in files:
    rel = fp.relative_to(root).as_posix()
    scanned += 1
    try:
        data = json.loads(fp.read_text(encoding='utf-8'))
    except Exception as e:
        results['json_parse_error'].append((rel, 'parse_error', str(e)[:180]))
        continue

    # required field check
    if isinstance(data, dict):
        for key in ('title', 'contentHtml', 'description', 'plainText'):
            if key in data:
                val = data.get(key)
                if isinstance(val, str) and not val.strip():
                    results['empty_required_field'].append((rel, key, '<empty>'))

    strings = list(collect_strings(data))
    for field, text in strings:
        if not text.strip():
            continue

        if '\u0000' in text or '\ufeff' in text or '?' in text:
            results['bad_characters'].append((rel, field, text[:120].replace('\n', ' ')))

        if PLACEHOLDER.search(text):
            results['placeholder'].append((rel, field, text[:160].replace('\n', ' ')))

        if re.search(r'\s{2,}', text):
            results['double_space'].append((rel, field, text[:140].replace('\n', ' ')))

        if suspicious_mojibake(text):
            fixed = try_fix_encoding(text)
            results['encoding_mojibake'].append((rel, field, text[:120].replace('\n', ' '), fixed[:120].replace('\n', ' ')))

        if re.search(r'\b\d{1,2}[\u2012\u2013\u2014-]\d{1,2}\b', text):
            results['dash_date_like'].append((rel, field, text[:140].replace('\n', ' ')))

print(f'Scanned article files: {scanned}')
for k in sorted(results):
    print(f'{k}: {len(results[k])}')

for k, v in sorted(results.items()):
    if not v:
        continue
    print(f'\n[{k}]')
    for item in v[:200]:
        print(' ', ' | '.join(item[:3]))
    if len(v) > 200:
        print(f' ... +{len(v)-200} more')

out = root / 'reports' / 'text-audit-articles-only.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(
    json.dumps({
        'meta': {'scanned': scanned},
        'summary': {k: len(v) for k, v in results.items()},
        'items': results,
    },
    ensure_ascii=False,
    indent=2),
    encoding='utf-8'
)
print('Saved:', out)
