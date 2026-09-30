import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const producerPath=fileURLToPath(import.meta.url),base=path.dirname(producerPath);
const root=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out=path.resolve(process.argv[2]||process.env.BOOKY_JOURNEY_CATALOG_SMOKE_OUTPUT||path.join(base,'actual-a1'));
const relativeOutput=path.relative(root,out);
assert(relativeOutput==='..'||relativeOutput.startsWith('..'+path.sep)||path.isAbsolute(relativeOutput),'Smoke output must stay outside the source checkout');
await fs.mkdir(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),norm=value=>value.replaceAll('\\','/');
const ref=async file=>({path:norm(file),sha256:sha(await fs.readFile(file))});
const producerBefore=await ref(producerPath);
const write=async(name,value)=>{const file=path.join(out,name);await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return ref(file);};

// Only static data and pure authoring/semantic owners. Auth and the server action
// are deliberately absent: this smoke cannot establish a real staff session.
const entry=`
export {getBookyJourneyDraftCatalog} from './apps/admin/lib/booky-journey-catalog';
export {createBookyJourneyDraft} from './apps/admin/lib/booky-journey-draft';
export {validateBookyJourneyDraftActivity} from './apps/admin/lib/booky-journey-activity-validation';
export {contentRecordHash} from './src/planet/contentExportHash';
export {countries,bookArchiveCountries} from './src/data/countries/index';
export {buildPublicBookArchive} from './src/data/bookArchive';
`;
const {build}=createRequire(path.join(root,'package.json'))('esbuild');
const loaded=new Map();
const loaders={'.ts':'ts','.tsx':'tsx','.mts':'ts','.cts':'ts','.js':'js','.jsx':'jsx','.mjs':'js','.cjs':'js','.json':'json'};
const bundled=await build({absWorkingDir:root,stdin:{resolveDir:root,loader:'ts',contents:entry},bundle:true,
  platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent',plugins:[{
    name:'bind-source-bytes',setup(builder){builder.onLoad({filter:/.*/,namespace:'file'},async args=>{
      const relative=path.relative(root,args.path),loader=loaders[path.extname(args.path)];
      assert(relative&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'Bundled source escaped the checkout');
      assert(loader,'Unsupported smoke source loader');
      const contents=await fs.readFile(args.path),record={path:norm(relative),sha256:sha(contents)};
      const previous=loaded.get(record.path);assert(!previous||previous.sha256===record.sha256,'Input changed during bundle loading');
      loaded.set(record.path,record);
      return {contents,loader,resolveDir:path.dirname(args.path)};
    });},
  }]});
const inputPaths=Object.keys(bundled.metafile.inputs).filter(input=>input!=='<stdin>').map(input=>
  norm(path.relative(root,path.resolve(root,input)))).sort();
assert(inputPaths.length>0,'No bundled source inputs');
assert.deepEqual(inputPaths,[...loaded.keys()].sort(),'Every esbuild input must bind its actual loaded bytes');
assert(!inputPaths.some(input=>/apps\/admin\/lib\/(?:auth\.ts|supabase\/)|apps\/admin\/app\/.*\/actions\.ts/u.test(input)),
  'Static smoke unexpectedly imported an auth or action owner');
const files=inputPaths.map(input=>loaded.get(input));
const readSnapshot=async()=>({schemaVersion:1,files:await Promise.all(files.map(async file=>({path:file.path,
  sha256:sha(await fs.readFile(path.join(root,file.path)))})))});
const before=await readSnapshot();
assert.deepEqual(before.files,files,'Source inputs changed between bundle loading and smoke execution');
const sourceManifest=await write('catalog-smoke-source-manifest.json',{schemaVersion:1,files,
  stdinSha256:sha(Buffer.from(entry)),bundleSha256:sha(bundled.outputFiles[0].contents)});
