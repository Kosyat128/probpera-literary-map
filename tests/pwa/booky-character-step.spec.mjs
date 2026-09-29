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

// Test-only guidance, synthetic fact assertions and independent test receipts.
// No real literary fact, production approval or child access is supplied here.
const SYNTHETIC_CONTENT = "\nimport { contentTextHash } from '../planet/contentExportHash';\nimport { getBookyDialogueChecksum,getBookyDialogueContentChecksum } from './bookyDialogueRegistry';\nimport { bookyJourneyEntityId,bookyJourneyDialogueContext,getBookyJourneyChecksum } from './bookyJourney';\nimport { inspectBookyDossierCharacter } from './bookyDossierCharacter';\nimport { bookDossierGraphDraftFixture } from '../../scripts/lib/book-dossier-graph-fixture';\nimport { bookDossierFixtureDesignProof } from '../../scripts/lib/book-dossier-fixtures';\nimport { BOOK_DOSSIER_REVIEW_STAGES,compileBookDossier } from '../books/bookDossierCompiler';\nimport { saveBookDossierDraft,reviewBookDossier,publishBookDossier } from '../books/bookDossierWorkflow';\nimport { parsePublishedBookDossier } from '../books/bookDossierDelivery';\nconst id='test.actual-app-journey',version=1,reviewedAt='2026-09-20T12:00:00.000Z';\nconst work={kind:'work',countryId:'russia',writerId:'dostoevsky',workId:'crime-and-punishment'},bookKey='russia:dostoevsky:crime-and-punishment';\nasync function published(locale){\n  const now=Date.parse(reviewedAt),draft=structuredClone(bookDossierGraphDraftFixture());\n  draft.bookKey=bookKey;for(const right of draft.rights)right.originalWork=bookKey;draft.locale=locale;draft.requiredLocales=[locale];draft.translationReadyLocales=[locale];\n  draft.title=locale==='ru'?'Синтетическое досье для проверки интерфейса':'Synthetic dossier for interface testing';\n  draft.writer=locale==='ru'?'Синтетические сведения, не литературный материал':'Synthetic content, not literary material';\n  draft.sections.find(section=>section.id==='graph-context').title=locale==='ru'?'Схема учебных персонажей':'Synthetic character map';\n  for(const block of draft.blocks)for(const item of block.items)if(item.id.startsWith('character-')){\n    item.label=(locale==='ru'?'Учебный персонаж ':'Synthetic character ')+item.id.slice(-1).toUpperCase();\n    item.value=locale==='ru'?'Синтетические сведения для проверки интерфейса.':'Synthetic details for interface testing.';\n  }\n  const context=record=>({now,actor:{id:'11111111-1111-4111-8111-111111111111',role:'owner'},expectedRevision:record?.revision||0});\n  const checked=result=>{if(!result.record||result.issues.length)throw Error(JSON.stringify(result.issues));return result.record;};\n  let record=checked(await saveBookDossierDraft(draft,null,context(null)));\n  for(const stage of BOOK_DOSSIER_REVIEW_STAGES)record=checked(await reviewBookDossier(record,stage,'APPROVED',true,{...context(record),...(stage==='design'?{designProof:bookDossierFixtureDesignProof(record,now)}:{})}));\n  record=checked(await publishBookDossier(record,context(record)));\n  const compiled=await compileBookDossier(record,{now,themeVersion:'synthetic-d206-character'});\n  if(!compiled.document||compiled.issues.length)throw Error(JSON.stringify(compiled.issues));return compiled.document;\n}\nconst documents={ru:await published('ru'),en:await published('en')};\nwindow.__d206PublicationCalls=[];window.__d206PublicationMode='ready';\nwindow.__d206PublicationFetch=async options=>{\n  const event={bookKey:options.bookKey,locale:options.locale,mode:options.mode,spoilers:options.revealSpoilers,reached:[...options.reachedItemIds??[]],delivery:window.__d206PublicationMode};window.__d206PublicationCalls.push(event);\n  if(options.signal?.aborted||window.__d206PublicationMode!=='ready'||options.bookKey!==bookKey||!documents[options.locale]||options.mode!=='BEFORE_READING'||options.revealSpoilers!=='NONE'||options.reachedItemIds?.length)return null;\n  const value=parsePublishedBookDossier({...documents[options.locale],validUntil:new Date(Date.now()+(window.__d206LeaseMs??60_000)).toISOString()});if(!value)throw Error('Synthetic published delivery rejected by actual parser');return value;\n};\nfunction makeCharacter(nodeId,itemId,blockId){const bindings=['ru','en'].map(locale=>{\n  const reference={work,dossierVersion:documents[locale].dossierVersion,locale,sectionId:'graph-context',blockId,itemId};\n  // Identity-only inputs prepare the projection checksum. They are never\n  // installed in App's catalogs; admission uses its real demand-loaded data.\n  const projection=inspectBookyDossierCharacter({reference,dossier:{...documents[locale],validUntil:new Date(Date.now()+60_000).toISOString()},publicCountries:[{id:'russia',writers:[{id:'dostoevsky'}]}],publicBooks:[{id:'crime-and-punishment',countryId:'russia',writerId:'dostoevsky',editorial:{status:'reviewed'}}]},Date.now());\n  if(!projection)throw Error('Synthetic character projection unavailable');\n  return{locale,dossierVersion:reference.dossierVersion,sectionId:reference.sectionId,blockId:reference.blockId,itemId:reference.itemId,readingMode:'BEFORE_READING',projectionChecksum:projection.semanticChecksum,dialogue:{id:id+'.'+nodeId,version:1,contentChecksum:'a'.repeat(64)}};\n});\nreturn {schemaVersion:1,id:'test.'+nodeId+'-contract',version:1,work,bindings};}\nconst characters={character:makeCharacter('character','character-c','graph-guests'),character_second:makeCharacter('character_second','character-b','graph-team')};\nconst definitions=[],dialogues=[],dialogueApprovals=[],journeyApprovals=[],availability=[];\nconst baseNodes=[{id:'country',kind:'country',screen:'globe',entity:{kind:'country',countryId:'russia'}},{id:'writer',kind:'writer',screen:'globe',entity:{kind:'writer',countryId:'russia',writerId:'dostoevsky'}},{id:'work',kind:'work',screen:'collection',entity:work},{id:'character',kind:'character',screen:'collection',entity:work,character:characters.character},{id:'character_second',kind:'character',screen:'collection',entity:work,character:characters.character_second},{id:'checkpoint',kind:'checkpoint',screen:'globe',entity:null}];\nfor(const locale of ['ru','en'])for(const node of baseNodes){\n  const title=locale==='ru'?'Тест интерфейса: '+node.id:'Interface test: '+node.id;\n  const body=node.kind==='character'?(locale==='ru'?'Откройте учебного персонажа и отдельно подтвердите шаг в его карточке.':'Open the synthetic character and separately acknowledge the step in its card.'):(locale==='ru'?'Откройте этот экран и подтвердите шаг, когда будете готовы.':'Open this screen and acknowledge the step when you are ready.');\n  const payload={id:id+'.'+node.id,locale,version:1,audience:'adult',ageRange:{min:18,max:120},readingLevel:'plain',intent:'navigation',screens:[node.screen],context:bookyJourneyDialogueContext(id,node),entityIds:node.entity?[bookyJourneyEntityId(node.entity)]:[],claimKind:'interface-guidance',factualSources:[],copy:{title,body,caption:body,reduced:title},narration:null,prohibitedTags:[],provenance:{kind:'editorial',sourcePath:'tests/pwa/booky-character-step.spec.mjs',sourceVersion:1,sourceRef:'synthetic-only:'+node.id,sourceSha256:'a'.repeat(64),copySha256:contentTextHash(JSON.stringify({title,body}))}};\n  const review={status:'approved',reviewer:'synthetic-dialogue-reviewer-not-real',reviewedAt,contentChecksum:getBookyDialogueContentChecksum(payload)};\n  dialogues.push({payload,review,checksum:getBookyDialogueChecksum({payload,review})});dialogueApprovals.push({id:payload.id,locale,version:1,contentChecksum:review.contentChecksum,reviewer:review.reviewer,reviewedAt});\n}\nfor(const [nodeId,character] of Object.entries(characters))characters[nodeId]={...character,bindings:character.bindings.map(binding=>({...binding,dialogue:{...binding.dialogue,contentChecksum:dialogues.find(record=>record.payload.locale===binding.locale&&record.payload.id===id+'.'+nodeId).review.contentChecksum}}))};\nfor(const locale of ['ru','en']){\n  const nodes=baseNodes.map(node=>{const record=dialogues.find(record=>record.payload.locale===locale&&record.payload.id===id+'.'+node.id);return{...node,...(node.kind==='character'?{character:characters[node.id]}:{}),dialogue:{id:record.payload.id,version:1,contentChecksum:record.review.contentChecksum}}});\n  const definition={schemaVersion:1,id,version,locale,audience:'adult',ageRange:{min:18,max:120},readingLevel:'plain',title:locale==='ru'?'Тестовый маршрут интерфейса':'Synthetic interface journey',prerequisites:[],nodes};definitions.push(definition);journeyApprovals.push({id,version,locale,definitionChecksum:getBookyJourneyChecksum(definition),reviewer:'synthetic-journey-reviewer-not-real',reviewedAt});availability.push({journeyId:id,version,locale,nodes:nodes.map(node=>({nodeId:node.id,locale,dialogueContentChecksum:node.dialogue.contentChecksum,available:true,offlineAvailable:false}))});\n}\nwindow.__d206SyntheticCharacter={bookKey,characters,documentIdentities:Object.fromEntries(Object.entries(documents).map(([locale,dossier])=>[locale,{bookKey:dossier.bookKey,cacheKey:dossier.cacheKey,dossierVersion:dossier.dossierVersion}]))};\nconst content={definitions,dialogues,currentVersions:[{id,version}],dialogueApprovals,journeyApprovals,availability};\nexport const readBookyJourneyContent=()=>content;\n";
const SYNTHETIC_PUBLIC_CLIENT = "// Explicit test boundary: the native production capability remains disabled.\nexport const isPublishedBookDossierAvailable=()=>window.__d206PublicationCapability===true;\nexport const fetchPublishedBookDossier=options=>window.__d206PublicationFetch(options);\n";
const SYNTHETIC_MIGRATION_CONTENT='export const readBookyJourneyMigrationContent=()=>({historicalDefinitions:[],migrations:[],approvedMigrationReceipts:[]});';

