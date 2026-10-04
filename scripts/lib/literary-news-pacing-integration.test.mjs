import {describe,expect,it,vi} from 'vitest';
import reviewed from '../../data/news/reviewed.json' with {type:'json'};
import {buildPublishedNewsFeed} from './literary-news-publication.mjs';
import {pendingNewsSourceState} from './literary-news-state.mjs';
import {dispatchNewsBatch,dispatchNewsJob,newsPostKey,reconcileNewsSnapshot} from './literary-news-social.mjs';

const start=new Date('2026-09-27T12:00:00Z');
const destination={platform:'telegram',id:'-100123',mode:'on'};
const records=Array.from({length:5},(_,i)=>({...reviewed.find(r=>r.kind==='news'),id:`pacing-${i}`,eventKey:`pacing-${i}`,
  eventDate:'2026-09-26',publishedAt:null,verifiedAt:start.toISOString()}));
function client(journal={rows:new Map(),sequence:0}) {
  return {
    journal,
    async read(key){return structuredClone(journal.rows.get(key)||{id:null,state:null});},
    async list(prefix){return [...journal.rows].filter(([key])=>key.startsWith(prefix)).map(([,row])=>structuredClone(row));},
    async compareAppend(key,id,state,guard){
      if(guard){const c=journal.rows.get(guard.key);
        if(!c||c.id!==guard.id||c.state.paused||!['on','canary'].includes(c.state.mode))return {applied:false};}
      const old=journal.rows.get(key)||{id:null,state:null};
      if(old.id!==id)return {applied:false,...structuredClone(old)};
      const row={id:++journal.sequence,state:structuredClone(state)};journal.rows.set(key,row);
      return {applied:true,...structuredClone(row)};
    },
  };
}
async function feed(items=records){return buildPublishedNewsFeed({records:items,withdrawals:[],current:start,
  release:'a'.repeat(40),state:pendingNewsSourceState(),timeZone:'Europe/Moscow'});}
async function setup(){const store=client();await reconcileNewsSnapshot(store,await feed(),[destination],start);
  await store.compareAppend('destination:telegram:-100123',null,{mode:'on',paused:false,historyReconciled:true});return store;}
const transport=()=>({preflight:async()=>({ok:true}),send:vi.fn(async()=>({kind:'accepted',remoteId:'99',remoteUrl:'https://t.me/c/123/99'}))});
const batch=async(store,t,time)=>dispatchNewsBatch({store,jobs:(await store.list('post:')).map(r=>r.state),transport:t,now:()=>time});

describe('gradual news publication through the real dispatcher',()=>{
  it('waits for the persisted variable interval across restarts and never catches up in a burst',async()=>{
    const store=await setup(),t=transport();
    await batch(store,t,start);expect(t.send).toHaveBeenCalledTimes(1);
    const restarted=client(store.journal);
    const pacing=(await store.read('history:pacing:telegram:-100123')).state;
    expect(pacing.intervalSeconds).toBeGreaterThanOrEqual(2700);expect(pacing.intervalSeconds).toBeLessThanOrEqual(3300);
    await batch(restarted,t,new Date(Date.parse(pacing.nextDueAt)-1));expect(t.send).toHaveBeenCalledTimes(1);
    await batch(restarted,t,new Date(pacing.nextDueAt));expect(t.send).toHaveBeenCalledTimes(2);
    await batch(restarted,t,new Date(start.getTime()+6*3600000));expect(t.send).toHaveBeenCalledTimes(3);
    await batch(restarted,t,new Date(start.getTime()+6*3600000));expect(t.send).toHaveBeenCalledTimes(3);
  });
  it('two different jobs racing in the same channel create only one post',async()=>{
    const store=await setup(),t=transport();
    await Promise.all(records.slice(0,2).map(r=>dispatchNewsJob({store:client(store.journal),key:newsPostKey(r.id,destination),transport:t,now:()=>start})));
    expect(t.send).toHaveBeenCalledTimes(1);
    const jobs=(await store.list('post:')).map(r=>r.state);
    expect(jobs.filter(j=>j.status==='sent_current')).toHaveLength(1);
    expect(jobs.filter(j=>j.status==='inflight')).toHaveLength(0);
  });
  it('an immediate correction edits the existing post while new posts remain spaced',async()=>{
    const store=await setup(),t=transport(),key=newsPostKey(records[0].id,destination);
    await dispatchNewsJob({store,key,transport:t,now:()=>start});
    const updated=records.map((r,i)=>i?r:{...r,summary:{...r.summary,ru:'Уточнённый проверенный текст новости.'}});
    await reconcileNewsSnapshot(store,await feed(updated),[destination],start);
    await batch(store,t,start);
    expect(t.send).toHaveBeenCalledTimes(2);
    expect(t.send.mock.calls[1][0].remoteId).toBe('99');
    expect((await store.read(key)).state.status).toBe('sent_current');
  });
});
