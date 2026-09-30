import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const producerPath=fileURLToPath(import.meta.url),base=path.dirname(producerPath);
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out=path.resolve(process.argv[2]||path.join(base,'actual-a1'));
const currentManifestPath=process.argv[3]||process.env.BOOKY_JOURNEY_FACT_SOURCE_MANIFEST;
assert(currentManifestPath,'Supply the current applied source manifest as argument 3');
const relativeOutput=path.relative(root,out);
assert(relativeOutput==='..'||relativeOutput.startsWith('..'+path.sep)||path.isAbsolute(relativeOutput),'Smoke output must stay outside the checkout');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),norm=value=>value.replaceAll('\\','/');
const ref=async file=>({path:norm(path.resolve(file)),sha256:sha(await fs.readFile(file))});
const currentSourceManifest=await ref(currentManifestPath),current=JSON.parse(await fs.readFile(currentManifestPath,'utf8'));
assert(Array.isArray(current.files)&&current.files.length===2101,'Current full2101-file source manifest is required');
const expected=new Map(current.files.map(file=>[file.path,file.sha256]));
const producerBefore=await ref(producerPath);
const priorPath=path.join(path.dirname(base),'s15-booky-journey-answer-preview-review/actual-a1/answer-smoke-result.json');
const priorRef=await ref(priorPath);
assert.equal(priorRef.sha256,'240f153708113d57ad35b0586f1b7efd8127690916f31919b82b284b7ea8dda6','Retained D225 result differs');
const prior=JSON.parse(await fs.readFile(priorPath,'utf8'));
assert(prior.pass&&prior.actualStaticCatalog&&prior.evaluatedWorkCount===1&&prior.evaluatedChoiceCount===2,'No retained actual supported tuple');
const selected=prior.selected;
const legacyPath=path.join(path.dirname(base),'s15-booky-journey-answer-preview-review/actual-a1/captures/booky-journey-authoring-ad-edae1-endent-canonical-selections/synthetic-journey-draft.json');
const legacyRef=await ref(legacyPath);
assert.equal(legacyRef.sha256,'7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5','Retained D225 no-fact download differs');
await fs.mkdir(out,{recursive:true});
const write=async(name,value)=>{const file=path.join(out,name);await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return ref(file);};
const entry=`
export {getBookyJourneyDraftCatalog} from './apps/admin/lib/booky-journey-catalog';
export {createBookyJourneyDraft,parseBookyJourneyDraft} from './apps/admin/lib/booky-journey-draft';
export {validateBookyJourneyDraftActivity,evaluateBookyJourneyDraftActivity} from './apps/admin/lib/booky-journey-activity-validation';
export {bookyJourneyEntityId,bookyJourneyDialogueContext,getBookyJourneyChecksum} from './src/host/bookyJourney';
export {parseBookyJourneyFact,getBookyJourneyFactChecksum} from './src/host/bookyJourneyFact';
export {createBookyDialogueRegistry,getBookyDialogueContentChecksum} from './src/host/bookyDialogueRegistry';
export {contentRecordHash} from './src/planet/contentExportHash';
export {countries,bookArchiveCountries} from './src/data/countries/index';
export {buildPublicBookArchive} from './src/data/bookArchive';
`;
const {build}=createRequire(path.join(root,'package.json'))('esbuild'),loaded=new Map();
const loaders={'.ts':'ts','.tsx':'tsx','.mts':'ts','.cts':'ts','.js':'js','.jsx':'jsx','.mjs':'js','.cjs':'js','.json':'json'};
const bundled=await build({absWorkingDir:root,stdin:{resolveDir:root,loader:'ts',contents:entry},bundle:true,
  platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent',plugins:[{name:'bind-source-bytes',setup(builder){
    builder.onLoad({filter:/.*/,namespace:'file'},async args=>{
      const relative=path.relative(root,args.path),loader=loaders[path.extname(args.path)];
      assert(relative&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'Bundled source escaped checkout');
      assert(loader,'Unsupported smoke source loader');
      const contents=await fs.readFile(args.path),record={path:norm(relative),sha256:sha(contents)};
      if(loaded.has(record.path))assert.equal(loaded.get(record.path).sha256,record.sha256,'Source changed during bundling');
      loaded.set(record.path,record);return {contents,loader,resolveDir:path.dirname(args.path)};
    });
  }}]});