// Actual App, source CSS and existing R3F scene. Native OS/preference bindings
// and HTTP delivery of real split chunks are controlled. Every camera movement uses real product controls or
// a Playwright pointer gesture; the fixture never assigns camera/controls state.
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const output = path.join(ROOT, '.tmp/booky-journey-memory');
  const replacementCounts={publication:0,journey:0,migration:0};
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
    publicPath: '/fixture/', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]', platform: 'browser', target: 'es2022', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true,
      VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_TURNSTILE_SITE_KEY: '' }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: 'false',
      __LITERARY_PLANET_LICENSE_AUTHORITY__: 'null', __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { '.css': 'css', '.png': 'file', '.webp': 'file', '.avif': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name: 'canonical-vite-resources', setup(builder) {
      builder.onLoad({filter:/[\\/]bookDossierPublicClient\.ts$/},args=>({...(++replacementCounts.publication,{}),contents:SYNTHETIC_PUBLIC_CLIENT,loader:'ts',resolveDir:path.dirname(args.path)}));
      builder.onLoad({ filter: /[\\/]bookyJourneyContent\.ts$/ }, args => ({ ...(++replacementCounts.journey,{}), contents: SYNTHETIC_CONTENT, loader: 'ts', resolveDir: path.dirname(args.path) }));
      builder.onLoad({ filter: /[\\/]bookyJourneyMigrationContent\.ts$/ }, args => ({ ...(++replacementCounts.migration,{}), contents: SYNTHETIC_MIGRATION_CONTENT, loader: 'ts', resolveDir: path.dirname(args.path) }));
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
  expect(replacementCounts).toEqual({publication:1,journey:1,migration:1});
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
  required.push('src/host/bookyJourneyFact.ts', 'src/host/BookyJourneyFactSources.tsx');
  for (const filename of required) expect(inputs).toContain(filename);
  const sourcePaths = [...new Set([...required, ...inputs.filter(value => value.startsWith('src/') && !value.includes('?')), 'tests/pwa/booky-character-step.spec.mjs'])].sort();
  const sourceInputs = await Promise.all(sourcePaths.map(async filename => ({ path: filename, sha256: digest(await fs.readFile(path.join(ROOT, filename))) })));
  files = new Map(built.outputFiles.map(file => ['/fixture/' + path.relative(output, file.path).replaceAll('\\', '/'), Buffer.from(file.contents)]));
  const selectionBytes = await fs.readFile(path.join(ROOT, 'scripts/mobile/native-base-assets.json'));
  selectedAssets = new Map(JSON.parse(selectionBytes).files.map(entry => {
    if (entry.source !== 'public/' + entry.output || entry.transformation !== 'none' || /(?:^|\/)\.\.(?:\/|$)|\\/u.test(entry.output)) throw Error('Invalid selected native asset');
    return ['/' + entry.output, entry];
  }));
  sourceEvidence = { externalFixtureSha256:digest(await fs.readFile(fileURLToPath(import.meta.url))),syntheticPublicationCapability:true,realPublicationServiceClaimed:false,syntheticDossierWorkflowOnly:true,publicClientReplacementSha256:digest(SYNTHETIC_PUBLIC_CLIENT),characterContentReplacementSha256:digest(SYNTHETIC_CONTENT),kind: 'canonical-app-adult-booky-journey-in-Chrome', actualApp: true, actualCss: true, actualGlobe: true,
    controlledPorts: ['native OS lifecycle and preference map; key-specific journey-progress write rejection and manually released write gate', 'HTTP delivery of real split chunks', 'explicitly synthetic content provider'],
    controllerObservation: 'No controller is replaced or called by the fixture. Semantic progress and readiness are observed through the real rendered controls.',
    bookChunks, primaryBookChunk, retryBookChunk, sharedBookDependencies,
    countryChunks, primaryCountryChunk, retryCountryChunk, sharedCountryDependencies,
    componentChunks, primaryComponentChunk, retryComponentChunk, sharedComponentDependencies, sourceInputs,
    cameraAuthority: 'Only existing canonical App navigation owns scene changes; no fixture camera assignments or synthetic navigation acknowledgement.',
    representation: 'Actual App journey controls, compiler, fresh admission, runtime and canonical country/writer/book navigation. Journey/migration content plus the publication capability/client boundary are replaced with explicitly synthetic RU/EN interface guidance, opt-in synthetic fact assertions with inert example.org citations, exact historical definitions and independent test review receipts. The native production publication gate stays closed; this fixture explicitly supplies a synthetic capability and actual-workflow/parser dossier delivery. No App state or canonical catalog setter is used; native bindings and Vite glob delivery are controlled. Source fixture evidence, not a dist artifact, installed-device or production journey acceptance.',
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

async function open(testInfo, { contentMode = 'approved', readerSeed = CONFIRMED_READER, progressSeed = null, overview = null, language = 'ru', width = 390 } = {}) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(ROOT, '.tmp/s15-booky-live'));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, 'journey-'));
  const context = await chromium.launchPersistentContext(profile, { channel: process.env.S15_BROWSER_CHANNEL ?? 'chrome', headless: true,
    viewport: { width, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  await page.addInitScript(()=>{window.__d206LibraryWrites=[];const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&key.startsWith('probpera-reading-library'))window.__d206LibraryWrites.push({key,value});return setItem.call(this,key,value);};});
  const memory = new Map([['probpera-interface-language', language], ['probpera-planet-welcome-v1', 'completed'],
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
  let rejectStartup=null;page.on('pageerror', error => {errors.push(error.message);rejectStartup?.(new Error('Fatal App startup pageerror: '+error.message));});
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
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture/booky-journey.css"></head><body><div id="root"></div><script>window.__journeyContentMode=' + JSON.stringify(contentMode)
        + (overview === null ? '' : ';window.__journeyOverviewMode=' + JSON.stringify(overview))
        + ';window.__d206PublicationCapability=' + JSON.stringify(contentMode!=='capability-absent') + ';</script><script type="module" src="/fixture/booky-journey.js"></script></body></html>' }); return;
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
    const fatalStartup=new Promise((_,reject)=>{rejectStartup=reject;});
    await Promise.race([fatalStartup,(async()=>{await page.goto(SITE + '/#atlas');await readyDocument(page);})()]);rejectStartup=null;
    return { page, memory, result, requestedChunks, operations,
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
      async coldReload(mode = contentMode, nextOverview = overview) {
        contentMode = mode; overview = nextOverview;
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
        result.publicationCalls=await page.evaluate(()=>window.__d206PublicationCalls??[]);result.libraryWrites=await page.evaluate(()=>window.__d206LibraryWrites??[]);
        Object.assign(result, { operations, errors, externalRequests, missingResources, requestedChunks,
          finalReaderPreference: memory.get(READER) ?? null, finalBookyPreference: JSON.parse(memory.get(BOOKY) ?? 'null'),
          finalProgressPreferenceRaw: memory.get(PROGRESS) ?? null });
        const filename = testInfo.outputPath('booky-character-step.json');
        await fs.writeFile(filename, JSON.stringify(result, null, 2) + '\n');
        await testInfo.attach('booky-character-step-source-evidence', { path: filename, contentType: 'application/json' });
        await context.close();
      } };
  } catch (error) { rejectStartup=null;const startup={...result,stage:'before fixture returned',error:error.message,errors,externalRequests,missingResources,operations,dom:await page.locator('body').innerText().catch(()=>null)};await fs.writeFile(testInfo.outputPath('startup-failure.json'),JSON.stringify(startup,null,2)+'\n');await context.close(); throw error; }
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

