import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPublishedNewsFeed } from './lib/literary-news-publication.mjs';
import { pendingNewsSourceState } from './lib/literary-news-state.mjs';
import { literaryNewsDailyReadiness } from './lib/literary-news-daily-readiness.mjs';
import { readNewsMediaBytes } from './lib/literary-news-media.mjs';
import destinations from '../data/news/social-destinations.json' with {type:'json'};
import registry from '../data/news/social-media-assets.json' with {type:'json'};

const current = new Date();
const root = fileURLToPath(new URL('../', import.meta.url));
const release = process.env.GITHUB_SHA || execFileSync('git', ['-c', `safe.directory=${root.replace(/\\/g,'/')}`,
  'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const records = JSON.parse(await readFile(new URL('../data/news/reviewed.json', import.meta.url), 'utf8'));
const withdrawals = JSON.parse(await readFile(new URL('../data/news/withdrawals.json', import.meta.url), 'utf8'));
const feed = await buildPublishedNewsFeed({ records, withdrawals, current, release,
  state: pendingNewsSourceState(), timeZone: 'Europe/Moscow' });
const report = await literaryNewsDailyReadiness({ feed, destination: destinations.destinations.find(d=>d.platform==='telegram'),
  current, mediaOptions: { registry, now: current,readBytes:readNewsMediaBytes }, publication: 'local_preparation' });
await mkdir('.tmp/literary-news-daily', {recursive:true});
await writeFile('.tmp/literary-news-daily/readiness.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ scope: report.publication, day: report.day, counts: report.counts, heldReasons: report.heldReasons }));
