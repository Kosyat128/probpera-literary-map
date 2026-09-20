import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
  test: { include: ['src/components/globeStandInspection.test.ts', 'src/components/GlobeCameraRig.test.tsx',
    'src/host/planetStandInspection.test.ts'], environment: 'node', maxWorkers: 1, retry: 0 } });
