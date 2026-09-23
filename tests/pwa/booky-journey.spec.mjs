import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://booky-journey.test';
const KEY = 'probpera-planet-composition-v1';
const BOOKY = 'probpera-booky-adult-v1';
const READER='probpera-booky-reader-policy-v1';
const PROGRESS='probpera-booky-journey-progress-v1';
const PRIMARY_JOURNEY = 'test.actual-app-journey';
const DEPENDENT_JOURNEY = 'test.dependent-journey';
const V1_SEED = {schemaVersion:2,audience:'adult',visible:true,resume:null,progress:[]};
const ASSET = 'src/assets/mascots/knizhulyk-green-v1.png';
const ASSET_SHA = '44f97b5c83189ba1ddca26fd1313edc515e5008a2e92c2c694d1d57c29a2a4ed';
const BASE = { editionId: 'rand-mcnally-1887', standId: 'canonical', backgroundId: 'background.base.site-starfield' };
const CUSTOMIZATION_KEYS = new Set([KEY, 'probpera.globe-edition.v2', 'probpera.globe-style.v1',
  'probpera-planet-stand-v1', 'probpera-planet-background-v1']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' };
let files, selectedAssets, sourceEvidence, bookChunks, primaryBookChunk, retryBookChunk;
let countryChunks, primaryCountryChunk, retryCountryChunk, componentChunks, primaryComponentChunk, retryComponentChunk;

// Test-only interface guidance and synthetic independent receipts. No literary
// facts, production approval, child access or content are supplied by this module.
const SYNTHETIC_CONTENT = `
import { contentTextHash } from '../planet/contentExportHash';
import { getBookyDialogueChecksum, getBookyDialogueContentChecksum } from './bookyDialogueRegistry';
import { bookyJourneyEntityId, bookyJourneyDialogueContext, getBookyJourneyChecksum } from './bookyJourney';
const primaryId='test.actual-app-journey',version=window.__journeyContentMode==='new-version'||window.__journeyContentMode.startsWith('migration-')?2:1,reviewedAt='2026-09-20T12:00:00.000Z';
const routeIds=window.__journeyContentMode.startsWith('history')?[primaryId,'test.dependent-journey']:[primaryId];
const activityMode=window.__journeyContentMode.startsWith('activity');
const definitions=[],dialogues=[],dialogueApprovals=[],journeyApprovals=[],availability=[];
for(const id of routeIds){
for(const locale of ['ru','en']){
  const nodes=[
    {id:'country',kind:'country',screen:'globe',entity:{kind:'country',countryId:'russia'}},
    {id:'writer',kind:'writer',screen:'globe',entity:{kind:'writer',countryId:'russia',writerId:'dostoevsky'}},
    {id:'work',kind:'work',screen:'collection',entity:{kind:'work',countryId:'russia',writerId:'dostoevsky',workId:'crime-and-punishment'}},
    ...(activityMode?[{id:'activity',kind:'activity',screen:'globe',entity:null,activity:{schemaVersion:1,id:'test.match-author',version:1,
      type:'match-work-author',targetWork:{kind:'work',countryId:'russia',writerId:'dostoevsky',workId:'crime-and-punishment'},
      choices:[{id:'dostoevsky',writer:{kind:'writer',countryId:'russia',writerId:'dostoevsky'}},
        {id:'tolstoy',writer:{kind:'writer',countryId:'russia',writerId:'tolstoy'}}]}}]:[]),
    {id:'checkpoint',kind:'checkpoint',screen:'globe',entity:null},
  ].filter(node=>activityMode?['country','activity','checkpoint'].includes(node.id):id===primaryId||['country','checkpoint'].includes(node.id)).map(node=>{
    const title=locale==='ru'?'Тест интерфейса: '+node.id:'Interface test: '+node.id;
    const body=node.kind==='activity'?(locale==='ru'?'Тест задания: выберите автора книги «Преступление и наказание».':'Activity test: choose the author of Crime and Punishment.')
      :locale==='ru'?'Откройте этот экран и подтвердите шаг, когда будете готовы.':'Open this screen and acknowledge the step when you are ready.';
    const payload={id:id+'.'+node.id,locale,version:1,audience:'adult',ageRange:{min:18,max:120},readingLevel:'plain',
      intent:node.kind==='activity'?'activity':'navigation',screens:[node.screen],context:bookyJourneyDialogueContext(id,node),
      entityIds:node.activity?[node.activity.targetWork,...node.activity.choices.map(choice=>choice.writer)].map(bookyJourneyEntityId)
        :node.entity?[bookyJourneyEntityId(node.entity)]:[],claimKind:'interface-guidance',factualSources:[],
      copy:{title,body,caption:body,reduced:title},narration:null,prohibitedTags:[],
      provenance:{kind:'editorial',sourcePath:'tests/pwa/booky-journey.spec.mjs',sourceVersion:1,sourceRef:'synthetic-only:'+node.id,
        sourceSha256:'a'.repeat(64),copySha256:contentTextHash(JSON.stringify({title,body}))}};
    const review={status:'approved',reviewer:'synthetic-dialogue-reviewer-not-real',reviewedAt,contentChecksum:getBookyDialogueContentChecksum(payload)};
    dialogues.push({payload,review,checksum:getBookyDialogueChecksum({payload,review})});
    dialogueApprovals.push({id:payload.id,locale,version:1,contentChecksum:review.contentChecksum,reviewer:review.reviewer,reviewedAt});
    return {...node,dialogue:{id:payload.id,version:1,contentChecksum:review.contentChecksum}};
  });
  const definition={schemaVersion:1,id,version,locale,audience:'adult',ageRange:{min:18,max:120},readingLevel:'plain',
    title:id===primaryId?(locale==='ru'?'Тестовый маршрут интерфейса':'Synthetic interface journey')
      :(locale==='ru'?'Тестовый зависимый маршрут':'Synthetic dependent journey'),
    prerequisites:id===primaryId?[]:[{id:primaryId,version}],nodes};
  definitions.push(definition);
  journeyApprovals.push({id,version,locale,definitionChecksum:getBookyJourneyChecksum(definition),reviewer:'synthetic-journey-reviewer-not-real',reviewedAt});
  availability.push({journeyId:id,version,locale,nodes:nodes.map(node=>({nodeId:node.id,locale,
    dialogueContentChecksum:node.dialogue.contentChecksum,available:true,offlineAvailable:true}))});
}
}
const approved={definitions,dialogues,currentVersions:routeIds.map(id=>({id,version})),dialogueApprovals,journeyApprovals,availability};
const missingReview={...approved,journeyApprovals:[]};
const missingSavedLocaleReview={...approved,journeyApprovals:journeyApprovals.filter(receipt=>receipt.id!==primaryId||receipt.locale!=='ru')};
export function readBookyJourneyContent(){return ['missing-review','activity-missing-review'].includes(window.__journeyContentMode)?missingReview
  :window.__journeyContentMode==='history-missing-ru-review'?missingSavedLocaleReview:approved;}
`;

// Independent synthetic migration receipts are distinct from route and dialogue
// review. Only the test providers supply this history; production stays empty.
const SYNTHETIC_MIGRATION_CONTENT = `
import { readBookyJourneyContent } from './bookyJourneyContent';
import { getBookyJourneyChecksum } from './bookyJourney';
import { getBookyJourneyMigrationChecksum } from './bookyJourneyMigration';
const historicalDefinitions=[],migrations=[],approvedMigrationReceipts=[];
if(window.__journeyContentMode.startsWith('migration-')){
  for(const current of readBookyJourneyContent().definitions){
    const historical={...current,version:1};
    historicalDefinitions.push(historical);
    const migration={schemaVersion:1,id:'test.actual-app-migration.'+current.locale,journeyId:current.id,locale:current.locale,
      fromVersion:1,fromDefinitionChecksum:getBookyJourneyChecksum(historical),
      toVersion:2,toDefinitionChecksum:getBookyJourneyChecksum(current),
      nodeMap:Object.fromEntries(historical.nodes.map(node=>[node.id,node.id])),safeCheckpointId:null};
    migrations.push(migration);
    approvedMigrationReceipts.push({id:migration.id,checksum:getBookyJourneyMigrationChecksum(migration),
      reviewer:'synthetic-independent-migration-reviewer-not-real',reviewedAt:'2026-09-20T12:00:00.000Z'});
  }
}
const reviewed={historicalDefinitions,migrations,approvedMigrationReceipts};
const missingReview={historicalDefinitions,migrations,approvedMigrationReceipts:[]};
export function readBookyJourneyMigrationContent(){
  return window.__journeyContentMode==='migration-missing-review'?missingReview:reviewed;
}
`;

// Actual App, source CSS and existing R3F scene. Native OS/preference bindings
// and HTTP delivery of real split chunks are controlled. Every camera movement uses real product controls or
// a Playwright pointer gesture; the fixture never assigns camera/controls state.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/booky-journey-memory');
  const built = await build({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, loader: 'ts', contents: `
    import{_roots}from'@react-three/fiber';
    import{mountHostApp}from'./src/host/mountHostApp';
    import{createAndroidPlatformAdapter}from'./src/platform/adapters/android/AndroidPlatformAdapter';
    const handles=[];let active=true,networkState={connected:true,connectionType:'wifi'};
    const subscribe=async(event,listener)=>{const handle={event,listener,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle};
    const bindings={core:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true},
      app:{getAppLanguage:async()=>({value:'ru-RU'}),getState:async()=>({isActive:active}),getLaunchUrl:async()=>undefined,addListener:subscribe},
      network:{getStatus:async()=>networkState,addListener:subscribe},
      preferences:{get:async({key})=>({value:await window.__osPreference('get',key)}),
        set:async({key,value})=>{await window.__osPreference('set',key,value,window.__bookyJourneyFixture.sample?.()??null)},
        remove:async({key})=>{await window.__osPreference('remove',key)}},
      browser:{open:async()=>{throw Error('External browser unavailable in this source fixture')}},appLauncher:{openUrl:async()=>({completed:false})}};
    const scenes=()=>[..._roots.entries()].map(([canvas,root])=>{const s=root.store.getState();
      return{canvas,renderer:s.gl,camera:s.camera,scene:s.scene,controls:s.controls,invalidate:s.invalidate}});
    const current=()=>scenes().find(value=>document.querySelector('#atlas')?.contains(value.canvas));
    const rounded=array=>array.map(n=>Number(n.toFixed(5)));
    const pose=root=>({position:rounded(root.camera.position.toArray()),quaternion:rounded(root.camera.quaternion.toArray()),
      zoom:root.camera.zoom,fov:root.camera.fov,target:root.controls?rounded(root.controls.target.toArray()):null});
    let original=null;
    window.__bookyJourneyFixture={scenes,remember:()=>{original=current()},
      setConnectivity(value){networkState=value;for(const handle of handles)if(!handle.removed&&handle.event==='networkStatusChange')handle.listener(value);},
      setVisible(value){active=value;for(const handle of handles)if(!handle.removed&&handle.event==='appStateChange')handle.listener({isActive:value});},
      sample(){const root=current();if(!root)return null;const stands=[],backgrounds=[],surfaces=[],mascotObjects=[];
        root.scene.traverse(object=>{if(object.name==='globe-planetka'||object.name.startsWith('planetka-')||object.name.startsWith('booky-'))mascotObjects.push(object.name);if(object.name.startsWith('included-globe-stand:'))stands.push(object);
          if(object.name.startsWith('included-globe-background:'))backgrounds.push(object);
          if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius===1
            &&object.material?.isMeshPhysicalMaterial&&object.material.map?.isCanvasTexture)surfaces.push(object)});
        const surface=surfaces[0],map=surface?.material.map,gpu=map?root.renderer.properties.get(map):null;
        return{selection:{editionId:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-edition'),
          standId:stands[0]?.userData.standId??'canonical',backgroundId:backgrounds[0]?.userData.backgroundId??'background.base.site-starfield'},
          quality:document.querySelector('#atlas .literary-globe')?.getAttribute('data-globe-quality-tier'),
          mascotObjects,backgroundResource:backgrounds[0]?.uuid??null,
          standCount:stands.length,backgroundCount:backgrounds.length,surfaceCount:surfaces.length,
          sameScene:!!original&&root.canvas===original.canvas&&root.renderer===original.renderer&&root.camera===original.camera&&root.scene===original.scene,
          pose:pose(root),url:location.href,texture:map?.uuid,geometry:surface?.geometry.uuid,
          uploaded:!!gpu?.__webglTexture&&gpu.__version===map?.version,frame:root.renderer.info.render.frame,
          gpu:{calls:root.renderer.info.render.calls,triangles:root.renderer.info.render.triangles,textures:root.renderer.info.memory.textures,geometries:root.renderer.info.memory.geometries},
          contextLost:root.renderer.getContext().isContextLost()};
      },
      async renderSample(){const root=current();if(!root)throw Error('No mounted globe renderer');
        for(let i=0;i<2;i++){root.invalidate();await new Promise(requestAnimationFrame)}return window.__bookyJourneyFixture.sample();},
    };
    createAndroidPlatformAdapter({bindings,channel:'dev'}).then(mountHostApp).catch(error=>{window.__bookyJourneyFixtureError=error.message});
  ` }, bundle: true, write: false, metafile: true, outdir: output, entryNames: 'booky-journey', assetNames: 'assets/[name]-[hash]',
    publicPath: '/fixture/', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]', platform: 'browser', target: 'es2020', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { '.css': 'css', '.png': 'file', '.webp': 'file', '.avif': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name: 'canonical-vite-resources', setup(builder) {
      builder.onLoad({ filter: /[\\/]bookyJourneyContent\.ts$/ }, args => ({ contents: SYNTHETIC_CONTENT, loader: 'ts', resolveDir: path.dirname(args.path) }));
      builder.onLoad({ filter: /[\\/]bookyJourneyMigrationContent\.ts$/ }, args => ({ contents: SYNTHETIC_MIGRATION_CONTENT, loader: 'ts', resolveDir: path.dirname(args.path) }));
      builder.onLoad({ filter: /[\\/]BookShelfScene\.tsx$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8'), attempts = [];
        const contents = source.replace(/import\.meta\.glob<\s*ComponentType<BookShelfSceneCanvasProps>\s*>\("\.\/BookShelfSceneCanvas\.tsx",\s*\{\s*import: "default",\s*query: \{ stage5Load: "(primary|retry)" \},\s*\}\)/gu, (_match, attempt) => {
          attempts.push(attempt); return `({"./BookShelfSceneCanvas.tsx":()=>import("./BookShelfSceneCanvas.tsx?stage5Load=${attempt}").then(module=>module.default)})`;
        });
        if (attempts.join(',') !== 'primary,retry' || contents.includes('import.meta.glob')) throw Error('Review changed canonical Vite glob imports');
        return { contents, loader: 'tsx', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /BookShelfSceneCanvas\.tsx\?stage5Load=(primary|retry)$/ }, args => {
        const [filename, query] = args.path.split('?'); return { path: path.resolve(args.resolveDir, filename), suffix: '?' + query };
      });
      builder.onLoad({ filter: /[\\/](?:bookArchiveRuntime\.ts|App\.tsx|DeferredHomepageArchives\.tsx)$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8'); let replacements = 0;
        const expected = args.path.endsWith('bookArchiveRuntime.ts') ? ['../planet/books', '../planet/books.ts']
          : args.path.endsWith('DeferredHomepageArchives.tsx') ? ['../components/BookArchiveSection', '../components/BookArchiveSection.tsx']
          : ['./planet/catalog', './planet/catalog.ts'];
        const contents = source.replace(/import\.meta\.glob<\s*typeof import\("([^"]+)"\)\s*>\(\s*"([^"]+)",\s*\{\s*query:\s*\{\s*stage5Load:\s*"retry"\s*\},?\s*\},?\s*\)/gu, (_match, module, glob) => {
          if (module !== expected[0] || glob !== expected[1]) throw Error('Unexpected canonical retry glob in ' + args.path);
          replacements++;
          return `({${JSON.stringify(glob)}:()=>import(${JSON.stringify(glob + '?stage5Load=retry')})})`;
        });
        if (replacements !== 1 || contents.includes('import.meta.glob')) throw Error('Review changed canonical Vite retry glob in ' + args.path);
        return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /(?:books\.ts|catalog\.ts|BookArchiveSection\.tsx)\?stage5Load=retry$/ }, args => {
        const [filename, query] = args.path.split('?'); return { path: path.resolve(args.resolveDir, filename), suffix: '?' + query };
      });
      builder.onResolve({ filter: /^\// }, args => args.kind === 'url-token' ? { path: args.path, external: true } : undefined);
      builder.onResolve({ filter: /\.geojson\?url$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'canonical-geojson-url' }));
      builder.onLoad({ filter: /.*/, namespace: 'canonical-geojson-url' }, async args => ({ contents: await fs.readFile(args.path), loader: 'file' }));
    } }],
  });
  const outputs = Object.entries(built.metafile.outputs);
  const fixtureUrl = filename => '/fixture/' + path.relative(output, path.resolve(ROOT, filename)).replaceAll('\\', '/');
  const entriesFor = source => {
    const entries = outputs.filter(([_filename, value]) => [source, source + '?stage5Load=retry'].includes(value.entryPoint?.replaceAll('\\', '/')));
    const primary = entries.find(([_filename, value]) => value.entryPoint === source);
    const retry = entries.find(([_filename, value]) => value.entryPoint === source + '?stage5Load=retry');
    expect(primary, source + ' primary entry').toBeTruthy(); expect(retry, source + ' retry entry').toBeTruthy();
    expect(entries).toHaveLength(2);
    const urls = [fixtureUrl(primary[0]), fixtureUrl(retry[0])]; expect(new Set(urls).size).toBe(2);
    return { entries, urls };
  };
  const books = entriesFor('src/planet/books.ts'), countries = entriesFor('src/planet/catalog.ts'), component = entriesFor('src/components/BookArchiveSection.tsx');
  bookChunks = books.urls; [primaryBookChunk, retryBookChunk] = bookChunks;
  countryChunks = countries.urls; [primaryCountryChunk, retryCountryChunk] = countryChunks;
  componentChunks = component.urls; [primaryComponentChunk, retryComponentChunk] = componentChunks;
  expect(new Set([...bookChunks, ...countryChunks, ...componentChunks]).size).toBe(6);
  // Every generated retry entry reaches the same physical domain/hook outputs
  // as its primary. Failed facade fetches never manufacture canonical data.
  const reaches = (from, target, visited = new Set()) => {
    if (from === target) return true;
    if (visited.has(from)) return false;
    visited.add(from);
    return (built.metafile.outputs[from]?.imports ?? []).some(value => !value.external && reaches(value.path, target, visited));
  };
  const sharedOwners = (entries, inputs) => inputs.map(input => {
    const owners = outputs.filter(([_filename, value]) => Object.hasOwn(value.inputs, input));
    expect(owners, input + ' has one canonical compiled owner').toHaveLength(1);
    for (const [entry] of entries) expect(reaches(entry, owners[0][0]), entry + ' reuses ' + input).toBe(true);
    return { input, output: fixtureUrl(owners[0][0]) };
  });
  const sharedBookDependencies = sharedOwners(books.entries, ['src/data/bookArchive.ts', 'src/data/bookArchiveQueue.ts']);
  const sharedCountryDependencies = sharedOwners(countries.entries, ['src/data/countries.ts']);
  const sharedComponentDependencies = sharedOwners(component.entries, ['src/data/bookArchive.ts', 'src/data/bookArchiveQueue.ts', 'src/hooks/useBookCollections.ts']);
  const inputs = Object.keys(built.metafile.inputs).map(value => value.replaceAll('\\', '/'));
  const assetBytes = await fs.readFile(path.join(ROOT, ASSET));
  expect(digest(assetBytes)).toBe(ASSET_SHA); expect(assetBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([assetBytes.readUInt32BE(16), assetBytes.readUInt32BE(20), assetBytes[25]]).toEqual([1254, 1254, 6]);
  const assetOutput = built.outputFiles.find(file => digest(file.contents) === ASSET_SHA); expect(assetOutput).toBeTruthy();
  const required = ['src/host/bookyJourneyMigration.ts','src/host/bookyJourneyMigrationContent.ts','src/host/bookyJourneyMigrationRegistry.ts','src/host/bookyJourneyProgress.ts','src/host/bookyJourneyProgressStore.ts','src/host/bookyJourneyPersistence.ts','src/host/bookyJourneyContent.ts','src/host/bookyJourneyRuntime.ts','src/host/bookyJourney.ts','src/host/BookyJourneyControls.tsx','src/components/WriterPanel.tsx','src/components/BookArchiveSection.tsx','src/books/bookArchiveDetailView.ts','src/host/bookyReaderPolicy.ts','src/host/bookyReaderPolicyStore.ts','src/host/BookyReaderSettings.tsx','src/host/bookyJourneyHost.ts','src/App.tsx', 'src/host/mountHostApp.tsx', 'src/components/LiteraryGlobe.tsx', 'src/components/LiteraryWorldMap.tsx',
    'src/components/GlobeCameraRig.tsx', 'src/components/globeAtlas.ts', 'src/host/planetMascot.ts', 'src/host/planetMascotRoutes.ts',
    'src/host/PlanetMascotControls.tsx', 'src/host/PlanetMascotControls.css', 'src/host/PlanetMascotAvatar.tsx', 'src/host/PlanetMascotAvatar.css',
    'src/host/bookyModel.ts', 'src/host/bookyAnimation.ts', 'src/host/useBookyRenderer.ts', 'src/host/bookySupport.ts', 'src/host/bookyTourProgress.ts',
    'src/host/planetMascotPreference.ts', 'src/host/planetMascotPersistence.ts', 'src/host/HostPlatformServices.ts', ASSET];
  required.push('src/host/bookyJourneyPrerequisites.ts', 'src/host/BookyJourneyHistoryControls.tsx',
    'src/host/BookyJourneyMigrationControls.tsx', 'src/host/BookyJourneyStorageControls.tsx');
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-journey.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { kind: 'canonical-app-adult-booky-journey-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS lifecycle and preference map; key-specific journey-progress write rejection and manually released write gate', 'HTTP delivery of real split chunks', 'explicitly synthetic content provider'],
    controllerObservation: 'No controller is replaced or called by the fixture. Semantic progress and readiness are observed through the real rendered controls.',
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Only existing canonical App navigation owns scene changes; no fixture camera assignments or synthetic navigation acknowledgement.',
    representation: 'Actual App journey controls, compiler, fresh admission, runtime and canonical country/writer/book navigation. Only journey and migration content providers are replaced with explicitly synthetic RU/EN interface guidance, exact historical definitions and independent test review receipts; native bindings and Vite glob delivery are controlled. Source fixture evidence, not a dist artifact, installed-device or production journey acceptance.',
    contentSubstitution: { path: 'src/host/bookyJourneyContent.ts', syntheticOnly: true, sourceSha256: digest(SYNTHETIC_CONTENT), realCanonicalTuple: ['russia','dostoevsky','crime-and-punishment'] },
    migrationContentSubstitution: { path: 'src/host/bookyJourneyMigrationContent.ts', syntheticOnly: true,
      sourceSha256: digest(SYNTHETIC_MIGRATION_CONTENT), independentReceipt: true, fromVersion: 1, toVersion: 2, nodeMap: 'explicit-identity' },
    fallbackArtwork: { path: ASSET, sha256: ASSET_SHA, bytes: assetBytes.length, width: 1254, height: 1254, pngColorType: 6,
      bundledPath: '/fixture/' + path.relative(output, assetOutput.path).replaceAll('\\', '/') },
    publicAssetSelectionSha256: digest(selectionBytes), selectedAssetCount: selectedAssets.size,
    builtFiles: built.outputFiles.map(file => ({ path: path.relative(output, file.path).replaceAll('\\', '/'), sha256: digest(file.contents) })),
    installedNative: false, deviceTested: false, childReviewed: false, childProfileCreated: false, childAccessGranted: false, reviewedDialogueAccepted: false, narrationEnabled: false, artAccepted: false, devicePerformanceAccepted: false, releaseReady: false };
});

