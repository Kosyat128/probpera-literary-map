import {test} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {resolveConfig} from 'vite';
test('native and PWA preparation disable dotenv and ambient public credentials',async()=>{
 const keys=['LITERARY_PLANET_NATIVE_PLATFORM','LITERARY_PLANET_NATIVE_CHANNEL','VITE_RELEASE_TEST_CANARY','YANDEX_METRIKA_COUNTER_ID'];const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{process.env.LITERARY_PLANET_NATIVE_PLATFORM='android';process.env.LITERARY_PLANET_NATIVE_CHANNEL='dev';process.env.VITE_RELEASE_TEST_CANARY='synthetic-do-not-compile';process.env.YANDEX_METRIKA_COUNTER_ID='invalid-ambient-value';
  for(const name of ['vite.native.config.ts','vite.pwa.config.ts']){const config=await resolveConfig({root:process.cwd(),configFile:path.resolve(name)},'build');assert.equal(config.envDir,false);assert.deepEqual(config.envPrefix,[]);assert.equal(config.env.VITE_RELEASE_TEST_CANARY,undefined);assert.equal(config.define['import.meta.env.VITE_SUPABASE_URL'],'""');assert.equal(config.define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'],'""');assert.equal(config.define.__YANDEX_METRIKA_COUNTER_ID__,'""');assert.equal(config.publicDir,'');}
 }finally{for(const key of keys)saved[key]===undefined?delete process.env[key]:process.env[key]=saved[key];}
});
