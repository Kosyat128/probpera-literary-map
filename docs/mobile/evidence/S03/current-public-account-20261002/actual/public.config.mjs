import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.env.D262_ROOT,run=process.env.D262_RUN,origin=process.env.D262_ORIGIN;
if(!root||!run||!/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin??''))throw new Error('Missing owned public account run');
const require=createRequire(path.join(root,'package.json'));
const {defineConfig,devices}=require('@playwright/test');
export default defineConfig({testDir:path.join(root,'tests/e2e'),testMatch:'planet-account-pages.spec.mjs',outputDir:path.join(run,'browser-output'),timeout:45000,expect:{timeout:10000},workers:1,retries:0,fullyParallel:false,reporter:[['json']],use:{baseURL:origin,channel:'msedge',trace:'off',video:'off',screenshot:'off'},projects:[{name:'current-public-mobile',use:{...devices['Pixel 7']}}]});
