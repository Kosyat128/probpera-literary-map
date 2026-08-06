import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('work/probpera-literary-map')

# -----------------------------
# Settings
# -----------------------------
TEXT_DIRS = [
    ROOT / 'public' / 'cms',
    ROOT / 'src' / 'data' / 'articles',
    ROOT / 'src' / 'data' / 'cms',
    ROOT / 'src' / 'data' / 'countries',
    ROOT / 'src' / 'data' / 'writers',
]

TEXT_EXTS = {'.json', '.ts'}
IGNORE_JSON_KEYS = {
    'id', 'slug', 'code', 'tag', 'tags', 'order', 'index', 'year', 'rank', 'lat', 'lng',
    'countryid', 'writerid', 'nobelyear', 'nobelyear', 'template', 'status', 'path', 'url',
    'thumbnail', 'cover', 'img', 'image', 'logo', 'avatar', 'portrait', 'flag', 'coordinates'
}

TEXT_KEYS = {
    'name', 'fullname', 'years', 'title', 'subtitle', 'summary', 'description', 'shortdescription',
    'bio', 'biography', 'history', 'historicalnote', 'about', 'content', 'contenthtml',
    'intro', 'lead', 'heading', 'subheading', 'text', 'excerpt', 'comment', 'quote', 'caption',
    'series', 'notes', 'label', 'country', 'region', 'province', 'birthplace', 'deathplace',
    'seodescription', 'ogdescription', 'publication', 'review', 'genre'
}

ARRAY_KEYS = {'works', 'genres', 'awards', 'tags', 'booktitles', 'bookids', 'relatedwriters', 'relatedcountries', 'sources'}

PLACEHOLDER_RE = re.compile(r'\b(?:TODO|TBD|FIXME|XXX|lorem\s+ipsum|undefined|null|N/A|temp)\b', re.IGNORECASE)
DOUBLE_SPACE_RE = re.compile(r' {2,}')
MULTISPACE_RE = re.compile(r'\s{3,}')
HTML_ENTITIES_RE = re.compile(r'&(?:nbsp|quot|amp|lt|gt|ldquo|rdquo|lsquo|rsquo);', re.IGNORECASE)


def is_mojibake(text: str) -> bool:
    if not text or len(text) < 4:
        return False
    # classic Russian mojibake detection used in previous checks
    try:
        fixed = text.encode('cp1251').decode('utf-8')
    except Exception:
        return False
    if fixed == text:
        return False
    if '\ufffd' in fixed:
        return False
    # ignore if it would look like random binary
    if len(re.sub(r'[\u0020-\u007e]', '', fixed)) < 1:
        # mostly ASCII, not likely Russian mojibake
        return False
    # must contain Cyrillic chars after decode
    if not any('А' <= ch <= 'я' for ch in fixed):
        return False
    return True


def decode_mojibake(text: str) -> str:
    try:
        return text.encode('cp1251').decode('utf-8')
    except Exception:
        return ''


def iter_json_paths(obj, path_parts):
    if isinstance(obj, dict):
        for k, v in obj.items():
            k_norm = str(k).lower()
            yield from iter_json_paths(v, path_parts + [str(k)])
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from iter_json_paths(item, path_parts + [f'[{i}]'])
    else:
        yield path_parts, obj


def check_text(path: str, field: str, text: str, context_path: str, source: str):
    issues = []
    if text is None:
        return issues
    if not isinstance(text, str):
        return issues

    value = text
    # trim only for checking emptiness
    if value.strip() == '':
        issues.append(('empty', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value}))
        return issues

    # Skip some aggressive checks for large HTML payload
    is_html_field = field.lower() in {'contenthtml', 'content', 'text'}

    if PLACEHOLDER_RE.search(value):
        issues.append(('placeholder', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value[:220]}))

    if (not is_html_field) and MULTISPACE_RE.search(value):
        issues.append(('multi_space', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value[:220]}))

    if (not is_html_field) and DOUBLE_SPACE_RE.search(value):
        issues.append(('double_space', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value[:220]}))

    if (not is_html_field) and (value.startswith(' ') or value.endswith(' ')):
        issues.append(('leading_trailing', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value[:220]}))

    if (not is_html_field) and HTML_ENTITIES_RE.search(value):
        issues.append(('html_entities', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value[:220]}))

    if field.lower() in TEXT_KEYS and len(value.strip()) < 3:
        issues.append(('too_short', {'path': path, 'source': source, 'field': field, 'context': context_path, 'sample': value.strip()}))

    if is_mojibake(value):
        issues.append(('mojibake', {
            'path': path,
            'source': source,
            'field': field,
            'context': context_path,
            'sample': value[:220],
            'fixed_hint': decode_mojibake(value)[:220]
        }))

    return issues


