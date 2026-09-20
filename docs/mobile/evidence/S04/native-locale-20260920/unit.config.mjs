import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('../../../../../',import.meta.url)),test:{include:['src/host/HostPlatformServices.test.ts','src/platform/adapters/android/AndroidPlatformAdapter.test.ts','tests/host/host-language-status.test.ts','src/i18n/InterfaceLanguage.pwa.test.tsx'],environment:'node',maxWorkers:2,retry:0}});
