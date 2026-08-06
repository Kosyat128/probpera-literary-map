import json, re
from pathlib import Path
from collections import defaultdict

root = Path("C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map")

# Text extensions and files to check
EXTS = {'.ts','.tsx','.md','.mdx','.json','.html','.css' }

SKIP_PARTS = {
    '.git', 'node_modules', 'dist', 'build', 'outputs', 'chrome-qa', 'edge-qa',
    'tmp_text_audit.py', 'package-lock.json', '.map'
}

# keep directories that contain user-facing content (including admin CMS text)
ALLOWED_PREFIXES = [
    'src/data',
    'src/components',
    'src/pages',
    'src/community',
    'src/filters',
    'src/utils',
    'src/i18n',
    'apps/admin',
    'public/cms',
    'public/brand',
    'docs',
    'README.md',
    'MIGRATION_RU.md',
    'FINAL_PRE_MIGRATION_CHECKLIST_RU.md',
    'SECURITY_RU.md',
    'DEPLOYMENT_RU.md',
    'ADMIN_GUIDE_RU.md',
    'ADMIN_HOSTING_RU.md',
]

# Actually include all non-binary files below these roots

patterns = {
    'placeholder': re.compile(r"\b(?:TODO|todo|TBD|FIXME|XXX|lorem ipsum|ipsum dolor|пример\s+placeholder|замени\s*\/?те?кст|заглушка)\b", re.IGNORECASE),
    'replacement': re.compile(r"\uFFFD|�|\u0000"),
    'mix_cyr_lat': re.compile(r"[\u0400-\u04FF][A-Za-z]"),
    'mix_lat_cyr': re.compile(r"[A-Za-z][\u0400-\u04FF]"),
    'space_before_punct': re.compile(r"\s+([:;,!?])"),
    'double_space': re.compile(r"\S\s{2,}\S"),
    'triple_dot': re.compile(r"\.\.{3,}"),
    'http_ref': re.compile(r"https?://[\w./?&=%-]+"),
    'nb_space': re.compile(r"\u00A0"),
    'weird_year': re.compile(r"\b\d{2}\.\d{2}\.\d{2,4}\b")
}

issues = defaultdict(list)
file_count = 0

for p in root.rglob('*'):
    if not p.is_file():
        continue
    # skip huge binary-like directories
    parts = set(p.parts)
    if any(part in SKIP_PARTS for part in p.parts):
        continue
    # skip files that are clearly binary
    if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.woff2','.woff','.ttf','.otf'}:
        continue
    # extension filter
    if p.suffix.lower() not in EXTS:
        continue
    rel = p.relative_to(root).as_posix()
    # include only meaningful text roots
    if not any(rel.startswith(pref) for pref in ALLOWED_PREFIXES) and p.name not in {'README.md','SECURITY_RU.md','DEPLOYMENT_RU.md','MIGRATION_RU.md','FINAL_PRE_MIGRATION_CHECKLIST_RU.md','ADMIN_GUIDE_RU.md','ADMIN_HOSTING_RU.md'}:
        continue

    try:
        text = p.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        # fallback latin1 to avoid losing files with cp-1251 style bytes
        try:
            text = p.read_text(encoding='cp1251')
        except Exception:
            continue
    except Exception:
        continue

    file_count += 1
    lines = text.splitlines()
    for ln, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped:
            continue

        if patterns['replacement'].search(line):
            issues['replacement'].append((rel, ln, 'replacement character'))

        if patterns['placeholder'].search(line):
            # ignore common technical terms
            if 'undefined' in line and 'undefined' in stripped and '=' in line:
                pass
            else:
                issues['placeholder'].append((rel, ln, stripped[:180]))

        if patterns['mix_cyr_lat'].search(line) or patterns['mix_lat_cyr'].search(line):
            # allow URLs, file names and JS identifiers mostly
            if not patterns['http_ref'].search(line):
                issues['mixed_script'].append((rel, ln, stripped[:180]))

        if patterns['space_before_punct'].search(line):
            # ignore if it's formatting in code (indent)
            if not stripped.startswith('const') and not stripped.startswith('export') and not stripped.startswith('import'):
                issues['space_before_punct'].append((rel, ln, stripped[:180]))

        # only text-heavy lines (letters) for spacing checks
        if re.search(r'[A-Za-zА-Яа-я]', line):
            if patterns['double_space'].search(line):
                # skip markdown list/item alignment and long indent in table rows
                if '  -' not in line and '|  ' not in line:
                    issues['double_space'].append((rel, ln, stripped[:180]))
            if patterns['nb_space'].search(line):
                issues['nb_space'].append((rel, ln, 'NBSP'))
            if patterns['triple_dot'].search(line):
                issues['triple_dot'].append((rel, ln, stripped[:180]))

        # suspicious short weird years in short labels
        if patterns['weird_year'].search(line):
            issues['weird_year'].append((rel, ln, stripped[:180]))

report = {
    'meta': {
        'root': str(root),
        'files_scanned': file_count,
        'issues_total': sum(len(v) for v in issues.values())
    },
    'summary': {k: len(v) for k,v in issues.items()},
    'samples': {k: v[:150] for k,v in issues.items()}
}

Path('C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map/reports/text-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('OK', file_count, report['meta']['issues_total'])
for k,v in issues.items():
    print(f"{k}: {len(v)}")