const CONFIRMED_READER = JSON.stringify({ schemaVersion: 1, audience: 'adult', age: 30,
  readingLevel: 'plain', confirmedAt: '2026-09-22T12:00:00.000Z', revision: 1 });
const WORK_KEY = 'russia:dostoevsky:crime-and-punishment';
const panel = page => page.locator('[data-planet-mascot-panel]');
const pet = page => page.locator('[data-planet-mascot-pet]');
const status = page => page.locator('[data-booky-journey-status]');
const next = page => page.locator('[data-booky-journey-next]');
const node = page => page.locator('[data-booky-journey-node]');
const sample = page => page.evaluate(() => window.__bookyJourneyFixture.sample());
const storageState = page => page.locator('[data-booky-journey-storage]');
const routeFor = (page, id) => page.locator('[data-booky-journey-route]').filter({ hasText: id === PRIMARY_JOURNEY
  ? /^(?:Тестовый маршрут интерфейса|Synthetic interface journey)$/u
  : /^(?:Тестовый зависимый маршрут|Synthetic dependent journey)$/u });
const historyRow = (page, key) => page.locator('[data-booky-journey-history-entry=' + JSON.stringify(key) + ']');
const historyAction = (page, name, key) => page.locator('[data-booky-journey-' + name + '=' + JSON.stringify(key) + ']');

