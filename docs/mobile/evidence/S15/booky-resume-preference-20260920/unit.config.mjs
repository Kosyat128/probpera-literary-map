import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../', import.meta.url)),
 test: { include: ["src/host/planetMascot.test.ts","src/host/planetMascotPersistence.test.ts","src/host/HostPlatformServices.test.ts","src/platform/adapters/web/WebPlatformAdapter.test.ts"], environment: 'node', maxWorkers: 1, retry: 0 } });
