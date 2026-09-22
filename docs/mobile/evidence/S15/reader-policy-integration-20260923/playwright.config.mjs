import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({ testDir: fileURLToPath(new URL('../../../../../tests/pwa', import.meta.url)),
  testMatch: 'booky-reader-policy.spec.mjs', timeout: 120000, workers: 1, retries: 0,
  outputDir: process.env.S15_BROWSER_OUTPUT, reporter: [['json', { outputFile: process.env.S15_BROWSER_REPORT }]] });
