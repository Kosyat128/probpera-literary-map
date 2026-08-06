import json
from pathlib import Path
ROOT=Path(r'C:/Users/User/Documents/Codex/2026-07-26/new-chat/work/probpera-literary-map')
rep=json.loads((ROOT/'reports'/'text-audit-articles-only.json').read_text(encoding='utf-8'))
items=rep['items']['double_space']
for file,field,snip in items[:20]:
    txt=snip
    try:
        rec=txt.encode('cp1251').decode('utf-8')
    except Exception as e:
        rec='ERR:'+str(type(e).__name__)
    print(file,field)
    print('txt:',txt)
    print('rec:',rec)
    print()
