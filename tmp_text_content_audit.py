# -*- coding: utf-8 -*-
import re
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path('.')
TEXT_FILES = [
    p
    for p in (ROOT / 'src').rglob('*')
    if p.is_file() and p.suffix.lower() in {'.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx'}
    and 'node_modules' not in p.parts
    and '.git' not in p.parts
    and 'reports' not in p.parts
]

TEXT_FILES += [
    p
    for p in (ROOT / 'public').rglob('*')
    if p.is_file() and p.suffix.lower() in {'.json', '.md', '.html'}
    and 'node_modules' not in p.parts
]

TEXT_FILES = sorted(set(TEXT_FILES), key=str)

STRING_RE = re.compile(r'(?<!\\)("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')')
RU_RE = re.compile(r'[\u0410-\u044f\u0401\u0451]')
DOUBLE_SPACE_RE = re.compile(r' {2,}')
TRAILING_SPACE_RE = re.compile(r'[ \t]+$')
PLACEHOLDER_RE = re.compile(r'\b(?:TODO|TBD|FIXME|XXX|lorem|ipsum|undefined|null|N/A)\b', re.IGNORECASE)
YEAR_BROKEN_RE = re.compile(r'\\b\\d{4}[\\s]{0,2}[-][\\s]{0,2}[\\d]{0,4}\\b')


def contains_mojibake_candidate(text: str) -> bool:
    try:
        fixed = text.encode('cp1251').decode('utf-8')
    except Exception:
        return False
    if fixed == text:
        return False
    if not RU_RE.search(fixed):
        return False
    return any(ch in fixed for ch in ['\u0439','\u0446','\u0443','\u043a','\u0435','\u043d','\u0433','\u0448','\u0449','\u0437','\u0445','\u0430','\u0451'])

issues = defaultdict(list)

for p in TEXT_FILES:
    try:
        text = p.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue

    for i, line in enumerate(text.splitlines(), start=1):
        for m in STRING_RE.finditer(line):
            raw = m.group(0)
            if len(raw) < 4:
                continue
            inner = raw[1:-1]

            if PLACEHOLDER_RE.search(inner):
                issues['placeholder_token'].append((str(p), i, inner[:200]))

            if DOUBLE_SPACE_RE.search(inner):
                issues['double_space_in_text'].append((str(p), i, inner[:220]))

            if TRAILING_SPACE_RE.search(raw):
                issues['line_trailing_space'].append((str(p), i, raw[:120]))

            if YEAR_BROKEN_RE.search(inner):
                issues['suspicious_year'].append((str(p), i, inner[:220]))

            if contains_mojibake_candidate(inner):
                fixed = inner.encode('cp1251').decode('utf-8')
                issues['encoding_misdecode'].append((str(p), i, inner[:220], fixed[:220]))

out = {
    'meta': {'root': str(ROOT.resolve()), 'files_scanned': len(TEXT_FILES)},
    'summary': {k: len(v) for k, v in issues.items()},
    'items': issues,
}

out_path = ROOT / 'reports' / 'text-content-audit.json'
out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

for cat in sorted(issues):
    print(cat, len(issues[cat]))
    for row in issues[cat][:80]:
        if cat == 'encoding_misdecode':
            path, ln, raw, fixed = row
            print(' ', path, ln)
            print('   raw :', raw)
            print('   fix :', fixed)
        else:
            print(' ', row[0], row[1], row[2])
    if len(issues[cat]) > 80:
        print('   ... +', len(issues[cat]) - 80, 'more')
    print()

print('saved', out_path)
