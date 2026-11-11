const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const repo=process.env.CATALOG_PREFLIGHT_REPO||path.resolve(__dirname,'../../../..'),native=createRequire(path.join(repo,'package.json'));
const {unzipSync}=native('fflate'),{createClient}=native('@supabase/supabase-js'),{attachCatalogFreshnessBoundary}=require('./catalog-review-freshness-boundary.cjs');
const output=process.env.CATALOG_PREFLIGHT_OUTPUT_ROOT||fs.mkdtempSync(path.join(path.resolve(repo,'../work'),'catalog-preflight-maintained-'));
fs.mkdirSync(output,{recursive:true});const mode=process.env.CATALOG_PREFLIGHT_MODE||'current';assert.ok(['before','current'].includes(mode));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),cache=new Map(),sources=new Map();
const specs={library:{archive:'next-catalog-review-full-seed-before.zip',hash:'f45180d64f50bde36a74189641958cfc7e2aec6d899ee09cb08321572b9fd2c4'},
  country:{archive:'next-catalog-country-review-full-seed-before.zip',hash:'2c7588bdc02a5cec9c1e8c1088a1b2b50386d2882df209b4cd0436fca438871a'}};
function captured(kind){
  if(cache.has(kind))return cache.get(kind);const spec=specs[kind],archive=fs.readFileSync(path.join(repo,'docs/admin-r3-evidence/2026-10-30-catalog-admission',spec.archive));assert.equal(sha(archive),spec.hash);
  const entries=unzipSync(archive),manifest=JSON.parse(Buffer.from(entries['manifest.json']));
  for(const entry of manifest.entries){assert.equal(entries[entry.path].length,entry.bytes);assert.equal(sha(entries[entry.path]),entry.sha256);}
  const root=path.join(output,'captured',kind);for(const[name,bytes]of Object.entries(entries)){const destination=path.join(root,name);assert.ok(destination.startsWith(root+path.sep));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});}
  Object.assign(process.env,{CATALOG_ADMISSION_REPO:repo,CATALOG_ADMISSION_SOURCE_ROOT:mode==='before'?path.join(root,'sources'):repo,CATALOG_ADMISSION_OUTPUT_ROOT:path.join(output,kind+'-runtime')});
  const value={runtime:require(path.join(root,'support/catalog-admission-runtime.cjs')),root,entries};cache.set(kind,value);return value;
}
function setup(kind,options={}){
  const original=captured(kind),view=original.runtime.setup(kind,options),metadata=attachCatalogFreshnessBoundary(view,kind,createClient,options.metadata||{});
  const api=view.load('apps/admin/lib/premium-translation-review.ts');
  const inspect=()=>api.loadPremiumTranslationReview({supabase:view.sdk,entityType:view.spec.type,entityId:options.entityId||view.identity(0),
    ...(kind==='country'?{sourceFields:structuredClone(view.rows[0].fields)}:{})});
  function collect(){const sourceRoot=mode==='before'?path.join(original.root,'sources'):repo;
    for(const source of view.graph.values()){assert.equal(sha(fs.readFileSync(path.join(sourceRoot,source.module))),source.sha256);sources.set(source.module,source);}}
  function render(value){const{createElement}=native('react'),{renderToStaticMarkup}=native('react-dom/server'),{load}=native('cheerio');
    const Panel=view.load('apps/admin/components/PremiumTranslationReviewPanel.tsx').default;
    const html=renderToStaticMarkup(createElement(Panel,{view:value,returnTo:kind==='library'?'library':'editorial-database'}));const $=load(html);
    return{html,approvalForms:$('form').filter((_,element)=>$(element).find('input[name="confirm_human_review"]').length>0).length,
      discardForms:$('form').filter((_,element)=>$(element).find('input[name="confirm_human_review"]').length===0).length,englishPreviews:$('[lang="en"]').length};}
  return{...view,metadata,inspect,render,collect,original};
}
async function paired(){const cases=[];for(const kind of Object.keys(specs)){
  const view=setup(kind),generated=await view.helper();assert.equal(generated.state,'translated');const initial=await view.inspect();
  const allBefore=structuredClone(view.rows[0]),draftBefore=structuredClone([...view.privateCandidates.values()][0]);
  if(kind==='library')view.rows[0].sources[0].license_name='Changed rights while all master rows and timestamps remain exact';else view.rows[0].row.fields.rights='Changed country override rights with identical timestamp';
  const after=await view.inspect(),allAfter=structuredClone(view.rows[0]),expected=structuredClone(allBefore);
  if(kind==='library')expected.sources[0].license_name=allAfter.sources[0].license_name;else expected.row.fields.rights=allAfter.row.fields.rights;
  const protectedBefore=structuredClone(allBefore),protectedAfter=structuredClone(allAfter);
  if(kind==='library'){delete protectedBefore.sources[0].license_name;delete protectedAfter.sources[0].license_name;}else{delete protectedBefore.row.fields.rights;delete protectedAfter.row.fields.rights;}
  view.collect();cases.push({kind,executionFailure:null,generated,initial,after,allBefore,allAfter,
    onlyRightsChanged:JSON.stringify(expected)===JSON.stringify(allAfter)&&JSON.stringify(allBefore)!==JSON.stringify(allAfter),protectedBefore,protectedAfter,draftBefore,
    draftAfter:structuredClone([...view.privateCandidates.values()][0]),providerCalls:view.providerCalls.length,canonicalWrites:view.writes.length,publicBuildRequests:view.builds.length,
    sources:[...view.graph.values()],sourcesUnchanged:true,installedSdkVersion:JSON.parse(fs.readFileSync(path.join(repo,'node_modules/@supabase/supabase-js/package.json'))).version,
    metadataRequests:view.metadata.calls,providerTrace:view.providerCalls,rawSdkWire:view.wire});
  }
  const report={mode,cases,adaptation:{version:2,kind:'Explicit maintained harness over unchanged archived runtime/SDK/private journal versus current algorithms',
    originalBeforeArchives:Object.fromEntries(Object.entries(specs).map(([kind,value])=>[kind,value.hash])),newTransport:'Only actual requests to new metadata RPC use extra installed-SDK return transport. No legacy SDK RPC is fabricated.',
    assertionContract:'Byte-identical parent frozen3aa0cc contract copied separately; this versioned loader is not claimed identical to original diagnostic runner.'}};
  fs.writeFileSync(path.join(output,'paired-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
module.exports={setup,paired,output,repo,sources,sha,mode};
if(require.main===module)paired().then(report=>console.log(JSON.stringify({output,mode,cases:report.cases.map(item=>({kind:item.kind,canPromote:item.after.canPromote,providerCalls:item.providerCalls,metadataRequests:item.metadataRequests.length}))})))
  .catch(error=>{console.error(error.stack||String(error));process.exitCode=2;});