const sourceBefore=await write('catalog-smoke-source-before.json',before);
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
const catalog=api.getBookyJourneyDraftCatalog(),publicBooks=api.buildPublicBookArchive(api.bookArchiveCountries);
const publicData={publicCountries:api.countries,publicBooks};
const writers=catalog.countries.flatMap(country=>country.writers.map(writer=>({country,writer})));
const targets=catalog.countries.flatMap(country=>country.writers.flatMap(writer=>writer.works.map(work=>({country,writer,work}))));
assert(catalog.countries.length>0&&catalog.countries.length<=256,'Canonical authoring country bounds');
assert(writers.length>0&&writers.length<=50000&&targets.length>0&&targets.length<=50000,'Canonical authoring record bounds');
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\s\u0000-\u001f\u007f]/u.test(value);
const normalized=(value,locale)=>value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase(locale);
const usableLabels=writer=>['ru','en'].every(locale=>typeof writer.label[locale]==='string'&&writer.label[locale].length>0
  &&writer.label[locale].length<=200&&writer.label[locale].trim()===writer.label[locale]
  &&!/[\u0000-\u001f\u007f]/u.test(writer.label[locale])&&normalized(writer.label[locale],locale));
const distinct=(first,second)=>first.country.id!==second.country.id||first.writer.id!==second.writer.id;
const distinctLabels=(first,second)=>['ru','en'].every(locale=>normalized(first.writer.label[locale],locale)
  !==normalized(second.writer.label[locale],locale));
const writerIsPublic=ref=>{const matches=api.countries.filter(country=>country.id===ref.countryId);
  return matches.length===1&&matches[0].writers.filter(writer=>writer.id===ref.writerId).length===1;};
const routeIds=target=>({countryId:target.country.id,writerId:target.writer.id,workId:target.work.id});
const counts={supportedWorkCount:0,rejectedWorkCount:0,ineligibleWorkCount:0,candidateAttempts:0,
  pureDraftRejectedAttempts:0,semanticRejectedAttempts:0};
const reasonCounts={},supportedExamples=[],ineligibleExamples=[];
const reason=code=>{reasonCounts[code]=(reasonCounts[code]||0)+1;};
const ineligible=(target,code)=>{counts.ineligibleWorkCount+=1;reason(code);
  if(ineligibleExamples.length<8)ineligibleExamples.push({...routeIds(target),reason:code});};
const copy=Object.fromEntries(['ru','en'].map(locale=>[locale,{
  title:locale==='ru'?'Проверка задания':'Activity check',
  description:locale==='ru'?'Технический черновик проверки, не опубликован.':'Unpublished technical validation draft.',
  nodes:Object.fromEntries(['country','writer','work','checkpoint'].map(kind=>[kind,{
    title:locale==='ru'?'Шаг проверки':'Validation step',body:locale==='ru'?'Откройте выбранный раздел.':'Open the selected section.',
  }])),
}]));
const activityCopy={ru:{title:'Выберите автора',body:'Сопоставьте выбранную книгу и автора.'},
  en:{title:'Choose the author',body:'Match the selected work and its author.'}};