async function guidanceSettle(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});}
async function globeGuidanceInputs(page, observation) {
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  async function geometry(locator) {
    return locator.evaluate(element=>{
      const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const box=rect(element);let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const scrollers=[];
      for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll|hidden|clip/.test(style.overflowY)){const r=rect(parent);clip={left:Math.max(clip.left,r.left+parent.clientLeft),right:Math.min(clip.right,r.left+parent.clientLeft+parent.clientWidth),top:Math.max(clip.top,r.top+parent.clientTop),bottom:Math.min(clip.bottom,r.top+parent.clientTop+parent.clientHeight)};if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+1)scrollers.push({index:scrollers.length,tag:parent.tagName,className:parent.className,rect:r,top:parent.scrollTop,height:parent.clientHeight,range:parent.scrollHeight-parent.clientHeight});}}
      const center={x:(box.left+box.right)/2,y:(box.top+box.bottom)/2};const points=[center,{x:center.x-box.width*.2,y:center.y},{x:center.x+box.width*.2,y:center.y}];
      const hits=points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return {point,inside:!!hit&&element.contains(hit),hit:hit?{tag:hit.tagName,className:typeof hit.className==='string'?hit.className:null,text:hit.textContent?.trim().slice(0,70)}:null};});
      return {box,clip,scrollers,scroll:scrollers[0]??null,center,hits,text:element.textContent?.trim(),disabled:!!element.disabled,visible:!!element.getClientRects().length&&getComputedStyle(element).visibility==='visible',borderRadius:getComputedStyle(element).borderRadius};
    });
  }
  async function expose(locator,label) {
    await expect(locator,label+' present').toBeVisible();let state=await geometry(locator);
    const usable=Math.max(40,Math.min(page.viewportSize().height,...state.scrollers.map(owner=>owner.height))*.55);const budget=Math.min(160,Math.max(8,Math.ceil(state.scrollers.reduce((sum,owner)=>sum+owner.range,0)/usable)+8));
    for(let attempt=0;attempt<=budget;attempt++) {
      state=await geometry(locator);const b=state.box,c=state.clip;
      if(b.top>=c.top-.5&&b.bottom<=c.bottom+.5&&b.left>=c.left-.5&&b.right<=c.right+.5&&state.hits.every(hit=>hit.inside)) return state;
      const towardTop=b.top<c.top-.5;state.scroll=state.scrollers.find(owner=>towardTop?owner.top>.5:owner.top<owner.range-.5)??null;
      if(!state.scroll||attempt===budget)throw Error(label+' cannot be exposed: '+JSON.stringify({budget,attempt,state}));
      const s=state.scroll.rect,left=Math.max(2,s.left),right=Math.min(page.viewportSize().width-2,s.right),top=Math.max(2,s.top+3),bottom=Math.min(page.viewportSize().height-2,s.bottom-3),down=b.top<c.top;
      const overflow=down?c.top-b.top:Math.max(0,b.bottom-c.bottom),distance=Math.min(240,(bottom-top)*.45,Math.max(64,overflow+48));
      const middle=(top+bottom)/2;let start=middle+(down?-distance/2:distance/2),end=middle+(down?distance/2:-distance/2);
      const corridor=await locator.evaluate((element,{left,right,start,end,top,bottom,down,ownerIndex})=>{
        const scrollers=[];for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+1)scrollers.push(parent);}const scroll=scrollers[ownerIndex];
        const describe=node=>({tag:node.tagName,className:typeof node.className==='string'?node.className:null,touchAction:getComputedStyle(node).touchAction,pointerEvents:getComputedStyle(node).pointerEvents,overflowY:getComputedStyle(node).overflowY,scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,chosenScroll:node===scroll});
        const paths=[{start,end}];if(scroll?.hasAttribute('data-planet-mascot-pet'))for(const length of [64,48,32,24])for(let low=top+4;low+length<=bottom-4;low+=8)paths.push({start:down?low:low+length,end:down?low+length:low});
        const candidates=paths.flatMap(route=>[left+8,right-8,(left+right)/2].map(x=>({x,start:route.start,end:route.end,points:[route.start,(route.start+route.end)/2,route.end].map(y=>{const hit=document.elementFromPoint(x,y),ancestors=[];let current=hit;while(current){ancestors.push(describe(current));if(current===scroll)break;current=current.parentElement;}return {x,y,hit:hit?describe(hit):null,inside:!!scroll&&!!hit&&scroll.contains(hit),interactive:!!scroll&&!!hit&&(()=>{const owner=hit.closest('canvas,button,a,input,textarea,select,[role="button"],[data-planet-mascot-pet]');return !!owner&&owner!==scroll&&scroll.contains(owner);})(),ancestors};})})));
        const chosen=candidates.find(candidate=>candidate.points.every(point=>point.inside&&!point.interactive&&point.ancestors.every(node=>node.touchAction!=='none'&&(node.chosenScroll||!/auto|scroll/.test(node.overflowY)||node.scrollHeight<=node.clientHeight+1))));
        return {candidates,chosen:chosen?{x:chosen.x,start:chosen.start,end:chosen.end}:null};
      },{left,right,start,end,top,bottom,down,ownerIndex:state.scroll.index});
      const record={label,attempt,budget,ownerIndex:state.scroll.index,scrollersBefore:state.scrollers,before:state.scroll.top,direction:down?'toward top':'toward bottom',targetBefore:state.box,clipBefore:state.clip,distance,start,end,holdBeforeReleaseMs:180,corridor};observation.scrolls.push(record);
      if(corridor.chosen===null)throw Error(label+' has no touch-scroll corridor: '+JSON.stringify(record));
      const x=corridor.chosen.x;start=corridor.chosen.start;end=corridor.chosen.end;record.actualStart=start;record.actualEnd=end;record.actualDistance=Math.abs(end-start);await touch('touchStart',[{x,y:start}]);for(let step=1;step<=8;step++){await touch('touchMove',[{x,y:start+(end-start)*step/8}]);await page.waitForTimeout(35);}await page.waitForTimeout(180);await touch('touchEnd',[]);await page.waitForTimeout(100);await guidanceSettle(page);
      const after=await geometry(locator);record.after=after.scrollers.find(owner=>owner.index===record.ownerIndex)?.top??null;record.scrollersAfter=after.scrollers;record.targetAfter=after.box;
    }
  }
  async function tap(locator,label,{minimum44=true,moving=false}={}) {
    if(!moving)await expose(locator,label);let state,last=null,matches=0;
    if(moving){state=await geometry(locator);expect(state.hits.every(hit=>hit.inside),label+' current moving target hits').toBe(true);expect(state.box.top>=state.clip.top-.5&&state.box.bottom<=state.clip.bottom+.5&&state.box.left>=state.clip.left-.5&&state.box.right<=state.clip.right+.5,label+' current moving target contained').toBe(true);}else
    await expect.poll(async()=>{state=await geometry(locator);const key=JSON.stringify([state.box,state.clip,state.hits.map(hit=>hit.inside)]);matches=key===last?matches+1:1;last=key;return matches>=3&&state.hits.every(hit=>hit.inside);},{intervals:[80],message:label+' settled touch geometry'}).toBe(true);
    observation.targets.push({label,...state});
    if(minimum44){expect(state.box.width,label+' width').toBeGreaterThanOrEqual(44);expect(state.box.height,label+' height').toBeGreaterThanOrEqual(44);}expect(state.disabled,label+' enabled').toBe(false);
    await locator.evaluate(target=>{window.__writerRecoveryTouch=[];window.__d206TouchTarget=target;window.__d206TouchStarted=performance.now();for(const type of ['pointerdown','pointerup','click'])target.addEventListener(type,event=>window.__writerRecoveryTouch.push({type,trusted:event.isTrusted,pointerType:event.pointerType,pointerId:event.pointerId,intended:target.contains(event.target),sameTarget:event.currentTarget===target,connected:target.isConnected,eventTime:event.timeStamp,observedTime:performance.now()}),{once:true});});
    const record={label,events:[],singleTouch:true,maximumClickObservationMs:750};observation.touches.push(record);
    await touch('touchStart',[state.center]);await page.waitForTimeout(65);await touch('touchEnd',[]);await guidanceSettle(page);
    try{await expect.poll(async()=>{record.events=await page.evaluate(()=>window.__writerRecoveryTouch);const down=record.events.find(event=>event.type==='pointerdown');return record.events.some(event=>event.type==='click'&&event.trusted&&event.pointerType==='touch'&&event.intended&&event.sameTarget&&event.pointerId===down?.pointerId);},{timeout:750,intervals:[25,50,100],message:label+' one trusted click from the same single touch and target'}).toBe(true);}
    finally{record.events=await page.evaluate(()=>window.__writerRecoveryTouch);record.after=await page.evaluate(()=>{const target=window.__d206TouchTarget,r=target?.getBoundingClientRect(),pet=document.querySelector('[data-planet-mascot-pet]');return{elapsedMs:performance.now()-window.__d206TouchStarted,targetConnected:target?.isConnected,targetClass:target?.className,targetBounds:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null,visibility:pet?.dataset.planetMascotVisibility,panel:pet?.dataset.planetMascotPanelState,focus:document.activeElement?.outerHTML.slice(0,300)};});}
    const events=record.events,down=events.find(event=>event.type==='pointerdown');for(const type of ['pointerdown','pointerup','click'])expect(events.some(event=>event.type===type&&event.trusted&&event.pointerType==='touch'&&event.intended&&event.sameTarget&&event.pointerId===down?.pointerId),label+' trusted '+type).toBe(true);
  }
  return {tap,expose,geometry,close:()=>cdp.detach()};
}

