import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const entry=JSON.parse(fs.readFileSync(new URL('./entry.json',import.meta.url),'utf8'));
export default defineConfig({testDir:fileURLToPath(new URL('../../../../../tests/pwa',import.meta.url)),testMatch:entry.browserFiles.map(file=>file.split('/').pop()),timeout:120000,workers:1,retries:0,outputDir:process.env.S15_BROWSER_OUTPUT,reporter:[['json',{outputFile:process.env.S15_BROWSER_REPORT}]]});