const inputPaths=Object.keys(bundled.metafile.inputs).filter(input=>input!=='<stdin>')
  .map(input=>norm(path.relative(root,path.resolve(root,input)))).sort();
assert.deepEqual(inputPaths,[...loaded.keys()].sort(),'Every esbuild input must bind actual loaded bytes');
assert(!inputPaths.some(input=>/apps\/admin\/lib\/(?:auth\.ts|supabase\/)|apps\/admin\/app\/.*\/actions\.ts/u.test(input)),'Unexpected auth/action import');
const files=inputPaths.map(input=>loaded.get(input)),dependencyFiles=files.filter(file=>file.path.startsWith('node_modules/'));
assert(dependencyFiles.length>0&&dependencyFiles.every(file=>file.path.startsWith('node_modules/@noble/hashes/')),'Expected bounded noble hash dependencies');
for(const file of files)if(!file.path.startsWith('node_modules/'))assert.equal(expected.get(file.path),file.sha256,'Current source manifest mismatch: '+file.path);
const snapshot=async()=>({schemaVersion:1,files:await Promise.all(files.map(async file=>({path:file.path,
  sha256:sha(await fs.readFile(path.join(root,file.path)))})))});
const before=await snapshot();assert.deepEqual(before.files,files,'Source changed after esbuild load');
const sourceManifest=await write('fact-smoke-source-manifest.json',{schemaVersion:1,files,stdinSha256:sha(Buffer.from(entry)),
  bundleSha256:sha(bundled.outputFiles[0].contents),currentSourceManifest});
const sourceBefore=await write('fact-smoke-source-before.json',before);
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
assert.equal(typeof api.evaluateBookyJourneyDraftActivity,'function','Applied D225 evaluator is required');
const catalog=api.getBookyJourneyDraftCatalog(),publicBooks=api.buildPublicBookArchive(api.bookArchiveCountries);
const writers=catalog.countries.flatMap(country=>country.writers.map(writer=>({country,writer})));
const canonical={countries:catalog.countries.length,writers:writers.length,
  works:catalog.countries.reduce((count,country)=>count+country.writers.reduce((n,writer)=>n+writer.works.length,0),0)};
const normalize=(value,locale)=>value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase(locale);
const usable=writer=>['ru','en'].every(locale=>typeof writer.label[locale]==='string'&&writer.label[locale].length>0
  &&writer.label[locale].length<=200&&writer.label[locale].trim()===writer.label[locale]
  &&!/[\u0000-\u001f\u007f]/u.test(writer.label[locale]));
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\s\u0000-\u001f\u007f]/u.test(value);
const publicWriter=author=>{const matches=api.countries.filter(country=>country.id===author.countryId);
  return matches.length===1&&matches[0].writers.filter(writer=>writer.id===author.writerId).length===1;};
function chooseOnePair(){
  const owner=writers.filter(item=>item.country.id===selected.countryId&&item.writer.id===selected.writerId);
  if(owner.length!==1||owner[0].writer.works.filter(work=>work.id===selected.workId).length!==1)return {reason:'selected-route-no-longer-in-dto'};
  const matches=publicBooks.filter(book=>book.countryId===selected.countryId&&book.writerId===selected.writerId&&book.id===selected.workId);
  if(matches.length!==1||!['reviewed','verified'].includes(matches[0].editorial?.status))return {reason:'selected-reviewed-work-no-longer-unique'};
  const book=matches[0];let author={countryId:book.countryId,writerId:book.writerId};
  // Exact current credit. No routing-owner fallback when authorship is present.
  if(book.authorship!==undefined){
    const authorship=book.authorship;
    if(!authorship||authorship.kind!=='single'||!Array.isArray(authorship.authors)||authorship.authors.length!==1)return {reason:'selected-authorship-not-single'};
    const credit=authorship.authors[0];
    if(!credit||!validId(credit.countryId)||!validId(credit.writerId)||credit.attribution!==undefined&&credit.attribution!=='credited')return {reason:'selected-credit-not-exact'};
    author={countryId:credit.countryId,writerId:credit.writerId};
  }
  if(!publicWriter(author))return {reason:'selected-credited-author-not-public'};
  const authorViews=writers.filter(item=>item.country.id===author.countryId&&item.writer.id===author.writerId);
  if(authorViews.length!==1||!usable(authorViews[0].writer))return {reason:'selected-author-missing-bilingual-label'};
  const first=authorViews[0],other=writers.find(item=>(item.country.id!==first.country.id||item.writer.id!==first.writer.id)
    &&usable(item.writer)&&['ru','en'].every(locale=>normalize(item.writer.label[locale],locale)!==normalize(first.writer.label[locale],locale)));
  return other?{first,other}:{reason:'no-distinct-bilingual-canonical-choice'};
}
const checks={retainedNoFactDownloadAuthenticated:true,currentNoFactConstruction:false,factParserRoundTrip:false,factContextsAndBilingualBindings:false,
  currentWorkAnchor:false,independentSyntheticCitations:false,registryDraftAdmissions:false,unapprovedDraftOnly:false,
  comboParserRoundTrip:false,comboActivityValidation:false,wrongVerdict:false,rightVerdict:false,exactReplyBinding:false};