const characterHintCopy={ru:{current:'Подтвердите шаг в открытой карточке персонажа.',closed:'Откройте этот шаг, затем подтвердите его.'},en:{current:'Acknowledge this step inside the open character card.',closed:'Open this step, then acknowledge it.',unavailable:'The character card is currently unavailable. You can return to this step later.'}};
const characterDialog=page=>page.locator('dialog[open]').filter({has:page.locator('[data-dossier-character-view]')});
const acknowledge=page=>page.locator('[data-dossier-character-acknowledge]');
function savedRecord(fixture){const value=JSON.parse(fixture.memory.get(PROGRESS)??'null');return value?.records.find(record=>record.recordId===value.activeRecordId)??null;}
async function characterPrefix(fixture,prefix){await expect.poll(()=>savedRecord(fixture)?.acknowledgedNodeIds??null).toEqual(prefix);await expect(storageState(fixture.page)).toHaveAttribute('data-booky-journey-storage','ready');return fixture.memory.get(PROGRESS);}
async function characterCapture(fixture,testInfo,filename,framing){await guidanceSettle(fixture.page);const bytes=await fixture.page.screenshot({path:testInfo.outputPath(filename),animations:'disabled'});fixture.result.screenshots.push({filename,sha256:digest(bytes),...fixture.page.viewportSize(),framing});}
async function openJourney(fixture,input){const {page}=fixture;if(!await panel(page).count())await input.tap(page.locator('[data-planet-mascot-toggle]'),'Open Booky help');await expect(page.locator('[data-booky-reader-state]')).toHaveAttribute('data-booky-reader-state','ready');const load=page.locator('[data-booky-journey-load]');if(await load.count()){await input.tap(load,'Load actual book catalog');await expect(load).toHaveCount(0,{timeout:60000});}await expect(storageState(page)).toHaveAttribute('data-booky-journey-storage','ready');}
async function readyJourneyNode(page,id,input){await expect(node(page)).toHaveAttribute('data-booky-journey-node',id);const resume=page.locator('[data-booky-journey-resume]');await expect(status(page)).toHaveAttribute('data-booky-journey-status',/^(ready|paused)$/u);if(await status(page).getAttribute('data-booky-journey-status')==='paused')await input.tap(resume,'Explicit Resume after surface relocation');await expect(status(page)).toHaveAttribute('data-booky-journey-status','ready');await expect(resume).toHaveCount(0);}
async function reachCharacter(fixture,input){const {page,result}=fixture;await openJourney(fixture,input);expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual([]);await input.tap(routeFor(page,PRIMARY_JOURNEY),'Start country-first character journey');await readyJourneyNode(page,'country',input);await characterPrefix(fixture,[]);for(const [previous,current] of [['country','writer'],['writer','work']]){await input.tap(next(page),'Acknowledge '+previous);await readyJourneyNode(page,current,input);}await characterPrefix(fixture,['country','writer']);await stablePose(page);const scene=await actual(page);const library=await page.evaluate(()=>({writes:[...window.__d206LibraryWrites],values:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('probpera-reading-library')).map(key=>[key,localStorage.getItem(key)]))}));result.observations.characterStep={touches:result.observations.characterStep.touches,targets:result.observations.characterStep.targets,scrolls:result.observations.characterStep.scrolls,routeAdmittedBeforeDossier:true,sceneBeforeCharacter:scene,libraryBeforeCharacter:library};await input.tap(next(page),'Acknowledge work and request first character');await readyJourneyNode(page,'character',input);await expect(characterDialog(page)).toBeVisible();await expect(page.locator('[data-dossier-character-view]')).toHaveAttribute('data-dossier-character-view','character-c');await expect(next(page)).toHaveCount(0);await characterPrefix(fixture,['country','writer','work']);return {scene,library};}
async function assertNoReadingOrSceneChange(fixture,before){const {page}=fixture;retained(await actual(page),before.scene,true);expect(await page.evaluate(()=>({writes:[...window.__d206LibraryWrites],values:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('probpera-reading-library')).map(key=>[key,localStorage.getItem(key)]))}))).toEqual(before.library);}

