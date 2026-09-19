import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const selection = process.env.S13_UNIT_SELECTION ?? 'unit';
assert.ok(['unit', 'adapter-allowlists'].includes(selection));
const unitFiles = [
  'src/components/globeCeramicPortraitStandGeometry.test.ts',
  'src/planet/globeCeramicPortraitStandPolicy.test.ts',
];
const adapterFiles = [
  'src/host/HostPlatformServices.test.ts',
  'src/platform/adapters/web/WebPlatformAdapter.test.ts',
];

export default defineConfig({
  root: fileURLToPath(new URL('../../../../../', import.meta.url)),
  test: {
    include: selection === 'unit' ? unitFiles : adapterFiles,
    ...(selection === 'adapter-allowlists' ? {
      testNamePattern: /round-trips only exact adult stand choices (?:through the stand preference key|without extending browser storage authority)$/u,
    } : {}),
    environment: 'node',
    maxWorkers: 2,
    retry: 0,
  },
});
