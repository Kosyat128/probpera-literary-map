import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createNewsService } from './lib/literary-news-feed.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataFile = new URL('../data/news/reviewed.json', import.meta.url);
const sources = JSON.parse(await readFile(new URL('../data/news/sources.json', import.meta.url), 'utf8'));
const service = createNewsService({
  sources,
  readReviewed: async () => JSON.parse(await readFile(dataFile, 'utf8')),
});
const port = Number(process.env.LITERARY_NEWS_PORT || 5188);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid LITERARY_NEWS_PORT');

const server = await createServer({
  root,
  configLoader: 'runner',
  cacheDir: fileURLToPath(new URL('../.tmp/literary-news-vite-cache', import.meta.url)),
  server: { host: '127.0.0.1', port, strictPort: true, open: false },
  plugins: [{
    name: 'local-literary-news',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        if (requestUrl.pathname !== '/__literary-news/feed') return next();
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET');
          return res.end();
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        try {
          res.end(JSON.stringify(await service.getFeed(requestUrl.searchParams.get('timeZone'))));
        } catch {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'reviewed_feed_unavailable' }));
        }
      });
    },
  }],
});

await server.listen();
console.log(`Literary news preview: http://127.0.0.1:${port}${server.config.base}news-preview.html`);
console.log(`Homepage preview: http://127.0.0.1:${port}${server.config.base}?literary-news=1#book-day`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { service.close(); await server.close(); process.exit(0); });
}
