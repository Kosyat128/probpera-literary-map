import{describe,expect,it,vi}from'vitest';
import{readNewsJsonArray}from'./literary-news-json-reader.mjs';
function stream(text,chunk=17){const bytes=new TextEncoder().encode(text);let offset=0;
  return new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.subarray(offset,offset+chunk));offset+=chunk;}});}
describe('Bounded annual JSON record reader',()=>{
  it('preserves reordered metadata, escaped braces, Unicode split across bytes and complete plain records',async()=>{
    const value={head:'Русский😀',records:[{id:1,text:'x},["\\\n',nested:{items:['a','б']}},{id:2,text:'next'}],tail:{passed:true}};
    const result=await readNewsJsonArray(stream(JSON.stringify(value),1),{arrayKey:'records',maxBytes:10000});expect(result).toEqual(value);
    const reuse={id:1},seen=vi.fn(async record=>record.id===1?reuse:record);
    const reused=await readNewsJsonArray(stream(JSON.stringify(value)),{arrayKey:'records',maxBytes:10000,onEntry:seen});
    expect(reused.records[0]).toBe(reuse);expect(seen).toHaveBeenCalledTimes(2);
  });
  it('handles empty arrays, primitive metadata and pretty JSON without changing its values',async()=>{
    const value={records:[],ok:true,count:3,none:null,string:'"x"'};
    expect(await readNewsJsonArray(stream(JSON.stringify(value,null,2)),{arrayKey:'records',maxBytes:10000})).toEqual(value);
  });
  it('rejects a tiny-object flood before parsing or retaining entries beyond the annual bound',async()=>{
    const onEntry=vi.fn(value=>value),text='{"records":['+Array.from({length:5491},()=> '{}').join(',')+']}';
    await expect(readNewsJsonArray(stream(text,8192),{arrayKey:'records',maxBytes:100000,onEntry}))
      .rejects.toThrow('news_json_array_too_many_entries');
    expect(onEntry).toHaveBeenCalledTimes(5490);
    await expect(readNewsJsonArray(stream('{"records":[{},{}]}'),{arrayKey:'records',maxBytes:100,maxEntries:1}))
      .rejects.toThrow('news_json_array_too_many_entries');
    expect(await readNewsJsonArray(stream('{"records":[]}'),{arrayKey:'records',maxBytes:100,maxEntries:0})).toEqual({records:[]});
  });
  it('bounds dense nested object graphs and top-level metadata before JSON.parse retains them',async()=>{
    const text='{"records":[{"junk":['+Array.from({length:2001},()=> '{}').join(',')+']}]}';
    await expect(readNewsJsonArray(stream(text,8192),{arrayKey:'records',maxBytes:100000}))
      .rejects.toThrow('news_json_structure_too_large');
    const value={records:[]};for(let i=0;i<65;i++)value['extra'+i]=null;
    await expect(readNewsJsonArray(stream(JSON.stringify(value)),{arrayKey:'records',maxBytes:100000}))
      .rejects.toThrow('news_json_metadata_too_many_keys');
  });
  it('keeps __proto__/constructor as own JSON properties without prototype pollution',async()=>{
    const text='{"__proto__":{"polluted":true},"constructor":{"safe":true},"records":[{"__proto__":{"nested":true}}]}';
    const value=await readNewsJsonArray(stream(text),{arrayKey:'records',maxBytes:10000});
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);expect(Object.hasOwn(value,'__proto__')).toBe(true);
    expect(value.__proto__).toEqual({polluted:true});expect(value.constructor).toEqual({safe:true});
    expect(Object.getPrototypeOf(value.records[0])).toBe(Object.prototype);expect({}.polluted).toBeUndefined();
  });
  it('rejects truncation, trailing commas/bytes, duplicate keys, nonobject records and oversize bodies',async()=>{
    for(const text of ['{"records":[{"a":1}', '{"records":[{},]}','{"records":[],}','{"records":[]}x',
      '{"records":[],"records":[]}','{"records":[null]}'])
      await expect(readNewsJsonArray(stream(text),{arrayKey:'records',maxBytes:10000})).rejects.toThrow(/news_json_/);
    await expect(readNewsJsonArray(stream('{"records":[]}'),{arrayKey:'records',maxBytes:3})).rejects.toThrow('news_json_reader_too_large');
    await expect(readNewsJsonArray(stream('{"records":[],"meta":"'+ 'x'.repeat(100)+'"}'),{arrayKey:'records',maxBytes:10000,maxMetadataBytes:30}))
      .rejects.toThrow('news_json_value_too_large');
  });
});
