import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '../../../../../tests/pwa', testMatch: 'downloads-artifact.spec.mjs',
 timeout: 120000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1, retries: 0,
 outputDir: process.env.S15_PWA_OUTPUT,
 reporter: [['json', { outputFile: process.env.S15_PWA_REPORT }]],
 use: { baseURL: process.env.PWA_QA_ORIGIN, channel: process.env.S15_BROWSER_CHANNEL ?? 'msedge', viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'allow', reducedMotion: 'reduce', screenshot: 'only-on-failure' },
});
