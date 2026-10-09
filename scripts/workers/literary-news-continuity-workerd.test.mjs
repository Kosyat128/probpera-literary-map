import {describe,expect,it} from 'vitest';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';

describe('continuity state in real SQLite-backed Durable Object storage',()=>{
  it('persists changed-item progress and exact timer advice between separate requests without outbound access',async()=>{
    const result=await build({stdin:{contents:`
      import {captureChangedNativeNews,planNewsCapture,completedNewsCaptureProgress} from '../lib/literary-news-capture-progress.mjs';
      import {scheduleNextNativeNewsAlarm} from './literary-news-delivery-worker.mjs';
      export class ContinuityFixture {
        constructor(state){this.storage=state.storage;}
        async fetch(request){
          const current=new Date('2026-12-01T12:00:00Z');
          const feed={items:Array.from({length:8},(_,i)=>({id:'record-'+i,kind:'news',eventDate:'2026-12-01',
            publishedAt:current.toISOString(),verifiedAt:current.toISOString()}))};
          const summary=await captureChangedNativeNews({storage:this.storage,capture:async({captureProgress,saveCaptureProgress})=>{
            const plan=await planNewsCapture(feed,current,captureProgress);
            await saveCaptureProgress(completedNewsCaptureProgress(plan,plan.ids,current));
            return{ids:plan.ids};
          }});
          await scheduleNextNativeNewsAlarm(this.storage,{NEWS_DELIVERY_ENABLED:'true'},
            {status:'daily_target_deficit',nextDispatchAt:'2026-12-01T13:45:29.592Z'},current);
          return Response.json({...summary,alarm:await this.storage.getAlarm()});
        }
        async alarm(){throw Error('fixture alarm must remain in the future');}
      }
      export default{fetch(request,env){return env.CONTINUITY.get(env.CONTINUITY.idFromName('continuity')).fetch(request);}};
    `,resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,write:false,format:'esm',platform:'browser',
      target:'es2022',external:['node:*'],logLevel:'silent'});
    const runtime=new Miniflare(convertV4MiniflareOptions({name:'isolated-continuity',modules:true,script:result.outputFiles[0].text,
      compatibilityDate:'2026-08-18',compatibilityFlags:['nodejs_compat'],cf:false,log:new Log(LogLevel.NONE),logRequests:false,
      durableObjects:{CONTINUITY:{className:'ContinuityFixture',useSQLite:true}},
      outboundService:async()=>{throw Error('outbound request forbidden');}}));
    try{
      const poll=async()=>(await runtime.dispatchFetch('https://fixture.internal/poll')).json();
      expect(await poll()).toEqual({ids:['record-0','record-1','record-2','record-3'],alarm:Date.parse('2026-12-01T13:45:29.592Z')});
      expect(await poll()).toEqual({ids:['record-4','record-5','record-6','record-7'],alarm:Date.parse('2026-12-01T13:45:29.592Z')});
      expect(await poll()).toEqual({ids:[],alarm:Date.parse('2026-12-01T13:45:29.592Z')});
    }finally{await runtime.dispose();}
  },15000);
});