# Regex for TS files
TS_FIELD_RE = re.compile(
    rf"(?P<key>{'|'.join(sorted(TEXT_KEYS | ARRAY_KEYS))})\\s*:\\s*(?P<quote>['\"`])(?P<val>(?:\\.|(?!\\k<quote>).)*)\\k<quote>",
    re.DOTALL
)
TS_ARRAY_RE = re.compile(
    rf"(?P<key>{'|'.join(sorted(ARRAY_KEYS))})\\s*:\\s*\\[(?P<body>.*?)\\]",
    re.DOTALL
)
TS_ARRAY_ITEM_RE = re.compile(r"(?P<quote>['\"`])(?P<val>(?:\\.|(?!\\k<quote>).)*)\\k<quote>")

issues = defaultdict(list)
scanned = {'json': 0, 'ts': 0, 'entries': 0}

# 1) JSON scans
for directory in TEXT_DIRS:
    if not directory.exists():
        continue
    for p in sorted(directory.rglob('*.json')):
        if not p.is_file():
            continue
        scanned['json'] += 1
        try:
            data = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue

        for path_parts, value in iter_json_paths(data, ['root']):
            if not isinstance(value, str):
                continue
            if not path_parts:
                continue
            field = str(path_parts[-1]).strip('[]')
            field_norm = field.lower()

            # skip service / technical keys
            if field_norm in IGNORE_JSON_KEYS:
                continue

            if value.count('http') > 0 and len(value.strip()) < 20:
                # technical URL fields are often short and can be skipped
                continue

            context = '.'.join(path_parts)
            for typ, row in check_text(str(p), field, value, context, 'json'):
                issues[typ].append(row)

# 2) TS scans
for directory in [ROOT / 'src' / 'data' / 'articles', ROOT / 'src' / 'data' / 'cms', ROOT / 'src' / 'data' / 'countries', ROOT / 'src' / 'data' / 'writers']:
    if not directory.exists():
        continue
    for p in sorted(directory.rglob('*.ts')):
        if not p.is_file() or p.name.endswith('.test.ts'):
            continue
        scanned['ts'] += 1
        text = p.read_text(encoding='utf-8', errors='ignore')
        source = str(p)
        scanned['entries'] += text.count('export')

        for match in TS_FIELD_RE.finditer(text):
            key = match.group('key')
            val = match.group('val')
            for typ, row in check_text(source, key, val, f"{source}:{key}", 'ts'):
                issues[typ].append(row)

        for match in TS_ARRAY_RE.finditer(text):
            key = match.group('key')
            body = match.group('body')
            for m in TS_ARRAY_ITEM_RE.finditer(body):
                val = m.group('val')
                for typ, row in check_text(source, f'{key}[]', val, f"{source}:{key}[]", 'ts'):
                    issues[typ].append(row)

report = {
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'scope': {
        'jsonFiles': scanned['json'],
        'tsFiles': scanned['ts'],
        'keysChecked': sorted(TEXT_KEYS),
        'arrayKeysChecked': sorted(ARRAY_KEYS),
    },
    'summary': {k: len(v) for k, v in issues.items()},
    'items': issues,
}

out = ROOT / 'reports' / 'manual-text-audit.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps(report['summary'], ensure_ascii=False, indent=2))
print(f"saved:{out}")

for typ in sorted(issues):
    print(f'\n{typ}: {len(issues[typ])}')
    for row in issues[typ][:12]:
        if typ == 'mojibake':
            print(f" - {row['path']} | {row['field']} | {row.get('sample','')} -> {row.get('fixed_hint','')}")
        else:
            print(f" - {row['path']} | {row['field']} | {row.get('sample','')}")
    if len(issues[typ]) > 12:
        print(f"   ... +{len(issues[typ])-12} more")
