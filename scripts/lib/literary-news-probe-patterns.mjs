/** Research input is data, never an arbitrary regular expression. */
export function probePathPattern(urls) {
  const patterns = new Set();
  for (const href of urls.slice(0, 12)) {
    const url = new URL(href), pathname = url.pathname;
    if (url.protocol !== 'https:' || pathname.length > 2048) throw new Error('probe_path_invalid');
    if (/^\/\d{4}\/\d{2}\//.test(pathname)) patterns.add('^/\\d{4}/\\d{2}/(?:\\d{2}/)?[^/]+/?$');
    else if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:news|noticias|actualites|aktuelles|novosti|aktualnosci|articles|blog|events|press|presse|nieuws|nyheter|event|en-news|novinky)\//i.test(pathname)) {
      const parts = pathname.split('/').filter(Boolean);
      const depth = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0]) ? 2 : 1;
      patterns.add('^' + RegExp.escape('/' + parts.slice(0, depth).join('/') + '/') + '.+');
    } else if (pathname.split('/').filter(Boolean).length === 1 && !/\.[a-z]+$/i.test(pathname)) patterns.add('^/[^/]{12,}/?$');
    else if (url.search && /\.(?:php|asp)$/.test(pathname)) patterns.add('^' + RegExp.escape(pathname) + '$');
    else {
      const parent = '/' + pathname.split('/').filter(Boolean).slice(0, -1).join('/') + '/';
      patterns.add('^' + RegExp.escape(parent) + '[^/]+/?$');
    }
  }
  if (!patterns.size) throw new Error('no_literary_article_links');
  return new RegExp([...patterns].slice(0, 6).join('|'));
}

export function checkedProbeSourceId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(value)
    || ['constructor', 'prototype'].includes(value)) throw new Error('probe_source_id_invalid');
  return value;
}
