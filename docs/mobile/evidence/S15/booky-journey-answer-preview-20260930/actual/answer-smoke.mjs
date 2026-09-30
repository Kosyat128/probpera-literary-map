import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const producerPath=fileURLToPath(import.meta.url),base=path.dirname(producerPath);
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out=path.resolve(process.argv[2]||path.join(base,'actual-a1'));
const currentManifestPath=process.argv[3]||process.env.BOOKY_JOURNEY_ANSWER_SOURCE_MANIFEST;
assert(currentManifestPath,'Supply the current applied source manifest as argument 3');
const relativeOutput=path.relative(root,out);
assert(relativeOutput==='..'||relativeOutput.startsWith('..'+path.sep)||path.isAbsolute(relativeOutput),'Smoke output must stay outside the checkout');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),norm=value=>value.replaceAll('\\','/');
const ref=async file=>({path:norm(path.resolve(file)),sha256:sha(await fs.readFile(file))});
const currentSourceManifest=await ref(currentManifestPath),current=JSON.parse(await fs.readFile(currentManifestPath,'utf8'));
assert(Array.isArray(current.files)&&current.files.length>0,'Current source manifest is required');
const expected=new Map(current.files.map(file=>[file.path,file.sha256]));
const producerBefore=await ref(producerPath);
const priorPath=path.join(path.dirname(base),'s15-booky-journey-activity-review/actual-a2/catalog-smoke-result.json');
const priorRef=await ref(priorPath);
assert.equal(priorRef.sha256,'d9b8de2d27cb81e736aff3a9ca84ff736b50d97f93691ceb0a34fc5ac2638624','Retained D224 result differs');
const prior=JSON.parse(await fs.readFile(priorPath,'utf8'));
assert(prior.pass&&prior.actualStaticCatalog&&prior.supportedWorkCount>0&&prior.supportedExamples.length>0,'No retained actual supported example');
const selected=prior.supportedExamples[0];
await fs.mkdir(out,{recursive:true});
const write=async(name,value)=>{const file=path.join(out,name);await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return ref(file);};
const entry=`
export {getBookyJourneyDraftCatalog} from './apps/admin/lib/booky-journey-catalog';
export {createBookyJourneyDraft} from './apps/admin/lib/booky-journey-draft';
export {evaluateBookyJourneyDraftActivity} from './apps/admin/lib/booky-journey-activity-validation';
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
const sourceManifest=await write('answer-smoke-source-manifest.json',{schemaVersion:1,files,stdinSha256:sha(Buffer.from(entry)),
  bundleSha256:sha(bundled.outputFiles[0].contents),currentSourceManifest});
const sourceBefore=await write('answer-smoke-source-before.json',before);
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
const pair=chooseOnePair(),checks={wrongVerdict:false,rightVerdict:false,exactReplyBinding:false,unapprovedDraftOnly:false};
let evaluatedWorkCount=0,evaluatedChoiceCount=0,ineligibleSelectedWorkCount=0,rejectedSelectedWorkCount=0,reason=null;
if(pair.reason){ineligibleSelectedWorkCount=1;reason=pair.reason;}
else{
  const copy=Object.fromEntries(['ru','en'].map(locale=>[locale,{title:locale==='ru'?'Проверка ответа':'Answer check',
    description:locale==='ru'?'Технический черновик проверки, не опубликован.':'Unpublished technical validation draft.',
    nodes:Object.fromEntries(['country','writer','work','checkpoint'].map(kind=>[kind,{title:locale==='ru'?'Шаг проверки':'Validation step',
      body:locale==='ru'?'Откройте выбранный раздел.':'Open the selected section.'}]))}]));
  const input={id:'catalog-answer-smoke',version:1,...selected,ageRange:{min:18,max:120},readingLevel:'plain',estimatedDurationMinutes:5,copy,
    activity:{type:'match-work-author',choices:[pair.first,pair.other].map(item=>({countryId:item.country.id,writerId:item.writer.id})),
      copy:{ru:{title:'Выберите автора',body:'Сопоставьте выбранную книгу и автора.'},en:{title:'Choose the author',body:'Match the selected work and its author.'}}}};
  const compiled=api.createBookyJourneyDraft(input,catalog);
  if(!compiled.ok){rejectedSelectedWorkCount=1;reason='one-pair-pure-draft-rejected';}
  else{
    const draft=compiled.draft,draftChecksum=api.contentRecordHash(draft),serialized=JSON.stringify(draft);
    assert.equal(draft.definitions.length,2);assert.equal(draft.dialogues.length,10);
    for(const definition of draft.definitions)assert.deepEqual(definition.nodes.map(node=>node.kind),['country','writer','work','activity','checkpoint']);
    for(const key of ['journeyApprovals','dialogueApprovals','currentVersions','availability'])assert.deepEqual(draft[key],[]);
    for(const key of ['releaseReady','humanReviewed','childApproved','narrationApproved'])assert.equal(draft[key],false);
    checks.unapprovedDraftOnly=true;
    const publicData={publicCountries:api.countries,publicBooks};
    const wrong=api.evaluateBookyJourneyDraftActivity(serialized,'choice-2',catalog,publicData);
    const right=api.evaluateBookyJourneyDraftActivity(serialized,'choice-1',catalog,publicData);
    evaluatedChoiceCount=2;
    if(!wrong.ok||!right.ok){rejectedSelectedWorkCount=1;reason='one-pair-current-answer-check-rejected';}
    else{
      assert.deepEqual(wrong,{ok:true,draftChecksum,choiceId:'choice-2',correct:false});
      assert.deepEqual(right,{ok:true,draftChecksum,choiceId:'choice-1',correct:true});
      assert(Object.isFrozen(wrong)&&Object.isFrozen(right),'Replies must be immutable');
      checks.wrongVerdict=true;checks.rightVerdict=true;checks.exactReplyBinding=true;evaluatedWorkCount=1;
    }
  }
}
const after=await snapshot(),sourceAfter=await write('answer-smoke-source-after.json',after);
const producer=await ref(producerPath),currentAfter=await ref(currentManifestPath),priorAfter=await ref(priorPath);
const sourceInputsUnchanged=JSON.stringify(before)===JSON.stringify(after)&&producer.sha256===producerBefore.sha256
  &&currentAfter.sha256===currentSourceManifest.sha256&&priorAfter.sha256===priorRef.sha256;
const pass=evaluatedWorkCount===1&&evaluatedChoiceCount===2&&Object.values(checks).every(Boolean)&&sourceInputsUnchanged;
const result={schemaVersion:1,pass,actualStaticCatalog:true,canonical,selected,evaluatedWorkCount,evaluatedChoiceCount,
  ineligibleSelectedWorkCount,rejectedSelectedWorkCount,reason,checks,fullCatalogValidationRepeated:false,
  retainedD224Assessment:{source:priorRef,canonical:prior.canonical,supportedWorkCount:prior.supportedWorkCount,
    rejectedWorkCount:prior.rejectedWorkCount,ineligibleWorkCount:prior.ineligibleWorkCount,reasonCounts:prior.reasonCounts},
  currentSourceManifest,sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged,dependencyInputCount:dependencyFiles.length,producer,
  authenticatedAdminSession:false,networkOrDatabaseRequests:false,exportedToProduction:false,humanReviewed:false,stageAccepted:false,releaseReady:false};
const resultRef=await write('answer-smoke-result.json',result);console.log(JSON.stringify({...result,resultRef}));
if(!pass)process.exitCode=1;
