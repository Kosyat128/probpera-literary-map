import json
import re
from pathlib import Path
from html import unescape
from collections import defaultdict

ROOT = Path('.')
REPORT = ROOT / 'reports' / 'text-full-audit.json'

# Config
PLACEHOLDERS = re.compile(r'\b(TODO|TBD|FIXME|XXX|lorem\s+ipsum|Lorem\s+ipsum|undefined|null|N/A|nan|placeholder)\b', re.IGNORECASE)
DOUBLE_SPACE = re.compile(r'\s{2,}')
TRAILING_OR_LEADING = re.compile(r'(^\s+|\s+$)')
SANE_ITALIC = re.compile(r'_[^_]{0,120}_')


def strip_html(text: str) -> str:
    t = re.sub(r'<[^>]+>', ' ', text)
    return unescape(t).replace('\u200b', ' ').replace('\xa0', ' ')


def check_value(value, context, path, issues):
    if not isinstance(value, str):
        return
    s = value
    # Normalize line breaks for checks
    if not s:
        issues.append({"path": path, "context": context, "type": "empty", "message": "empty text", "sample": s[:120]})
        return

    if PLACEHOLDERS.search(s):
        issues.append({"path": path, "context": context, "type": "placeholder", "message": "placeholder token found", "sample": PLACEHOLDERS.search(s).group(0)})

    if DOUBLE_SPACE.search(s):
        issues.append({"path": path, "context": context, "type": "double_space", "message": "multiple spaces", "sample": DOUBLE_SPACE.search(s).group(0)})

    if re.search(r'\u0000|\ufffd', s):
        issues.append({"path": path, "context": context, "type": "bad_char", "message": "invalid/placeholder character", "sample": s[:120]})

    # suspicious entity remnants
    if re.search(r'&(?:nbsp|quot|amp|lt|gt);', s):
        issues.append({"path": path, "context": context, "type": "html_entity", "message": "HTML entity not converted", "sample": re.search(r'&(?:nbsp|quot|amp|lt|gt);', s).group(0)})

    plain = strip_html(s)
    if plain != s and plain.strip() and len(plain) < 40:
        issues.append({"path": path, "context": context, "type": "short_visible", "message": "Short visible text for formatted block", "sample": plain[:120]})

    if len(plain) > 0 and len(plain) < 12:
        issues.append({"path": path, "context": context, "type": "too_short", "message": "Very short text", "sample": plain[:120]})


def iter_texts(obj, prefix, callback):
    if isinstance(obj, dict):
        for k, v in obj.items():
            np = f"{prefix}.{k}" if prefix else str(k)
            callback(k, v, np)
            if isinstance(v, (dict, list)):
                iter_texts(v, np, callback)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            np = f"{prefix}[{i}]"
            callback(None, v, np)
            if isinstance(v, (dict, list)):
                iter_texts(v, np, callback)


def collect_source_files():
    files = []
    # CMS content
    cms_dir = ROOT / 'public' / 'cms' / 'articles'
    if cms_dir.exists():
        files += list(cms_dir.glob('cms-*.json'))

    files += list((ROOT / 'src').glob('**/*.ts')) + list((ROOT / 'src').glob('**/*.tsx')) + list((ROOT / 'src').glob('**/*.md'))
    files += list((ROOT / 'public').glob('**/*.json'))
    files = [p for p in files if p.is_file() and '.git' not in p.parts and 'node_modules' not in p.parts and 'reports' not in p.parts and '.cache' not in p.parts]
    return sorted(set(files), key=lambda p: str(p).lower())


issues = []
by_file = defaultdict(list)

for p in collect_source_files():
    text = p.read_text(encoding='utf-8', errors='ignore')
    rel = str(p.relative_to(ROOT))

    # Try parse JSON for targeted recursive checks, as string for all files too
    if p.suffix.lower() == '.json':
        try:
            data = json.loads(text)
            def visit(ctx_key, val, path):
                if isinstance(val, str):
                    if ctx_key and ctx_key.lower() in {'title','name','subtitle','lead','description','biography','summary','content','body','text','alt','caption','excerpt','quote','tagline'}:
                        rec = {
                            'file': rel,
                            'path': path,
                            'context': f"{ctx_key} ({path})",
                        }
                        before = len(issues)
                        check_value(val, rec['context'], path, issues)
                        if len(issues) > before:
                            by_file[rel].append(issues[-1])
                elif isinstance(val, (dict, list)):
                    iter_texts(val, path, visit)
            iter_texts(data, 'root', visit)
            continue
        except Exception:
            pass

    # Fallback plain text scan for non-json or broken json
    for i, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        rec_path = f"line:{i}"
        before = len(issues)
        check_value(line, f"line {i}", rec_path, issues)
        if len(issues) > before:
            by_file[rel].append(issues[-1])

# Summarize by category
summary = defaultdict(int)
for item in issues:
    summary[item['type']] += 1

critical_candidates = [i for i in issues if i.get('type') in {'placeholder', 'bad_char', 'empty'}]

report = {
    'generatedAt': str(__import__('datetime').datetime.utcnow().isoformat()) + 'Z',
    'counts': {
        'filesScanned': len(set(p.as_posix() for p in collect_source_files())),
        'issues': len(issues),
        **summary,
        'filesWithIssues': len(by_file),
    },
    'topFiles': [
        {'file': f, 'count': len(v)} for f, v in sorted(by_file.items(), key=lambda kv: len(kv[1]), reverse=True)[:40]
    ],
    'issues': issues[:4000],
    'critical': critical_candidates,
}

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding='utf-8')
print(f"scanned={len(set(p.as_posix() for p in collect_source_files()))}")
print(f"issues={len(issues)}")
print(f"files_with_issues={len(by_file)}")
for k, v in sorted(summary.items()):
    print(f"{k}: {v}")
