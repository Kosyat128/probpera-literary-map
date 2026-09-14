import fs from 'node:fs/promises';
const filename='docs/mobile/AUTOPILOT_STATE.json',state=JSON.parse(await fs.readFile(filename,'utf8'));
state.updatedAt=new Date().toISOString();
state.verificationCache.ownerCatalogWorkflow={recordedAt:state.updatedAt,
 ownerInstruction:'Owner is filling the work archive; integrate all current canonical archives during final preparation after application implementation.',
 activeScope:'App functionality, platform integration and canonical ingestion contracts. No factual archive population in this checkout.',
 finalSync:'Use then-current owner canonical content; preserve country/writer/work IDs, references, favorites and navigation. Revalidate both locales, rights/cover records, offline/search and exact artifacts.',
 contentAcceptanceDeferred:true,releaseGatesWaived:false};
await fs.writeFile(filename,JSON.stringify(state,null,2)+'\n');
for(const name of ['STATUS.md','BLOCKERS.md','NEXT_CODEX_PROMPT.txt']){
 const path='docs/mobile/'+name;let text=(await fs.readFile(path,'utf8')).replaceAll('\r\n','\n');
 const marker='<!-- s09-country-writer-20260914:begin -->';
 text=text.replace(marker,marker+'\nOwner fills the archive; final canonical content synchronization follows app\nimplementation (D107). Current counts are development snapshots; keep IDs/state.');
 await fs.writeFile(path,text);
}
