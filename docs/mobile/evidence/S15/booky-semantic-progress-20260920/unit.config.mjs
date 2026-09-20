import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const entry = JSON.parse(readFileSync(new URL('./entry.json', import.meta.url), 'utf8'));
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
 test: { include: entry.unitFiles, environment: 'node', maxWorkers: 1, retry: 0 } });
