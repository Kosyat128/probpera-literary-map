import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const entry=JSON.parse(fs.readFileSync(new URL('./entry-a2.json',import.meta.url),'utf8'));
const escape=title=>[...title].map(c=>c.charCodeAt(0)===92||'^$.*+?()[]{}|'.includes(c)?String.fromCharCode(92)+c:c).join('');
export default defineConfig({testDir:fileURLToPath(new URL('../../../../../tests/pwa',import.meta.url)),testMatch:entry.browserFiles.map(file=>file.split('/').pop()),grep:new RegExp('(?:'+entry.browserTestTitles.map(escape).join('|')+')$'),timeout:120000,workers:1,retries:0,outputDir:process.env.S15_BROWSER_OUTPUT,reporter:[['json',{outputFile:process.env.S15_BROWSER_REPORT}]]});
