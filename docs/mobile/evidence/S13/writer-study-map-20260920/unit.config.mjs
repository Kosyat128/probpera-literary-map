import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
  test: { include: ['src/components/globeWriterStudyGeometry.test.ts'], environment: 'node', maxWorkers: 1, retry: 0 } });
