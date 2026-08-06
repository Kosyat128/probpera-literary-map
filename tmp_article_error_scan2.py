import json
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime

ROOT = Path('.')
article_dirs = [ROOT / 'public/articles', ROOT / 'public/cms/articles']
text_fields = ['title','description','sectionLabel','publishedLabel','readingMinutes','readingTime','plainText','contentHtml','seoTitle','seoDescription','ogTitle','ogDescription','excerpt','summary']

rules = {
    'encoding_mojibake': re.compile(r'Р[?-\u0400-\u04FF]{2,}', re.UNICODE),
    'double_space': re.compile(r' {2,}'),
    'space_before_punct': re.compile(r'\s+[,.!?:;]'),
    'weird_chars': re.compile(r'[\x00\x08\x0b\x0c\x0e\x7f]'),
}

bad_link_keywords = ['google.com','vk.com','dzen.ru','facebook.com','twitter.com','t.me','instagram.com','ok.ru']
href_pattern = re.compile(r'href="([^"]+)"', re.IGNORECASE)

report = {
    'generatedAt': datetime.now().isoformat() + 'Z',
    'summary': {'articlesScanned': 0, 'issues': 0},
    'items': defaultdict(list)
}


def iterate_articles():
    for d in article_dirs:
        if not d.exists():
            continue
        for fp in sorted(d.glob('*.json')):
            try:
                txt = fp.read_text(encoding='utf-8')
                data = json.loads(txt)
                yield fp.as_posix(), 'ok', None, data
            except Exception as e:
                yield fp.as_posix(), '__parse_error__', str(e), None


def add_issue(file, field, snippet, rule):
    report['items'][rule].append({'file': file, 'field': field, 'snippet': snippet[:220]})


def text_value(data, field):
    if not isinstance(data, dict):
        return None
    v = data.get(field)
    if v is None:
        return None
    if isinstance(v, (int, float, bool)):
        return str(v)
    return str(v)

for file, status, err, data in iterate_articles():
    if status != 'ok':
        report['summary']['issues'] += 1
        report['summary']['articlesScanned'] += 1
        report['items']['parse_error'].append({'file': file, 'field': 'json', 'snippet': err})
        continue

    if isinstance(data, list):
        # many CMS exports may wrap items in array
        items = data
    elif isinstance(data, dict):
        items = [data]
    else:
        report['summary']['articlesScanned'] += 1
        report['items']['wrong_root_type'].append({'file': file, 'field':'root', 'snippet': type(data).__name__})
        continue

    for item in items:
        report['summary']['articlesScanned'] += 1

        if not (text_value(item, 'title') or '').strip():
            add_issue(file, 'title', '<empty>', 'empty_title')
        if not (text_value(item, 'url') or '').strip():
            add_issue(file, 'url', '<empty>', 'empty_url')

        for field in text_fields:
            val = text_value(item, field)
            if not val:
                continue

            if rules['encoding_mojibake'].search(val):
                add_issue(file, field, val, 'encoding_mojibake')
            if rules['weird_chars'].search(val):
                add_issue(file, field, val, 'weird_chars')

            for m in rules['double_space'].finditer(val):
                idx = m.start()
                snippet = val[max(0, idx - 20):min(len(val), idx + 40)]
                add_issue(file, field, snippet, 'double_space')

            for m in rules['space_before_punct'].finditer(val):
                idx = m.start()
                snippet = val[max(0, idx - 20):min(len(val), idx + 40)]
                add_issue(file, field, snippet, 'space_before_punctuation')

        chtml = text_value(item, 'contentHtml') or ''
        for m in href_pattern.finditer(chtml):
            u = m.group(1)
            if any(k.lower() in u.lower() for k in bad_link_keywords):
                add_issue(file, 'contentHtml.href', u, 'bad_link')

        txt_for_tokens = text_value(item, 'plainText') or text_value(item, 'description') or ''
        words = [w for w in re.findall(r'\S+', txt_for_tokens) if len(w) > 90]
        if words:
            add_issue(file, 'plainText', words[0], 'very_long_token')

for k, v in list(report['items'].items()):
    report['summary'][k] = len(v)
    report['summary']['issues'] += len(v)

report['summary']['issues_by_rule'] = {k: len(v) for k, v in report['items'].items()}

# compact preview
for k in list(report['items'].keys()):
    report['items'][k] = report['items'][k][:30]

print(json.dumps(report, ensure_ascii=False, indent=2))