async function open(testInfo, { contentMode = 'approved', readerSeed = CONFIRMED_READER, progressSeed = null } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, 'journey-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  const memory = new Map([['probpera-interface-language', 'ru'], ['probpera-planet-welcome-v1', 'completed'],
    [KEY, JSON.stringify({ schemaVersion: 1, commitId: 'booky-journey-fixture:1', selection: BASE })],
    [BOOKY, JSON.stringify(V1_SEED)]]);
  if (readerSeed !== null) memory.set(READER, readerSeed);
  if (progressSeed !== null) memory.set(PROGRESS, progressSeed);
  let failedProgressWritesRemaining = 0;
  let nextProgressWriteGate = null;
  const progressWriteGates = [];
  const operations = [], errors = [], externalRequests = [], missingResources = [], requestedChunks = [];
  const result = { ...sourceEvidence, contentMode, initialReaderPreference: readerSeed, initialProgressPreference: progressSeed,
    pass: false, observations: {}, screenshots: [] };
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__osPreference', async (_source, operation, key, value) => {
    const entry = { operation, key, ...(value === undefined ? {} : { value }) };
    operations.push(entry);
    if (operation === 'get') return memory.get(key) ?? null;
    if (operation === 'set') {
      if (key === PROGRESS && failedProgressWritesRemaining > 0) {
        --failedProgressWritesRemaining; entry.failed = true;
        throw Error('Controlled native journey-progress write failure');
      }
      if (key === PROGRESS && nextProgressWriteGate) {
        const gate = nextProgressWriteGate; nextProgressWriteGate = null;
        gate.entered = true; entry.manuallyHeld = true;
        await gate.wait;
        entry.manuallyReleased = true;
      }
      memory.set(key, value); return;
    }
    if (operation === 'remove') { memory.delete(key); return; }
    throw Error('Unknown native preference operation');
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE) { externalRequests.push(url.href); await route.abort(); return; }
    if (route.request().resourceType() === 'document' && url.pathname === '/') {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-journey.css"></head><body><div id="root"></div><script>window.__journeyContentMode=' + JSON.stringify(contentMode) + ';</script><script type="module" src="/fixture/booky-journey.js"></script></body></html>' }); return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if ([...bookChunks, ...countryChunks, ...componentChunks].includes(pathname)) requestedChunks.push(pathname);
    if (!files.has(pathname) && selectedAssets.has(pathname)) {
      const entry = selectedAssets.get(pathname), filename = path.resolve(ROOT, entry.source);
      if (await fs.realpath(filename) !== filename) throw Error('Linked selected asset');
      const bytes = await fs.readFile(filename);
      if (digest(bytes) !== entry.sourceSha256) throw Error('Stale selected fixture asset: ' + entry.output);
      files.set(pathname, bytes);
    }
    const bytes = files.get(pathname);
    if (bytes) { await route.fulfill({ contentType: mime[path.extname(pathname)] ?? 'application/octet-stream', body: bytes }); return; }
    if (pathname !== '/favicon.ico') missingResources.push(pathname);
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Unselected fixture asset' });
  });
  try {
    await page.goto(SITE + '/#atlas');
    await readyDocument(page);
    return { page, memory, result, requestedChunks,
      progressWrites: () => operations.filter(entry => entry.key === PROGRESS && entry.operation !== 'get'),
      failNextProgressWrite() { ++failedProgressWritesRemaining; },
      holdNextProgressWrite() {
        if (nextProgressWriteGate) throw Error('A progress write is already armed');
        let release;
        const gate = { entered: false, released: false, wait: new Promise(resolve => { release = resolve; }) };
        gate.release = () => { gate.released = true; release(); };
        nextProgressWriteGate = gate; progressWriteGates.push(gate);
        // No timer releases this gate. The test decides when the real adapter
        // can finish its write/readback; runtime, storage and focus stay real.
        return { entered: () => gate.entered, release: gate.release };
      },
      async coldReload(mode = contentMode) {
        contentMode = mode;
        // A new document destroys the old React/runtime objects. Only the native
        // preference map survives; the neutral URL supplies no restored target.
        const previousOrigin = await page.evaluate(() => performance.timeOrigin);
        if (page.url() === SITE + '/#atlas') await page.reload();
        else await page.goto(SITE + '/#atlas');
        await readyDocument(page);
        expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(previousOrigin);
      },
      verify() {
        expect(errors).toEqual([]); expect(externalRequests).toEqual([]); expect(missingResources).toEqual([]);
        expect(operations.filter(entry => entry.operation !== 'get' && CUSTOMIZATION_KEYS.has(entry.key))).toEqual([]);
        expect(operations.filter(entry => entry.operation !== 'get'
          && ![BOOKY, READER, PROGRESS, 'probpera-interface-language', 'probpera-planet-recent-adult-v1'].includes(entry.key))).toEqual([]);
        expect(memory.get(READER) ?? null).toBe(readerSeed); result.pass = true;
      },
      async close() {
        for (const gate of progressWriteGates) gate.release();
        result.finalDom = await page.evaluate(() => {
          const describe = element => {
            if (!element) return null;
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
            return { tag: element.tagName, className: element.className, data: { ...element.dataset },
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom },
              display: style.display, visibility: style.visibility, height: style.height, overflowX: style.overflowX,
              overflowY: style.overflowY, scrollTop: element.scrollTop, transition: style.transition,
              hiddenAncestor: element.closest('[hidden], [inert], [aria-hidden="true"]')?.className ?? null,
              animations: element.getAnimations().map(animation => ({ state: animation.playState,
                pending: animation.pending, currentTime: animation.currentTime,
                timing: animation.effect?.getComputedTiming(), transitionProperty: animation.transitionProperty })) };
          };
          const detail = document.querySelector('#book-archive-detail'), ancestors = [];
          for (let ancestor = detail?.parentElement; ancestor; ancestor = ancestor.parentElement) ancestors.push(describe(ancestor));
          return { url: location.href, hidden: document.hidden, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            journey: document.querySelector('[data-booky-journey-status]')?.getAttribute('data-booky-journey-status'),
            node: document.querySelector('[data-booky-journey-node]')?.getAttribute('data-booky-journey-node'),
            detail: describe(detail), ancestors,
            workObservations: window.__journeyWorkObservations ?? [] };
        }).catch(error => ({ diagnosticError: error.message }));
        Object.assign(result, { operations, errors, externalRequests, missingResources, requestedChunks,
          finalReaderPreference: memory.get(READER) ?? null, finalBookyPreference: JSON.parse(memory.get(BOOKY) ?? 'null'),
          finalProgressPreferenceRaw: memory.get(PROGRESS) ?? null });
        const filename = testInfo.outputPath('booky-journey.json');
        await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-journey-source-evidence', { path: filename, contentType: 'application/json' });
        await context.close();
      } };
  } catch (error) { await context.close(); throw error; }
}

async function readyDocument(page) {
  await expect(page.locator('.native-planet-app[data-planet-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.native-planet-launch')).toBeHidden();
  await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-webgl-context', 'ready');
  await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-camera-phase', 'idle');
  await expect(page.locator('#atlas canvas')).toHaveCount(1);
  expect(await page.evaluate(() => window.__bookyJourneyFixtureError ?? null)).toBeNull();
  await page.evaluate(() => window.__bookyJourneyFixture.remember());
}

