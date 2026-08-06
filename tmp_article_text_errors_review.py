import json
import re
from pathlib import Path
from collections import defaultdict, Counter
from html import unescape

ROOT = Path(r'C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map')
ARTICLE_DIRS = [ROOT / 'public' / 'articles', ROOT / 'public' / 'cms' / 'articles']

OUTPUT = ROOT / 'reports' / 'articles_text_errors_review.json'

PLACEHOLDER_RE = re.compile(r'\b(?:TODO|TBD|FIXME|XXX|lorem\s+ipsum|ipsum\s+dolor|__placeholder__|sample\s+text|null|undefined)\b', re.IGNORECASE)
DOUBLE_SPACE_RE = re.compile(r'\S\s{3,}\S|\S\s{2,}\S')
CONTROL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]')
DASH_DATE_RE = re.compile(r'\b\d{1,4}\s*[\-\u2012\u2013\u2014]\s*\d{1,4}\b')

REQUIRED_FIELDS = ('title', 'description', 'contentHtml', 'plainText')


def collect_text_fields(obj, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            np = f"{path}.{k}" if path else str(k)
            yield from collect_text_fields(v, np)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            np = f"{path}[{i}]"
            yield from collect_text_fields(v, np)
    elif isinstance(obj, str):
        yield path, obj


def cyrillic_count(text: str) -> int:
    return sum(1 for ch in text if '\u0400' <= ch <= '\u04FF')


def sanitize_html_for_readable(text: str) -> str:
    no_tags = re.sub(r'<[^>]+>', ' ', text)
    return unescape(no_tags)


def try_recover_from_utf8_cp1251(text: str):
    try:
        rec = text.encode('cp1251').decode('utf-8')
    except Exception:
        return None
    return rec


def is_probable_mojibake(text: str) -> bool:
    rec = try_recover_from_utf8_cp1251(text)
    if rec is None or rec == text:
        return False

    if cyrillic_count(rec) < 4:
        return False

    orig_c = cyrillic_count(text)
    rec_c = cyrillic_count(rec)
    if rec_c <= orig_c:
        return False

    if '�' in rec or '�' in text:
        return False

    if len(rec.strip()) < 4:
        return False

    if len(text.strip()) < 20 and len(rec.strip()) > 80:
        return False

    return True


issues = defaultdict(list)
file_stats = defaultdict(Counter)
scanned = 0
parse_errors = 0

for d in ARTICLE_DIRS:
    if not d.exists():
        continue
    for p in sorted(d.glob('*.json')):
        scanned += 1
        rel = p.relative_to(ROOT).as_posix()

        try:
            data = json.loads(p.read_text(encoding='utf-8'))
        except Exception as e:
            issues['json_parse_error'].append({
                'file': rel,
                'field': 'json',
                'issue': str(e),
                'snippet': '',
            })
            parse_errors += 1
            continue

        if isinstance(data, dict):
            for req in REQUIRED_FIELDS:
                if req in data and (not str(data.get(req, '')).strip()):
                    issues['empty_required_field'].append({'file': rel, 'field': req, 'snippet': '<empty>'})

        for path, text in collect_text_fields(data):
            if not isinstance(text, str) or not text.strip():
                continue

            snippet = text[:220].replace('\n', ' ').strip()

            if CONTROL_RE.search(text):
                issues['control_chars'].append({'file': rel, 'field': path, 'snippet': snippet})

            if PLACEHOLDER_RE.search(text):
                issues['placeholder_phrases'].append({'file': rel, 'field': path, 'snippet': snippet})

            plain = sanitize_html_for_readable(text)
            if DOUBLE_SPACE_RE.search(plain):
                issues['double_space'].append({'file': rel, 'field': path, 'snippet': plain[:220].replace('\n', ' ')})

            if DASH_DATE_RE.search(text):
                issues['date_like_pattern'].append({'file': rel, 'field': path, 'snippet': snippet})

            if is_probable_mojibake(text):
                rec = try_recover_from_utf8_cp1251(text)
                issues['encoding_mojibake'].append({
                    'file': rel,
                    'field': path,
                    'snippet': snippet,
                    'recovered_preview': rec[:220].replace('\n', ' ') if rec else '',
                })

for category in issues.values():
    for item in category:
        file_stats[item['file']][item['field']] += 1

sorted_files = [
    {
        'file': f,
        'counts': dict(counter),
        'total': sum(counter.values()),
    }
    for f, counter in sorted(file_stats.items(), key=lambda kv: sum(kv[1].values()), reverse=True)
]

out = {
    'meta': {
        'scanned': scanned,
        'parse_errors': parse_errors,
        'root': str(ROOT),
    },
    'summary': {k: len(v) for k, v in issues.items()},
    'file_top': sorted_files,
    'items': issues,
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

print('Scanned files:', scanned)
print('Summary:')
for k in sorted(out['summary'], key=lambda x: (-out['summary'][x], x)):
    print(f" - {k}: {out['summary'][k]}",)
print('Report saved:', OUTPUT)
