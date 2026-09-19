import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../../../../../tests/pwa',testMatch:'content-inspection.spec.mjs',
 timeout:90000,expect:{timeout:15000},workers:1,retries:0,outputDir:process.env.S11_BROWSER_OUTPUT,
 reporter:[['json',{outputFile:process.env.S11_BROWSER_REPORT}]]});
