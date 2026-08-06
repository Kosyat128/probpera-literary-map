from pathlib import Path

ROOT = Path('apps/admin')

def has_suspicious(text: str) -> bool:
    for ch in text:
        o = ord(ch)
        if 0x00C0 <= o <= 0x00FF:
            return True
    return False

def can_fix_line(line: str):
    if not has_suspicious(line):
        return None

    try:
        fixed = line.encode('cp1251', errors='ignore').decode('utf-8')
    except Exception:
        return None

    if not fixed or fixed == line:
        return None

    if '\\ufffd' in fixed:
        return None

    orig_bad = sum(1 for ch in line if 0x00C0 <= ord(ch) <= 0x00FF)
    fixed_bad = sum(1 for ch in fixed if 0x00C0 <= ord(ch) <= 0x00FF)
    cyr_orig = sum(1 for ch in line if 0x0400 <= ord(ch) <= 0x04FF)
    cyr_fixed = sum(1 for ch in fixed if 0x0400 <= ord(ch) <= 0x04FF)

    if fixed_bad >= orig_bad:
        return None
    if cyr_fixed < max(2, cyr_orig):
        return None

    return fixed

for path in sorted(ROOT.rglob('*')):
    if path.suffix.lower() not in {'.ts', '.tsx', '.css', '.json'}:
        continue

    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        continue

    changed = []
    for idx, line in enumerate(text.splitlines(), 1):
        fixed = can_fix_line(line)
        if fixed is not None:
            changed.append((idx, line, fixed))

    if changed:
        print(f"{path} {len(changed)}")
        for idx, before, after in changed[:12]:
            print('  line', idx)
            print('   before:', before[:180])
            print('   after :', after[:180])
        print('---')
