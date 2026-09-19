import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../../../../../tests/pwa',testMatch:'globe-stand-customization.spec.mjs',
 timeout:120000,expect:{timeout:15000},workers:1,retries:0,outputDir:process.env.S13_BROWSER_OUTPUT,
 reporter:[['json',{outputFile:process.env.S13_BROWSER_REPORT}]]});
