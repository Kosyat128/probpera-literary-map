from pathlib import Path
bad=[]
chars=['\u00d0', '\u00c3', '\u0402', '\u0453', '\u0421', '\u0420']
for p in Path('apps/admin').rglob('*.tsx'):
    text=p.read_text(encoding='utf-8')
    if any(ch in text for ch in chars):
        bad.append((p, sum(1 for ch in text if ch in chars)))
for p,c in bad:
    print(p, c)
print('count', len(bad))
