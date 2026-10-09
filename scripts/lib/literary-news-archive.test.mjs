import {describe,expect,it} from 'vitest';
import reviewed from '../../data/news/reviewed.json' with {type:'json'};
import {buildPublishedNewsFeed,verifyPublishedNewsSnapshot,NEWS_ARCHIVE_PUBLICATION_POLICY} from './literary-news-publication.mjs';
import {pendingNewsSourceState} from './literary-news-state.mjs';
import {handleNewsRequest,LiteraryNewsPublicReader} from '../workers/literary-news-worker.mjs';
import {reconcileNewsSnapshot} from './literary-news-social.mjs';

const current=new Date('2026-10-09T16:00:00Z'),release='a'.repeat(40),state=pendingNewsSourceState();
const archivedIds=['yesenin-konstantinovo-poetry-festival-2026','aficionado-award-words-without-borders-2026'];
describe('explicit reviewed archive keeps historical announcements without authorizing new social creates',()=>{
  it('retains the original two Telegram announcements and binds their archive policy to the full proof',async()=>{
    const normal=await buildPublishedNewsFeed({records:reviewed,current,release,state});
    const archive=await buildPublishedNewsFeed({records:reviewed,current,release,state,archive:true});
    for(const id of archivedIds){expect(normal.items.some(row=>row.id===id)).toBe(false);
      expect(archive.items.find(row=>row.id===id)).toMatchObject({kind:'announcement'});}
    expect(archive.snapshot.policy).toBe(NEWS_ARCHIVE_PUBLICATION_POLICY);
    expect(archive.snapshot.id).not.toBe(normal.snapshot.id);
    await expect(verifyPublishedNewsSnapshot(archive)).rejects.toThrow('public_snapshot_incomplete');
    expect(await verifyPublishedNewsSnapshot(archive,{archive:true})).toBe(archive);
    await expect(verifyPublishedNewsSnapshot(normal,{archive:true})).rejects.toThrow('public_snapshot_incomplete');
    const store={read:()=>{throw Error('must_not_mutate');}};
    await expect(reconcileNewsSnapshot(store,archive,[],current)).rejects.toThrow('public_snapshot_incomplete');
  });
  it('keeps explicit withdrawals and every ordinary record validation in the archive',async()=>{
    const original=reviewed.find(row=>row.id===archivedIds[0]);
    const records=[original,{...original,id:'future',verifiedAt:'2026-10-10T00:00:00Z'},
      {...original,id:'bad-source',source:{...original.source,url:'http://unsafe.example'}},
      {...original,id:'unreviewed',verification:'candidate'}];
    const feed=await buildPublishedNewsFeed({records,current,release,state,archive:true,
      withdrawals:[{id:original.id,withdrawnAt:current.toISOString(),reason:'Explicit source correction'}]});
    expect(feed.items).toEqual([]);expect(feed.withdrawals).toHaveLength(1);
    await expect(buildPublishedNewsFeed({records,current,release,state,archive:true,contractVersion:1}))
      .rejects.toThrow('public_archive_contract_required');
  });
  it('negotiates the explicit archive URL and cannot reuse a current projection in the reader cache',async()=>{
    const env={NEWS_RELEASE_SHA:release,NEWS_STATE:{get:async()=>null}};
    const reader=new LiteraryNewsPublicReader({storage:{}},env,{now:()=>current});
    for(const [query,archive] of [['',false],['&view=archive',true],['',false]]){
      const request=new Request('https://news.probpera.ru/api/literary-news/feed?contract=2&timeZone=Europe%2FMoscow'+query);
      const response=await reader.fetch(request);expect(response.status).toBe(200);
      const value=await response.json();await verifyPublishedNewsSnapshot(value,{archive});
      expect(value.items.some(row=>row.id===archivedIds[0])).toBe(archive);
    }
    const legacy=await handleNewsRequest(new Request('https://news.probpera.ru/api/literary-news/feed?view=archive'),env,current);
    expect(legacy.status).toBe(503);
  });
});
