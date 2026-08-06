import json
import re
import pathlib
root=pathlib.Path('.')
files=list(root.joinpath('public','articles').glob('*.json'))+list(root.joinpath('public','cms','articles').glob('cms-*.json'))
pat_susp=re.compile(r'[\u00C2\u00C3\u00D0\u00D1]|â|Ã|Ð|\uFFFD')
pat_doubles=re.compile(r'\s{2,}')
moji_total=0
double_total=0
for fp in files:
    text=fp.read_text(encoding='utf-8')
    data=json.loads(text)
    s=json.dumps(data,ensure_ascii=False)
    m=pat_susp.findall(s)
    d=len(pat_doubles.findall(s))
    if m:
        moji_total+=len(m)
        print(f"{fp.as_posix()} mojibake_like={len(m)}")
    double_total += d
print('moji_total',moji_total)
print('double_total',double_total)