async function restoreCharacterWorkByUser(fixture,input,language,expected){
  const {page,result}=fixture,bookKey='russia:dostoevsky:crime-and-punishment';
  const observation={coldRestore:language==='en',snapshots:[],oldTokenIdentityObserved:false};
  result.observations.characterStep.workResume=observation;
  const assertSemantic=async(panelOpen=true)=>{
    if(panelOpen)await characterPrefix(fixture,expected.prefix);
    else await expect.poll(()=>savedRecord(fixture)?.acknowledgedNodeIds??null).toEqual(expected.prefix);
    expect(savedRecord(fixture)?.resumeNodeId).toBe('character');
    expect(fixture.memory.get(PROGRESS)).toBe(expected.raw);
    expect(fixture.progressWrites()).toHaveLength(expected.writes);
  };
  const snapshot=async label=>{
    const dom=await page.evaluate(()=>({url:location.href,timeOrigin:performance.timeOrigin,
      phase:document.querySelector('[data-booky-journey-status]')?.getAttribute('data-booky-journey-status')??null,
      node:document.querySelector('[data-booky-journey-node]')?.getAttribute('data-booky-journey-node')??null,
      detail:document.querySelector('#book-archive-detail')?.getAttribute('data-cms-entity-id')??null,
      publicationCalls:[...window.__d206PublicationCalls],libraryWrites:[...window.__d206LibraryWrites],
      libraryValues:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('probpera-reading-library')).map(key=>[key,localStorage.getItem(key)]))}));
    observation.snapshots.push({label,...dom,progressRaw:fixture.memory.get(PROGRESS),progressWriteCount:fixture.progressWrites().length,scene:await actual(page)});
  };
  await assertSemantic();await snapshot('current character before deliberate exit');
  await input.tap(characterDialog(page).getByRole('button',{name:language==='ru'?'Закрыть':'Close',exact:true}),'Close current character before leaving its work');
  await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);await assertSemantic();
  await input.tap(page.locator('[data-planet-mascot-collapse]'),'Close Booky help before closing the underlying book detail');
  await expect(panel(page)).toHaveCount(0);await assertSemantic(false);
  observation.helpCollapsedBeforeBookClose=true;
  await input.tap(page.locator('.book-detail-close'),'Explicitly close current book detail before leaving collection');
  await expect(page.locator('#book-archive-detail')).toHaveCount(0);
  await expect.poll(()=>new URL(page.url()).searchParams.has('book')).toBe(false);
  await expect(page.locator('.native-planet-panel')).toBeVisible();
  await assertSemantic(false);await snapshot('book closed and URL restored while collection remains open and help is closed');
  await input.tap(page.locator('.native-planet-panel__header').getByRole('button',{name:language==='ru'?'Вернуться к планете':'Return to the planet',exact:true}),'Explicit return from collection to planet after book close');
  await expect(page.locator('.native-planet-panel')).toBeHidden();await expect(page.locator('#book-archive-detail')).toHaveCount(0);
  observation.exitNavigationActions=2;
  await expect(panel(page)).toHaveCount(0);await openJourney(fixture,input);
  await expect(panel(page)).toBeVisible();observation.helpReopenedBeforeResume=true;
  await expect(status(page)).toHaveAttribute('data-booky-journey-status','paused');
  await expect(node(page)).toHaveAttribute('data-booky-journey-node','character');
  await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);
  await assertSemantic();await snapshot('paused on globe after explicit return');
  if(language==='en'){
    await fixture.coldReload('approved');await openJourney(fixture,input);
    await expect(page.locator('.native-planet-panel')).toBeHidden();await expect(page.locator('#book-archive-detail')).toHaveCount(0);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status','paused');
    await expect(node(page)).toHaveAttribute('data-booky-journey-node','character');
    await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);
    expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual([]);
    await assertSemantic();await snapshot('cold paused restore before any Resume');
  }
  await page.evaluate(()=>{
    const audit={rows:[],opened:false,overflow:0,last:null,observer:null,capture:null};
    audit.capture=()=>{const row={phase:document.querySelector('[data-booky-journey-status]')?.getAttribute('data-booky-journey-status')??null,
      node:document.querySelector('[data-booky-journey-node]')?.getAttribute('data-booky-journey-node')??null,
      detail:document.querySelector('#book-archive-detail')?.getAttribute('data-cms-entity-id')??null,
      openModal:document.querySelectorAll('dialog[open] [data-dossier-character-view]').length,
      acknowledge:document.querySelectorAll('[data-dossier-character-acknowledge]').length};
      if(row.openModal||row.acknowledge)audit.opened=true;const key=JSON.stringify(row);if(key===audit.last)return;audit.last=key;
      if(audit.rows.length<128)audit.rows.push({at:performance.now(),...row});else audit.overflow++;
    };
    audit.observer=new MutationObserver(audit.capture);audit.observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});audit.capture();window.__d209CharacterResumeAudit=audit;
  });
  try{
    await input.tap(page.locator('[data-booky-journey-resume]'),'Explicit Resume restores only the current character work');
    // No readiness helper here: it may issue another Resume and obscure the boundary.
    await expect(page.locator('#book-archive-detail')).toHaveAttribute('data-cms-entity-id',bookKey,{timeout:60000});
    await expect(node(page)).toHaveAttribute('data-booky-journey-node','character');
    await expect(status(page)).toHaveAttribute('data-booky-journey-status','ready',{timeout:60000});
    await expect(page.locator('.book-dossier-reader')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('[data-booky-journey-open]')).toBeEnabled();
    await expect(status(page)).toHaveText(characterHintCopy[language].closed);
    await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);
    await assertSemantic();await guidanceSettle(page);
    await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);
    expect(await page.evaluate(key=>window.__d206PublicationCalls.some(call=>call.bookKey===key&&call.delivery==='ready'),bookKey)).toBe(true);
    await snapshot('exact work ready after one Resume and current publication, before Open');
  }finally{
    observation.modalAudit=await page.evaluate(()=>{const audit=window.__d209CharacterResumeAudit;if(!audit)return null;audit.capture();audit.observer.disconnect();return{rows:audit.rows,opened:audit.opened,overflow:audit.overflow};});
  }
  expect(observation.modalAudit.opened).toBe(false);expect(observation.modalAudit.overflow).toBe(0);
  // Deliberate work navigation owns its reading changes. Cold reload also creates
  // new renderer resources. Only subsequent character actions use this baseline.
  await stablePose(page);
  const fresh={scene:await actual(page),library:await page.evaluate(()=>({writes:[...window.__d206LibraryWrites],values:Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('probpera-reading-library')).map(key=>[key,localStorage.getItem(key)]))}))};
  observation.characterActionBaselineAfterWorkNavigation=fresh;
  await input.tap(page.locator('[data-booky-journey-open]'),'Fresh explicit Open after restoring only the prerequisite work');
  await expect(characterDialog(page)).toBeVisible();await expect(page.locator('[data-dossier-character-view]')).toHaveAttribute('data-dossier-character-view','character-c');
  await expect(acknowledge(page)).toBeVisible();await expect(next(page)).toHaveCount(0);
  await expect(status(page)).toHaveText(characterHintCopy[language].current);
  await assertSemantic();await assertNoReadingOrSceneChange(fixture,fresh);
  Object.assign(observation,{resumeRestoresWorkWithoutModalOrCredit:true,freshOpenAfterWorkResumeRequired:true,
    inSessionCharacterWorkRestored:language==='ru',coldPausedCharacterWorkRestored:language==='en'});
  return fresh;
}