async function actual(page) {
  let observed;
  await expect.poll(async () => { observed = await sample(page); return observed?.uploaded ? observed.selection : null; }).toEqual(BASE);
  observed = await page.evaluate(() => window.__bookyJourneyFixture.renderSample());
  expect(observed.surfaceCount).toBe(1); expect(observed.mascotObjects).toEqual([]);
  expect(observed.contextLost).toBe(false); expect(observed.gpu.calls).toBeGreaterThan(0);
  return observed;
}
function retained(current, original, samePose = false) {
  expect(current.sameScene).toBe(true); expect(current.texture).toBe(original.texture);
  expect(current.geometry).toBe(original.geometry); expect(current.backgroundResource).toBe(original.backgroundResource);
  expect(current.selection).toEqual(original.selection);
  if (samePose) expect(current.pose).toEqual(original.pose);
}
async function stablePose(page) {
  let previous, matches = 0;
  await expect.poll(async () => { const key = JSON.stringify((await sample(page)).pose);
    matches = key === previous ? matches + 1 : 0; previous = key; return matches;
  }, { intervals: [80, 150, 250] }).toBeGreaterThanOrEqual(3);
}
async function openPanel(page) {
  if (!await panel(page).count()) await page.locator('[data-planet-mascot-toggle]').click();
  await expect(page.locator('[data-booky-journey-controls]')).toBeVisible();
  await expect(page.locator('[data-booky-reader-state]')).toHaveAttribute('data-booky-reader-state', 'ready');
}
async function loadBooks(page) {
  const load = page.locator('[data-booky-journey-load]');
  if (await load.count()) { await expect(load).toBeEnabled(); await load.click(); await expect(load).toHaveCount(0, { timeout: 60_000 }); }
}
const answerChoice = (page, id) => page.locator('[data-booky-journey-answer=' + JSON.stringify(id) + ']');
const answerState = page => page.locator('[data-booky-journey-answer-status]');
async function startActivity(fixture) {
  const { page } = fixture;
  await openPanel(page); await loadBooks(page);
  await routeFor(page, PRIMARY_JOURNEY).click();
  await expectReadyNode(page, 'country', 0, 3);
  await next(page).click();
  await expect(node(page)).toHaveAttribute('data-booky-journey-node', 'activity');
  await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'ready');
  await expect(answerChoice(page, 'dostoevsky')).toBeEnabled();
  await expect(next(page)).toBeDisabled();
  await expectProgress(page, 1, 3);
  await expect.poll(() => savedRecord(fixture)?.acknowledgedNodeIds).toEqual(['country']);
  await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
  expect(savedRecord(fixture).resumeNodeId).toBe('activity');
  return fixture.memory.get(PROGRESS);
}
async function captureActivity(fixture, testInfo, filename) {
  const surface = fixture.page.locator('[data-booky-journey-activity]');
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.evaluate(element => {
    const measure = target => {
      const b = target.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height,
        fullyInViewport: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight };
    };
    return { surface: measure(element), feedback: measure(element.querySelector('[role="status"]')),
      choices: [...element.querySelectorAll('button')].map(button => {
        const box = measure(button);
        return { ...box, hit: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
      }), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  expect(bounds.surface.fullyInViewport).toBe(true); expect(bounds.feedback.fullyInViewport).toBe(true);
  expect(bounds.overflow).toBe(false);
  for (const choice of bounds.choices) { expect(choice.fullyInViewport).toBe(true); expect(choice.hit).toBe(true); expect(choice.height).toBeGreaterThanOrEqual(44); }
  await capture(fixture, testInfo, filename, 'Actual App activity choices and temporary answer feedback; independently synthetic task receipts only');
  fixture.result.screenshots.at(-1).bounds = bounds;
}

test('activity answers require fresh explicit acknowledgement and stay separate from navigation and saved progress', async ({}, testInfo) => {
  const fixture = await open(testInfo, { contentMode: 'activity' }), { page, result } = fixture;
  result.scenario = 'explicit-activity-answer';
  try {
    const raw = await startActivity(fixture), writes = fixture.progressWrites().length;
    await page.setViewportSize({ width: 320, height: 900 }); await stablePose(page);
    const before = await actual(page), url = page.url();
    const wrong = answerChoice(page, 'tolstoy'), correct = answerChoice(page, 'dostoevsky');
    await correct.focus(); await page.keyboard.press('Tab'); await expect(wrong).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'incorrect');
    await expect(wrong).toHaveAttribute('aria-pressed', 'true'); await expect(wrong).toBeFocused();
    await expect(next(page)).toBeDisabled(); await expectProgress(page, 1, 3);
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(writes);
    expect(page.url()).toBe(url); retained(await actual(page), before, true);
    await captureActivity(fixture, testInfo, 'journey-activity-incorrect-ru-320.png');
    await page.keyboard.press('Shift+Tab'); await expect(correct).toBeFocused(); await page.keyboard.press('Enter');
    await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'correct');
    await expect(next(page)).toBeEnabled(); await expectProgress(page, 1, 3);
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(writes);
    expect(page.url()).toBe(url); retained(await actual(page), before, true);
    await locale(page, 'en');
    await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'unanswered');
    await expect(next(page)).toBeDisabled(); expect(fixture.memory.get(PROGRESS)).toBe(raw);
    await expect(correct).toContainText('Dost'); await expect(wrong).toContainText('Tolst');
    await page.setViewportSize({ width: 1440, height: 850 }); await stablePose(page);
    const afterLocale = await actual(page), afterLocaleUrl = page.url();
    await correct.click(); await expect(next(page)).toBeEnabled();
    await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'correct');
    expect(page.url()).toBe(afterLocaleUrl); retained(await actual(page), afterLocale, true);
    await captureActivity(fixture, testInfo, 'journey-activity-correct-en.png');
    expect(fixture.progressWrites()).toHaveLength(writes); expect(fixture.memory.get(PROGRESS)).toBe(raw);
    expect(page.url()).toBe(afterLocaleUrl); retained(await actual(page), afterLocale, true);
    await next(page).click(); await expectReadyNode(page, 'checkpoint', 2, 3);
    await expect.poll(() => savedRecord(fixture)?.acknowledgedNodeIds).toEqual(['country', 'activity']);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    const record = savedRecord(fixture), activity = record.nodes.find(item => item.kind === 'activity');
    expect(Object.keys(activity).sort()).toEqual(['activity', 'entity', 'id', 'kind', 'screen']);
    expect(Object.keys(activity.activity).sort()).toEqual(['id', 'semanticChecksum', 'version']);
    expect(activity.activity.semanticChecksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(record)).not.toMatch(/choiceId|correctChoiceId|incorrect|unanswered/u);
    await next(page).click(); await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    await expect.poll(() => savedRecord(fixture)?.acknowledgedNodeIds).toEqual(['country', 'activity', 'checkpoint']);
    Object.assign(result.observations, { wrongAnswerNoProgress: true, keyboardChoiceKeepsFocus: true,
      answerNoNavigationOrStorage: true, correctRequiresExplicitNext: true, localeClearsAnswer: true,
      canonicalLocalizedChoices: true, activitySemanticFingerprintSaved: true, answerNotPersisted: true,
      canonicalSceneRetainedWithinDocument: true, explicitCompletion: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('activity answer is temporary across suspension cold restoration and revoked journey review', async ({}, testInfo) => {
  const fixture = await open(testInfo, { contentMode: 'activity' }), { page, result } = fixture;
  result.scenario = 'activity-lifecycle-revocation';
  try {
    const raw = await startActivity(fixture), writes = fixture.progressWrites().length;
    await answerChoice(page, 'dostoevsky').click(); await expect(next(page)).toBeEnabled();
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(false));
    await expect(page.locator('[data-booky-journey-controls]')).toHaveCount(0);
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(true)); await openPanel(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await resumeIfPaused(page);
    await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'unanswered');
    await expect(next(page)).toBeDisabled();
    await answerChoice(page, 'dostoevsky').click(); await expect(next(page)).toBeEnabled();
    await fixture.coldReload(); await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(writes);
    const cold = await actual(page), coldUrl = page.url();
    await resumeIfPaused(page); await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'unanswered');
    await expect(next(page)).toBeDisabled(); await expectProgress(page, 1, 3);
    expect(page.url()).toBe(coldUrl); retained(await actual(page), cold, true);
    await answerChoice(page, 'dostoevsky').click(); await expect(next(page)).toBeEnabled();
    await fixture.coldReload('activity-missing-review'); await openPanel(page); await loadBooks(page);
    await expect(page.locator('[data-booky-journey-answer]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-route]')).toHaveCount(0);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(writes);
    await fixture.coldReload('activity'); await openPanel(page); await loadBooks(page); await resumeIfPaused(page);
    await expect(answerState(page)).toHaveAttribute('data-booky-journey-answer-status', 'unanswered');
    await expect(next(page)).toBeDisabled(); await expectProgress(page, 1, 3);
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(writes);
    Object.assign(result.observations, { backgroundClearsAnswer: true, coldRestorePausedWithoutAnswer: true,
      noAnswerReplayed: true, revokedReviewHidesActivity: true, reviewRecoveryRequiresFreshAnswer: true,
      savedPrefixPreserved: true, noLifecycleProgressWrite: true });
    fixture.verify();
  } finally { await fixture.close(); }
});
async function expectProgress(page, count, total = 4) {
  await expect(page.locator('[data-booky-journey-progress]')).toHaveText(new RegExp('(?:Подтверждено шагов:|Steps acknowledged:) ' + count + ' (?:из|of) ' + total, 'u'));
}
function savedRecord(fixture) {
  const raw = fixture.memory.get(PROGRESS);
  if (!raw) return null;
  const preference = JSON.parse(raw);
  return preference.records?.find(record => record.recordId === preference.activeRecordId) ?? null;
}
async function expectSavedPrefix(fixture, prefix, version = 1) {
  await expect.poll(() => savedRecord(fixture)?.acknowledgedNodeIds ?? null).toEqual(prefix);
  await expect(storageState(fixture.page)).toHaveAttribute('data-booky-journey-storage', 'ready');
  const record = savedRecord(fixture);
  expect(record.journeyId).toBe('test.actual-app-journey'); expect(record.journeyVersion).toBe(version);
  expect(record.resumeNodeId).toBe(['country', 'writer', 'work', 'checkpoint'][prefix.length] ?? null);
  return fixture.memory.get(PROGRESS);
}
async function startCountryStep(fixture) {
  await openPanel(fixture.page); await loadBooks(fixture.page);
  await expect(storageState(fixture.page)).toHaveAttribute('data-booky-journey-storage', 'ready');
  const route = routeFor(fixture.page, PRIMARY_JOURNEY);
  await expect(route).toHaveCount(1); await route.click();
  await expectReadyNode(fixture.page, 'country', 0);
  return expectSavedPrefix(fixture, []);
}
async function completePrimaryJourney(fixture) {
  await startCountryStep(fixture);
  for (const [index, id] of ['writer', 'work', 'checkpoint'].entries()) {
    await next(fixture.page).click(); await expectReadyNode(fixture.page, id, index + 1);
  }
  await next(fixture.page).click();
  await expect(status(fixture.page)).toHaveAttribute('data-booky-journey-status', 'complete');
  await expectProgress(fixture.page, 4);
  const raw = await expectSavedPrefix(fixture, ['country', 'writer', 'work', 'checkpoint']);
  return { raw, record: savedRecord(fixture) };
}
async function expectHistorySaved(fixture, activeRecordId, records) {
  await expect.poll(() => JSON.parse(fixture.memory.get(PROGRESS) ?? 'null')?.activeRecordId).toBe(activeRecordId);
  await expect(storageState(fixture.page)).toHaveAttribute('data-booky-journey-storage', 'ready');
  const value = JSON.parse(fixture.memory.get(PROGRESS)); expect(value.records).toEqual(records);
  return fixture.memory.get(PROGRESS);
}
async function resumeIfPaused(page) {
  await openPanel(page);
  const resume = page.locator('[data-booky-journey-resume]');
  if (await resume.count()) { await expect(resume).toBeEnabled(); await resume.click(); }
}
async function expectReadyNode(page, id, count, total = 4) {
  await openPanel(page);
  await expect(node(page)).toHaveAttribute('data-booky-journey-node', id);
  await expect(status(page)).toHaveAttribute('data-booky-journey-status', /^(ready|paused)$/u);
  await resumeIfPaused(page);
  await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'ready');
  await expect(next(page)).toBeEnabled();
  await expectProgress(page, count, total);
}
async function locale(page, language) {
  await page.locator('.native-planet-app .interface-language-control button:visible')
    .filter({ hasText: new RegExp('^' + language.toUpperCase() + '$', 'u') }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}
async function capture(fixture, testInfo, filename, framing) {
  await fixture.page.evaluate(() => document.fonts.ready);
  await fixture.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bytes = await fixture.page.screenshot({ path: testInfo.outputPath(filename), animations: 'disabled' });
  fixture.result.screenshots.push({ filename, sha256: digest(bytes), ...fixture.page.viewportSize(), framing });
}
async function captureStorage(fixture, testInfo, filename, actionSelector, description) {
  const surface = fixture.page.locator('.booky-journey-controls__storage');
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.evaluate((element, selector) => {
    const measure = target => {
      const box = target.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        fullyInViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight };
    };
    const action = element.querySelector(selector), box = action.getBoundingClientRect();
    return { surface: measure(element), status: measure(element.querySelector('[data-booky-journey-storage]')),
      action: measure(action), actionHit: action.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
  }, actionSelector);
  expect(bounds.status.fullyInViewport).toBe(true); expect(bounds.action.fullyInViewport).toBe(true);
  expect(bounds.actionHit).toBe(true); expect(bounds.action.height).toBeGreaterThanOrEqual(44);
  await capture(fixture, testInfo, filename, description);
  fixture.result.screenshots.at(-1).bounds = bounds;
}
async function captureMigration(fixture, testInfo) {
  const surface = fixture.page.locator('[data-booky-journey-migration-controls]');
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.evaluate(element => {
    const measure = target => {
      const box = target.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        fullyInViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight };
    };
    const action = element.querySelector('[data-booky-journey-confirm-migrate]'), box = action.getBoundingClientRect();
    return { surface: measure(element), status: measure(element.querySelector('[data-booky-journey-migration-status]')),
      action: measure(action), actionHit: action.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
  });
  expect(bounds.status.fullyInViewport).toBe(true); expect(bounds.action.fullyInViewport).toBe(true);
  expect(bounds.actionHit).toBe(true); expect(bounds.action.height).toBeGreaterThanOrEqual(44);
  await capture(fixture, testInfo, 'journey-migration-confirm-en.png',
    'Desktop actual App EN independently reviewed v1-to-v2 migration awaits explicit confirmation; original progress is unchanged');
  fixture.result.screenshots.at(-1).bounds = bounds;
}
async function captureHistory(fixture, testInfo, key, filename, framing, confirmation = false) {
  const row = historyRow(fixture.page, key); await row.scrollIntoViewIfNeeded();
  const bounds = await row.evaluate((element, confirming) => {
    const measure = target => {
      const box = target.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        fullyInViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight };
    };
    const action = element.querySelector(confirming ? '[data-booky-journey-confirm-delete-history]' : '[data-booky-journey-delete-history]');
    const box = action.getBoundingClientRect();
    return { surface: measure(element), action: measure(action),
      actionHit: action.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
  }, confirmation);
  expect(bounds.surface.fullyInViewport).toBe(true); expect(bounds.action.fullyInViewport).toBe(true);
  expect(bounds.actionHit).toBe(true); expect(bounds.action.height).toBeGreaterThanOrEqual(44);
  await capture(fixture, testInfo, filename, framing); fixture.result.screenshots.at(-1).bounds = bounds;
}
async function reachableJourneyControls(page) {
  const controls = page.locator('[data-booky-journey-controls] button:visible');
  const observations = [];
  for (let index = 0; index < await controls.count(); index++) {
    const button = controls.nth(index); await button.scrollIntoViewIfNeeded();
    let observed;
    await expect.poll(async () => {
      observed = await button.evaluate(element => {
        const bounds = element.getBoundingClientRect(), hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return { label: element.textContent, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
          width: bounds.width, height: bounds.height, viewport: innerWidth, reachable: !!hit && element.contains(hit),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      return observed.height >= 44 && observed.left >= 0 && observed.right <= observed.viewport && observed.reachable && !observed.overflow;
    }).toBe(true);
    observations.push(observed);
  }
  expect(observations.length).toBeGreaterThanOrEqual(3);
  await next(page).scrollIntoViewIfNeeded();
  return observations;
}

test('actual reviewed fixture follows country writer work and explicit checkpoint across locale and suspension', async ({}, testInfo) => {
  test.setTimeout(180_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'explicit-journey';
  try {
    const original = await actual(page);
    await openPanel(page); await loadBooks(page);
    const route = page.locator('[data-booky-journey-route]');
    await expect(route).toHaveCount(1); await route.click();
    await expectReadyNode(page, 'country', 0);
    await expect(page.locator('#atlas .literary-globe')).toHaveAttribute('data-globe-camera-phase', 'idle');
    await page.setViewportSize({ width: 320, height: 780 });
    await expectReadyNode(page, 'country', 0);
    result.observations.ruReachability = await reachableJourneyControls(page);
    await capture(fixture, testInfo, 'journey-country-ru.png', '320px actual App country step with explicit acknowledgement; synthetic guidance only');
    await next(page).click();
    await expectReadyNode(page, 'writer', 1);
    await expect(page.locator('.writer-detail')).toBeVisible();
    await expect(page.locator('.writer-detail-heading')).toContainText('Достоевский');
    await locale(page, 'en');
    await expectProgress(page, 1);
    await expect(node(page)).toHaveAttribute('data-booky-journey-node', 'writer');
    await expect(node(page)).toContainText('Interface test: writer');
    await resumeIfPaused(page); await expectReadyNode(page, 'writer', 1);
    result.observations.enReachability = await reachableJourneyControls(page);
    await capture(fixture, testInfo, 'journey-writer-en.png', '320px actual App writer step retains one semantic acknowledgement after EN switch');

    await stablePose(page); const beforePause = await actual(page);
    await page.locator('[data-planet-mascot-collapse]').click(); await expect(panel(page)).toHaveCount(0);
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(false));
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(true));
    await openPanel(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 1); await stablePose(page);
    retained(await actual(page), beforePause, true);
    await page.locator('[data-booky-journey-resume]').click();
    await expectReadyNode(page, 'writer', 1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Observe real rendered readiness throughout the work transition. This
    // observer never invokes product methods or supplies an acknowledgement.
    await page.evaluate(() => {
      window.__journeyWorkObservations = [];
      const observe = () => {
        const current = document.querySelector('[data-booky-journey-node]');
        if (current?.getAttribute('data-booky-journey-node') !== 'work') return;
        const detail = document.querySelector('#book-archive-detail'), button = document.querySelector('[data-booky-journey-next]');
        const sheet = detail?.closest('.book-shelf-frame__detail');
        const bounds = detail?.getBoundingClientRect();
        window.__journeyWorkObservations.push({ enabled: !!button && !button.disabled,
          phase: document.querySelector('[data-booky-journey-status]')?.getAttribute('data-booky-journey-status'),
          visible: !!bounds?.width && !!bounds?.height && !detail.closest('[hidden], [inert], [aria-hidden="true"]'),
          sheetPhase: sheet?.getAttribute('data-mobile-phase') ?? null,
          sheetAnimations: sheet?.getAnimations().filter(animation => animation.pending
            || animation.playState === 'running' || animation.playState === 'paused').length ?? 0,
          bookKey: new URL(location.href).searchParams.get('book'), title: detail?.getAttribute('aria-label') ?? null });
      };
      const observer = new MutationObserver(observe); observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      window.__stopJourneyWorkObservation = () => { observe(); observer.disconnect(); return window.__journeyWorkObservations; };
    });
    await next(page).click();
    await expectReadyNode(page, 'work', 2);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'collection');
    await expect(page.locator('#book-archive-detail')).toBeVisible();
    await expect(page.locator('#book-archive-detail')).toHaveAttribute('aria-label', 'Crime and Punishment');
    expect(new URL(page.url()).searchParams.get('book')).toBe(WORK_KEY);
    const workObservations = await page.evaluate(() => window.__stopJourneyWorkObservation());
    expect(workObservations.some(item => !item.enabled)).toBe(true);
    expect(workObservations.some(item => item.enabled)).toBe(true);
    for (const item of workObservations.filter(item => item.enabled)) {
      expect(item.phase).toBe('ready'); expect(item.visible).toBe(true); expect(item.bookKey).toBe(WORK_KEY);
      expect(item.sheetPhase).toBe('idle'); expect(item.sheetAnimations).toBe(0);
    }
    result.observations.workReadiness = workObservations;
    retained(await actual(page), original);
    await next(page).click();
    await expectReadyNode(page, 'checkpoint', 3);
    await expect(pet(page)).toHaveAttribute('data-planet-mascot-screen', 'globe');
    await expectProgress(page, 3);
    await next(page).click();
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    await expectProgress(page, 4);
    retained(await actual(page), original);
    Object.assign(result.observations, { actualCountryWriterWork: true, exactWorkVisible: true,
      acknowledgementRequiresSettledView: true, explicitCheckpointCompletion: true, localeRetainsSemanticProgress: true,
      collapseBackgroundRequireResume: true, noAutomaticMovementOnResume: true, canonicalSceneRetained: true,
      syntheticApprovalOnly: true, durableJourneyProgressClaimed: false });
    fixture.verify();
  } finally { await fixture.close(); }
});

for (const scenario of [
  { name: 'no-profile', options: { readerSeed: null }, expectedStatus: 'profile-required' },
  { name: 'no-independent-journey-review', options: { contentMode: 'missing-review' }, expectedStatus: 'unavailable' },
]) test('journey admission fails closed: ' + scenario.name, async ({}, testInfo) => {
  test.setTimeout(120_000);
  const fixture = await open(testInfo, scenario.options), { page, result } = fixture;
  result.scenario = scenario.name;
  try {
    const original = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', scenario.expectedStatus);
    await expect(page.locator('[data-booky-journey-route]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-open]')).toHaveCount(0);
    await expect(next(page)).toHaveCount(0);
    await locale(page, 'en');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', scenario.expectedStatus);
    await expect(page.locator('[data-booky-journey-route]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-progress]')).toHaveCount(0);
    retained(await actual(page), original, true);
    Object.assign(result.observations, { admissionDeniedRuEn: true, noJourneyNavigation: true,
      noJourneyProgress: true, canonicalSceneRetained: true, syntheticApprovalOnly: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('confirmed journey progress restores the exact prefix paused in a fresh document until explicit resume', async ({}, testInfo) => {
  test.setTimeout(150_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'cold-progress-resume';
  try {
    await startCountryStep(fixture);
    await next(page).click(); await expectReadyNode(page, 'writer', 1);
    const saved = await expectSavedPrefix(fixture, ['country']);
    const writesBeforeReload = fixture.progressWrites().length;
    await fixture.coldReload();
    await stablePose(page); const neutral = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 1);
    await expect(node(page)).toHaveAttribute('data-booky-journey-node', 'writer');
    await expect(page.locator('[data-booky-journey-next]:enabled')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-open]:enabled')).toHaveCount(0);
    await stablePose(page); retained(await actual(page), neutral, true);
    expect(new URL(page.url()).searchParams.get('country')).toBeNull();
    expect(new URL(page.url()).searchParams.get('writer')).toBeNull();
    expect(new URL(page.url()).searchParams.get('book')).toBeNull();
    expect(fixture.memory.get(PROGRESS)).toBe(saved);
    expect(fixture.progressWrites()).toHaveLength(writesBeforeReload);
    await page.locator('[data-booky-journey-resume]').click();
    await expectReadyNode(page, 'writer', 1);
    await expect(page.locator('.writer-detail-heading')).toContainText('Достоевский');
    expect(new URL(page.url()).searchParams.get('writer')).toBe('dostoevsky');
    await expectSavedPrefix(fixture, ['country']);
    retained(await actual(page), neutral);
    Object.assign(result.observations, { confirmedPrefix: ['country'], restoredPaused: true,
      newDocumentRestoration: true, noAutomaticNavigationOrWrite: true, explicitResumeRequired: true,
      exactWriterAfterResume: true, canonicalSceneRetainedWithinDocument: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('failed journey-progress native write stays visibly unsaved until explicit exact retry', async ({}, testInfo) => {
  test.setTimeout(150_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'progress-write-retry';
  try {
    await page.setViewportSize({ width: 320, height: 900 });
    const saved = await startCountryStep(fixture);
    const original = await actual(page);
    fixture.failNextProgressWrite();
    await next(page).click();
    await expectProgress(page, 1);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'failed');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'write');
    await expect(page.locator('[data-booky-journey-save-retry]')).toBeVisible();
    expect(fixture.memory.get(PROGRESS)).toBe(saved);
    expect(savedRecord(fixture).acknowledgedNodeIds).toEqual([]);
    const failed = fixture.progressWrites().filter(entry => entry.failed);
    expect(failed).toHaveLength(1);
    expect(JSON.parse(failed[0].value).records[0].acknowledgedNodeIds).toEqual(['country']);
    result.observations.failedWrite = { persisted: JSON.parse(saved), pending: JSON.parse(failed[0].value) };
    await captureStorage(fixture, testInfo, 'journey-save-failed-ru-320.png', '[data-booky-journey-save-retry]',
      '320px actual App RU unconfirmed journey save with explicit retry');
    await page.locator('[data-booky-journey-save-retry]').click();
    await expectSavedPrefix(fixture, ['country']);
    expect(fixture.memory.get(PROGRESS)).toBe(failed[0].value);
    await expect(page.locator('[data-booky-journey-save-retry]')).toHaveCount(0);
    await expectReadyNode(page, 'writer', 1);
    retained(await actual(page), original);
    Object.assign(result.observations, { priorBytesPreservedOnWriteFailure: true, visiblyUnsavedLocalPrefix: true,
      explicitRetryConfirmsExactBytes: true, canonicalSceneRetained: true, failurePort: 'native-preferences-set' });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('future journey progress remains unchanged until explicit confirmed removal', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const future = JSON.stringify({ schemaVersion: 99, audience: 'adult', futurePayload: 'synthetic unknown progress' }, null, 2);
  const fixture = await open(testInfo, { progressSeed: future }), { page, result } = fixture;
  result.scenario = 'future-progress-clear';
  try {
    const original = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'failed');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'unsupported');
    await expect(page.locator('[data-booky-journey-route]:enabled')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-next]:enabled')).toHaveCount(0);
    await expect(node(page)).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(future); expect(fixture.progressWrites()).toEqual([]);
    await locale(page, 'en');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'unsupported');
    expect(fixture.memory.get(PROGRESS)).toBe(future); expect(fixture.progressWrites()).toEqual([]);
    await page.locator('[data-booky-journey-clear-progress]').click();
    await expect(page.locator('[data-booky-journey-confirm-clear-progress]')).toBeVisible();
    expect(fixture.memory.get(PROGRESS)).toBe(future); expect(fixture.progressWrites()).toEqual([]);
    await captureStorage(fixture, testInfo, 'journey-future-clear-en.png', '[data-booky-journey-confirm-clear-progress]',
      'Desktop actual App EN unknown journey schema kept unchanged with explicit deletion confirmation');
    await page.locator('[data-booky-journey-confirm-clear-progress]').click();
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect.poll(() => fixture.memory.has(PROGRESS)).toBe(false);
    expect(fixture.progressWrites().map(entry => entry.operation)).toEqual(['remove']);
    await expect(page.locator('[data-booky-journey-progress]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-route]:enabled')).toHaveCount(1);
    retained(await actual(page), original, true);
    Object.assign(result.observations, { unknownBytesPreservedRuEn: true, noUnknownRecordAdmission: true,
      confirmationBeforeDelete: true, explicitDeleteConfirmedByReadback: true, noAutomaticProgressRewrite: true,
      canonicalSceneRetained: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('a new reviewed journey version cannot reinterpret or overwrite a saved older prefix', async ({}, testInfo) => {
  test.setTimeout(150_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'incompatible-progress-version';
  try {
    await startCountryStep(fixture);
    await next(page).click(); await expectReadyNode(page, 'writer', 1);
    const saved = await expectSavedPrefix(fixture, ['country']);
    const writes = fixture.progressWrites().length;
    await fixture.coldReload('new-version');
    await stablePose(page); const neutral = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    await expectProgress(page, 1);
    await expect(node(page)).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-resume]:enabled')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-next]:enabled')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-open]:enabled')).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(saved);
    expect(savedRecord(fixture).journeyVersion).toBe(1);
    expect(fixture.progressWrites()).toHaveLength(writes);
    await locale(page, 'en');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    await expectProgress(page, 1);
    expect(fixture.memory.get(PROGRESS)).toBe(saved);
    expect(fixture.progressWrites()).toHaveLength(writes);
    await stablePose(page); retained(await actual(page), neutral, true);
    expect(new URL(page.url()).searchParams.get('country')).toBeNull();
    Object.assign(result.observations, { savedVersion: 1, currentReviewedVersion: 2, incompatibleProgressUnavailable: true,
      exactOldBytesPreservedRuEn: true, noAutomaticNavigationOrRewrite: true, canonicalSceneRetainedWithinDocument: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('explicit reviewed journey migration preserves history and restores the exact new prefix paused', async ({}, testInfo) => {
  test.setTimeout(180_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'explicit-progress-migration';
  try {
    await locale(page, 'en');
    await startCountryStep(fixture);
    await next(page).click(); await expectReadyNode(page, 'writer', 1);
    const originalBytes = await expectSavedPrefix(fixture, ['country']);
    const originalRecord = savedRecord(fixture), writes = fixture.progressWrites().length;
    expect(originalRecord.locale).toBe('en');
    await fixture.coldReload('migration-approved');
    await stablePose(page); const neutral = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    await expectProgress(page, 1);
    const offer = page.locator('[data-booky-journey-migrate]');
    await expect(offer).toHaveCount(1); await expect(offer).toBeEnabled();
    expect(fixture.memory.get(PROGRESS)).toBe(originalBytes); expect(fixture.progressWrites()).toHaveLength(writes);
    expect(new URL(page.url()).searchParams.get('country')).toBeNull();
    await offer.click();
    const confirm = page.locator('[data-booky-journey-confirm-migrate]');
    await expect(confirm).toBeVisible(); await expect(confirm).toBeEnabled();
    expect(fixture.memory.get(PROGRESS)).toBe(originalBytes); expect(fixture.progressWrites()).toHaveLength(writes);
    await stablePose(page); retained(await actual(page), neutral, true);
    await page.locator('[data-booky-journey-cancel-migrate]').click();
    await expect(confirm).toHaveCount(0); await expect(offer).toBeFocused();
    expect(fixture.memory.get(PROGRESS)).toBe(originalBytes); expect(fixture.progressWrites()).toHaveLength(writes);
    await offer.click(); await expect(confirm).toBeEnabled();
    await captureMigration(fixture, testInfo);
    expect(fixture.memory.get(PROGRESS)).toBe(originalBytes); expect(fixture.progressWrites()).toHaveLength(writes);
    await confirm.click();
    await expectReadyNode(page, 'writer', 1);
    await expect(page.locator('.writer-detail-heading')).toContainText('Dostoevsky');
    expect(new URL(page.url()).searchParams.get('writer')).toBe('dostoevsky');
    const migratedBytes = await expectSavedPrefix(fixture, ['country'], 2);
    const migrated = JSON.parse(migratedBytes), target = savedRecord(fixture);
    expect(migrated.records).toHaveLength(2);
    expect(migrated.records.find(record => record.recordId === originalRecord.recordId)).toEqual(originalRecord);
    expect(target.recordId).not.toBe(originalRecord.recordId); expect(target.locale).toBe('en');
    expect(target.policyFingerprint).toBe(originalRecord.policyFingerprint);
    expect(target.definitionChecksum).not.toBe(originalRecord.definitionChecksum);
    expect(target.nodes).toEqual(originalRecord.nodes);
    await expect(page.locator('[data-booky-journey-migrate]')).toHaveCount(0);
    retained(await actual(page), neutral);
    result.observations.migrationRecords = { original: originalRecord, migrated: target };
    const confirmedWrites = fixture.progressWrites().length;
    await fixture.coldReload('migration-approved');
    await stablePose(page); const restoredScene = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expect(node(page)).toHaveAttribute('data-booky-journey-node', 'writer');
    await expectProgress(page, 1);
    await expect(page.locator('[data-booky-journey-next]:enabled')).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(migratedBytes); expect(fixture.progressWrites()).toHaveLength(confirmedWrites);
    expect(new URL(page.url()).searchParams.get('writer')).toBeNull();
    await locale(page, 'ru');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused'); await expectProgress(page, 1);
    expect(fixture.memory.get(PROGRESS)).toBe(migratedBytes); expect(fixture.progressWrites()).toHaveLength(confirmedWrites);
    await stablePose(page); retained(await actual(page), restoredScene, true);
    await page.locator('[data-booky-journey-resume]').click();
    await expectReadyNode(page, 'writer', 1);
    await expect(page.locator('.writer-detail-heading')).toContainText('Достоевский');
    await expectSavedPrefix(fixture, ['country'], 2);
    expect(JSON.parse(fixture.memory.get(PROGRESS)).records.find(record => record.recordId === originalRecord.recordId)).toEqual(originalRecord);
    retained(await actual(page), restoredScene);
    Object.assign(result.observations, { fromVersion: 1, toVersion: 2, exactAcknowledgedPrefix: ['country'],
      independentSyntheticMigrationReview: true, noMigrationBeforeConfirmation: true, cancellationRetainsBytesAndFocus: true,
      originalHistoryRetained: true, exactPrefixTransferred: true, confirmedSaveReadback: true, exactWriterAfterTransfer: true,
      migratedColdRestorePaused: true, noAutomaticNavigationOrWriteOnRestore: true, localeRetainsMigratedPrefix: true,
      explicitResumeRequiredAfterReload: true, canonicalSceneRetainedWithinDocument: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('missing or revoked independent migration review preserves the old version without navigation', async ({}, testInfo) => {
  test.setTimeout(180_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'migration-review-denied';
  try {
    await locale(page, 'en');
    await startCountryStep(fixture);
    await next(page).click(); await expectReadyNode(page, 'writer', 1);
    const saved = await expectSavedPrefix(fixture, ['country']);
    const originalRecord = savedRecord(fixture), writes = fixture.progressWrites().length;
    await fixture.coldReload('migration-missing-review');
    await stablePose(page); const missingScene = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    await expectProgress(page, 1);
    await expect(page.locator('[data-booky-journey-migrate]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-confirm-migrate]')).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(saved); expect(fixture.progressWrites()).toHaveLength(writes);
    await stablePose(page); retained(await actual(page), missingScene, true);
    expect(new URL(page.url()).searchParams.get('country')).toBeNull();

    await fixture.coldReload('migration-approved');
    await openPanel(page); await loadBooks(page);
    const offer = page.locator('[data-booky-journey-migrate]');
    await expect(offer).toHaveCount(1); await offer.click();
    await expect(page.locator('[data-booky-journey-confirm-migrate]')).toBeEnabled();
    expect(fixture.memory.get(PROGRESS)).toBe(saved); expect(fixture.progressWrites()).toHaveLength(writes);
    // The bundled provider is immutable for a document. A fresh document sees
    // its revoked receipt; no live content-update API is invented by the test.
    await fixture.coldReload('migration-missing-review');
    await stablePose(page); const revokedScene = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(page.locator('[data-booky-journey-migrate]')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-confirm-migrate]:enabled')).toHaveCount(0);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    await expectProgress(page, 1);
    await expect(page.locator('[data-booky-journey-resume]:enabled')).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-next]:enabled')).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(saved); expect(savedRecord(fixture)).toEqual(originalRecord);
    expect(fixture.progressWrites()).toHaveLength(writes);
    await stablePose(page); retained(await actual(page), revokedScene, true);
    expect(new URL(page.url()).searchParams.get('writer')).toBeNull();
    Object.assign(result.observations, { savedVersion: 1, currentReviewedVersion: 2,
      missingIndependentMigrationReviewDenied: true, revokedIndependentMigrationReviewDenied: true,
      revocationAcrossNewDocument: true, offeredConfirmationInvalidated: true, exactOldBytesPreserved: true, noInferredAcknowledgements: true,
      sameDocumentContentRefreshClaimed: false,
      noAutomaticNavigationOrWrite: true, canonicalSceneRetainedWithinDocument: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('confirmed exact-version completion unlocks a dependent journey only with independently admitted saved locale', async ({}, testInfo) => {
  test.setTimeout(210_000);
  const fixture = await open(testInfo, { contentMode: 'history' }), { page, result } = fixture;
  result.scenario = 'history-prerequisite-admission';
  try {
    const initialScene = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(routeFor(page, PRIMARY_JOURNEY)).toHaveCount(1);
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBeUndefined();
    const { raw, record } = await completePrimaryJourney(fixture);
    expect(record.journeyId).toBe(PRIMARY_JOURNEY); expect(record.journeyVersion).toBe(1); expect(record.locale).toBe('ru');
    expect(record.resumeNodeId).toBeNull();
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeEnabled();
    retained(await actual(page), initialScene);
    const confirmedWrites = fixture.progressWrites().length;
    await locale(page, 'en');
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeEnabled();
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(confirmedWrites);
    await fixture.coldReload('history');
    await stablePose(page); const restoredScene = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    await expectProgress(page, 4);
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeEnabled();
    await expect(historyRow(page, record.recordId)).toHaveAttribute('data-booky-journey-history-available', 'true');
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(confirmedWrites);
    expect(new URL(page.url()).searchParams.get('country')).toBeNull();
    await stablePose(page); retained(await actual(page), restoredScene, true);
    await captureHistory(fixture, testInfo, record.recordId, 'journey-history-complete-en.png',
      'Desktop actual App EN validated completed RU history; the exact-version dependent journey is available without rewriting progress');

    // EN target review remains approved. Revoking only the saved RU route's
    // independent receipt must invalidate its prerequisite contribution.
    await fixture.coldReload('history-missing-ru-review');
    await stablePose(page); const revokedScene = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(page.locator('[data-booky-journey-route]')).toHaveCount(0);
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(raw); expect(fixture.progressWrites()).toHaveLength(confirmedWrites);
    expect(savedRecord(fixture)).toEqual(record);
    expect(new URL(page.url()).searchParams.get('country')).toBeNull();
    await stablePose(page); retained(await actual(page), revokedScene, true);
    Object.assign(result.observations, { completedRecord: record, requiredJourneyId: PRIMARY_JOURNEY, requiredVersion: 1,
      dependentJourneyId: DEPENDENT_JOURNEY, lockedBeforeExplicitCompletion: true, unlockedAfterConfirmedCompletion: true,
      independentlyAdmittedLocaleEquivalence: true, completedColdRestoreNoWriteOrNavigation: true,
      revokedSavedLocaleReviewDeniesPrerequisite: true, preservedExactCompletionBytes: true,
      revokedSavedLocaleReviewDeniesRuntimeOffers: true,
      syntheticIndependentReviewsOnly: true, canonicalSceneRetainedWithinDocument: true });
    fixture.verify();
  } finally { await fixture.close(); }
});

test('history selection never navigates and confirmed single-record deletion truthfully retries while revoking a prerequisite', async ({}, testInfo) => {
  test.setTimeout(210_000);
  const fixture = await open(testInfo, { contentMode: 'history' }), { page, result } = fixture;
  result.scenario = 'explicit-history-select-delete';
  try {
    const { record: completed } = await completePrimaryJourney(fixture);
    await routeFor(page, DEPENDENT_JOURNEY).click();
    await expectReadyNode(page, 'country', 0, 2);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect.poll(() => savedRecord(fixture)?.journeyId).toBe(DEPENDENT_JOURNEY);
    const incomplete = savedRecord(fixture);
    expect(incomplete.acknowledgedNodeIds).toEqual([]); expect(incomplete.resumeNodeId).toBe('country');
    const both = JSON.parse(fixture.memory.get(PROGRESS)).records;
    expect(both).toHaveLength(2); expect(both.find(record => record.recordId === completed.recordId)).toEqual(completed);
    await stablePose(page); const selectionScene = await actual(page), selectionUrl = page.url();
    await historyAction(page, 'select-history', completed.recordId).click();
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    await expectHistorySaved(fixture, completed.recordId, both);
    await expect(historyRow(page, completed.recordId)).toHaveAttribute('data-booky-journey-history-selected', 'true');
    expect(page.url()).toBe(selectionUrl); await stablePose(page); retained(await actual(page), selectionScene, true);
    await historyAction(page, 'select-history', incomplete.recordId).click();
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 0, 2);
    const beforeDelete = await expectHistorySaved(fixture, incomplete.recordId, both);
    await expect(historyRow(page, incomplete.recordId)).toHaveAttribute('data-booky-journey-history-selected', 'true');
    await expect(page.locator('[data-booky-journey-next]:enabled')).toHaveCount(0);
    expect(page.url()).toBe(selectionUrl); await stablePose(page); retained(await actual(page), selectionScene, true);

    await page.setViewportSize({ width: 320, height: 900 });
    await stablePose(page); const deletionScene = await actual(page);
    const writes = fixture.progressWrites().length;
    const remove = historyAction(page, 'delete-history', completed.recordId);
    const confirm = historyAction(page, 'confirm-delete-history', completed.recordId);
    await remove.click(); await expect(confirm).toBeEnabled();
    expect(fixture.memory.get(PROGRESS)).toBe(beforeDelete); expect(fixture.progressWrites()).toHaveLength(writes);
    await historyAction(page, 'cancel-delete-history', completed.recordId).click();
    await expect(confirm).toHaveCount(0); await expect(remove).toBeFocused();
    expect(fixture.memory.get(PROGRESS)).toBe(beforeDelete); expect(fixture.progressWrites()).toHaveLength(writes);
    await remove.click(); await expect(confirm).toBeEnabled();
    await captureHistory(fixture, testInfo, completed.recordId, 'journey-history-delete-ru-320.png',
      '320px actual App RU confirms deletion of only the completed prerequisite record; the incomplete dependent record remains separate', true);
    await stablePose(page); retained(await actual(page), deletionScene, true);
    fixture.failNextProgressWrite(); await confirm.click();
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'failed');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'write');
    await expect(page.locator('[data-booky-journey-save-retry]')).toBeVisible();
    expect(fixture.memory.get(PROGRESS)).toBe(beforeDelete);
    const failed = fixture.progressWrites().filter(operation => operation.failed);
    expect(failed).toHaveLength(1);
    const pending = JSON.parse(failed[0].value);
    expect(pending.records).toEqual([incomplete]); expect(pending.activeRecordId).toBe(incomplete.recordId);
    await page.locator('[data-booky-journey-save-retry]').click();
    const afterDelete = await expectHistorySaved(fixture, incomplete.recordId, [incomplete]);
    expect(afterDelete).toBe(failed[0].value);
    await expect(historyRow(page, completed.recordId)).toHaveCount(0);
    await expect(historyRow(page, incomplete.recordId)).toHaveAttribute('data-booky-journey-history-available', 'false');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'unavailable');
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-resume]:enabled')).toHaveCount(0);
    expect(page.url()).toBe(selectionUrl); await stablePose(page); retained(await actual(page), deletionScene, true);
    Object.assign(result.observations, { deletedRecord: completed, retainedRecord: incomplete,
      selectedRecordsPreserveAcknowledgements: true, selectionNeverNavigates: true, incompleteSelectionPaused: true,
      deletionRequiresConfirmation: true, cancellationRetainsBytesAndFocus: true, failedDeletionWritePreservesBytes: true,
      explicitRetryConfirmsExactDeletion: true, onlyChosenHistoryRecordDeleted: true, deletionRevokesDependentAdmission: true,
      currentSelectionRetainedUnavailable: true, canonicalSceneRetained: true, failurePort: 'native-preferences-set' });
    fixture.verify();
  } finally { await fixture.close(); }
});

// These focused keyboard regressions exercise actual App controls. They do not
// claim a complete accessibility audit, installed-device or screen-reader QA.
for (const scenario of [
  { name: 'owned invalidated confirmation restores stable status', outside: false, language: 'ru' },
  { name: 'invalidated confirmation never steals outside keyboard focus', outside: true, language: 'en' },
]) test('journey focus: ' + scenario.name, async ({}, testInfo) => {
  test.setTimeout(150_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = scenario.outside ? 'focus-invalidation-outside' : 'focus-invalidation-owned-confirm';
  let gate;
  try {
    if (scenario.language === 'en') await locale(page, 'en');
    const before = await startCountryStep(fixture), original = await actual(page);
    const key = savedRecord(fixture).recordId, writes = fixture.progressWrites().length;
    const clear = page.locator('[data-booky-journey-clear-progress]');
    const confirm = page.locator('[data-booky-journey-confirm-clear-progress]');
    const outside = historyAction(page, 'delete-history', key);
    gate = fixture.holdNextProgressWrite();
    await next(page).press('Enter');
    await expect.poll(gate.entered).toBe(true);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'saving');
    await expectProgress(page, 1);
    expect(fixture.memory.get(PROGRESS)).toBe(before);

    // Start at the programmatically focusable status, then use actual keyboard
    // traversal and activation. No product action is dispatched from JS.
    await storageState(page).focus(); await page.keyboard.press('Tab');
    await expect(clear).toBeFocused(); await page.keyboard.press('Enter');
    await expect(confirm).toBeFocused();
    if (scenario.outside) {
      await page.keyboard.press('Shift+Tab');
      await expect(outside).toBeFocused();
    }
    gate.release();
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect(confirm).toHaveCount(0);
    if (scenario.outside) await expect(outside).toBeFocused();
    else await expect(storageState(page)).toBeFocused();
    await expectSavedPrefix(fixture, ['country']);
    expect(fixture.progressWrites()).toHaveLength(writes + 1);
    expect(fixture.progressWrites().slice(writes)).toMatchObject([{ operation: 'set', manuallyHeld: true, manuallyReleased: true }]);
    expect(fixture.progressWrites().some(entry => entry.operation === 'remove')).toBe(false);
    retained(await actual(page), original);
    await captureStorage(fixture, testInfo, scenario.outside ? 'journey-focus-outside-en.png' : 'journey-focus-restored-ru.png',
      '[data-booky-journey-clear-progress]', scenario.outside
        ? 'Actual App EN: completed native save invalidates clear confirmation and preserves the user-selected outside control'
        : 'Actual App RU: completed native save removes stale confirmation and restores owned focus to stable storage status');
    result.observations.focus = { keyboard: ['Enter on Next', 'Tab to clear', 'Enter to open confirmation',
      ...(scenario.outside ? ['Shift+Tab outside'] : [])], heldPort: 'native-preferences-set', manualRelease: true,
      focusedAtInvalidation: scenario.outside ? 'history-delete-outside' : 'clear-confirm',
      expectedAfterInvalidation: scenario.outside ? 'same-history-delete' : 'storage-status',
      noUnexpectedDeletion: true, onlyOriginalNextSave: true, canonicalSceneRetained: true,
      fullAccessibilityAcceptanceClaimed: false };
    fixture.verify();
  } finally { gate?.release(); await fixture.close(); }
});

test('journey focus: keyboard cancellation and fresh document discard consent without replaying progress', async ({}, testInfo) => {
  test.setTimeout(150_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'focus-keyboard-remount-lifecycle';
  try {
    await startCountryStep(fixture); await next(page).press('Enter');
    await expectReadyNode(page, 'writer', 1);
    const saved = await expectSavedPrefix(fixture, ['country']), key = savedRecord(fixture).recordId;
    const writes = fixture.progressWrites().length;
    await storageState(page).focus(); await page.keyboard.press('Tab');
    await expect(page.locator('[data-booky-journey-clear-progress]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-booky-journey-confirm-clear-progress]')).toBeFocused();
    // New document with the same OS preference bytes: pending consent must not
    // survive or perform removal, acknowledgement or canonical navigation.
    await fixture.coldReload();
    await stablePose(page); const neutral = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 1);
    await expect(page.locator('[data-booky-journey-confirm-clear-progress]')).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(saved); expect(fixture.progressWrites()).toHaveLength(writes);

    const cancellations = [
      ['[data-booky-journey-reset]', '[data-booky-journey-confirm-reset]', '[data-booky-journey-cancel-reset]'],
      ['[data-booky-journey-delete-history=' + JSON.stringify(key) + ']', '[data-booky-journey-confirm-delete-history]', '[data-booky-journey-cancel-delete-history]'],
      ['[data-booky-journey-clear-progress]', '[data-booky-journey-confirm-clear-progress]', '[data-booky-journey-cancel-clear-progress]'],
    ];
    for (const [triggerSelector, confirmSelector, cancelSelector] of cancellations) {
      const trigger = page.locator(triggerSelector), confirm = page.locator(confirmSelector), cancel = page.locator(cancelSelector);
      await trigger.focus(); await page.keyboard.press('Enter'); await expect(confirm).toBeFocused();
      await page.keyboard.press('Tab'); await expect(cancel).toBeFocused();
      await page.keyboard.press('Enter'); await expect(confirm).toHaveCount(0); await expect(trigger).toBeFocused();
    }
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(false));
    await page.evaluate(() => window.__bookyJourneyFixture.setVisible(true));
    await openPanel(page);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 1); await stablePose(page); retained(await actual(page), neutral, true);
    for (const field of ['country', 'writer', 'book']) expect(new URL(page.url()).searchParams.get(field)).toBeNull();
    expect(fixture.memory.get(PROGRESS)).toBe(saved); expect(fixture.progressWrites()).toHaveLength(writes);
    Object.assign(result.observations, { keyboardCancellationTargets: ['reset', 'history-delete', 'clear-all'],
      keyboard: ['Enter opens', 'Tab reaches cancel', 'Enter cancels'], pendingConsentDiscardedOnNewDocument: true,
      nativeBackgroundRetainsPausedPrefix: true, noUnexpectedNavigationOrWrite: true,
      canonicalSceneRetainedWithinDocument: true, fullAccessibilityAcceptanceClaimed: false });
    fixture.verify();
  } finally { await fixture.close(); }
});


async function captureCapacity(fixture, testInfo) {
  const surface = fixture.page.locator('.booky-journey-controls__capacity');
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.evaluate(element => {
    const measure = target => {
      const box = target.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        fullyInViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight };
    };
    const action = element.querySelector('[data-booky-journey-manage-history]'), box = action.getBoundingClientRect();
    return { surface: measure(element), status: measure(element.querySelector('[data-booky-journey-history-capacity]')),
      action: measure(action), actionHit: action.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
  });
  expect(bounds.status.fullyInViewport).toBe(true); expect(bounds.action.fullyInViewport).toBe(true);
  expect(bounds.actionHit).toBe(true); expect(bounds.action.height).toBeGreaterThanOrEqual(44);
  await capture(fixture, testInfo, 'journey-capacity-full-ru-320.png',
    '320px actual App RU explains 32 of 32 entries and offers explicit history management; a new dependent route needs a free entry');
  fixture.result.screenshots.at(-1).bounds = bounds;
}

test('full journey history keeps existing progress usable and frees exactly one chosen entry for a new route', async ({}, testInfo) => {
  test.setTimeout(240_000);
  const fixture = await open(testInfo, { contentMode: 'history' }), { page, result } = fixture;
  result.scenario = 'history-capacity-explicit-recovery';
  try {
    // Obtain a real saved prefix through App controls before constructing held
    // synthetic history. The extra IDs have no definitions or review receipts.
    await startCountryStep(fixture);
    await next(page).click(); await expectReadyNode(page, 'writer', 1);
    const genuineBytes = await expectSavedPrefix(fixture, ['country']);
    const genuinePreference = JSON.parse(genuineBytes), genuine = savedRecord(fixture);
    const held = Array.from({ length: 31 }, (_, index) => {
      const journeyId = 'test.held-history-' + index;
      return { ...genuine, journeyId,
        // Exact codec identity: SHA-256 of UTF-8 JSON [policy, route, version].
        recordId: digest(JSON.stringify([genuine.policyFingerprint, journeyId, genuine.journeyVersion])) };
    });
    const full = { ...genuinePreference, records: [genuine, ...held] }, seededBytes = JSON.stringify(full);
    expect(new Set(full.records.map(record => record.recordId)).size).toBe(32);
    result.observations.capacitySeed = { genuineRecord: genuine, genuinePreferenceSha256: digest(genuineBytes),
      seededPreferenceSha256: digest(seededBytes), heldRecordIds: held.map(record => record.recordId),
      heldRecordsUnreviewed: true, suppliedAtFreshDocumentBoundary: true };
    const beforeColdWrites = fixture.progressWrites().length;
    fixture.memory.set(PROGRESS, seededBytes);
    await fixture.coldReload('history');
    await stablePose(page); const neutral = await actual(page);
    await openPanel(page); await loadBooks(page);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'paused');
    await expectProgress(page, 1);
    const capacity = page.locator('[data-booky-journey-history-capacity]');
    await expect(capacity).toHaveAttribute('data-booky-journey-history-capacity', 'full');
    await expect(capacity).toHaveAttribute('data-booky-journey-history-used', '32');
    await expect(capacity).toHaveAttribute('data-booky-journey-history-limit', '32');
    await expect(capacity).toContainText('32 из 32');
    await expect(page.locator('[data-booky-journey-history-entry]')).toHaveCount(32);
    await expect(routeFor(page, PRIMARY_JOURNEY)).toBeEnabled();
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(seededBytes); expect(fixture.progressWrites()).toHaveLength(beforeColdWrites);
    for (const field of ['country', 'writer', 'book']) expect(new URL(page.url()).searchParams.get(field)).toBeNull();
    await stablePose(page); retained(await actual(page), neutral, true);

    await page.locator('[data-booky-journey-resume]').click();
    await expectReadyNode(page, 'writer', 1);
    for (const [index, id] of ['work', 'checkpoint'].entries()) {
      await next(page).click(); await expectReadyNode(page, id, index + 2);
    }
    await next(page).click();
    await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    const completedBytes = await expectSavedPrefix(fixture, ['country', 'writer', 'work', 'checkpoint']);
    const completed = savedRecord(fixture), completedPreference = JSON.parse(completedBytes);
    expect(completedPreference.records).toHaveLength(32); expect(completedPreference.records.slice(1)).toEqual(held);
    await expect(routeFor(page, PRIMARY_JOURNEY)).toBeEnabled();
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeDisabled();
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toHaveAttribute('aria-describedby', await capacity.getAttribute('id'));
    expect(fixture.progressWrites().some(operation => operation.operation === 'remove')).toBe(false);
    retained(await actual(page), neutral);
    await page.setViewportSize({ width: 320, height: 900 });
    await captureCapacity(fixture, testInfo);

    const completedWrites = fixture.progressWrites().length;
    await locale(page, 'en');
    await expect(capacity).toContainText('32 of 32');
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeDisabled();
    expect(fixture.memory.get(PROGRESS)).toBe(completedBytes); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    await stablePose(page); const beforeManagement = await actual(page), managementUrl = page.url();
    // Keyboard traversal starts at the persistent status, then reaches the
    // explicit management action; focusing a heading does not navigate a route.
    await status(page).focus(); await page.keyboard.press('Tab');
    const manage = page.locator('[data-booky-journey-manage-history]');
    await expect(manage).toBeFocused(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-booky-journey-history-heading]')).toBeFocused();
    expect(fixture.memory.get(PROGRESS)).toBe(completedBytes); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    expect(page.url()).toBe(managementUrl); retained(await actual(page), beforeManagement, true);

    const removed = held[0], remove = historyAction(page, 'delete-history', removed.recordId);
    const confirm = historyAction(page, 'confirm-delete-history', removed.recordId);
    await remove.focus(); await page.keyboard.press('Enter'); await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(historyAction(page, 'cancel-delete-history', removed.recordId)).toBeFocused();
    await page.keyboard.press('Enter'); await expect(confirm).toHaveCount(0); await expect(remove).toBeFocused();
    expect(fixture.memory.get(PROGRESS)).toBe(completedBytes); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    await page.keyboard.press('Enter'); await expect(confirm).toBeFocused();
    fixture.failNextProgressWrite(); await page.keyboard.press('Enter');
    const remaining = [completed, ...held.slice(1)];
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'failed');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'write');
    await expect(page.locator('[data-booky-journey-save-retry]')).toBeVisible();
    expect(fixture.memory.get(PROGRESS)).toBe(completedBytes);
    const failed = fixture.progressWrites().filter(operation => operation.failed);
    expect(failed).toHaveLength(1); expect(JSON.parse(failed[0].value).records).toEqual(remaining);
    // Local intent has a slot, but disk confirmation failed: eligibility may
    // update while the real storage controls keep the change visibly unsaved.
    await expect(capacity).toHaveCount(0);
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeEnabled();
    await page.locator('[data-booky-journey-save-retry]').click();
    const freedBytes = await expectHistorySaved(fixture, completed.recordId, remaining);
    expect(freedBytes).toBe(failed[0].value);
    await expect(page.locator('[data-booky-journey-history-entry]')).toHaveCount(31);
    await expect(historyRow(page, removed.recordId)).toHaveCount(0);
    await expect(capacity).toHaveCount(0);
    await expect(routeFor(page, DEPENDENT_JOURNEY)).toBeEnabled();
    expect(savedRecord(fixture)).toEqual(completed);
    expect(page.url()).toBe(managementUrl); await stablePose(page); retained(await actual(page), beforeManagement, true);
    await page.setViewportSize({ width: 1440, height: 850 });
    await captureHistory(fixture, testInfo, completed.recordId, 'journey-capacity-recovered-en.png',
      'Desktop actual App EN retains the completed primary record after confirmed removal of exactly one held entry; a new route can now start');
    await routeFor(page, DEPENDENT_JOURNEY).click();
    await expectReadyNode(page, 'country', 0, 2);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect.poll(() => savedRecord(fixture)?.journeyId).toBe(DEPENDENT_JOURNEY);
    const final = JSON.parse(fixture.memory.get(PROGRESS));
    expect(final.records).toHaveLength(32);
    expect(final.records.filter(record => record.recordId !== final.activeRecordId)).toEqual(remaining);
    expect(savedRecord(fixture).acknowledgedNodeIds).toEqual([]);
    expect(savedRecord(fixture).resumeNodeId).toBe('country');
    await expect(capacity).toHaveAttribute('data-booky-journey-history-used', '32');
    await expect(historyRow(page, removed.recordId)).toHaveCount(0);
    expect(fixture.progressWrites().some(operation => operation.operation === 'remove')).toBe(false);
    retained(await actual(page), beforeManagement);
    Object.assign(result.observations, { fullCount: 32, freedCount: 31, finalCount: 32, removedRecord: removed,
      retainedCompletedRecord: completed, freedPreferenceSha256: digest(freedBytes),
      validFullSeedFromActualAppPrefix: true, fullColdRestoreNoWriteOrNavigation: true,
      sameRecordResumeAndCompletionAtCapacity: true, newDependentStartDisabledAtCapacity: true,
      capacityExplanationRuEn: true, disabledRouteExplained: true, keyboardManagementFocusesHistory: true,
      cancellationPreservesFullBytes: true, explicitSingleHeldDeletionFreesSlot: true,
      failedDeletionWritePreservesFullBytes: true, localSlotRecoveryRemainsUnsavedUntilRetry: true,
      explicitRetryConfirmsFreedSlot: true,
      originalCompletionAndOtherHistoryRetained: true, newStartUsesOnlyFreedSlot: true,
      noAutomaticEvictionOrClear: true, canonicalSceneRetainedWithinDocument: true,
      productionApprovalClaimed: false, fullAccessibilityAcceptanceClaimed: false });
    fixture.verify();
  } finally { await fixture.close(); }
});


const passportView = page => page.locator('[data-booky-journey-passport]');
const passportSummary = page => page.locator('[data-booky-journey-passport-summary]');
const passportCompleted = page => page.locator('[data-booky-journey-passport-completed-journey]');
async function openPassport(page) {
  await openPanel(page);
  if (!await passportView(page).evaluate(element => element.open)) await passportSummary(page).click();
  await expect(passportView(page)).toHaveJSProperty('open', true);
}
async function expectPassportCounts(page, country, writer, work) {
  await openPassport(page);
  await expect(passportView(page)).toHaveAttribute('data-booky-journey-passport', 'ready');
  for (const [kind, count] of Object.entries({ country, writer, work })) {
    await expect(page.locator('[data-booky-journey-passport-count=' + JSON.stringify(kind) + ']')).toHaveText(String(count));
  }
}
async function expectPassportPending(page) {
  await openPassport(page);
  await expect(passportView(page)).toHaveAttribute('data-booky-journey-passport', 'pending');
  await expect(page.locator('[data-booky-journey-passport-status]')).toHaveAttribute('data-booky-journey-passport-status', 'pending');
  await expect(page.locator('[data-booky-journey-passport-count]')).toHaveCount(0);
  await expect(passportCompleted(page)).toHaveCount(0);
}
async function capturePassport(fixture, testInfo, filename, framing) {
  const surface = passportView(fixture.page);
  await openPassport(fixture.page); await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.evaluate(element => {
    const measure = target => {
      const rect = target.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        fullyInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight };
    };
    const action = target => {
      const box = measure(target);
      return { ...box, hit: target.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
    };
    return { surface: measure(element), summary: action(element.querySelector('[data-booky-journey-passport-summary]')),
      status: measure(element.querySelector('[data-booky-journey-passport-status]')),
      counts: [...element.querySelectorAll('[data-booky-journey-passport-count]')].map(measure),
      completed: [...element.querySelectorAll('[data-booky-journey-passport-completed-journey]')].map(measure),
      manage: action(element.querySelector('[data-booky-journey-passport-manage-history]')),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  expect(bounds.surface.fullyInViewport).toBe(true); expect(bounds.status.fullyInViewport).toBe(true);
  expect(bounds.overflow).toBe(false); expect(bounds.counts).toHaveLength(3);
  for (const box of [...bounds.counts, ...bounds.completed]) expect(box.fullyInViewport).toBe(true);
  for (const box of [bounds.summary, bounds.manage]) {
    expect(box.fullyInViewport).toBe(true); expect(box.hit).toBe(true);
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await capture(fixture, testInfo, filename, framing); fixture.result.screenshots.at(-1).bounds = bounds;
}

test('literary passport credits only confirmed acknowledged steps and withdraws a deliberately deleted history', async ({}, testInfo) => {
  test.setTimeout(240_000);
  const fixture = await open(testInfo), { page, result } = fixture;
  result.scenario = 'passport-confirmed-progress';
  try {
    await page.setViewportSize({ width: 320, height: 900 });
    const initialWrites = fixture.progressWrites().length, initialRaw = fixture.memory.get(PROGRESS) ?? null;
    // A real App URL selects the country, without invoking journey controllers
    // or manufacturing an acknowledgement. Passive opens are not passport credit.
    await page.goto(SITE + '/?country=russia#atlas'); await readyDocument(page);
    await expect(page.locator('[data-atlas-country="russia"]')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('country')).toBe('russia');
    await openPanel(page); await loadBooks(page);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'ready');
    await expect(passportView(page)).toHaveJSProperty('open', false);
    await stablePose(page); const initialScene = await actual(page), initialUrl = page.url();
    await passportSummary(page).focus(); await page.keyboard.press('Enter');
    await expectPassportCounts(page, 0, 0, 0); await expect(passportCompleted(page)).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS) ?? null).toBe(initialRaw); expect(fixture.progressWrites()).toHaveLength(initialWrites);
    expect(page.url()).toBe(initialUrl); retained(await actual(page), initialScene, true);

    await startCountryStep(fixture); await expectPassportCounts(page, 0, 0, 0);
    await next(page).click(); await expectReadyNode(page, 'writer', 1);
    await expectSavedPrefix(fixture, ['country']); await expectPassportCounts(page, 1, 0, 0);
    await next(page).click(); await expectReadyNode(page, 'work', 2);
    const beforeWorkAcknowledgement = await expectSavedPrefix(fixture, ['country', 'writer']);
    await expectPassportCounts(page, 1, 1, 0); await expect(passportCompleted(page)).toHaveCount(0);

    fixture.failNextProgressWrite(); await next(page).click();
    await expectReadyNode(page, 'checkpoint', 3);
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'failed');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'write');
    await expectPassportPending(page);
    expect(fixture.memory.get(PROGRESS)).toBe(beforeWorkAcknowledgement);
    expect(savedRecord(fixture).acknowledgedNodeIds).toEqual(['country', 'writer']);
    const failedAcknowledgement = fixture.progressWrites().filter(operation => operation.failed);
    expect(failedAcknowledgement).toHaveLength(1);
    expect(JSON.parse(failedAcknowledgement[0].value).records[0].acknowledgedNodeIds).toEqual(['country', 'writer', 'work']);
    await page.locator('[data-booky-journey-save-retry]').click();
    const confirmedWork = await expectSavedPrefix(fixture, ['country', 'writer', 'work']);
    expect(confirmedWork).toBe(failedAcknowledgement[0].value);
    await expectPassportCounts(page, 1, 1, 1); await expect(passportCompleted(page)).toHaveCount(0);
    await expect(passportSummary(page)).toHaveText('Литературный паспорт');
    await capturePassport(fixture, testInfo, 'journey-passport-confirmed-ru-320.png',
      '320px actual App RU passport counts only three explicitly acknowledged canonical entities after exact storage retry; journey still incomplete');

    await next(page).click(); await expect(status(page)).toHaveAttribute('data-booky-journey-status', 'complete');
    const completedRaw = await expectSavedPrefix(fixture, ['country', 'writer', 'work', 'checkpoint']);
    const completedRecord = savedRecord(fixture), completedWrites = fixture.progressWrites().length;
    await expectPassportCounts(page, 1, 1, 1); await expect(passportCompleted(page)).toHaveCount(1);
    await expect(passportCompleted(page)).toHaveAttribute('data-booky-journey-passport-completed-journey', PRIMARY_JOURNEY);
    await expect(passportCompleted(page)).toHaveAttribute('data-booky-journey-passport-version', '1');
    await expect(page.locator('[data-booky-journey-passport-completed-title]')).toHaveText('Тестовый маршрут интерфейса');
    await stablePose(page); const beforeLocale = await actual(page), beforeLocaleUrl = page.url();
    await locale(page, 'en');
    await expectPassportCounts(page, 1, 1, 1); await expect(passportCompleted(page)).toHaveCount(1);
    await expect(passportSummary(page)).toHaveText('Literary passport');
    await expect(page.locator('[data-booky-journey-passport-completed-title]')).toHaveText('Synthetic interface journey');
    expect(fixture.memory.get(PROGRESS)).toBe(completedRaw); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    expect(page.url()).toBe(beforeLocaleUrl); await stablePose(page); retained(await actual(page), beforeLocale, true);
    // The native details disclosure is presentation-only, including keyboard use.
    await passportSummary(page).focus(); await page.keyboard.press('Enter');
    await expect(passportView(page)).toHaveJSProperty('open', false); await expect(passportSummary(page)).toBeFocused();
    await page.keyboard.press('Enter'); await expect(passportView(page)).toHaveJSProperty('open', true);
    await expect(passportSummary(page)).toBeFocused(); await expectPassportCounts(page, 1, 1, 1);
    expect(fixture.memory.get(PROGRESS)).toBe(completedRaw); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    expect(page.url()).toBe(beforeLocaleUrl); retained(await actual(page), beforeLocale, true);
    await page.setViewportSize({ width: 1440, height: 850 }); await stablePose(page);
    await capturePassport(fixture, testInfo, 'journey-passport-completed-en.png',
      'Desktop actual App EN passport shows one freshly admitted completed journey and confirmed canonical entity counts; disclosure and history actions remain reachable');

    const beforeManagement = await actual(page), managementUrl = page.url();
    await page.locator('[data-booky-journey-passport-manage-history]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-booky-journey-history-heading]')).toBeFocused();
    expect(fixture.memory.get(PROGRESS)).toBe(completedRaw); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    expect(page.url()).toBe(managementUrl); retained(await actual(page), beforeManagement, true);
    const remove = historyAction(page, 'delete-history', completedRecord.recordId);
    const confirm = historyAction(page, 'confirm-delete-history', completedRecord.recordId);
    await remove.click(); await expect(confirm).toBeFocused();
    expect(fixture.memory.get(PROGRESS)).toBe(completedRaw); expect(fixture.progressWrites()).toHaveLength(completedWrites);
    await expectPassportCounts(page, 1, 1, 1);
    fixture.failNextProgressWrite(); await confirm.click();
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage', 'failed');
    await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage-error', 'write');
    await expectPassportPending(page); await expect(historyRow(page, completedRecord.recordId)).toHaveCount(0);
    expect(fixture.memory.get(PROGRESS)).toBe(completedRaw);
    const failed = fixture.progressWrites().filter(operation => operation.failed);
    expect(failed).toHaveLength(2);
    const removedValue = JSON.parse(failed[1].value);
    expect(removedValue.records).toEqual([]); expect(removedValue.activeRecordId).toBeNull();
    await page.locator('[data-booky-journey-save-retry]').click();
    const deletedRaw = await expectHistorySaved(fixture, null, []);
    expect(deletedRaw).toBe(failed[1].value);
    await expectPassportCounts(page, 0, 0, 0); await expect(passportCompleted(page)).toHaveCount(0);
    await expect(page.locator('[data-booky-journey-passport-completed-title]')).toHaveCount(0);
    expect(page.url()).toBe(managementUrl); await stablePose(page); retained(await actual(page), beforeManagement, true);
    expect(fixture.progressWrites().some(operation => operation.operation === 'remove')).toBe(false);
    Object.assign(result.observations, { ordinaryCountrySelectionNoCredit: true,
      acknowledgedCountSequence: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
      workWriteFailureHidesUnconfirmedCounts: true, workRetryConfirmsExactBytes: true,
      completedOnlyAfterExplicitFinish: true, completedJourney: { id: PRIMARY_JOURNEY, version: 1 },
      defaultClosedNativeDisclosure: true, keyboardDisclosureKeepsFocus: true,
      localeAndDisclosureNoWriteOrNavigation: true, historyManagementFocusOnly: true,
      explicitRecordDeletionRequired: true, failedDeletionHidesConfirmedCredit: true,
      deletionRetryConfirmsExactBytes: true, emptyAfterConfirmedDeletion: true,
      confirmedWorkSha256: digest(confirmedWork), completedPreferenceSha256: digest(completedRaw), deletedPreferenceSha256: digest(deletedRaw),
      canonicalSceneRetainedWithinDocument: true, newPassportPersistenceCreated: false,
      passiveLearningCreditClaimed: false, productionApprovalClaimed: false, fullAccessibilityAcceptanceClaimed: false });
    fixture.verify();
  } finally { await fixture.close(); }
});
