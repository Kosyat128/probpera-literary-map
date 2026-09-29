import {describe,expect,it,vi} from 'vitest';
import {fallbackUnsentNewsPhoto,newsNewCreateIsFresh} from './literary-news-text-fallback.mjs';
import {prepareNewsPost,newsPostKey} from './literary-news-social.mjs';
const current=new Date('2026-09-30T12:00:00Z'),destination={platform:'telegram',id:'-100123',mode:'on',requirePhotoForNewPosts:false};
const record={id:'fixture-story',verification:'confirmed',kind:'news',category:'releases',eventDate:'2026-09-30',
  publishedAt:'2026-09-30T06:00:00Z',verifiedAt:current.toISOString(),title:{ru:'Новая книга',en:'New book'},
  summary:{ru:'Издатель объявил книгу.',en:'Publisher announced a book.'},source:{name:'Publisher',url:'https://publisher.example/news/book',language:'en'}};
async function fixture(){
  const asset={id:'fixture-photo',status:'approved',newsIds:[record.id],sourceUrl:'https://publisher.example/image.jpg',sourceSha256:'b'.repeat(64),
    subject:'book',entityEvidence:'Synthetic test',author:'Fixture',rightsholder:'Fixture',credit:'Fixture',license:'owned',
    licenseEvidenceUrl:'https://publisher.example/license',licenseEvidenceSha256:'c'.repeat(64),checkMethod:'ownership-record',
    checkedAt:'2026-09-29T00:00:00Z',validUntil:'2026-10-10T00:00:00Z',transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
    permissions:[{platform:'telegram',destinationId:destination.id,publish:true,providerProcessing:true,evidenceUrl:'https://publisher.example/license'}],
    derivative:{sha256:'d'.repeat(64),byteLength:7,mime:'image/jpeg',width:480,height:640,profile:'literary-news-photo-v1'}};
  const prepared=await prepareNewsPost(record,{id:'verified-fixture',release:'a'.repeat(40)},'telegram',
    {destination,mediaOptions:{registry:{assets:[asset]},now:current,deferBytes:true}});
  const key=newsPostKey(record.id,destination),row={id:3,state:{key,newsId:record.id,destination,status:'pending',originalAdmission:current.toISOString(),
    prepared,desiredRevision:prepared.revision}},admitted={record};
  const store={read:vi.fn(async()=>({id:1,state:admitted})),compareAppend:vi.fn(async()=>({applied:true,id:4}))};
  return{row,admitted,store};
}
describe('Verified text fallback after one bounded media preparation attempt',()=>{
  it('preserves the existing full news formatter, source and site links and durable identity',async()=>{
    const f=await fixture(),result=await fallbackUnsentNewsPhoto({...f,reason:'delivery_media_bytes_unavailable',current});
    const expected=await prepareNewsPost(record,{id:'verified-fixture',release:'a'.repeat(40)},'telegram');
    expect(result.applied).toBe(true);expect(result.state.prepared.payload).toEqual(expected.payload);
    expect(result.state.prepared.media).toBeNull();expect(result.state.key).toBe(f.row.state.key);
    expect(result.state.prepared.payload.text).toContain(record.source.url);
    expect(result.state.prepared.payload.text).toContain('https://probpera.ru/#literary-news');
    expect(f.store.read).toHaveBeenCalledExactlyOnceWith('admission:news:fixture-story');
    expect(f.store.compareAppend).toHaveBeenCalledWith(f.row.state.key,3,result.state);
  });
  it('keeps changed image bytes and prepared/admission corruption blocked',async()=>{
    const f=await fixture();expect(await fallbackUnsentNewsPhoto({...f,reason:'media_cache_bytes_changed',current})).toBeNull();
    expect(f.store.read).not.toHaveBeenCalled();
    f.row.state.prepared.payload.caption+='tampered';
    await expect(fallbackUnsentNewsPhoto({...f,reason:'media_cache_unavailable',current})).rejects.toThrow('text_fallback_revision_invalid');
    const g=await fixture();g.admitted.record={...record,summary:{...record.summary,ru:'Changed unreviewed claim'}};
    await expect(fallbackUnsentNewsPhoto({...g,reason:'media_cache_unavailable',current})).rejects.toThrow('text_fallback_admission_invalid');
    expect(g.store.compareAppend).not.toHaveBeenCalled();
  });
  it.each([{remoteId:'17'},{status:'inflight'},{status:'ambiguous'},{dispatchStartedAt:current.toISOString()},
    {destination:{...destination,requirePhotoForNewPosts:true}}])('never replaces a sent, uncertain or explicitly photo-required job: %j',async extra=>{
    const f=await fixture();Object.assign(f.row.state,extra);
    expect(await fallbackUnsentNewsPhoto({...f,reason:'media_cache_unavailable',current})).toBeNull();
    expect(f.store.compareAppend).not.toHaveBeenCalled();
  });
  it('a competing receipt wins CAS without being replaced or resent as text',async()=>{
    const f=await fixture();f.store.compareAppend.mockResolvedValue({applied:false,id:9,state:{remoteId:'17',status:'sent_current'}});
    expect(await fallbackUnsentNewsPhoto({...f,reason:'media_source_unavailable',current})).toMatchObject({applied:false});
  });
  it('accepts source date-only fresh publications and rejects unknown, old and future dates',()=>{
    for(const [publishedAt,expected] of [['2026-09-30',true],['2026-09-20',false],[null,false],['2026-10-01',false]])
      expect(newsNewCreateIsFresh({prepared:{temporal:{kind:'news',publishedAt,eventDate:'2026-09-30'}}},current)).toBe(expected);
  });
});
