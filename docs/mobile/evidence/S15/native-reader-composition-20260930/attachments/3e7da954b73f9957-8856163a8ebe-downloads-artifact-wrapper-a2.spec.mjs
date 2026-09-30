import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import fs from 'node:fs/promises';
const ROOT='C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work',require=createRequire(pathToFileURL(ROOT+'/package.json'));const {test}=require('@playwright/test');const records=new WeakMap();
test.beforeEach(async({page,context},testInfo)=>{
  const began=Date.now(),record={schemaVersion:1,passiveOnly:true,originalAssertionsUnchanged:true,cacheReadMethod:'read-only CDP CacheStorage',samples:[],errors:[],versions:[],registrations:[],requestFailures:[]};
  const elapsed=()=>Date.now()-began,push=(key,value)=>{if(record[key].length<256)record[key].push({elapsedMs:elapsed(),...value});};let cdp=null,pending=null;
  const failed=request=>push('requestFailures',{method:request.method(),url:request.url(),error:request.failure()?.errorText??null});context.on('requestfailed',failed);
  try{cdp=await context.newCDPSession(page);cdp.on('ServiceWorker.workerErrorReported',value=>push('errors',value));cdp.on('ServiceWorker.workerVersionUpdated',value=>push('versions',value));cdp.on('ServiceWorker.workerRegistrationUpdated',value=>push('registrations',value));await cdp.send('ServiceWorker.enable');}catch(error){push('errors',{observerSetupError:error.message});}
  async function sample(kind){
    if(pending)await pending;if(record.samples.length>=30)return;
    pending=(async()=>{try{
      const value=await page.evaluate(async()=>{const item=value=>value?{scriptURL:value.scriptURL,state:value.state}:null;const service=navigator.serviceWorker;const registrations=service?await service.getRegistrations():[];return{href:location.href,secureContext:isSecureContext,supported:!!service,controller:item(service?.controller),registrations:registrations.map(value=>({scope:value.scope,installing:item(value.installing),waiting:item(value.waiting),active:item(value.active)}))};});
      let cacheCounts=null,cacheError=null;
      if(cdp){try{const names=await cdp.send('CacheStorage.requestCacheNames',{securityOrigin:new URL(value.href).origin});cacheCounts=await Promise.all(names.caches.filter(value=>value.cacheName.startsWith('literary-planet-pwa-v1-')).map(async value=>{const entries=await cdp.send('CacheStorage.requestEntries',{cacheId:value.cacheId,skipCount:0,pageSize:1});return{name:value.cacheName,entries:entries.returnCount};}));}catch(error){cacheError=error.message;}}
      record.samples.push({elapsedMs:elapsed(),kind,...value,cacheCounts,cacheError});
    }catch(error){record.samples.push({elapsedMs:elapsed(),kind,readError:error.message});}})();try{await pending;}finally{pending=null;}
  }
  const timer=setInterval(()=>{void sample('interval');},5000);records.set(testInfo,{record,sample,timer,cdp,failed});
});
test.afterEach(async({context},testInfo)=>{
  const state=records.get(testInfo);if(!state)return;clearInterval(state.timer);await state.sample('after-test');context.off('requestfailed',state.failed);
  state.record.actualTestStatus=testInfo.status;state.record.expectedTestStatus=testInfo.expectedStatus;state.record.limits={eventsPerCategory:256,cacheSamples:30,intervalMs:5000};
  if(state.cdp){try{await state.cdp.detach();}catch(error){state.record.observerDetachError=error.message;}}
  const bytes=Buffer.from(JSON.stringify(state.record,null,2)+'\n');await fs.writeFile(testInfo.outputPath('service-worker-diagnostics.json'),bytes,{flag:'wx'});await testInfo.attach('service-worker-diagnostics',{body:bytes,contentType:'application/json'});
});
await import(pathToFileURL(await fs.realpath(ROOT+'/tests/pwa/downloads-artifact.spec.mjs')).href);
