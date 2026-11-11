const assert=require('node:assert/strict');
// Controlled canonical read transport only. Caller owns the immutable captured
// snapshots. Selection/admission algorithms remain actual application/SQL paths.
function createLibraryCanonicalTransport(input){
 const tables={literary_works:'works',literary_work_translations:'translations',literary_work_sources:'sources'},wire=[];
 async function fetch(resource,init={}){
  const url=new URL(typeof resource==='string'?resource:resource.url),name=url.pathname.split('/').at(-1),method=init.method||'GET';
  assert.ok(Object.hasOwn(tables,name));assert.ok(['GET','HEAD'].includes(method),'Canonical mutations are forbidden');
  const params=Object.fromEntries(url.searchParams),request={method,name,params};wire.push(request);input.onRead?.(request);
  if(input.nativeReplay){const saved=input.nativeReplay(request);assert.ok(saved,'Every BEFORE query requires its original native reply');return new Response(method==='HEAD'?null:JSON.stringify(saved.nativeRows),{status:200,headers:{'Content-Type':'application/json','Content-Range':`0-${Math.max(0,saved.nativeCount-1)}/${saved.nativeCount}`}});}
  const snapshot=input.snapshot();assert.ok(snapshot&&Array.isArray(snapshot[tables[name]]));
  let rows=snapshot[tables[name]].filter(row=>Object.entries(params).every(([key,value])=>{
   if(['select','order','offset','limit'].includes(key))return true;
   if(value.startsWith('eq.'))return String(row[key])===value.slice(3);
   if(value.startsWith('in.'))return value.slice(4,-1).split(',').includes(String(row[key]));
   if(value.startsWith('cs.'))return value.slice(4,-1).split(',').every(field=>Array.isArray(row[key])&&row[key].includes(field));
   throw Error(`Unsupported actual SDK canonical predicate ${key}=${value}`);
  }));
  const count=rows.length;
  if(params.order){const columns=params.order.split(',').map(part=>part.split('.'));assert.ok(columns.every(parts=>parts.length===2&&['asc','desc'].includes(parts[1])));rows=[...rows].sort((a,b)=>{for(const [column,direction]of columns){if(a[column]===b[column])continue;return(a[column]<b[column]?-1:1)*(direction==='asc'?1:-1);}return 0;});}
  const offset=Number(params.offset||0),limit=params.limit===undefined?rows.length:Number(params.limit);assert.ok(Number.isSafeInteger(offset)&&offset>=0&&Number.isSafeInteger(limit)&&limit>=0);rows=rows.slice(offset,offset+limit);
  if(params.select&&params.select!=='*'){const fields=params.select.split(',');assert.ok(fields.every(field=>/^[a-z_]+$/u.test(field)));rows=rows.map(row=>Object.fromEntries(fields.map(field=>[field,structuredClone(row[field])])));}
  return new Response(method==='HEAD'?null:JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json','Content-Range':`0-${Math.max(0,count-1)}/${count}`}});
 }
 return{fetch,wire,handles(name){return Object.hasOwn(tables,name);}};
}
module.exports={createLibraryCanonicalTransport};
