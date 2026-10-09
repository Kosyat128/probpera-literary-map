import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchNewsFeedWithTransientRetry} from './literary-news-feed-request.mjs';

const url='https://news.probpera.ru/api/literary-news/feed?contract=2';
function response(status=503,retryAfter='1',actualUrl=url) {
  const cancel=vi.fn();
  const body=new ReadableStream({cancel});
  const value=new Response(body,{status,headers:retryAfter===null?{}:{'Retry-After':retryAfter}});
  Object.defineProperty(value,'url',{value:actualUrl});
  return {value,cancel};
}
afterEach(()=>vi.useRealTimers());
describe('bounded public feed busy retry',()=>{
  it('releases each busy body before retrying through the same budgeted fetch and signal',async()=>{
    const first=response(),second=response(503,'2'),good=response(200,null);
    const controller=new AbortController(),options={method:'GET',signal:controller.signal};
    const calls=[];
    const fetchImpl=vi.fn(async(input,init)=>{calls.push({input,init});return [first,second,good][calls.length-1].value;});
    const waitImpl=vi.fn(async(ms,signal)=>{
      expect(signal).toBe(controller.signal);
      expect([first,second][waitImpl.mock.calls.length-1].cancel).toHaveBeenCalledOnce();
      expect(ms).toBe(waitImpl.mock.calls.length===1?1000:2000);
    });
    expect(await fetchNewsFeedWithTransientRetry(url,options,{fetchImpl,waitImpl})).toBe(good.value);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(calls.every(call=>call.input===url && call.init===options)).toBe(true);
    expect(good.cancel).not.toHaveBeenCalled();
    await good.value.body.cancel();
  });
  it('returns the third busy response without another request or unbounded delay',async()=>{
    const replies=Array.from({length:3},()=>response());let index=0;
    const fetchImpl=vi.fn(async()=>replies[index++].value),waitImpl=vi.fn(async()=>{});
    expect(await fetchNewsFeedWithTransientRetry(url,{}, {fetchImpl,waitImpl})).toBe(replies[2].value);
    expect(fetchImpl).toHaveBeenCalledTimes(3);expect(waitImpl).toHaveBeenCalledTimes(2);
    expect(replies[0].cancel).toHaveBeenCalledOnce();expect(replies[1].cancel).toHaveBeenCalledOnce();
    expect(replies[2].cancel).not.toHaveBeenCalled();await replies[2].value.body.cancel();
  });
  it.each([[500,'1'],[429,'1'],[503,null],[503,'0'],[503,'3'],[503,'60'],[503,'1.5'],[503,'Fri, 09 Oct 2026 18:30:00 GMT']])(
    'does not retry status %s with Retry-After %s',async(status,retryAfter)=>{
      const reply=response(status,retryAfter),fetchImpl=vi.fn(async()=>reply.value),waitImpl=vi.fn(async()=>{});
      expect(await fetchNewsFeedWithTransientRetry(url,{}, {fetchImpl,waitImpl})).toBe(reply.value);
      expect(fetchImpl).toHaveBeenCalledOnce();expect(waitImpl).not.toHaveBeenCalled();await reply.value.body.cancel();
    });
  it.each(['https://untrusted.example/feed','https://news.probpera.ru/api/other'])('does not retry a response from %s',async(actualUrl)=>{
    const reply=response(503,'1',actualUrl),fetchImpl=vi.fn(async()=>reply.value),waitImpl=vi.fn(async()=>{});
    expect(await fetchNewsFeedWithTransientRetry(url,{}, {fetchImpl,waitImpl})).toBe(reply.value);
    expect(fetchImpl).toHaveBeenCalledOnce();expect(waitImpl).not.toHaveBeenCalled();await reply.value.body.cancel();
  });
  it('does not retry redirected responses',async()=>{
    const reply=response();Object.defineProperty(reply.value,'redirected',{value:true});
    const fetchImpl=vi.fn(async()=>reply.value);
    expect(await fetchNewsFeedWithTransientRetry(url,{}, {fetchImpl})).toBe(reply.value);
    expect(fetchImpl).toHaveBeenCalledOnce();await reply.value.body.cancel();
  });
  it('stops during its wait when the unchanged caller deadline expires',async()=>{
    vi.useFakeTimers();const reply=response(),controller=new AbortController();
    const fetchImpl=vi.fn(async()=>reply.value);
    const pending=fetchNewsFeedWithTransientRetry(url,{signal:controller.signal},{fetchImpl});
    const rejected=expect(pending).rejects.toThrow('deadline');
    await vi.advanceTimersByTimeAsync(400);controller.abort(new Error('deadline'));await rejected;
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchImpl).toHaveBeenCalledOnce();expect(reply.cancel).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
  it('does not start another request when aborted during an injected wait',async()=>{
    const reply=response(),controller=new AbortController(),fetchImpl=vi.fn(async()=>reply.value);
    const waitImpl=async()=>{controller.abort(new Error('unmounted'));};
    await expect(fetchNewsFeedWithTransientRetry(url,{signal:controller.signal},{fetchImpl,waitImpl})).rejects.toThrow('unmounted');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('propagates a spent native fetch budget without retrying or changing the request',async()=>{
    const fetchImpl=vi.fn(async()=>{throw Error('delivery_request_budget_exhausted');}),waitImpl=vi.fn(async()=>{});
    await expect(fetchNewsFeedWithTransientRetry(url,{}, {fetchImpl,waitImpl})).rejects.toThrow('delivery_request_budget_exhausted');
    expect(fetchImpl).toHaveBeenCalledOnce();expect(waitImpl).not.toHaveBeenCalled();
  });
  it('refuses write methods before sending any network request',async()=>{
    const fetchImpl=vi.fn();
    await expect(fetchNewsFeedWithTransientRetry(url,{method:'POST'},{fetchImpl})).rejects.toThrow('requires_get');
    await expect(fetchNewsFeedWithTransientRetry(new Request(url,{method:'POST'}),{}, {fetchImpl})).rejects.toThrow('requires_get');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
