const fs=require('node:fs'),assert=require('node:assert/strict');
const report=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),checks=[];assert.equal(report.observations.length,8);
for(const row of report.observations){
 const error=row.state.statusClass?.includes('is-error'),idle=row.state.statusClass?.includes('is-idle');
 let pass;
 if(row.name==='lookup-resolved-failure'||row.name==='lookup-rejection-control')pass=error&&!row.state.recoveryVisible;
 else if(row.name==='lookup-empty-control')pass=idle&&!row.state.recoveryVisible;
 else if(row.name==='discard-deleted-true-control')pass=idle&&!row.state.recoveryVisible;
 else if(row.name==='discard-deleted-false'||row.name==='discard-rejection-control')pass=error&&row.state.recoveryVisible;
 else if(row.name==='discard-late-old-scope-control'){const expected={id:'33333333-3333-4333-8333-333333333333',clientSessionId:'44444444-4444-4444-8444-444444444444',sequence:8,snapshotHash:'e'.repeat(64)};pass=row.state.statusClass?.includes('is-saved')&&row.state.recoveryVisible&&row.state.locator==='77777777-7777-4777-8777-777777777777'&&Object.keys(row.newScopeDeleteInput||{}).length===4&&Object.entries(expected).every(([key,value])=>row.newScopeDeleteInput?.[key]===value);}
 else pass=idle&&!row.state.recoveryVisible&&row.state.locator==='77777777-7777-4777-8777-777777777777';
 checks.push({name:row.name,criterion:row.criterion,category:row.category,pass:Boolean(pass)});
 checks.push({name:row.name+' preserves current authored input/no accidental restore/no page error',category:'preservation',pass:row.inputBefore===row.inputAfter&&row.state.restores.length===0&&row.pageErrors.length===0});
}
console.log(JSON.stringify({classification:'ACTUAL_COMPONENT_ORACLE_NO_DB_OR_MODULE_ACCEPTANCE',checks,pass:checks.filter(x=>x.pass).length,fail:checks.filter(x=>!x.pass).length}));process.exitCode=checks.every(x=>x.pass)?0:1;
