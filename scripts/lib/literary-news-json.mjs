import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';

// Code-owned canonical JSON for plain data. Large profiles never require a second
// full JSON string or UTF-8 buffer merely to measure/hash their existing proofs.
const fail=code=>{throw Error(code);};
const omitted=value=>value===undefined||typeof value==='function'||typeof value==='symbol';
function checkToJson(item){
  const descriptor=Object.getOwnPropertyDescriptor(item,'toJSON');
  if(descriptor?.get||descriptor?.set)fail('news_json_accessor');
  if(typeof descriptor?.value==='function')fail('news_json_nonplain_value');
}
function* stringChunks(value){
  if(value.length<=2048){yield JSON.stringify(value);return;}
  yield '"';let chunk='';
  for(let i=0;i<value.length;i++){
    const code=value.charCodeAt(i);
    if(code===0x22)chunk+='\\"';
    else if(code===0x5c)chunk+='\\\\';
    else if(code===0x08)chunk+='\\b';
    else if(code===0x0c)chunk+='\\f';
    else if(code===0x0a)chunk+='\\n';
    else if(code===0x0d)chunk+='\\r';
    else if(code===0x09)chunk+='\\t';
    else if(code<0x20)chunk+='\\u'+code.toString(16).padStart(4,'0');
    else if(code>=0xd800&&code<=0xdbff){
      const next=value.charCodeAt(i+1);
      if(next>=0xdc00&&next<=0xdfff)chunk+=value[i]+value[++i];
      else chunk+='\\u'+code.toString(16).padStart(4,'0');
    }else if(code>=0xdc00&&code<=0xdfff)chunk+='\\u'+code.toString(16).padStart(4,'0');
    else chunk+=value[i];
    if(chunk.length>=16384){yield chunk;chunk='';}
  }
  if(chunk)yield chunk;yield '"';
}
export function* newsJsonChunks(value){
  const ancestors=new Set();
  // Ordinary records fit a small native serialization. Check their complete plain
  // structure first; large arrays/profiles still stream without a whole-value copy.
  function smallTree(item,path,budget){
    if(omitted(item))return true;
    if(item===null||typeof item==='number'||typeof item==='boolean')return --budget.nodes>=0;
    if(typeof item==='string'){budget.characters-=item.length;return --budget.nodes>=0&&budget.characters>=0;}
    if(typeof item!=='object')fail('news_json_unsupported_value');
    const array=Array.isArray(item),prototype=Object.getPrototypeOf(item);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('news_json_nonplain_value');
    if(path.has(item)||ancestors.has(item))fail('news_json_cycle');
    const keys=array?Array.from({length:Math.min(item.length,101)},(_,i)=>String(i)):Object.keys(item);
    if(keys.length>100||--budget.nodes<0)return false;
    checkToJson(item);
    path.add(item);
    try{for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(item,key);
      if(descriptor?.get||descriptor?.set)fail('news_json_accessor');budget.characters-=key.length;
      if(budget.characters<0||!smallTree(descriptor?.value,path,budget))return false;
    }return true;}finally{path.delete(item);}
  }
  function* visit(item,depth){
    if(depth>100)fail('news_json_depth_exceeded');
    if(item===null){yield 'null';return;}
    if(typeof item==='string'){yield* stringChunks(item);return;}
    if(typeof item==='number'||typeof item==='boolean'){yield JSON.stringify(item);return;}
    if(typeof item!=='object')fail('news_json_unsupported_value');
    if(ancestors.has(item))fail('news_json_cycle');
    const array=Array.isArray(item),prototype=Object.getPrototypeOf(item);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('news_json_nonplain_value');
    checkToJson(item);
    if(smallTree(item,new Set(),{nodes:120,characters:3000})){yield JSON.stringify(item);return;}
    ancestors.add(item);
    try{
      if(array){yield '[';for(let i=0;i<item.length;i++){
        if(i)yield ',';const descriptor=Object.getOwnPropertyDescriptor(item,String(i));
        if(descriptor?.get||descriptor?.set)fail('news_json_accessor');
        if(omitted(item[i]))yield 'null';else yield* visit(item[i],depth+1);
      }yield ']';}
      else{yield '{';let first=true;for(const key of Object.keys(item)){
        const descriptor=Object.getOwnPropertyDescriptor(item,key);
        if(descriptor?.get||descriptor?.set)fail('news_json_accessor');
        if(omitted(item[key]))continue;
        if(!first)yield ',';first=false;yield* stringChunks(key);yield ':';yield* visit(item[key],depth+1);
      }yield '}';}
    }finally{ancestors.delete(item);}
  }
  yield* visit(value,0);
}
export function newsJsonByteSize(value){let bytes=0;for(const chunk of newsJsonChunks(value))bytes+=Buffer.byteLength(chunk,'utf8');return bytes;}
export async function newsJsonDigest(value){const hash=createHash('sha256');for(const chunk of newsJsonChunks(value))hash.update(chunk,'utf8');return hash.digest('hex');}
export function newsJsonStream(value,{onComplete=()=>{}}={}){
  const chunks=newsJsonChunks(value),encoder=new TextEncoder();let finished=false;
  let completed=false;const complete=()=>{if(!completed){completed=true;onComplete();}};
  return new ReadableStream({pull(controller){
    // Coalesce small tokens while never retaining the full response string.
    let text='';try{while(text.length<16384){const next=chunks.next();if(next.done){finished=true;break;}text+=next.value;}
      if(text)controller.enqueue(encoder.encode(text));if(finished){controller.close();complete();}}
    catch(error){chunks.return();controller.error(error);complete();}
  },cancel(){chunks.return();complete();}});
}
