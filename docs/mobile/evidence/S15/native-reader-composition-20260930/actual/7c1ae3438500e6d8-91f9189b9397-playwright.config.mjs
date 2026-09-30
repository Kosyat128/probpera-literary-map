import {createRequire} from 'node:module';
const {defineConfig}=createRequire('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work/package.json')('@playwright/test');
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
if(!process.env.S15_FOCUS_EVIDENCE_FOLDER)throw Error('Explicit bound evidence folder required');
const entry=JSON.parse(fs.readFileSync(process.env.S15_FOCUS_EVIDENCE_FOLDER+'/entry.json','utf8'));
const escape=title=>[...title].map(c=>c.charCodeAt(0)===92||'^$.*+?()[]{}|'.includes(c)?String.fromCharCode(92)+c:c).join('');
export default defineConfig({testDir:'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work/tests/pwa',testMatch:entry.browserFiles.map(file=>file.split('/').pop()),grep:new RegExp('(?:'+entry.browserTestTitles.map(escape).join('|')+')$'),timeout:120000,workers:1,retries:0,outputDir:process.env.S15_BROWSER_OUTPUT,reporter:[['json',{outputFile:process.env.S15_BROWSER_REPORT}]]});
