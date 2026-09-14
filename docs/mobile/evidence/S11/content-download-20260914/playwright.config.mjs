import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../tests/pwa', testMatch: 'content-package-download.spec.mjs',
  timeout: 90000, fullyParallel: false, workers: 1, retries: 0,
  outputDir: './browser-output-' + process.env.S11_ATTEMPT,
  reporter: [['json', { outputFile: process.env.S11_BROWSER_REPORT }]],
});
