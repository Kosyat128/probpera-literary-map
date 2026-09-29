import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {newsJsonChunks,newsJsonByteSize,newsJsonDigest,newsJsonStream} from './literary-news-json.mjs';
const oldHash=value=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
describe('Exact bounded canonical news JSON',()=>{
  it.each([null,true,false,0,-0,1e30,NaN,Infinity,'plain',
    'Русский текст😀\u2028\u2029\ud800x\udfff', '"\\\b\f\n\r\t\u0000\u001f',
    [1,undefined,NaN,()=>1,Symbol('omitted'),null],{z:1,'10':'ten','2':'two',a:undefined,b:()=>1,c:Symbol('omitted')},
    Object.assign(Object.create(null),{ru:'Книга',en:'Book'})])('matches native JSON.stringify bytes/UTF8 digest for %#',async value=>{
      const text=[...newsJsonChunks(value)].join('');expect(text).toBe(JSON.stringify(value));
      expect(newsJsonByteSize(value)).toBe(Buffer.byteLength(JSON.stringify(value),'utf8'));
      expect(await newsJsonDigest(value)).toBe(oldHash(value));
      expect(await new Response(newsJsonStream(value)).text()).toBe(JSON.stringify(value));
    });
  it('keeps surrogate pairs together at chunk edges and bounds long Russian/control strings',async()=>{
    const value={title:'Я'.repeat(16383)+'😀'+'\ud800'+'\n'.repeat(10000),items:Array.from({length:2000},(_,i)=>({id:i,text:'Книга '+i}))};
    const chunks=[...newsJsonChunks(value)];expect(Math.max(...chunks.map(row=>row.length))).toBeLessThanOrEqual(16389);
    expect(chunks.join('')).toBe(JSON.stringify(value));expect(await newsJsonDigest(value)).toBe(oldHash(value));
    expect(await new Response(newsJsonStream(value)).text()).toBe(JSON.stringify(value));
  });
  it('rejects cycles, nonplain values and getters, but permits reused plain subobjects',async()=>{
    const cyclic={};cyclic.self=cyclic;expect(()=>newsJsonByteSize(cyclic)).toThrow('news_json_cycle');
    for(const value of [new Date(),new Map(),new Set(),new Uint8Array(2),{toJSON(){return 'custom';}},new(class extends Array{})()])
      expect(()=>newsJsonByteSize(value)).toThrow('news_json_nonplain_value');
    const accessor=Object.defineProperty({},'secret',{enumerable:true,get(){throw Error('must_not_execute');}});
    expect(()=>newsJsonByteSize(accessor)).toThrow('news_json_accessor');
    const shared={a:1},value={one:shared,two:shared};expect(await newsJsonDigest(value)).toBe(oldHash(value));
  });
  it('rejects hidden toJSON accessors before the native serializer can execute them',async()=>{
    let executed=0;const value=Object.defineProperty({ordinary:'value'},'toJSON',
      {get(){executed++;return()=>({changed:'canonical payload'});}});
    expect(()=>newsJsonByteSize(value)).toThrow('news_json_accessor');
    await expect(newsJsonDigest(value)).rejects.toThrow('news_json_accessor');expect(executed).toBe(0);
  });
});