function assertDraftOnly(draft){
  for(const key of ['journeyApprovals','dialogueApprovals','currentVersions','availability'])assert.deepEqual(draft[key],[]);
  for(const key of ['releaseReady','humanReviewed','childApproved','narrationApproved'])assert.equal(draft[key],false);
  for(const record of draft.dialogues){assert.equal(record.review.status,'draft');assert.equal(record.review.reviewer,null);
    assert.equal(record.review.reviewedAt,null);assert.equal(record.payload.narration,null);assert.deepEqual(record.payload.prohibitedTags,[]);}
}
// The original download is retained evidence. Its exact compatibility against
// the new core belongs to the unchanged browser case, not a second old bundle.
const pair=chooseOnePair();
let evaluatedWorkCount=0,evaluatedChoiceCount=0,ineligibleSelectedWorkCount=0,rejectedSelectedWorkCount=0,reason=null;
let noFactDraftNodeCount=0,noFactDraftDialogueCount=0,factDraftNodeCount=0,factDraftDialogueCount=0;
let registryDraftAdmissionCount=0,comboDraftNodeCount=0,comboDraftDialogueCount=0;
if(pair.reason){ineligibleSelectedWorkCount=1;reason=pair.reason;}
else{
  const copy=Object.fromEntries(['ru','en'].map(locale=>[locale,{title:locale==='ru'?'Проверка факта':'Fact check',
    description:locale==='ru'?'Технический черновик проверки, не опубликован.':'Unpublished technical validation draft.',
    nodes:Object.fromEntries(['country','writer','work','checkpoint'].map(kind=>[kind,{title:locale==='ru'?'Шаг проверки':'Validation step',
      body:locale==='ru'?'Откройте выбранный раздел.':'Open the selected section.'}]))}]));
  // Reserved example URLs and explicit dates are synthetic technical metadata.
  // They do not support a verified factual claim and are never fetched.
  const fact={copy:{
    ru:{title:'Технический текст проверки',body:'Это непроверенный текст для проверки привязки черновика.\nВторая строка сохранена без изменений.',
      sources:[{id:'synthetic-ru',url:'https://example.org/technical-fact/ru',accessedAt:'2026-09-28T10:00:00.000Z'}]},
    en:{title:'Technical validation copy',body:'This is unverified copy for checking draft bindings.\nThe second line is preserved unchanged.',
      sources:[{id:'synthetic-en',url:'https://example.org/technical-fact/en',accessedAt:'2026-09-29T11:00:00.000Z'}]},
  }};
  const input={id:'catalog-fact-smoke',version:1,...selected,ageRange:{min:18,max:120},readingLevel:'plain',estimatedDurationMinutes:5,copy,fact};
  const compiled=api.createBookyJourneyDraft(input,catalog);
  if(!compiled.ok){rejectedSelectedWorkCount=1;reason='one-work-fact-draft-rejected';}
  else{
    const draft=compiled.draft,serialized=JSON.stringify(draft),reopened=api.parseBookyJourneyDraft(serialized,catalog);
    assert.equal(draft.definitions.length,2);assert.equal(draft.dialogues.length,10);
    factDraftNodeCount=5;factDraftDialogueCount=10;
    assert(reopened.ok,'Full fact draft parser rejected current source');assert.deepEqual(reopened.input,input);
    assert.deepEqual(reopened.draft,draft);assert.equal(api.contentRecordHash(reopened.draft),api.contentRecordHash(draft));
    checks.factParserRoundTrip=true;
    const {fact:omittedFact,...noFactInput}=input;
    const noFact=api.createBookyJourneyDraft(noFactInput,catalog);assert(noFact.ok,'Current no-fact construction rejected');
    assertDraftOnly(noFact.draft);assert.equal(noFact.draft.dialogues.length,8);
    assert(!Object.hasOwn(noFact.draft.authoringSource.input,'fact'));
    assert(!Object.hasOwn(noFact.draft.authoringSource.input,'activity'));
    assert.deepEqual(noFact.draft.authoringSource.selection,draft.authoringSource.selection);
    for(const definition of noFact.draft.definitions){
      assert.deepEqual(definition.nodes.map(node=>node.kind),['country','writer','work','checkpoint']);
      assert(definition.nodes.every(node=>!Object.hasOwn(node,'fact')&&!Object.hasOwn(node,'activity')));
    }
    const noFactParsed=api.parseBookyJourneyDraft(JSON.stringify(noFact.draft),catalog);
    assert(noFactParsed.ok);assert.deepEqual(noFactParsed.draft,noFact.draft);
    noFactDraftNodeCount=4;noFactDraftDialogueCount=8;checks.currentNoFactConstruction=true;
    const bindings=['ru','en'].map(locale=>{const record=draft.dialogues.find(item=>item.payload.intent==='sourced-fact'&&item.payload.locale===locale);
      assert(record,'Missing fact record');assert.deepEqual(record.payload.factualSources,fact.copy[locale].sources);
      assert.deepEqual(record.payload.copy,{title:fact.copy[locale].title,body:fact.copy[locale].body,caption:fact.copy[locale].title,reduced:fact.copy[locale].title});
      assert.equal(record.payload.claimKind,'factual');assert.equal(record.payload.provenance.kind,'editorial');
      assert.equal(record.payload.provenance.sourceRef,`/input/fact/copy/${locale}`);
      assert.equal(record.payload.provenance.sourceSha256,draft.authoringSourceChecksum);
      const contentChecksum=api.getBookyDialogueContentChecksum(record.payload);assert(contentChecksum&&contentChecksum!=='0'.repeat(64));
      assert.equal(record.review.contentChecksum,contentChecksum);
      return {locale,id:record.payload.id,version:record.payload.version,contentChecksum};});
    assert.notEqual(bindings[0].contentChecksum,bindings[1].contentChecksum);
    const anchor={kind:'work',...selected};
    for(const definition of draft.definitions){
      assert.deepEqual(definition.nodes.map(node=>node.kind),['country','writer','work','sourced-fact','checkpoint']);
      const node=definition.nodes[3],record=draft.dialogues.find(item=>item.payload.locale===definition.locale&&item.payload.id===node.dialogue.id);
      assert.equal(node.id,'sourced-fact');assert.equal(node.screen,'collection');assert.deepEqual(node.entity,anchor);
      assert.deepEqual(node.entity,definition.nodes[2].entity);assert.deepEqual(node.fact.dialogues,bindings);
      assert.deepEqual(api.parseBookyJourneyFact(node.fact),node.fact);assert(api.getBookyJourneyFactChecksum(node.fact,node.entity,node.screen));
      assert.equal(record.payload.context,api.bookyJourneyDialogueContext(definition.id,node));
      assert.equal(node.dialogue.contentChecksum,api.getBookyDialogueContentChecksum(record.payload));
      assert.equal(api.getBookyJourneyChecksum(definition),draft.definitionsChecksums.find(item=>item.locale===definition.locale).checksum);
    }
    checks.factContextsAndBilingualBindings=true;checks.currentWorkAnchor=true;checks.independentSyntheticCitations=true;
    const canonicalEntityIds=[...new Set(draft.definitions[0].nodes.flatMap(node=>node.entity?[api.bookyJourneyEntityId(node.entity)]:[]))];
    const registry=api.createBookyDialogueRegistry(draft.dialogues,{canonicalEntityIds,approvedReviews:[]});
    assert.equal(registry.size,10);assert.deepEqual(registry.rejections,[]);registryDraftAdmissionCount=registry.size;
    for(const record of draft.dialogues)assert.equal(registry.resolve({id:record.payload.id,locale:record.payload.locale,audience:'adult',age:30,
      readingLevel:'plain',intent:record.payload.intent,screen:record.payload.screens[0],context:record.payload.context,
      entityIds:record.payload.entityIds,now:'2026-09-30T12:00:00.000Z'}),null,'Draft citation metadata must not grant review');
    checks.registryDraftAdmissions=true;assertDraftOnly(draft);
    const activity={type:'match-work-author',choices:[pair.first,pair.other].map(item=>({countryId:item.country.id,writerId:item.writer.id})),
      copy:{ru:{title:'Выберите автора',body:'Сопоставьте выбранную книгу и автора.'},en:{title:'Choose the author',body:'Match the selected work and its author.'}}};
    const combo=api.createBookyJourneyDraft({...input,activity},catalog);assert(combo.ok,'Fact/activity combination rejected');
    assertDraftOnly(combo.draft);checks.unapprovedDraftOnly=true;
    comboDraftNodeCount=6;comboDraftDialogueCount=12;assert.equal(combo.draft.dialogues.length,12);
    for(const definition of combo.draft.definitions)assert.deepEqual(definition.nodes.map(node=>node.kind),['country','writer','work','sourced-fact','activity','checkpoint']);
    const comboSerialized=JSON.stringify(combo.draft),comboChecksum=api.contentRecordHash(combo.draft);
    const comboParsed=api.parseBookyJourneyDraft(comboSerialized,catalog);assert(comboParsed.ok,'Combined full draft parser rejected');
    assert.deepEqual(comboParsed.draft,combo.draft);assert.equal(api.contentRecordHash(comboParsed.draft),comboChecksum);checks.comboParserRoundTrip=true;
    const publicData={publicCountries:api.countries,publicBooks};
    const validation=api.validateBookyJourneyDraftActivity(comboSerialized,catalog,publicData);
    assert.deepEqual(validation,{ok:true,draftChecksum:comboChecksum});checks.comboActivityValidation=true;
    const wrong=api.evaluateBookyJourneyDraftActivity(comboSerialized,'choice-2',catalog,publicData);
    const right=api.evaluateBookyJourneyDraftActivity(comboSerialized,'choice-1',catalog,publicData);
    evaluatedChoiceCount=2;
    if(!wrong.ok||!right.ok){rejectedSelectedWorkCount=1;reason='one-pair-current-answer-check-rejected';}
    else{
      assert.deepEqual(wrong,{ok:true,draftChecksum:comboChecksum,choiceId:'choice-2',correct:false});
      assert.deepEqual(right,{ok:true,draftChecksum:comboChecksum,choiceId:'choice-1',correct:true});
      assert(Object.isFrozen(wrong)&&Object.isFrozen(right),'Replies must be immutable');
      checks.wrongVerdict=true;checks.rightVerdict=true;checks.exactReplyBinding=true;evaluatedWorkCount=1;
    }
  }
}
const after=await snapshot(),sourceAfter=await write('fact-smoke-source-after.json',after);
const producer=await ref(producerPath),currentAfter=await ref(currentManifestPath),priorAfter=await ref(priorPath),legacyAfter=await ref(legacyPath);
const sourceInputsUnchanged=JSON.stringify(before)===JSON.stringify(after)&&producer.sha256===producerBefore.sha256
  &&currentAfter.sha256===currentSourceManifest.sha256&&priorAfter.sha256===priorRef.sha256&&legacyAfter.sha256===legacyRef.sha256;
