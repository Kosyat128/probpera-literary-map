import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
  test: { include: ['src/host/planetMascot.test.ts', 'src/books/bookArchiveAuthorRequest.test.ts'], environment: 'node', maxWorkers: 1, retry: 0 } });
