import { load } from 'cheerio';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DIR = 'reports/r10/sources';
export const sha = value => createHash('sha256').update(value).digest('hex');
export function safeAddress(ip) {
  if (isIP(ip) === 4) {
    const [a,b]=ip.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===198&&(b===18||b===19)));
  }
  return isIP(ip) === 6 && !/^(?:\:\:|fc|fd|fe[89ab]|ff)/i.test(ip);
}
export async function boundedFetch(input, { timeout = 12000, maxBytes = 2 * 1024 * 1024, allowedHosts, encoding: pinnedEncoding, includeBytes = false } = {}) {
  let url = new URL(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    for (let redirects = 0; redirects < 4; redirects++) {
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('unsafe_destination');
      if (allowedHosts && !allowedHosts.has(url.hostname)) throw new Error('unapproved_redirect');
      const ips = await lookup(url.hostname, { all: true });
      if (!ips.length || !ips.every(x => safeAddress(x.address))) throw new Error('private_destination');
      const response = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'ProbperaSourceResearch/1.0 (+https://probpera.ru)', Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9' } });
      if (response.status >= 300 && response.status < 400) {
        const next = new URL(response.headers.get('location'), url);
        const base = h => h.replace(/^www\./, '');
        if (base(next.hostname) !== base(url.hostname) && !allowedHosts?.has(next.hostname)) throw new Error('external_redirect:' + next.origin);
        url = next;
        continue;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) throw new Error('http_' + response.status);
      if (!/(?:html|xml|text\/plain)/i.test(contentType)) throw new Error('unsupported_content_type:' + contentType);
      if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('response_too_large');
      const parts = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > maxBytes) { controller.abort(); throw new Error('response_too_large'); }
        parts.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(parts);
      if (pinnedEncoding && !['utf-8', 'windows-1252'].includes(pinnedEncoding)) throw new Error('unsupported_encoding');
      const encoding = pinnedEncoding || /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] || 'utf-8';
      let text;
      try { text = new TextDecoder(encoding).decode(bytes); } catch { text = bytes.toString('utf8'); }
      if (/just a moment\.\.\.|checking your browser|verify you are human|captcha-container/i.test(text.slice(0, 120000))) throw new Error('challenge_document');
      return { url: url.href, status: response.status, contentType, bytes: size, sha256: sha(bytes), text,
        ...(includeBytes ? { rawBytes: bytes } : {}), accessedAt: new Date().toISOString() };
    }
    throw new Error('too_many_redirects');
  } finally { clearTimeout(timer); }
}
export async function pool(entries, worker, concurrency = 4) {
  let cursor = 0;
  const results = new Array(entries.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (cursor < entries.length) { const i = cursor++; results[i] = await worker(entries[i], i); }
  }));
  return results;
}
async function cenl() {
  const d = JSON.parse(await readFile(DIR + '/directory-0.json', 'utf8'));
  const entries = [...new Map(d.links.filter(x => x.url.includes('/library/')).map(x => [x.url, x])).values()];
  const result = await pool(entries, async (entry, i) => {
    try {
      const r = await boundedFetch(entry.url);
      const $ = load(r.text);
      const links = [];
      $('a[href]').each((_, e) => { const a = $(e); try { const u = new URL(a.attr('href'), r.url); if (/^https?:$/.test(u.protocol) && !/cenl\.org$/.test(u.hostname) && !/facebook|twitter|youtube|instagram|linkedin/.test(u.hostname)) links.push({ url: u.href, label: a.text().trim() }); } catch {} });
      console.log('directory', i + 1, entry.label.split('/').at(-1), links.length);
      return { ...entry, accessedAt: r.accessedAt, sha256: r.sha256, links };
    } catch (error) { console.log('directory-error', i + 1, error.message); return { ...entry, error: error.message }; }
  }, 2);
  await writeFile(DIR + '/cenl-directory-details.json', JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[2] === 'cenl') { await mkdir(DIR, { recursive: true }); await cenl(); }
