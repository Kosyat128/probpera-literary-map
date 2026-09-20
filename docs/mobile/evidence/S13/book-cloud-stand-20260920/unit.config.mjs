import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
  test: { include: ['src/components/globeBookCloudStandGeometry.test.ts', 'src/host/HostPlatformServices.test.ts',
    'src/host/planetStandCustomization.test.ts', 'src/planet/globeComposition.test.ts'], environment: 'node', maxWorkers: 1, retry: 0 } });
