import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
  test: { include: ['src/components/globeWhaleStandGeometry.test.ts', 'src/components/globeCraftMaterials.test.ts'], environment: 'node', maxWorkers: 1, retry: 0 } });
