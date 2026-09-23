import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({ testDir: fileURLToPath(new URL('../../../../../tests/pwa', import.meta.url)),
 testMatch:['booky-journey.spec.mjs'], grep:/journey focus:|actual reviewed fixture follows|confirmed journey progress restores|future journey progress remains|explicit reviewed journey migration|history selection never navigates/,
 timeout:120000,workers:1,retries:0,outputDir:process.env.S15_BROWSER_OUTPUT,reporter:[['json',{outputFile:process.env.S15_BROWSER_REPORT}]] });
