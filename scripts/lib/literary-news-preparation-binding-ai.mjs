import {DAILY_NEWS_AI_CAPACITY_CODE,dailyNewsModelRequest,normalizeDailyNewsAiProviderCode,
  parseDailyNewsModelResult} from './literary-news-daily-automation.mjs';

const fail=code=>{throw Error(code);};
const safeError=error=>/^(?:daily_|ai_|provider_)[a-z0-9_]+$/.test(error?.message||'')?error.message:'daily_preparation_unavailable';
const checkedHttpStatus=value=>{
  const status=Number(value);
  return Number.isInteger(status)&&status>=100&&status<=599?status:null;
};

// Shared production adapter; keep native cancellation and both model protocols intact.
export function createPreparationBindingAi(binding,{deadline=Infinity,now=()=>Date.now(),timeoutMs=45000}={}){
  if(typeof binding?.run!=='function')fail('daily_ai_binding_missing');let stopped=null;
  return{async request(args){
    if(stopped)throw stopped;
    if(deadline-now()<timeoutMs+15000)fail('ai_execution_deadline');
    const{model,input}=dailyNewsModelRequest(args);let timer;
    try{const result=await Promise.race([binding.run(model,input,{signal:AbortSignal.timeout(timeoutMs)}),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('ai_request_timeout')),timeoutMs);})]);
      const codes=[...(Array.isArray(result?.errors)?result.errors:[]),result?.error]
        .map(error=>normalizeDailyNewsAiProviderCode(error?.code));
      const status=checkedHttpStatus(result?.status);
      const quotaCode=codes.find(code=>[4006,3036,402].includes(code));
      if(status===402||quotaCode!==undefined)
        throw Object.assign(Error('ai_quota_exceeded'),{code:quotaCode??402,httpStatus:status});
      if(codes.includes(DAILY_NEWS_AI_CAPACITY_CODE)&&(status===429||status===null))
        throw Object.assign(Error('ai_http_429'),{code:DAILY_NEWS_AI_CAPACITY_CODE,httpStatus:429});
      if(codes.includes(429)||status===429)throw Object.assign(Error('ai_http_429'),{httpStatus:429});
      return parseDailyNewsModelResult(result);
    }catch(error){
      const code=normalizeDailyNewsAiProviderCode(error?.code)??normalizeDailyNewsAiProviderCode(error?.cause?.code);
      const http=checkedHttpStatus(error?.status||error?.statusCode||error?.httpStatus);
      const quota=[4006,3036,402].includes(code)||http===402||/(?:^|\D)(?:4006|3036)(?:\D|$)/.test(error?.message||'');
      const temporaryCapacity=!quota&&code===DAILY_NEWS_AI_CAPACITY_CODE&&(http===429||http===null);
      stopped=Object.assign(Error(quota?'ai_quota_exceeded':http===429||temporaryCapacity?'ai_http_429':safeError(error)),
        {httpStatus:temporaryCapacity?429:http,...(temporaryCapacity?{providerCode:DAILY_NEWS_AI_CAPACITY_CODE}:{})});
      throw stopped;
    }finally{clearTimeout(timer);}
  }};
}
