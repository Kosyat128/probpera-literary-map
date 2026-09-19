import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'../../../../../tests/pwa',testMatch:'reading-progress.spec.mjs',
 timeout:60000,expect:{timeout:10000},workers:1,retries:0,outputDir:process.env.S11_BROWSER_OUTPUT,
 reporter:[['json',{outputFile:process.env.S11_BROWSER_REPORT}]]});
