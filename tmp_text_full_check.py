# -*- coding: utf-8 -*-
import re
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path('.')
MAX_SAMPLES = 200

TEXT_DIRS = [
    Path('src/data'),
    Path('public/cms'),
    Path('src/articles'),
    Path('src/data/articles'),
    Path('apps/admin/components'),
    Path('apps/admin/lib'),
    Path("apps/admin/app/(dashboard)"),
    Path("apps/admin/app/(auth)"),
]

SKIP_FILES = {'.git', 'node_modules', '.pnpm-store', 'dist', '.codex-runtime'}

TEXT_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx', '.html', '.css'}

PLACEHOLDER = re.compile(r'\b(?:TODO|TBD|FIXME|XXX|lorem|ipsum|null|undefined)\b', re.IGNORECASE)
MULTI_SPACE = re.compile(r' {2,}')
DATE_DASH = re.compile(r'\b(\d{1,2})[\-\u2013\u2014](\d{1,4})\b')


def is_text_file(path: Path):
    if path.suffix.lower() not in TEXT_EXTS:
        return False
    parts = set(path.parts)
    if parts.intersection(SKIP_FILES):
        return False
    # skip reports and generated bundles
    if 'reports' in parts or '.git' in parts:
        return False
    return True


def cyrillic_count(s: str) -> int:
    if not s:
        return 0
    return sum(1 for ch in s if '\u0400' <= ch <= '\u04FF')


def try_fix_encoding(line: str):
    try:
        fixed = line.encode('cp1251').decode('utf-8')
    except Exception:
        return None
    return fixed


def is_mojibake_candidate(line: str) -> bool:
    if not any(ord(ch) > 127 for ch in line):
        return False

    fixed = try_fix_encoding(line)
    if fixed is None:
        return False

    if fixed == line:
        return False

    if cyrillic_count(fixed) == 0:
        return False

    if '\ufffd' in fixed:
        return False

    if re.search(r'[\u0420\u0410-\u044f][\u0420\u0400-\u04FF]', line):
        return True

    if any(ord(ch) >= 0xE000 and ord(ch) <= 0xF8FF for ch in line):
        return True

    return True


results = defaultdict(list)
file_count = 0
line_issues = 0

for directory in TEXT_DIRS:
    if not directory.exists():
        continue
    for p in directory.rglob('*'):
        if not p.is_file() or not is_text_file(p):
            continue
        file_count += 1
        try:
            text = p.read_text(encoding='utf-8')
        except Exception:
            continue

        for idx, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if not stripped:
                continue

            t = stripped.strip()
            if t.startswith('import ') or t.startswith('export ') or t.startswith('type ') or t.startswith('interface '):
                continue

            if PLACEHOLDER.search(line):
                results['placeholders'].append((str(p), idx, stripped[:180]))
                line_issues += 1

            if MULTI_SPACE.search(line):
                if not t.lstrip().startswith('//'):
                    results['double_space'].append((str(p), idx, stripped[:180]))
                    line_issues += 1

            if DATE_DASH.search(line):
                results['suspicious_date_like'].append((str(p), idx, stripped[:180]))
                line_issues += 1

            if is_mojibake_candidate(line):
                fixed = try_fix_encoding(line)
                if fixed:
                    raw = stripped[:220]
                    fix = fixed.strip()[:220]
                    results['encoding_mojibake'].append((str(p), idx, raw, fix))
                    line_issues += 1

out = {
    'meta': {
        'root': str(ROOT.resolve()),
        'files_scanned': file_count,
        'total_issues': line_issues,
    },
    'summary': {k: len(v) for k, v in results.items()},
    'items': results,
}

out_path = ROOT / 'reports' / 'full-text-audit.json'
out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

print('Scanned:', file_count)
for k, v in sorted(results.items()):
    print(k, len(v))
    for item in v[:MAX_SAMPLES]:
        if k == 'encoding_mojibake':
            print(' ', item[0], item[1])
            print('    raw: ', item[2])
            print('    fix: ', item[3])
        else:
            print(' ', item[0], item[1], item[2])
    if len(v) > MAX_SAMPLES:
        print(f'   ... +{len(v)-MAX_SAMPLES}')