for(const [index,target] of targets.entries()){
  const matches=publicBooks.filter(book=>book.id===target.work.id&&book.countryId===target.country.id&&book.writerId===target.writer.id);
  if(matches.length!==1){ineligible(target,'public-work-tuple-not-unique');continue;}
  const book=matches[0];
  if(!['reviewed','verified'].includes(book.editorial?.status)){ineligible(target,'work-not-reviewed');continue;}
  if(!writerIsPublic({countryId:book.countryId,writerId:book.writerId})){ineligible(target,'routing-owner-not-public');continue;}
  let author={countryId:book.countryId,writerId:book.writerId};
  // Match the existing exact single-answer resolver. Routing ownership is used
  // only for its documented absent-authorship legacy fallback. Provided credit
  // never falls back to that routing owner or to a synthesized country ID.
  if(book.authorship!==undefined){
    const authorship=book.authorship;
    if(!authorship||authorship.kind!=='single'){ineligible(target,'unsupported-authorship-kind');continue;}
    if(!Array.isArray(authorship.authors)||authorship.authors.length!==1){ineligible(target,'single-author-credit-not-unique');continue;}
    const credit=authorship.authors[0];
    if(!credit||!validId(credit.countryId)||!validId(credit.writerId)
      ||credit.attribution!==undefined&&credit.attribution!=='credited'){ineligible(target,'single-author-credit-not-exact');continue;}
    author={countryId:credit.countryId,writerId:credit.writerId};
  }
  if(!writerIsPublic(author)){ineligible(target,'credited-author-not-public');continue;}
  const authored=writers.filter(item=>item.country.id===author.countryId&&item.writer.id===author.writerId);
  if(authored.length!==1){ineligible(target,'credited-author-not-in-authoring-dto');continue;}
  const first=authored[0];
  if(!usableLabels(first.writer)){ineligible(target,'credited-author-missing-bilingual-label');continue;}
  const alternatives=writers.filter(item=>distinct(first,item)&&usableLabels(item.writer)&&distinctLabels(first,item));
  if(!alternatives.length){ineligible(target,'no-distinct-bilingual-canonical-choice');continue;}
  let supported=false;
  for(const other of alternatives){
    counts.candidateAttempts+=1;
    const input={id:`catalog-smoke-${index+1}`,version:1,...routeIds(target),ageRange:{min:18,max:120},
      readingLevel:'plain',estimatedDurationMinutes:5,copy,activity:{type:'match-work-author',
        choices:[first,other].map(item=>({countryId:item.country.id,writerId:item.writer.id})),copy:activityCopy}};
    const compiled=api.createBookyJourneyDraft(input,catalog);
    if(!compiled.ok){counts.pureDraftRejectedAttempts+=1;reason('pure-draft-rejected');continue;}
    const draft=compiled.draft;
    assert.equal(draft.status,'draft');assert.equal(draft.definitions.length,2);assert.equal(draft.dialogues.length,10);
    for(const definition of draft.definitions)assert.deepEqual(definition.nodes.map(node=>node.kind),['country','writer','work','activity','checkpoint']);
    for(const key of ['journeyApprovals','dialogueApprovals','currentVersions','availability'])assert.deepEqual(draft[key],[]);
    for(const key of ['releaseReady','humanReviewed','childApproved','narrationApproved'])assert.equal(draft[key],false);
    const validated=api.validateBookyJourneyDraftActivity(JSON.stringify(draft),catalog,publicData);
    if(!validated.ok){counts.semanticRejectedAttempts+=1;reason('current-semantic-or-source-check-rejected');continue;}
    assert.deepEqual(Object.keys(validated).sort(),['draftChecksum','ok']);
    assert.equal(validated.draftChecksum,api.contentRecordHash(draft));
    counts.supportedWorkCount+=1;supported=true;
    if(supportedExamples.length<8)supportedExamples.push(routeIds(target));
    break;
  }
  if(!supported){counts.rejectedWorkCount+=1;reason('all-available-choice-pairs-rejected');
    if(ineligibleExamples.length<8)ineligibleExamples.push({...routeIds(target),reason:'all-available-choice-pairs-rejected'});}
}
assert.equal(counts.supportedWorkCount+counts.rejectedWorkCount+counts.ineligibleWorkCount,targets.length,'Every actual DTO work must have an honest outcome');
const after=await readSnapshot(),sourceAfter=await write('catalog-smoke-source-after.json',after);
const producerAfter=await ref(producerPath);
const sourceInputsUnchanged=JSON.stringify(before)===JSON.stringify(after)&&producerBefore.sha256===producerAfter.sha256;
const pass=counts.supportedWorkCount>=1&&sourceInputsUnchanged;
const result={schemaVersion:1,pass,actualStaticCatalog:true,canonical:{countries:catalog.countries.length,writers:writers.length,works:targets.length},
  ...counts,reasonCounts,supportedExamples,ineligibleExamples,sourceManifest,sourceBefore,sourceAfter,sourceInputsUnchanged,
  producer:producerAfter,unapprovedDraftOnly:true,authenticatedAdminSession:false,networkOrDatabaseRequests:false,
  exportedToProduction:false,humanReviewed:false,stageAccepted:false,releaseReady:false};
const resultRef=await write('catalog-smoke-result.json',result);
console.log(JSON.stringify({...result,resultRef}));
if(!pass)process.exitCode=1;
