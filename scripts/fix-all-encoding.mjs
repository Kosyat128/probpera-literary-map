import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetPaths = [
  ...readdirSync(path.join(root, 'public', 'articles'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join('public/articles', file)),
  ...readdirSync(path.join(root, 'public', 'cms', 'articles'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join('public/cms/articles', file)),
];

const TARGET_KEYS = new Set([
  'title',
  'subtitle',
  'lead',
  'description',
  'summary',
  'content',
  'contentHtml',
  'contenthtml',
  'text',
  'intro',
  'excerpt',
  'bio',
  'biography',
  'about',
  'country',
  'region',
  'province',
  'comment',
  'note',
  'notes',
  'name',
  'tagline',
  'heading',
  'subheading',
  'shortDescription',
  'ogDescription',
  'review',
  'quote',
  'answer',
  'question',
  'answerText',
  'label',
]);

const suspicious = /(â€“|â€”|â€œ|â€|â€™|â€¢|â€¦|Â|Ã|Ð|Ñ|�|Â\u20ac|â€¢|â€|â€‘|â€ )/g;
const replacement = /\uFFFD/g;

function decodeMojibake(value) {
  const candidates = [value];

  const latin1ToUtf8 = () => {
    try {
      return Buffer.from(value, 'latin1').toString('utf8');
    } catch {
      return value;
    }
  };

  const entityDecode = () => {
    try {
      return decodeURIComponent(escape(value));
    } catch {
      return value;
    }
  };

  const reversed = () => {
    try {
      return Buffer.from(value, 'utf8').toString('latin1');
    } catch {
      return value;
    }
  };

  candidates.push(latin1ToUtf8());
  candidates.push(entityDecode());
  candidates.push(reversed());

  const uniq = [...new Set(candidates)];

  const score = (v) => {
    const text = String(v ?? '');
    const suspiciousCount = (text.match(suspicious) || []).length;
    const replacementCount = (text.match(replacement) || []).length;
    const controlCount = [...text].filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x20 && code !== 0x0a && code !== 0x0d && code !== 0x09;
    }).length;
    const length = text.length || 1;
    return suspiciousCount * 9 + replacementCount * 13 + controlCount * 20 - Math.min(length * 0.02, 1);
  };

  let best = value;
  let bestScore = score(value);

  for (const candidate of uniq) {
    const candidateScore = score(candidate);
    if (candidateScore + 1 < bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return best;
}

function normalizeText(value, key) {
  if (typeof value !== 'string') {
    return value;
  }

  const hasTarget = TARGET_KEYS.has(key) || TARGET_KEYS.has(key.toLowerCase());

  let next = value
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,:;!?\.\)])\s*/g, '$1 ')
    .trim();

  if (next && hasTarget && (/[А-Яа-яA-Za-z0-9]/.test(next) || suspicious.test(next) || replacement.test(next))) {
    next = decodeMojibake(next);
  }

  return next;
}

function walk(node, onChange, pathStack) {
  if (node === null || node === undefined) return node;

  if (Array.isArray(node)) {
    return node.map((item, index) => walk(item, onChange, `${pathStack}[${index}]`));
  }

  if (typeof node === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(node)) {
      const nextPath = pathStack ? `${pathStack}.${key}` : key;
      const fixed = walk(value, onChange, nextPath);
      if (typeof fixed === 'string' && typeof value === 'string') {
        const normalized = normalizeText(value, key);
        if (normalized !== value) {
          onChange({ path: nextPath, before: value, after: normalized });
          result[key] = normalized;
          continue;
        }
      }
      result[key] = fixed;
    }
    return result;
  }

  return node;
}

let totalFiles = 0;
let totalChanges = 0;
let changedFiles = 0;
const report = [];

for (const relativePath of targetPaths) {
  const absolutePath = path.join(root, relativePath);
  const raw = readFileSync(absolutePath, 'utf8');
  const data = JSON.parse(raw);
  const changes = [];

  const next = walk(data, (item) => changes.push(item), '');

  if (changes.length > 0) {
    writeFileSync(absolutePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    changedFiles += 1;
    totalChanges += changes.length;
    report.push({ file: relativePath, changes: changes.length, samples: changes.slice(0, 8) });
  }

  totalFiles += 1;
}

const summary = {
  files: totalFiles,
  changedFiles,
  totalChanges,
  samples: report.slice(0, 60),
};

console.log(JSON.stringify(summary, null, 2));