const pass=evaluatedWorkCount===1&&evaluatedChoiceCount===2&&Object.values(checks).every(Boolean)&&sourceInputsUnchanged;
const result={schemaVersion:1,pass,actualStaticCatalog:true,canonical,selected,evaluatedWorkCount,evaluatedChoiceCount,
  noFactDraftNodeCount,noFactDraftDialogueCount,factDraftNodeCount,factDraftDialogueCount,registryDraftAdmissionCount,comboDraftNodeCount,comboDraftDialogueCount,
  ineligibleSelectedWorkCount,rejectedSelectedWorkCount,reason,checks,fullCatalogValidationRepeated:false,
  retainedD225AnswerSmoke:priorRef,retainedD225NoFactDownload:legacyRef,legacyByteCompatibilityEvidenceOwner:'unchanged-browser-case',
  currentSourceManifest,sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged,dependencyInputCount:dependencyFiles.length,producer,
  syntheticCitationMetadata:true,factualClaimsVerified:false,sourcesFetched:false,
  authenticatedAdminSession:false,networkOrDatabaseRequests:false,exportedToProduction:false,humanReviewed:false,stageAccepted:false,releaseReady:false};
const resultRef=await write('fact-smoke-result.json',result);console.log(JSON.stringify({...result,resultRef}));
if(!pass)process.exitCode=1;
