import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(pathToFileURL('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work/package.json'));const {defineConfig}=require('@playwright/test');
export default defineConfig({testDir:'D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-reader-foreground-review/runtime-build-diagnostic-review-a2',testMatch:'downloads-artifact-wrapper-a2.spec.mjs',timeout:120000,expect:{timeout:15000},fullyParallel:false,workers:1,retries:0,
  outputDir:process.env.S15_PWA_OUTPUT,reporter:[['json',{outputFile:process.env.S15_PWA_REPORT}]],
  use:{baseURL:process.env.PWA_QA_ORIGIN,channel:process.env.S15_BROWSER_CHANNEL??'msedge',viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,
    serviceWorkers:'allow',reducedMotion:'reduce',screenshot:'only-on-failure',trace:'retain-on-failure'}});
