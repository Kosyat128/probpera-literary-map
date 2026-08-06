import json
import re
from pathlib import Path
from collections import defaultdict

article_dirs=[Path('public/articles'), Path('public/cms/articles')]
text_fields=['title','description','sectionLabel','publishedLabel','readingMinutes','readingTime','plainText','contentHtml','seoTitle','seoDescription','ogTitle','ogDescription','excerpt','summary']

rules = {
    'encoding_mojibake': re.compile(r'Ð[?-Ÿ]{2,}', re.UNICODE),
    'double_space': re.compile(r' {2,}'),
    'space_before_punct': re.compile(r'\s+[,\.\!\?:;]'),
    'weird_chars': re.compile(r'[\u0000\u0008\u000b\u000c\u000e\u007f]'),
}

bad_link_keywords=['google.com','vk.com/probperra','dzen.ru/probaperra','facebook.com','twitter.com']
href_pattern=re.compile(r'href="([^"]+)"', re.IGNORECASE)

report={
    'generatedAt': __import__('datetime').datetime.utcnow().isoformat()+'Z',
    'summary': {'articlesScanned':0,'issues':0},
    'items': defaultdict(list)
}


def iterate_articles():
    for d in article_dirs:
        for fp in sorted(d.glob('*.json')):
            try:
                data=json.loads(fp.read_text(encoding='utf-8'))
                yield fp.as_posix(), 'ok', None, data
            except Exception as e:
                yield fp.as_posix(), '__parse_error__', str(e), None


def add_issue(file, field, snippet, rule):
    report['items'][rule].append({'file':file,'field':field,'snippet':snippet[:220]})


def text_value(data, field):
    v=data.get(field)
    if v is None:
        return None
    if isinstance(v,(int,float,bool)):
        return str(v)
    return str(v)

for file, status, err, data in iterate_articles():
    if status != 'ok':
        report['summary']['issues'] += 1
        report['items']['parse_error'].append({'file':file,'field':'json','snippet':err})
        report['summary']['articlesScanned'] += 1
        continue

    report['summary']['articlesScanned'] += 1

    if not text_value(data, 'title') or not text_value(data, 'title').strip():
        add_issue(file, 'title', '<empty>', 'empty_title')
    if not text_value(data, 'url') or not text_value(data, 'url').strip():
        add_issue(file, 'url', '<empty>', 'empty_url')

    for field in text_fields:
        val = text_value(data, field)
        if not val:
            continue

        if rules['encoding_mojibake'].search(val):
            add_issue(file, field, val, 'encoding_mojibake')
        if rules['weird_chars'].search(val):
            add_issue(file, field, val, 'weird_chars')
        for m in rules['double_space'].finditer(val):
            idx=m.start()
            snippet=val[max(0, idx-20):min(len(val), idx+40)]
            add_issue(file, field, snippet, 'double_space')
        for m in rules['space_before_punct'].finditer(val):
            idx=m.start()
            snippet=val[max(0, idx-20):min(len(val), idx+40)]
            add_issue(file, field, snippet, 'space_before_punctuation')

    chtml = text_value(data,'contentHtml') or ''
    for m in href_pattern.finditer(chtml):
        u=m.group(1)
        if any(k.lower() in u.lower() for k in bad_link_keywords):
            add_issue(file, 'contentHtml.href', u, 'bad_link')

    txt = text_value(data,'plainText') or text_value(data,'description') or ''
    words = [w for w in re.findall(r'\S+', txt) if len(w) > 80]
    if words:
        add_issue(file, 'plainText', words[0], 'very_long_token')

for k,v in report['items'].items():
    report['summary'][k]=len(v)
    report['summary']['issues'] += len(v)

report['summary']['issues_by_rule'] = {k:len(v) for k,v in report['items'].items()}

# keep preview only
a=report['items']
for k in list(a.keys()):
    a[k]=a[k][:200]

print(json.dumps(report, ensure_ascii=False, indent=2))
