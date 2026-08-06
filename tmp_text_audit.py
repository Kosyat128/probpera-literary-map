import re
from pathlib import Path
from collections import defaultdict

root = Path('work/probpera-literary-map')

patterns = {
    'mixed_word_cyrillic_latin': re.compile(r'[\u0400-\u04FF][A-Za-z]'),
    'mixed_word_latin_cyrillic': re.compile(r'[A-Za-z][\u0400-\u04FF]'),
    'replacement_char': re.compile(r'\uFFFD|�'),
    'placeholder_token': re.compile(r'\b(?:TODO|todo|TBD|FIXME|XXX|lorem|ipsum|undefined|null)\b'),
    'triple_dot': re.compile(r'\.{3,}(?=\S)'),
    'doubled_space': re.compile(r'\s{2,}', re.UNICODE),
    'weird_date_like': re.compile(r'\b\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}\b'),
}

# Files with textual content
paths = []
for p in root.rglob('*'):
    if not p.is_file():
        continue
    if p.suffix.lower() not in {'.ts', '.tsx', '.md', '.json', '.mdx', '.html'}:
        continue
    if '\\.git\\' in str(p):
        continue
    if 'reports' in p.parts:
        continue
    paths.append(p)

results = defaultdict(list)
for p in paths:
    try:
        text = p.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue

    for idx, line in enumerate(text.splitlines(), start=1):
        # check in lines only with quotes (content-heavy) to reduce TS noise
        if line.strip().startswith('//'):
            continue

        # Replacement / encoding
        if patterns['replacement_char'].search(line):
            results['replacement_char'].append((p, idx, line.strip()))

        # Placeholder words and obvious junk
        if patterns['placeholder_token'].search(line):
            # ignore generic variable names
            if 'public/' not in str(p) and 'FIXME' not in line:
                results['placeholder_token'].append((p, idx, line.strip()))

        # Mixed scripts in word tokens
        if patterns['mixed_word_cyrillic_latin'].search(line):
            if 'https' not in line and 'http' not in line:
                results['mixed_word_cyrillic_latin'].append((p, idx, line.strip()))
        if patterns['mixed_word_latin_cyrillic'].search(line):
            if 'https' not in line and 'http' not in line:
                results['mixed_word_latin_cyrillic'].append((p, idx, line.strip()))

        # punctuation artifacts
        if patterns['triple_dot'].search(line):
            results['triple_dot'].append((p, idx, line.strip()))

        # only for Russian-facing files, detect suspicious many consecutive spaces
        if 'src/data' in str(p) or 'public/cms' in str(p) or p.name.endswith('.md'):
            if patterns['doubled_space'].search(line) and '  ' in line and not line.strip().startswith('//'):
                if any(ch.isalpha() for ch in line):
                    # avoid indent-only lines
                    if line.strip() and not line.lstrip().startswith('import') and not line.lstrip().startswith('export'):
                        results['doubled_space'].append((p, idx, line.strip()))

print('SUMMARY')
for k in sorted(results):
    print(f"{k}: {len(results[k])}")

# Print short samples grouped by issue
for k in ['replacement_char','placeholder_token','mixed_word_cyrillic_latin','mixed_word_latin_cyrillic','triple_dot','doubled_space']:
    print('\n---', k, '---')
    for p, idx, line in results.get(k, [])[:120]:
        path = str(p)
        short = line[:180].replace('\t','<TAB>')
        print(f"{path}:{idx}: {short}")
    if len(results.get(k, [])) > 120:
        print(f'... + {len(results[k])-120} more')