for(const [language,width] of [['ru',390],['en',320]])test('actual App '+language+' character journey requires current modal acknowledgement and preserves canonical context',async({},testInfo)=>{
  const fixture=await open(testInfo,{language,width}),{page,result}=fixture;result.scenario='character-journey-'+language;result.observations.characterStep={touches:[],targets:[],scrolls:[]};const input=await globeGuidanceInputs(page,result.observations.characterStep);
  try{
    let before=await reachCharacter(fixture,input);const prefix=['country','writer','work'];const raw=fixture.memory.get(PROGRESS),writes=fixture.progressWrites().length;
    await expect(status(page)).toHaveText(characterHintCopy[language].current);
    result.observations.characterStep.initialCurrentHint=await status(page).textContent();
    await expect(acknowledge(page)).toHaveText(language==='ru'?'Подтвердить шаг':'Acknowledge step');await input.expose(acknowledge(page),'Current modal acknowledgement');
    await characterCapture(fixture,testInfo,'character-current-'+language+'.png','Actual native modal for a synthetic published character; separate acknowledgement remains inside the modal.');
    const callsBeforeClose=await page.evaluate(()=>window.__d206PublicationCalls);
    await input.tap(characterDialog(page).getByRole('button',{name:language==='ru'?'Закрыть':'Close',exact:true}),'Close character without credit');await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);await characterPrefix(fixture,prefix);expect(fixture.memory.get(PROGRESS)).toBe(raw);expect(fixture.progressWrites()).toHaveLength(writes);await assertNoReadingOrSceneChange(fixture,before);
    await expect(status(page)).toHaveAttribute('data-booky-journey-status','ready');
    await expect(status(page)).toHaveText(characterHintCopy[language].closed);
    await expect(page.locator('[data-booky-journey-open]')).toBeEnabled();
    expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual(callsBeforeClose);
    await input.expose(status(page),'Current ready-to-open hint after character Close');
    await characterCapture(fixture,testInfo,'character-closed-'+language+'.png','Current ready-to-open hint after trusted Close; the modal acknowledgement is absent. Static framing does not prove unchanged progress or request counts.');
    expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual(callsBeforeClose);
    expect(fixture.memory.get(PROGRESS)).toBe(raw);expect(fixture.progressWrites()).toHaveLength(writes);
    result.observations.characterStep.closedHint={text:await status(page).textContent(),publicationCalls: callsBeforeClose.length,openEnabled:true};
    await input.tap(page.locator('[data-booky-journey-open]'),'Explicit fresh character Open after Close');await expect(characterDialog(page)).toBeVisible();await expect(page.locator('[data-dossier-character-view]')).toHaveAttribute('data-dossier-character-view','character-c');await characterPrefix(fixture,prefix);expect(fixture.memory.get(PROGRESS)).toBe(raw);
    await expect(status(page)).toHaveText(characterHintCopy[language].current);
    expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual(callsBeforeClose);
    result.observations.characterStep.reopenedCurrentHint=await status(page).textContent();
    await assertNoReadingOrSceneChange(fixture,before);
    before=await restoreCharacterWorkByUser(fixture,input,language,{prefix:[...prefix],raw,writes});
    await input.tap(acknowledge(page),'Acknowledge exact current first character');prefix.push('character');await characterPrefix(fixture,prefix);
    {
      await readyJourneyNode(page,'character_second',input);await expect(characterDialog(page)).toBeVisible();await expect(page.locator('[data-dossier-character-view]')).toHaveAttribute('data-dossier-character-view','character-b');await expect(next(page)).toHaveCount(0);await expect(status(page)).toHaveText(characterHintCopy[language].current);await assertNoReadingOrSceneChange(fixture,before);await input.expose(acknowledge(page),'Second current modal acknowledgement');
      if(language==='ru')await characterCapture(fixture,testInfo,'character-consecutive-ru.png','Actual second synthetic character modal after acknowledging only the first; separate second acknowledgement is still required.');
      await input.tap(acknowledge(page),'Acknowledge exact second character');prefix.push('character_second');await characterPrefix(fixture,prefix);
    }
    await readyJourneyNode(page,'checkpoint',input);await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);await assertNoReadingOrSceneChange(fixture,before);await input.tap(next(page),'Explicit final checkpoint acknowledgement');prefix.push('checkpoint');await expect(status(page)).toHaveAttribute('data-booky-journey-status','complete');await characterPrefix(fixture,prefix);
    const record=savedRecord(fixture),fingerprints=record.nodes.filter(item=>item.kind==='character');expect(fingerprints).toHaveLength(2);for(const item of fingerprints){expect(Object.keys(item).sort()).toEqual(['character','entity','id','kind','screen']);expect(Object.keys(item.character).sort()).toEqual(['id','semanticChecksum','version']);expect(item.character.semanticChecksum).toMatch(/^[a-f0-9]{64}$/u);}expect(JSON.stringify(record)).not.toMatch(/cacheKey|validUntil|token|receipt|Учебный персонаж|Synthetic character/u);
    await input.expose(status(page),'Completed journey status');await characterCapture(fixture,testInfo,'character-complete-'+language+'.png','Completed synthetic journey after explicit modal and final checkpoint acknowledgements; no literary approval is represented.');
    Object.assign(result,{syntheticPublicationCapability:true,realPublicationServiceClaimed:false,nativeDeviceClaimed:false,consecutiveCharactersExercised:true,characterJourneyPassed:true});Object.assign(result.observations.characterStep,{routeAdmittedBeforeDossier:true,characterReadyHintTracksModal:true,hintPresentationAddsNoPublicationRequest:true,closeAndReopenNoCredit:true,explicitCurrentModalCredit:true,staticCharacterFingerprintOnly:true,canonicalSceneAndReadingRetained:true,checks:[{name:'country-first route admission does not require a future open dossier',pass:true},{name:'ready character hint follows committed modal, Close and fresh Open without new publication request or credit',pass:true},{name:'one explicit Resume restores only the exact current character work without modal or semantic credit',pass:true},{name:'a fresh explicit Open after work restoration is required before character acknowledgement',pass:true},{name:language==='ru'?'in-session character work recovery preserves the saved semantic step':'cold paused character restore performs no navigation before explicit Resume',pass:true},{name:'Close and fresh Open give no character credit',pass:true},{name:'only explicit current modal acknowledgement advances character progress',pass:true},{name:'character progress stores static identity without temporary receipt',pass:true},{name:'canonical globe and reading storage remain unchanged during character actions',pass:true}],savedRecord:record});fixture.verify();
  }finally{await input.close();await fixture.close();}
});

