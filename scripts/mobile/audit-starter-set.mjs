import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {parseCsv} from './csv.mjs';

const root=await fs.realpath(fileURLToPath(new URL('../../',import.meta.url)));
const destination=process.argv[2];
if(!destination) throw new Error('Usage: node scripts/mobile/audit-starter-set.mjs <new report.json>');
const output=path.resolve(root,destination);
if(!output.startsWith(root+path.sep)||path.extname(output)!=='.json') throw new Error('Report must remain inside the checkout');
await assert.rejects(fs.stat(output),{code:'ENOENT'});
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
async function evidence(relative) {
 const absolute=path.resolve(root,relative);
 if(!absolute.startsWith(root+path.sep)) throw new Error('Source outside checkout');
 const real=await fs.realpath(absolute);
 if(real!==absolute) throw new Error('Linked source is not audit evidence');
 const stat=await fs.stat(absolute);assert.ok(stat.isFile());
 const bytes=await fs.readFile(absolute);return {path:relative,bytes:bytes.length,sha256:sha(bytes)};
}
const tablePath='docs/mobile/requirements/v12/37_BASE_EDITION_STARTER_SET.csv';
assert.equal((await evidence(tablePath)).sha256,'575f40b97986cb4e64cb89243059a3b18c4cda8069f4f0e1c7d3565f6132b731');
const rows=parseCsv(await fs.readFile(path.join(root,tablePath),'utf8'));
assert.equal(rows.length,29);assert.equal(new Set(rows.map(r=>r.item_id)).size,rows.length);
assert.ok(rows.every(r=>r.required==='true'&&r.iap_sku_allowed==='false'));
const built=await build({stdin:{resolveDir:root,contents:`
 export * from './src/planet/baseEditionPolicy';
 export {INCLUDED_GLOBE_STANDS} from './src/planet/globeStands';
 export {GLOBE_BACKGROUNDS} from './src/planet/globeBackgrounds';
 export {GLOBE_EDITION_BY_ID,resolveGlobeEditionTexturePath} from './src/planet/editions';
 `,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',target:'es2020',metafile:true,logLevel:'silent'});
const runtime=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const policy=runtime.createBaseEditionPolicy(),snapshot=policy.getSnapshot();
assert.deepEqual(snapshot.starterItems.map(i=>({id:i.id,requirementId:i.requirementId,category:i.category})),
 rows.map(r=>({id:r.item_id,requirementId:r.requirement_id,category:r.category})));
assert.equal(snapshot.grantsEntitlement,false);assert.equal(snapshot.releaseReady,false);
const moduleInputs=Object.keys(built.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>path.relative(root,path.resolve(root,p)).replaceAll('\\','/'));
const sourceBindings={
 'background.base.site-starfield':['src/components/LiteraryGlobe.tsx'],
 'background.base.library':['src/planet/globeBackgrounds.ts','src/components/globeBackgroundGeometry.ts','src/components/globeLibraryGeometry.ts','src/components/globeLibraryBookGeometry.ts','src/components/globeCraftMaterials.ts','src/components/GlobeIncludedBackground.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts','src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts','src/host/PlanetStandControls.tsx'],
 'background.base.writer-study':['src/planet/writerStudySketch.ts','src/host/planetSceneInspection.ts','src/host/planetSceneInspectionBridge.ts','src/host/PlanetSceneInspectionControls.tsx','src/host/PlanetSceneInspectionControls.css','src/components/GlobeSceneInspectionAnchor.tsx','src/planet/globeBackgrounds.ts','src/components/globeBackgroundGeometry.ts','src/components/globeWriterStudyGeometry.ts','src/components/globeLibraryBookGeometry.ts','src/components/globeCraftMaterials.ts','src/components/GlobeIncludedBackground.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts','src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts','src/host/PlanetStandControls.tsx'],
 // The explicit whale derivative belongs to existing STARTER-019; only CSV
 // rows below create inventory items. Required count remains exactly 29.
 'canonical-globe':['src/components/LiteraryGlobe.tsx','src/components/GlobeCameraRig.tsx',
  'src/components/globeAntiqueGeometry.ts','src/components/globeWhaleStandGeometry.ts',
  'src/planet/globeStands.ts','src/components/globeStandGeometry.ts','src/components/globeCraftMaterials.ts',
  'src/components/GlobeIncludedStand.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts',
  'src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts',
  'src/host/PlanetStandControls.tsx'],
 'literary-archive':['src/planet/catalog.ts','src/App.tsx'],
 'search-favorites-offline':['src/search/globalSearchRuntime.ts','src/hooks/useReadingLibrary.ts','src/planet/ContentDownloads.ts'],
 'stand.base.museum':['src/planet/globeStands.ts','src/components/globeStandGeometry.ts','src/components/globeCraftMaterials.ts','src/components/GlobeIncludedStand.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts','src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts','src/host/PlanetStandControls.tsx'],
 'stand.base.wood':['src/planet/globeStands.ts','src/components/globeStandGeometry.ts','src/components/globeTurnedWoodAtlas.ts','src/components/globeCraftMaterials.ts','src/components/GlobeIncludedStand.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts','src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts','src/host/PlanetStandControls.tsx'],
 'stand.base.book-stack':['src/planet/globeStands.ts','src/components/globeStandGeometry.ts','src/components/globeCraftMaterials.ts','src/components/GlobeIncludedStand.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts','src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts','src/host/PlanetStandControls.tsx'],
};
// Additional owner requests have their own inventory, never a CSV requirement binding.
const portraitSources=['src/planet/baseEditionPolicy.ts','src/planet/globeStands.ts',
 'src/components/globeCeramicPortraitStandGeometry.ts','src/components/globeStandGeometry.ts',
 'src/components/GlobeIncludedStand.tsx','src/host/planetComposition.ts','src/host/planetCompositionPresentation.ts',
 'src/planet/globeComposition.ts','src/components/useGlobeCompositionScene.ts','src/components/useGlobeCompositionFrame.ts',
 'src/host/PlanetStandControls.tsx'];
const ownerSourceBindings={
 'stand.base.portrait-pushkin':portraitSources,
 'stand.base.portrait-hemingway':portraitSources,
 'stand.base.portrait-tolstoy':portraitSources,
};
for (const [id, source] of [
 ['background.base.library','src/components/globeLibraryGeometry.ts'],
 ['background.base.writer-study','src/components/globeWriterStudyGeometry.ts'],
]) {
 const descriptor=runtime.GLOBE_BACKGROUNDS.find(background=>background.id===id);
 assert.ok(descriptor, id);assert.equal(descriptor.source,source);
 assert.equal(descriptor.commercialAvailability,'included-in-base');
 assert.equal(descriptor.provenance,'authored-in-project');assert.equal(descriptor.supportedAccess,'adult');
 assert.deepEqual(descriptor.qualityTiers,['high','balanced','economy']);
 assert.equal(policy.classify(id).canonicalId,id);
 for(const flag of ['childReviewed','rightsReviewed','grantsEntitlement','releaseReady'])assert.equal(descriptor[flag],false);
}
assert.deepEqual(snapshot.ownerAdditions.map(item=>item.id).sort(),Object.keys(ownerSourceBindings).sort());
const sourcePaths=[...new Set([tablePath,'scripts/mobile/audit-starter-set.mjs','scripts/mobile/csv.mjs',...moduleInputs,
 ...Object.values(sourceBindings).flat(),...Object.values(ownerSourceBindings).flat()])].sort();
const sourceBefore=await Promise.all(sourcePaths.map(evidence));
const editions=[];
for(const id of snapshot.grandfatheredEditionIds) {
 const edition=runtime.GLOBE_EDITION_BY_ID[id];assert.ok(edition);
 const resources=[];
 for(const locale of ['ru','en']) for(const compact of [false,true]) {
  const texture=runtime.resolveGlobeEditionTexturePath(id,compact,locale);
  if(!texture) {resources.push({locale,compact,present:false,path:null});continue;}
  try {resources.push({locale,compact,present:true,...await evidence('public/'+texture)});}
  catch(error) {if(error.code!=='ENOENT')throw error;resources.push({locale,compact,present:false,path:'public/'+texture});}
 }
 editions.push({id,visitorAvailable:edition.visitorAvailable,includedInBase:true,
  bilingualRegistryLabelsPresent:['ru','en'].every(l=>typeof edition.fullLabel[l]==='string'&&edition.fullLabel[l].trim()),
  resources,releaseAcceptance:'not-established-by-this-audit'});
}
const items=[];
for(const row of rows) {
 const bound=snapshot.skinEditionBindings.find(b=>b.itemId===row.item_id),edition=bound&&editions.find(e=>e.id===bound.editionId);
 const sources=await Promise.all((sourceBindings[row.item_id]??[]).map(evidence));
 const hasSource=!!edition||sources.length>0;
 items.push({requirementId:row.requirement_id,id:row.item_id,category:row.category,required:true,iapSkuAllowed:false,
  implementation:edition?{status:'canonical-edition-bound',editionId:edition.id}:sources.length?{status:'source-present',sources}:{status:'no-audited-binding'},
  checks:{presence:hasSource?'partial':'open',assetChecksums:edition?edition.resources.every(r=>r.present)?'present':'missing':'unmeasured',
   ruEnCoverage:edition&&edition.bilingualRegistryLabelsPresent?'registry-labels-only':'unmeasured',
   rightsAcceptance:'open',platformAcceptance:'open',offlineAcceptance:'open',switchStressAcceptance:'open',visualApproval:'open',
   childAgeReview:row.category==='child'||/child|planetka|world\./u.test(row.item_id)?'open':'not-assessed'},
  acceptance:'OPEN',releaseReady:false});
}
const ownerAdditions=[];
for(const item of snapshot.ownerAdditions) {
 const descriptor=runtime.INCLUDED_GLOBE_STANDS.find(stand=>stand.id===item.id);
 assert.ok(descriptor);assert.equal(descriptor.sourceItemId,item.id);
 assert.equal(descriptor.provenance,'authored-in-project');assert.equal(descriptor.canonicalSource,null);
 assert.equal(descriptor.source,'src/components/globeCeramicPortraitStandGeometry.ts');
 assert.equal(descriptor.contentVersion,1);assert.equal(descriptor.supportedAccess,'adult');
 assert.equal(item.inclusionBasis,'explicit-owner-request');assert.equal(item.commercialAvailability,'included-in-base');
 assert.equal(item.iapSkuAllowed,false);assert.equal(Object.hasOwn(item,'requirementId'),false);
 assert.equal(policy.classify(item.id).canonicalId,item.id);
 for(const flag of ['iapSkuAllowed','childReviewed','rightsReviewed','artReviewed','grantsEntitlement','releaseReady']) assert.equal(descriptor[flag],false);
 const sources=await Promise.all(ownerSourceBindings[item.id].map(evidence));
 ownerAdditions.push({...item,required:false,sourceItemId:descriptor.sourceItemId,provenance:descriptor.provenance,
  canonicalSource:descriptor.canonicalSource,contentVersion:descriptor.contentVersion,supportedAccess:descriptor.supportedAccess,
  implementation:{status:'source-present',sources},
  checks:{presence:'partial',rightsAcceptance:'open',platformAcceptance:'open',offlineAcceptance:'open',
   switchStressAcceptance:'open',visualApproval:'open',childAgeReview:'not-assessed'},
  childReviewed:false,rightsReviewed:false,artReviewed:false,grantsEntitlement:false,acceptance:'OPEN',releaseReady:false});
}
assert.deepEqual(await Promise.all(sourcePaths.map(evidence)),sourceBefore,'Sources changed during audit');
const report={schemaVersion:1,kind:'literary-planet-starter-set-source-inventory',recordedAt:new Date().toISOString(),
 auditValid:true,status:'INCOMPLETE',requiredCount:items.length,acceptedCount:0,sourceBoundCount:items.filter(i=>i.implementation.status!=='no-audited-binding').length,
 sourceInputs:sourceBefore,defaultEditionId:snapshot.defaultEditionId,grandfatheredEditions:editions,items,
 ownerAddedCount:ownerAdditions.length,ownerAdditions,
 limitations:['Source/asset presence is not feature or release acceptance.','Existing rights metadata does not replace platform/territory review.',
 'Owner additions are separate from the 29 mandatory starter requirements.','Adult canonical editions cannot satisfy the required child skins.','No optional SKU or entitlement is approved by this inventory.'],
 productionActionsPerformed:false,grantsEntitlement:false,stageAccepted:false,releaseReady:false};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,json(report),{flag:'wx'});
console.log(json({auditValid:report.auditValid,status:report.status,requiredCount:report.requiredCount,acceptedCount:0,
 sourceBoundCount:report.sourceBoundCount,ownerAddedCount:ownerAdditions.length,grandfatheredEditions:editions.length,report:destination,releaseReady:false}));
