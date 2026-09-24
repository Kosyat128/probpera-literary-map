import fs from 'node:fs';
const entry=JSON.parse(fs.readFileSync(new URL('./entry.json',import.meta.url),'utf8'));
export default { cacheDir: "D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-playful-poses-evidence/vitest-cache", test: { environment: 'node', maxWorkers: 1, retry: 0, include: entry.unitFiles } };
