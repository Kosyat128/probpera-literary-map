import{describe,expect,it}from'vitest';
import{LITERARY_NEWS_SOURCES}from'./literary-news-sources.mjs';
import{DAILY_NEWS_POLICY,DAILY_NEWS_MODELS,dailyNewsDigest,dailyRecordHashPayload,validateDailyNewsRecord}from'./literary-news-daily-profile.mjs';
const current=new Date('2026-09-30T12:00:00Z');
async function recordFixture(){
  const source=LITERARY_NEWS_SOURCES.find(s=>s.discoveryEnabled!==false&&!s.linkPattern&&s.language==='en'&&s.topics.includes('releases')),
    url=new URL('immutable-record-fixture',new URL(source.url).origin+'/').href,hash='a'.repeat(64);
  const value={id:'daily-'+(await dailyNewsDigest(url)).slice(0,32),eventKey:'daily-topic:'+(await dailyNewsDigest('immutable-topic')).slice(0,40),
    sourceId:source.id,kind:'news',category:'releases',eventDate:'2026-09-30',publishedAt:'2026-09-30T08:00:00Z',verifiedAt:current.toISOString(),verification:'confirmed',
    title:{ru:'Новый роман',en:'New novel'},summary:{ru:'Издатель представил новый роман.',en:'The publisher announced a new novel.'},
    source:{name:source.name,url,language:source.language},provenance:{reviewKind:'machineReviewed',policy:DAILY_NEWS_POLICY,firstAcceptedAt:current.toISOString(),
      draftModel:DAILY_NEWS_MODELS.draft,reviewModel:DAILY_NEWS_MODELS.review,eventDateBasis:'source-publication',draftSha256:hash,reviewSha256:hash,reviewPassed:true,
      sourceEvidence:{documentSha256:hash,textSha256:hash,accessedAt:'2026-09-30T08:00:00Z',publication:{value:'2026-09-30T08:00:00Z',method:'jsonld.datePublished'},
        quotes:['The publisher announced a new novel.'],literaryQuote:'new novel'}}};
  value.provenance.recordSha256=await dailyNewsDigest(dailyRecordHashPayload(value));return{value,source};
}
describe('Fully validated immutable default-source record memo',()=>{
  it('deeply freezes successful default records and safely accepts later clocks',async()=>{
    const{value}=await recordFixture();expect(await validateDailyNewsRecord(value,current)).toBe(value);
    for(const object of [value,value.title,value.source,value.provenance,value.provenance.sourceEvidence,value.provenance.sourceEvidence.quotes])expect(Object.isFrozen(object)).toBe(true);
    expect(()=>{value.title.en='Changed content';}).toThrow(TypeError);
    expect(await validateDailyNewsRecord(value,new Date(current.getTime()+1000))).toBe(value);
  });
  it('an earlier clock and a mutable clone with a copied hash still run all admission/content checks',async()=>{
    const{value}=await recordFixture();await validateDailyNewsRecord(value,current);
    await expect(validateDailyNewsRecord(value,new Date(current.getTime()-1000))).rejects.toThrow('daily_record_invalid');
    const clone=structuredClone(value);clone.summary.en='A substituted unsupported statement.';
    await expect(validateDailyNewsRecord(clone,new Date(current.getTime()+1000))).rejects.toThrow('daily_record_proof_invalid');
  });
  it('custom registries never receive immutable memo eligibility or skip changed content',async()=>{
    const{value,source}=await recordFixture();await validateDailyNewsRecord(value,current,{sources:[source]});
    expect(Object.isFrozen(value)).toBe(false);value.title.en='Altered title';
    await expect(validateDailyNewsRecord(value,current,{sources:[source]})).rejects.toThrow('daily_record_proof_invalid');
  });
});
