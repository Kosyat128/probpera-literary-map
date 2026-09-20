import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({ testDir: fileURLToPath(new URL('../../../../../tests/pwa', import.meta.url)),
  testMatch: 'reading-library.spec.mjs', timeout: 120000, workers: 1, retries: 0,
  outputDir: process.env.S11_BROWSER_OUTPUT, reporter: [['json', { outputFile: process.env.S11_BROWSER_REPORT }]] });
