/** Browser smoke of exact emitted bytes. OS plugins are explicit simulations;
 * this cannot close installation, native storage, device or full UI gates. */
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath}from'node:url';import{randomUUID}from'node:crypto';import{chromium,expect}from'@playwright/test';import{captureReleaseInputs,sha256}from'./release-readiness.mjs';
const root=await fs.realpath(fileURLToPath(new URL('../../',import.meta.url)));if(process.argv.length!==2)throw new Error('No remote URL/options accepted.');
const out=path.join(root,'.tmp/mobile-native-bundle-smoke-'+randomUUID());await fs.mkdir(out);const input=await captureReleaseInputs(root);const artifact=JSON.parse(await fs.readFile(path.join(root,'dist-native/artifact.json'),'utf8'));
if(artifact.kind!=='literary-planet-bundled-native-preparation'||artifact.platform!=='android'||artifact.channel!=='dev'||artifact.sourceCommit!==input.sourceCommit)throw new Error('Exact android/dev current-commit bundle required');
const files=new Map();for(const item of artifact.inventory){const name=path.resolve(root,'dist-native',item.path);if(!name.startsWith(path.join(root,'dist-native')+path.sep)||(await fs.lstat(name)).isSymbolicLink())throw new Error('Unsafe bundle input');const bytes=await fs.readFile(name);if(sha256(bytes)!==item.sha256||bytes.length!==item.bytes)throw new Error('Bundle digest mismatch');files.set('/'+item.path,bytes);}
const report={schemaVersion:1,startedAt:new Date().toISOString(),binding:input,buildId:artifact.buildId,artifactSha256:sha256(await fs.readFile(path.join(root,'dist-native/artifact.json'))),pluginBoundary:'simulation',installed:false,osStorageObserved:false,releaseReady:false,cases:[],errors:[],screenshots:[],externalRequests:[]};
let browser,context;const preferences=new Map();const origin='https://local-native-bundle.test';
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.exposeBinding('fixturePreference',(_source,method,key,value)=>{if(method==='get')return preferences.get(key)??null;if(method==='set')preferences.set(key,value);else if(method==='remove')preferences.delete(key);return true;});
 await context.addInitScript(()=>{
  window.androidBridge={postMessage(){throw new Error('No actual OS bridge in this browser smoke');}};
  const plugins={App:['getAppLanguage','getState','getLaunchUrl','exitApp'],Network:['getStatus'],Preferences:['get','set','remove'],Browser:['open','close'],AppLauncher:['openUrl','canOpenUrl'],PlanetContentStore:['get','put','remove','keys','capacity'],PlanetSecureStore:['get','set','remove']};
  window.Capacitor={PluginHeaders:Object.entries(plugins).map(([name,methods])=>({name,methods:[...methods.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]})),nativeCallback:()=> 'synthetic-listener',nativePromise:async(plugin,method,options)=>{
   if(method==='removeListener')return{};if(plugin==='App'){if(method==='getAppLanguage')return{value:'ru'};if(method==='getState')return{isActive:true};if(method==='getLaunchUrl')return undefined;return{};}
   if(plugin==='Network')return{connected:false,connectionType:'none'};
   if(plugin==='Preferences'){const value=await window.fixturePreference(method,options.key,options.value);return method==='get'?{value}:{};}
   if(plugin==='PlanetContentStore'){if(method==='capacity')return{availableBytes:256*1024*1024};if(method==='keys')return{keys:[]};throw new Error('Content OS storage is unavailable in this browser smoke');}
   if(plugin==='PlanetSecureStore')throw new Error('Secure OS storage is unavailable in this browser smoke');return{};
  }};
 });
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg'};
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin){report.externalRequests.push(url.origin);await route.abort();return;}const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);const body=files.get(name);if(!body){report.errors.push('MISSING_BUNDLED_RESOURCE:'+name);await route.fulfill({status:404,body:''});return;}await route.fulfill({status:200,body,contentType:mime[path.extname(name)]??'application/octet-stream'});});
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push('PAGE_ERROR:'+error.message));
 page.setDefaultTimeout(12000);
 const record=(id,status,details={})=>report.cases.push({id,status,...details});
 const checkpoint=()=>fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
 const capture=async name=>{const filename=name+'.png';await page.screenshot({path:path.join(out,filename),timeout:10000});const bytes=await fs.readFile(path.join(out,filename));report.screenshots.push({path:filename,sha256:sha256(bytes),locale:await page.locator('html').getAttribute('lang'),visuallyReviewed:false});};
 const attempt=async(id,work)=>{try{const details=await work();record(id,'PASS',details??{});await checkpoint();return true;}catch(error){record(id,'FAIL',{reason:error.message});report.errors.push(id+':'+error.message);try{await capture('failed-'+id);}catch{}await checkpoint();return false;}};
 const menuToggle=page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]');
 const menu=page.locator('.atlas-application-chrome [data-atlas-application-menu-panel]');
 const panel=page.locator('.native-planet-panel'),detail=panel.locator('#book-archive-detail');
 const language=async locale=>{
  if(await page.locator('html').getAttribute('lang')===locale)return;
  if(await panel.isVisible()){await panel.locator('[data-interface-language="'+locale+'"]').click();}
  else{if(await menuToggle.getAttribute('aria-expanded')!=='true')await menuToggle.click();await menu.locator('[data-interface-language="'+locale+'"]').click();}
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
 };
 const collection=async()=>{if(await panel.isVisible())return;if(await menuToggle.getAttribute('aria-expanded')!=='true')await menuToggle.click();await menu.locator('[data-atlas-action="open-collection"]').click();await expect(panel).toBeVisible();};
 const returnToPlanet=async()=>{if(await panel.isVisible()){await panel.getByRole('button',{name:/^(?:Вернуться к планете|Return to the planet)$/u}).click();await expect(panel).toBeHidden();}};
 const search=async query=>{await returnToPlanet();const toggle=page.locator('[data-atlas-action="toggle-search"]');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();const field=page.locator('#country-search');await expect(field).toBeFocused();await field.fill(query);return field;};
 let canvas;
 const retained=async()=>{await expect(page.locator('#atlas canvas')).toHaveCount(1);if(!canvas||!await page.locator('#atlas canvas').first().evaluate((node,old)=>node===old,canvas))throw new Error('Canonical globe canvas replaced');};
 const viewport=async()=>{if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))throw new Error('Small-screen horizontal overflow');};
 const started=await attempt('first-launch',async()=>{
  await page.goto(origin+'/#atlas',{waitUntil:'domcontentloaded',timeout:20000});
  await expect(page.locator('.native-planet-app')).toBeVisible({timeout:20000});await expect(page.locator('[data-atlas-experience]')).toHaveAttribute('data-atlas-view','immersive');
  await expect(page.locator('.native-planet-launch')).toHaveCount(0,{timeout:20000});await expect(page.locator('#atlas canvas').first()).toBeVisible({timeout:20000});
  canvas=await page.locator('#atlas canvas').first().elementHandle();if(!canvas)throw new Error('No actual globe canvas');
  await expect(page.locator('[data-planet-welcome]')).toBeVisible({timeout:20000});await viewport();await capture('welcome-ru');return{freshNonsecretPreferences:true,exactEmittedBundle:true};
 });
 if(started){
  await attempt('welcome-en',async()=>{await language('en');await expect(page.locator('[data-planet-welcome]')).toContainText('Begin your journey');await retained();await viewport();await capture('welcome-en');});
  await attempt('welcome-search',async()=>{await language('ru');await page.locator('[data-planet-welcome-action="search"]').click();await expect(page.locator('#country-search')).toBeFocused();await expect(page.locator('[data-planet-welcome]')).toHaveCount(0);await expect.poll(()=>preferences.get('probpera-planet-welcome-v1')).toBe('completed');return{preferenceBackend:'synthetic-native-boundary'};});
  const workKey='russia:dostoevsky:crime-and-punishment';let favoriteAdded=false;
  for(const locale of ['ru','en']){
   await attempt('locale-'+locale,async()=>{await returnToPlanet();await language(locale);await retained();await viewport();});
   await attempt('country-search-'+locale,async()=>{await search(locale==='ru'?'Россия':'Russia');const option=page.locator('#country-results [data-option-key="country:russia"]');await expect(option).toBeVisible();await option.click();await expect.poll(()=>new URL(page.url()).searchParams.get('country')).toBe('russia');await retained();return{countryId:'russia'};});
   await attempt('writer-search-'+locale,async()=>{const field=await search(locale==='ru'?'Fyodor Dostoevsky':'Фёдор Михайлович Достоевский');const option=page.locator('#country-results [data-option-key="writer:russia:dostoevsky"]');await expect(option).toBeVisible();const id=await option.getAttribute('id');await field.press('Home');for(let step=0;step<12&&await field.getAttribute('aria-activedescendant')!==id;step++)await field.press('ArrowDown');await expect(field).toHaveAttribute('aria-activedescendant',id);await field.press('Enter');await expect.poll(()=>new URL(page.url()).searchParams.get('writer')).toBe('dostoevsky');await expect(page.locator('.writer-detail h4')).toContainText(/Достоевск|Dostoevsky/iu);await retained();await viewport();await capture('writer-'+locale);return{countryId:'russia',writerId:'dostoevsky',input:'keyboard',oppositeLocaleQuery:true};});
   const opened=await attempt('canonical-work-'+locale,async()=>{const title=locale==='ru'?'Преступление и наказание':'Crime and Punishment';await search(title);const option=page.locator('#country-results [data-option-key="book:'+workKey+'"]');await expect(option).toBeVisible();await option.click();await expect(detail).toBeVisible();await expect(detail).toHaveAccessibleName(title);await expect.poll(()=>new URL(page.url()).searchParams.get('book')).toBe(workKey);await retained();await viewport();await capture('work-'+locale);return{canonicalWorkKey:workKey,title};});
   if(opened){
    const reader=detail.locator('.book-dossier-reader');await reader.waitFor({state:'attached',timeout:5000}).catch(()=>undefined);
    if(await reader.count())await attempt('bundled-material-'+locale,async()=>{const read=detail.locator('.book-detail-read-dossier');if(await read.isVisible())await read.click();await expect(reader).toBeVisible();await expect(reader).toHaveAttribute('lang',locale);await expect(reader.locator('.book-dossier-reader__page')).toContainText(/\S/u);await capture('material-'+locale);return{kind:'bundled-book-dossier',fullBookTextClaimed:false,editorialApprovalClaimed:false};});
    else{record('bundled-material-'+locale,'NOT_RUN',{reason:'No dossier reader was present within the bounded wait in the actual emitted bundle; material availability and editorial approval are not inferred.',visibleState:(await detail.innerText()).slice(0,1500)});await checkpoint();}
    await attempt('favorite-'+locale,async()=>{const button=detail.getByRole('button',{name:locale==='ru'?favoriteAdded?'В избранном':'В избранное':favoriteAdded?'In favourites':'Add to favourites',exact:true});
     if(!favoriteAdded){await button.click();favoriteAdded=true;}
     const active=detail.getByRole('button',{name:locale==='ru'?'В избранном':'In favourites',exact:true});await expect(active).toHaveAttribute('aria-pressed','true');return{localOnly:true,nativeOsPersistenceClaimed:false};});
    await attempt('work-back-'+locale,async()=>{await panel.locator('.book-detail-close').click();await expect(detail).toBeHidden();await returnToPlanet();await expect.poll(()=>new URL(page.url()).searchParams.get('book')).toBeNull();await retained();});
   }else{record('bundled-material-'+locale,'NOT_RUN',{reason:'Dependent work opening failed; no material result claimed.'});record('favorite-'+locale,'NOT_RUN',{reason:'Dependent work opening failed.'});record('work-back-'+locale,'NOT_RUN',{reason:'Dependent work opening failed.'});}
   await attempt('local-collection-'+locale,async()=>{await collection();const shelf=panel.locator('#book-collection-shelf');await expect(shelf).toBeVisible();await shelf.selectOption('favorites');
    if(favoriteAdded)await expect(panel.locator('.archive-book-detail[data-book-key="'+workKey+'"]').first()).toBeVisible();
    await viewport();await capture('collection-'+locale);return{selectedShelf:'favorites',canonicalWorkExpected:favoriteAdded,storage:'browser local collection; not native OS attestation'};});
   await attempt('settings-'+locale,async()=>{await collection();const settings=panel.locator('[data-planet-graphics-settings]');await settings.scrollIntoViewIfNeeded();if(await settings.getAttribute('open')===null){await settings.locator('summary').focus();await settings.locator('summary').press('Space');}const economy=settings.locator('[data-planet-quality-option="economy"]');await economy.check();await expect(economy).toBeChecked();await expect.poll(()=>preferences.get('probpera-planet-graphics-quality-v1')).toBe('economy');await viewport();await capture('settings-'+locale);return{keyboardDisclosure:true,preferences:'synthetic-native-boundary'};});
   await attempt('booky-size-'+locale,async()=>{await returnToPlanet();const companion=page.locator('.planet-mascot-controls[data-planet-mascot-pet]');
    if(await companion.getAttribute('data-planet-mascot-active')!=='true')await companion.locator('[data-planet-mascot-toggle]').click();
    if(await companion.locator('[data-planet-mascot-collapse]').isVisible())await companion.locator('[data-planet-mascot-collapse]').click();
    if(!await companion.locator('[data-booky-size="large"]:visible').count())await companion.locator('[data-booky-actions-toggle]').click();
    const size=companion.locator('[data-booky-size="large"]:visible');await size.click();await expect(size).toHaveAttribute('aria-pressed','true');await expect(companion).toHaveAttribute('data-booky-companion-size','large');await expect.poll(()=>preferences.get('probpera-booky-size-v1')).toBe('large');await retained();await viewport();await capture('booky-large-'+locale);return{localizedName:locale==='ru'?'Книжулик':'Mr. Booky',preferences:'synthetic-native-boundary',nativeOsPersistenceClaimed:false};});
  }
  await attempt('small-viewport-keyboard',async()=>{await returnToPlanet();await page.setViewportSize({width:320,height:740});await language('ru');await menuToggle.focus();await menuToggle.press('Enter');await expect(menu).toBeVisible();await menu.locator('[data-interface-language="en"]').focus();await menu.locator('[data-interface-language="en"]').press('Enter');await expect(menu).toBeHidden();await expect(page.locator('html')).toHaveAttribute('lang','en');await retained();await viewport();await capture('small-keyboard-en');return{viewport:{width:320,height:740},keyboard:true};});
  await attempt('ru-en-state-retention',async()=>{await page.setViewportSize({width:390,height:844});await language('ru');await retained();await expect.poll(()=>new URL(page.url()).searchParams.get('country')).toBe('russia');await expect.poll(()=>new URL(page.url()).searchParams.get('writer')).toBe('dostoevsky');await expect.poll(()=>preferences.get('probpera-booky-size-v1')).toBe('large');await capture('final-globe-ru');return{selectedCountry:'russia',selectedWriter:'dostoevsky',bookySize:'large',sameCanvas:true};});
 }
 record('native-auth-payment','NOT_RUN',{reason:'Native edition remains accountless; browser plugin simulation cannot attest configured Auth, deletion, PSP or store payments.'});
 report.sameCanvas=started&&!report.cases.some(test=>test.status==='FAIL'&&/globe|canvas/iu.test(test.reason??''));report.locales=report.cases.filter(test=>test.status==='PASS'&&test.id.startsWith('locale-')).map(test=>test.id.slice(7));if(report.cases.some(test=>test.id==='ru-en-state-retention'&&test.status==='PASS'))report.locales.push('ru');report.shippedOfflineResources=!report.errors.some(error=>error.startsWith('MISSING_BUNDLED_RESOURCE:'));report.networkBlocked=true;
 report.fullProductAcceptance=false;report.limits=['All native plugins are synthetic boundaries.','Local collection uses browser storage, not OS secure storage.','No native Auth/payment, human editorial/legal approval or installed-device acceptance is claimed.'];
 const after=await captureReleaseInputs(root);if(after.sourceFingerprint!==input.sourceFingerprint||after.sourceCommit!==input.sourceCommit)throw new Error('Inputs changed during browser smoke');
 report.pass=report.errors.length===0&&report.externalRequests.length===0&&!report.cases.some(test=>test.status==='FAIL');report.productChainStatus=report.pass?(report.cases.some(test=>test.status==='NOT_RUN')?'PARTIAL':'PASS'):'FAIL';
}catch(error){report.pass=false;report.errors.push(error.message);}finally{await context?.close();await browser?.close();}
report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output:path.relative(root,out),pass:report.pass,errors:report.errors,screenshots:report.screenshots,installed:false,osStorageObserved:false,releaseReady:false}));process.exitCode=report.pass?0:1;
