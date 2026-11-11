const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const runtime=require('./site-copy-admission-runtime.cjs');
const captured=JSON.parse(fs.readFileSync(path.join(__dirname,'site-copy-parameters-genuine-before.json'),'utf8'));
const checks=[],observations=[];
const check=(name,pass)=>{checks.push({name,pass:Boolean(pass)});assert.ok(pass,name);};
const countRecord=captured.records.find(row=>row.kind==='target');
const configure=(view,row)=>{const value=view.snapshot();value.settings.siteCopy.ru={[row.key]:row.source};delete value.settings.siteCopy.en[row.key];delete value.settings.premiumTranslation.siteCopyEn[row.key];view.setRow(value);};
const response=text=>async({value})=>{const body=JSON.parse(value.response);body.items=body.items.map(item=>({...item,text}));value.response=JSON.stringify(body);};
(async()=>{
 for(const row of captured.records.filter(row=>row.kind==='target')){
  const view=runtime.createSiteCopyAdmissionRuntime();view.setRow(row.canonicalBefore);view.setPrivateDraft(row.review.draft);
  const before=view.stateSnapshot(),draft=view.candidate(),review=await view.loadReview();
  check(row.name+' historical candidate remains visible with a specific parameter problem',review.status==='pending'&&!review.canPromote&&review.problem.includes('{count}'));
  await view.reviewAction(view.reviewForm(true));
  check(row.name+' human approval cannot publish or pay to repair an old incompatible draft',view.promotions.length===0&&view.requests.length===0&&view.builds.length===0&&JSON.stringify(view.snapshot())===JSON.stringify(before.canonical)&&JSON.stringify(view.candidate())===JSON.stringify(draft));
  observations.push({name:row.name,review,draft,wire:view.wire});
 }
 for(const row of captured.records.filter(row=>row.kind==='control')){
  const view=runtime.createSiteCopyAdmissionRuntime({onProvider:response(row.candidate)});configure(view,row);
  const before=view.stateSnapshot();await view.helper();
  check(row.name+' compatible result is privately retained before human approval',Boolean(view.candidate())&&view.requests.length===2&&view.promotions.length===0&&JSON.stringify(view.snapshot())===JSON.stringify(before.canonical));
  await view.reviewAction(view.reviewForm(true));
  check(row.name+' explicit human approval preserves the exact compatible text',view.promotions.length===1&&view.publicView().en[row.key]===row.candidate&&view.requests.length===2);
 }
 const invalid=runtime.createSiteCopyAdmissionRuntime({onProvider:response('Writer profile checked')});configure(invalid,countRecord);
 const before=invalid.stateSnapshot();await invalid.helper();const paid=invalid.requests.length;
 check('Invalid translator and repair cannot become a private candidate or public mutation',!invalid.candidate()&&paid===2&&invalid.requests.every(call=>call.pass!=='review')&&invalid.builds.length===0&&JSON.stringify(invalid.snapshot())===JSON.stringify(before.canonical));
 await invalid.helper();
 check('Ordinary same-source retry cannot pay again after a rejected parameter repair',invalid.requests.length===paid&&invalid.admission.operations.size===1);
 const repaired=runtime.createSiteCopyAdmissionRuntime({onProvider:async input=>response(input.number===1?'Writer profile checked':'The {count} writer profile is ready')(input)});configure(repaired,countRecord);
 await repaired.helper();
 check('A compatible repair follows the existing review path and bounded budget',JSON.stringify(repaired.requests.map(call=>call.pass))===JSON.stringify(['translation','repair','review'])&&repaired.candidate()?.payload.items[0].text==='The {count} writer profile is ready'&&repaired.promotions.length===0);
 const invalidSource=runtime.createSiteCopyAdmissionRuntime();configure(invalidSource,{...countRecord,source:'Проверенные карточки'});await invalidSource.helper();
 check('A known count key without its source parameter makes no new provider request',invalidSource.requests.length===0&&!invalidSource.candidate()&&invalidSource.builds.length===0);
 fs.writeFileSync(path.join(runtime.output,'parameters-report.json'),JSON.stringify({classification:'ACTUAL_HELPER_AND_HISTORICAL_DRAFT_PARAMETER_GUARDS_WITH_CONTROLLED_SDK_NOT_NATIVE_OR_BROWSER',checks,observations,sources:runtime.sourceBindings(),genuineBefore:captured.provenance},null,2)+'\n');
 console.log(JSON.stringify({checks:checks.length,passed:checks.filter(row=>row.pass).length,output:runtime.output}));
})().catch(error=>{fs.writeFileSync(path.join(runtime.output,'parameters-execution-failure.json'),JSON.stringify({error:error.stack,checks,observations},null,2));console.error(error.stack);process.exitCode=1;});