test('actual App absent publication capability denies character routes without opening or progress',async({},testInfo)=>{
  const fixture=await open(testInfo,{language:'en',width:320,contentMode:'capability-absent'}),{page,result}=fixture;result.scenario='character-publication-absent';result.observations.characterStep={touches:[],targets:[],scrolls:[]};const input=await globeGuidanceInputs(page,result.observations.characterStep);
  try{const before=await actual(page);await openJourney(fixture,input);await expect(status(page)).toHaveAttribute('data-booky-journey-status','unavailable');await expect(routeFor(page,PRIMARY_JOURNEY)).toHaveCount(0);await expect(page.locator('[data-booky-journey-open]')).toHaveCount(0);await expect(characterDialog(page)).toHaveCount(0);await expect(acknowledge(page)).toHaveCount(0);expect(fixture.progressWrites()).toEqual([]);expect(fixture.memory.has(PROGRESS)).toBe(false);expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual([]);retained(await actual(page),before);await input.expose(status(page),'Unavailable journey status');await characterCapture(fixture,testInfo,'character-capability-absent-en.png','Actual App denies the synthetic character route when its test-only publication capability is absent; no dossier request or progress write occurs.');await fixture.coldReload('approved');await page.evaluate(()=>window.__d206LeaseMs=15_000);const publishedBefore=await reachCharacter(fixture,input),prefix=['country','writer','work'];const raw=fixture.memory.get(PROGRESS),writes=fixture.progressWrites().length;await page.evaluate(()=>window.__d206PublicationMode='unavailable');await expect(characterDialog(page)).toHaveCount(0,{timeout:20000});await expect(acknowledge(page)).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>window.__d206PublicationCalls.some(call=>call.delivery==='unavailable'))).toBe(true);const callsAfterFailedRenewal=await page.evaluate(()=>window.__d206PublicationCalls);await characterPrefix(fixture,prefix);expect(fixture.memory.get(PROGRESS)).toBe(raw);expect(fixture.progressWrites()).toHaveLength(writes);await assertNoReadingOrSceneChange(fixture,publishedBefore);await guidanceSettle(page);await expect(characterDialog(page)).toHaveCount(0);result.observations.characterStep.controlledShortLeaseMs=15000;
    await expect(status(page)).toHaveAttribute('data-booky-journey-status','ready');
    await expect(node(page)).toHaveAttribute('data-booky-journey-node','character');
    await expect(status(page)).toHaveText(characterHintCopy.en.unavailable);
    await expect(page.locator('[data-booky-journey-open]')).toBeDisabled();
    await input.expose(status(page),'Current unavailable character hint after failed renewal');
    await characterCapture(fixture,testInfo,'character-unavailable-en.png','Current unavailable-card hint after the real lease-renewal timer receives controlled null delivery. Static image does not prove lease or progress behavior.');
    expect(await page.evaluate(()=>window.__d206PublicationCalls)).toEqual(callsAfterFailedRenewal);
    expect(fixture.memory.get(PROGRESS)).toBe(raw);expect(fixture.progressWrites()).toHaveLength(writes);
    Object.assign(result.observations.characterStep,{characterUnavailableHintCurrent:true,hintPresentationAddsNoPublicationRequest:true,unavailableHint:{text:await status(page).textContent(),publicationCalls:callsAfterFailedRenewal.length,openDisabled:true}});result.observations.characterStep.realRenewalTimer=true;result.observations.characterStep.failedRenewalRevokesWithoutCredit=true;Object.assign(result,{syntheticPublicationCapability:false,realPublicationServiceClaimed:false,nativeDeviceClaimed:false,consecutiveCharactersExercised:false,characterCapabilityDenied:true});Object.assign(result.observations.characterStep,{checks:[{name:'absent publication capability exposes no character route or action',pass:true},{name:'unavailable route produces no publication request or progress write',pass:true},{name:'canonical globe remains retained',pass:true},{name:'real short-lease renewal failure revokes current modal without credit or replay',pass:true},{name:'failed renewal shows current unavailable hint and disabled Open without extra publication request or credit',pass:true}]});fixture.verify();}finally{await input.close();await fixture.close();}
});
