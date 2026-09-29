import {Buffer} from 'node:buffer';
const fail=code=>{throw Error(code);};
const space=char=>char===' '||char==='\n'||char==='\r'||char==='\t';
/** Parse one code-owned top-level array incrementally. A whole annual JSON string
 * and a duplicate record graph are never retained. Semantic/profile checks remain
 * in the existing validators; this reader only bounds and parses JSON framing. */
export async function readNewsJsonArray(stream,{arrayKey,maxBytes,maxEntries=5490,maxMetadataBytes=65536,maxEntryBytes=65536,onEntry=async value=>value}={}){
  if(typeof stream?.getReader!=='function'||typeof arrayKey!=='string'||!Number.isSafeInteger(maxBytes)
    ||!Number.isSafeInteger(maxEntries)||maxEntries<0||maxEntries>5490)fail('news_json_reader_input');
  const reader=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),result={},keys=new Set();
  let phase='start',key=null,keyText='',keyEscaped=false,totalBytes=0,metadataBytes=0,scanner=null,arraySeen=false;
  function startValue(char,target){scanner={target,text:'',depth:0,containers:0,inString:false,escaped:false,
    container:char==='{'||char==='[',string:char==='"'};phase='value';}
  function finishValue(){
    const {text,target}=scanner;let value;try{value=JSON.parse(text);}catch{fail('news_json_reader_invalid');}
    if(target==='entry'){if(!value||Array.isArray(value)||typeof value!=='object')fail('news_json_array_entry_invalid');
      const accepted=onEntry(value),finish=entry=>{result[arrayKey].push(entry);phase='array-after';scanner=null;};
      if(typeof accepted?.then==='function')return accepted.then(finish);finish(accepted);return;}
    else{metadataBytes+=Buffer.byteLength(text,'utf8');if(metadataBytes>maxMetadataBytes)fail('news_json_metadata_too_large');
      Object.defineProperty(result,key,{value,writable:true,enumerable:true,configurable:true});phase='after-value';}
    scanner=null;
  }
  function character(char){
    if(phase==='done'){if(!space(char))fail('news_json_reader_invalid');return;}
    if(phase==='start'){if(space(char))return;if(char!=='{')fail('news_json_reader_invalid');phase='key';return;}
    if(phase==='key'||phase==='key-after-comma'){
      if(space(char))return;if(char==='}'&&phase==='key'){phase='done';return;}
      if(char!=='"')fail('news_json_reader_invalid');keyText='"';keyEscaped=false;phase='key-text';return;
    }
    if(phase==='key-text'){
      keyText+=char;if(keyText.length>2048)fail('news_json_reader_invalid');
      if(keyEscaped){keyEscaped=false;return;}if(char==='\\'){keyEscaped=true;return;}
      if(char==='"'){try{key=JSON.parse(keyText);}catch{fail('news_json_reader_invalid');}
        if(keys.has(key))fail('news_json_duplicate_key');keys.add(key);
        if(keys.size>64)fail('news_json_metadata_too_many_keys');phase='colon';}return;
    }
    if(phase==='colon'){if(space(char))return;if(char!==':')fail('news_json_reader_invalid');phase='value-start';return;}
    if(phase==='value-start'){
      if(space(char))return;
      if(key===arrayKey){if(char!=='[')fail('news_json_array_entry_invalid');arraySeen=true;
        Object.defineProperty(result,arrayKey,{value:[],writable:true,enumerable:true,configurable:true});phase='array-entry';return;}
      startValue(char,'metadata');
    }else if(phase==='array-entry'||phase==='array-entry-after-comma'){
      if(space(char))return;if(char===']'&&phase==='array-entry'){phase='after-value';return;}
      if(char!=='{')fail('news_json_array_entry_invalid');
      // Enforce the count before parsing or retaining another graph, even when
      // each entry is tiny and the raw byte cap would permit millions of them.
      if(result[arrayKey].length>=maxEntries)fail('news_json_array_too_many_entries');startValue(char,'entry');
    }else if(phase==='after-value'){
      if(space(char))return;if(char===','){phase='key-after-comma';return;}if(char==='}'){phase='done';return;}fail('news_json_reader_invalid');
    }else if(phase==='array-after'){
      if(space(char))return;if(char===','){phase='array-entry-after-comma';return;}if(char===']'){phase='after-value';return;}fail('news_json_reader_invalid');
    }
    if(phase!=='value')return;
    const s=scanner;
    if(!s.container&&!s.string&&(space(char)||char===','||char==='}'||char===']')){
      const pending=finishValue();return pending?pending.then(()=>character(char)):character(char);}
    s.text+=char;const limit=s.target==='entry'?maxEntryBytes:maxMetadataBytes;
    if(s.text.length>limit)fail('news_json_value_too_large');
    if(s.inString){
      if(s.escaped)s.escaped=false;
      else if(char==='\\')s.escaped=true;
      else if(char==='"'){s.inString=false;if(s.string)return finishValue();}
    }else if(char==='"')s.inString=true;
    else if(s.container){if(char==='{'||char==='['){s.depth++;s.containers++;
        if(s.depth>100||s.containers>(s.target==='entry'?2000:50000))fail('news_json_structure_too_large');
      }else if(char==='}'||char===']')s.depth--;
      if(s.depth<0)fail('news_json_reader_invalid');if(s.depth===0)return finishValue();}
  }
  try{
    while(true){const{value,done}=await reader.read();if(done)break;
      totalBytes+=value.byteLength;if(totalBytes>maxBytes)fail('news_json_reader_too_large');
      // KV may deliver a very large chunk. Decode bounded pieces, not the entire value.
      for(let offset=0;offset<value.byteLength;offset+=8192){
        const text=decoder.decode(value.subarray(offset,offset+8192),{stream:true});
        for(const char of text){const pending=character(char);if(pending)await pending;}
      }
    }
    for(const char of decoder.decode()){const pending=character(char);if(pending)await pending;}
    if(phase!=='done'||!arraySeen)fail('news_json_reader_invalid');return result;
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
