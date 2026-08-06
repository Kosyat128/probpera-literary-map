# -*- coding: utf-8 -*-
import re
import sys
from pathlib import Path

ROOT = Path(r"C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")

globs = [
    'apps/admin/**/*.ts',
    'apps/admin/**/*.tsx',
    'apps/admin/**/*.js',
    'apps/admin/**/*.jsx',
    'apps/admin/**/*.css',
    'apps/admin/**/*.json',
    'src/data/articles/*.ts',
    'src/data/cms/*.ts',
    'src/data/countries/generated/*.json',
    'src/data/countries/generated/*.ts',
    'src/data/countries/*.ts',
    'src/data/writers/*.ts',
    'public/articles/*.json',
    'public/cms/articles/*.json',
    'public/cms/published-*.json',
    'public/articles/index.json',
]

SUSPECT = re.compile(r'[\u00C0-\u00FF]')


def cyrillic_count(text: str) -> int:
    return sum(1 for ch in text if '\u0400' <= ch <= '\u04FF')

def has_high_score(text: str) -> bool:
    return bool(SUSPECT.search(text))

def decode_if_mojibake(value: str) -> str | None:
    if not value:
        return None

    if not has_high_score(value):
        return None

    try:
        fixed = value.encode('cp1251').decode('utf-8')
    except Exception:
        return None

    if fixed == value:
        return None
    if '\ufffd' in fixed:
        return None

    if cyrillic_count(fixed) + 1 < max(1, min(cyrillic_count(value), 3)):
        return None

    bad_before = sum(1 for ch in value if 0xC0 <= ord(ch) <= 0xFF)
    bad_after = sum(1 for ch in fixed if 0xC0 <= ord(ch) <= 0xFF)

    if bad_after >= bad_before:
        if bad_after == bad_before and cyrillic_count(fixed) <= cyrillic_count(value):
            return None

    if len(fixed.strip()) == 0:
        return None

    return fixed


dry_run = '--dry-run' in sys.argv

changed_files = 0
changed_lines = 0
samples = []

paths = []
for pattern in globs:
    paths.extend(ROOT.glob(pattern))

for path in sorted(set(paths)):
    if not path.is_file():
        continue

    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        continue

    out_lines = []
    file_changes = 0

    for idx, line in enumerate(text.splitlines(keepends=True), 1):
        if not has_high_score(line):
            out_lines.append(line)
            continue

        fixed = decode_if_mojibake(line)
        if fixed is None:
            out_lines.append(line)
            continue

        if fixed != line:
            file_changes += 1
            changed_lines += 1
            samples.append((str(path), idx, line.rstrip('\n\r'), fixed.rstrip('\n\r')))
            out_lines.append(fixed)
        else:
            out_lines.append(line)

    if file_changes:
        changed_files += 1
        if not dry_run:
            path.write_text(''.join(out_lines), encoding='utf-8')

print(f'changed_files={changed_files}')
print(f'changed_lines={changed_lines}')
print('sample_count', len(samples))
for path, idx, before, after in samples[:120]:
    print(f'{path}:{idx}')
    print('  before:', before[:180])
    print('  after :', after[:180])
    print()
