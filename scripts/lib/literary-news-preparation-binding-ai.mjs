import {dailyNewsModelRequest,parseDailyNewsModelResult} from './literary-news-daily-automation.mjs';

const fail=code=>{throw Error(code);};
const safeError=error=>/^(?:daily_|ai_|provider_)[a-z0-9_]+$/.test(error?.message||'')?error.message:'daily_preparation_unavailable';

// Shared production adapter; keep native cancellation and both model protocols intact.
export function createPreparationBindingAi(binding,{deadline=Infinity,now=()=>Date.now(),timeoutMs=45000}={}){
  if(typeof binding?.run!=='function')fail('daily_ai_binding_missing');let stopped=null;
  return{async request(args){
    if(stopped)throw stopped;
    if(deadline-now()<timeoutMs+15000)fail('ai_execution_deadline');
    const{model,input}=dailyNewsModelRequest(args);let timer;
    try{const result=await Promise.race([binding.run(model,input,{signal:AbortSignal.timeout(timeoutMs)}),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('ai_request_timeout')),timeoutMs);})]);
      const codes=[...(Array.isArray(result?.errors)?result.errors:[]),result?.error].filter(Boolean).map(e=>Number(e.code));
      if(codes.some(c=>[4006,3036,402].includes(c)))throw Object.assign(Error('ai_quota_exceeded'),{httpStatus:result?.status===402?402:null});
      if(codes.includes(429)||result?.status===429)throw Object.assign(Error('ai_http_429'),{httpStatus:429});
      return parseDailyNewsModelResult(result);
    }catch(error){const code=Number(error?.code||error?.cause?.code),http=Number(error?.status||error?.statusCode||error?.httpStatus);
      const quota=[4006,3036,402].includes(code)||http===402||/(?:^|\D)(?:4006|3036)(?:\D|$)/.test(error?.message||'');
      stopped=Object.assign(Error(quota?'ai_quota_exceeded':http===429?'ai_http_429':safeError(error)),
        {httpStatus:Number.isInteger(http)&&http>=100&&http<=599?http:null});throw stopped;
    }finally{clearTimeout(timer);}
  }};
}
