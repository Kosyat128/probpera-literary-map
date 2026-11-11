// Controlled PostgREST transport; the actual GET route and installed SDK build the query.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), {createRequire} = require('node:module');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const runtimeFiles = ['apps/admin/app/api/media/assets/route.ts', 'apps/admin/lib/editor-media-assets-contract.ts'];
function seedRows() {
  return Array.from({length:137}, (_,offset) => {
    const index=offset+1, label=String(index).padStart(3,'0');
    return {id:`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,bucket:'editorial-media',object_path:`fixture/asset-${label}.svg`,original_name:`original-${label}.png`,
      alt_text:`Asset ${label}`,caption:`Caption ${label}`,collection_name:`Collection ${label}`,creator:'Synthetic author',source_url:'https://source.invalid/one',
      license_name:'permission',license_url:'https://source.invalid/permission',width:800,height:600,created_at:new Date(Date.UTC(2026,0,1,0,0,137-index)).toISOString(),deleted_at:null};
  }).map((row,index)=>index===136?{...row,original_name:'filename-needle-137.png'}:index===135?{...row,caption:'caption-needle-136'}:index===134?{...row,collection_name:'collection-needle-135'}:index===133?{...row,alt_text:'literal %_\\ item'}:index===132?{...row,alt_text:'literal XX item'}:row);
}
function like(pattern) {
  let result='';
  for(let i=0;i<pattern.length;i++) {
    const c=pattern[i], literal=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(c==='\\'&&i+1<pattern.length)result+=literal(pattern[++i]);
    else result+=c==='%'?'.*':c==='_'?'.':literal(c);
  }
  return new RegExp('^'+result+'$','iu');
}
function splitGroup(value) {
  let quoted=false,escaped=false,depth=0,start=0;const parts=[];
  for(let i=0;i<value.length;i++) {
    const c=value[i];
    if(escaped){escaped=false;continue;}if(quoted&&c==='\\'){escaped=true;continue;}
    if(c==='"'){quoted=!quoted;continue;}if(quoted)continue;
    if(c==='(')depth++;if(c===')')depth--;
    if(depth<0)throw Error('Unbalanced PostgREST group');
    if(c===','&&depth===0){parts.push(value.slice(start,i));start=i+1;}
  }
  if(quoted||depth!==0)throw Error('Unterminated PostgREST expression');
  parts.push(value.slice(start));return parts;
}
function expression(value) {
  const group=/^(and|or)\((.*)\)$/su.exec(value);
  if(group){const terms=splitGroup(group[2]).map(expression);return row=>group[1]==='and'?terms.every(test=>test(row)):terms.some(test=>test(row));}
  const atom=/^(original_name|alt_text|caption|collection_name|created_at|id)\.(ilike|lt|eq)\.(.*)$/su.exec(value);
  if(!atom)throw Error('Unsupported actual PostgREST expression: '+value);
  const [,field,operator,raw]=atom,term=raw.startsWith('"')?JSON.parse(raw):raw;
  if(typeof term!=='string')throw Error('PostgREST operand is not text');
  if(operator==='ilike'){const re=like(term);return row=>re.test(row[field]??'');}
  return row=>operator==='eq'?row[field]===term:String(row[field])<term;
}
function createMediaRouteRuntime(options) {
  const {dependencyRoot,sourceRoot=dependencyRoot,manifest,empty=false}=options;
  const native=createRequire(path.join(dependencyRoot,'package.json')),ts=native('typescript'),{createClient}=native('@supabase/supabase-js');
  const rows=options.rows?structuredClone(options.rows):empty?[]:seedRows(),wire=[],protocolErrors=[],sourceGraph=[];
  const sdk=createClient('https://m11-media.invalid','synthetic-local-public-fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{retry:false},global:{fetch:async(input,init={})=>{
    const url=new URL(String(input)),entry={method:init.method||'GET',pathname:url.pathname,query:[...url.searchParams],responseIds:[]};wire.push(entry);
    try {
      if(url.origin!=='https://m11-media.invalid'||url.pathname!=='/rest/v1/media_assets'||entry.method!=='GET')throw Error('Uncontrolled SDK transport');
      if(options.readError)return new Response(JSON.stringify({code:'42501',message:'Synthetic denied read'}),{status:403,headers:{'content-type':'application/json'}});
      let found=rows.slice();
      if(url.searchParams.getAll('or').length>1)throw Error('Duplicate OR query parameters');
      for(const [key,value]of url.searchParams) {
        if(['select','order','limit'].includes(key))continue;
        if(key==='deleted_at'&&value==='is.null'){found=found.filter(row=>row.deleted_at===null);continue;}
        if(key==='or'&&value.startsWith('(')&&value.endsWith(')')){const test=expression('or'+value);found=found.filter(test);continue;}
        // The genuine BEFORE alt-only route remains independently replayable.
        if(['alt_text','caption','collection_name','original_name'].includes(key)&&value.startsWith('ilike.')){const test=expression(key+'.'+value);found=found.filter(test);continue;}
        throw Error('Unsupported actual query filter: '+key+'='+value);
      }
      const order=url.searchParams.get('order')||'';
      if(order!=='created_at.desc,id.desc')throw Error('Unexpected actual media order: '+order);
      found.sort((a,b)=>{for(const clause of order.split(',')){const [key,direction]=clause.split('.');const compare=String(a[key]).localeCompare(String(b[key]));if(compare)return direction==='desc'?-compare:compare;}return 0;});
      const limit=Number(url.searchParams.get('limit')||1000);
      if(!Number.isSafeInteger(limit)||limit<0||limit>1000)throw Error('Unsafe fixture range');
      found=found.slice(0,limit);entry.responseIds=found.map(row=>row.id);
      const columns=(url.searchParams.get('select')||'*').split(',');
      if(!columns.includes('*'))found=found.map(row=>Object.fromEntries(columns.map(key=>[key,row[key]])));
      return new Response(JSON.stringify(options.nullData?null:found),{status:200,headers:{'content-type':'application/json'}});
    }catch(error){protocolErrors.push({message:String(error),query:entry.query});throw error;}
  }}});
  const allowed=new Map((manifest?.files||runtimeFiles.map(file=>{const b=fs.readFileSync(path.join(sourceRoot,file));return{file,bytes:b.length,sha256:hash(b),role:'actual-runtime-source'};})).map(row=>[row.file,row])),loaded=new Map();
  const mocks={'@/lib/auth':{requireStaff:async()=>options.staff===false?null:{user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},role:'owner'}},'@/lib/supabase/server':{createServerSupabaseClient:async()=>options.noClient?null:sdk}};
  function load(file) {
    if(loaded.has(file))return loaded.get(file).exports;
    const expected=allowed.get(file);if(!expected||expected.role!=='actual-runtime-source')throw Error('Uncaptured local module '+file);
    const b=fs.readFileSync(path.join(sourceRoot,file));if(hash(b)!==expected.sha256)throw Error('Source drift '+file);sourceGraph.push({file,sha256:hash(b),bytes:b.length});
    const module={exports:{}};loaded.set(file,module);
    const require=name=>{if(Object.hasOwn(mocks,name))return mocks[name];if(name.startsWith('@/')||name.startsWith('.')){
      const stem=name.startsWith('@/')?'apps/admin/'+name.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),name));
      const resolved=[stem,stem+'.ts',stem+'.tsx'].find(candidate=>allowed.has(candidate));if(!resolved)throw Error('Unexpected uncaptured server import '+name);return load(resolved);
    }return native(name);};
    const code=ts.transpileModule(b.toString(),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function('require','module','exports',code)(require,module,module.exports);return module.exports;
  }
  const GET=load('apps/admin/app/api/media/assets/route.ts').GET;
  return {wire,protocolErrors,sourceGraph,rows,sdk,handle:request=>GET(request),load};
}
module.exports={createMediaRouteRuntime,seedRows,splitGroup,expression,runtimeFiles};
