import { defineConfig } from '@playwright/test';
const globe = process.env.S11_MODE === 'globe';
export default defineConfig({ testDir: globe ? '../../../../../tests/host' : '../../../../../tests/pwa',
 testMatch: globe ? 'native-planet.spec.mjs' : ['optional-uninstall.spec.mjs', 'storage-management.spec.mjs', 'download-network-policy.spec.mjs'],
 grep: globe ? /downloads live in the actual globe collection|native host background/ : undefined,
 timeout: 90000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1, retries: 0,
 outputDir: process.env.S11_BROWSER_OUTPUT,
 reporter: [['json', { outputFile: process.env.S11_BROWSER_REPORT }]],
});
