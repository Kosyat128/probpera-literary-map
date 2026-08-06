import json
from collections import Counter

with open('reports/text-full-audit.json', encoding='utf-8') as f:
    d = json.load(f)
issues = d.get('issues', [])
print('total', d.get('total_issues', len(issues)))
counts = Counter(i.get('type') for i in issues)
print('top_types', counts.most_common(20))
for item in issues[:25]:
    print(f"{item.get('file')}:{item.get('line')}: {item.get('type')} -> {str(item.get('sample'))[:150]}")
