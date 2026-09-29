import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPublicNewsAddress } from "./literary-news-safe-fetch.mjs";
import { NEWS_MEDIA_LIMITS } from "./literary-news-media.mjs";

import { checkedVkNewsUploadUrl } from "./literary-news-media-upload-policy.mjs";
export { checkedVkNewsUploadUrl } from "./literary-news-media-upload-policy.mjs";

export function createPinnedVkNewsUpload({ lookupImpl = lookup, requestImpl = request } = {}) {
  return async (input, form, { signal: externalSignal } = {}) => {
    const url = checkedVkNewsUploadUrl(input);
    const signal = externalSignal ? AbortSignal.any([externalSignal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
    signal.throwIfAborted();
    // Encode only the prepared bounded file; never send bot/user credentials to an upload host.
    const encoded = new Request("https://upload.invalid", { method:"POST",body:form });
    const bytes = Buffer.from(await encoded.arrayBuffer());
    if (bytes.length > NEWS_MEDIA_LIMITS.outputBytes + 16384) throw new Error("vk_upload_body_too_large");
    const answers = await new Promise((resolve,reject)=> {
      const abort=()=>reject(new Error("vk_upload_aborted"));
      signal.addEventListener("abort",abort,{once:true});
      Promise.resolve().then(()=>lookupImpl(url.hostname,{all:true})).then(resolve,reject)
        .finally(()=>signal.removeEventListener("abort",abort));
      if(signal.aborted) abort();
    });
    signal.throwIfAborted();
    if (!Array.isArray(answers) || !answers.length || answers.some((row)=>!isPublicNewsAddress(row?.address)
      || isIP(row.address)!==row.family)) throw new Error("vk_upload_address_rejected");
    return new Promise((resolve,reject)=> {
      const req = requestImpl(url,{method:"POST",agent:false,signal,servername:url.hostname,rejectUnauthorized:true,maxHeaderSize:16384,
        lookup(host,options,callback) {
          if(host!==url.hostname) return callback(new Error("vk_upload_address_rejected"));
          const family=typeof options==="number"?options:options?.family;
          const matches=answers.filter((row)=>!family||row.family===family);
          if(!matches.length) return callback(new Error("vk_upload_address_rejected"));
          if(options?.all) callback(null,matches.map(({address,family})=>({address,family})));
          else callback(null,matches[0].address,matches[0].family);
        },headers:{Host:url.host,"Content-Type":encoded.headers.get("content-type"),"Content-Length":bytes.length,"Accept-Encoding":"identity"}},incoming=> {
        if([401,403,429].includes(incoming.statusCode) || incoming.statusCode>=500) {
          const status=incoming.statusCode,headers={};
          if(incoming.headers["retry-after"])headers["Retry-After"]=incoming.headers["retry-after"];
          incoming.destroy();resolve(new Response(null,{status,headers}));return;
        }
        if(incoming.statusCode!==200 || incoming.headers["content-encoding"] && incoming.headers["content-encoding"]!=="identity"
          || Number(incoming.headers["content-length"])>262144) { incoming.destroy(); reject(new Error("vk_upload_reply_rejected")); return; }
        const chunks=[];let length=0;
        incoming.on("data",chunk=> {length+=chunk.length;if(length>262144) incoming.destroy(new Error("vk_upload_reply_too_large"));else chunks.push(chunk);});
        incoming.once("error",reject);
        incoming.once("end",()=>resolve(new Response(Buffer.concat(chunks),{status:200,headers:{"Content-Type":"application/json"}})));
      });
      req.once("error",reject); req.end(bytes);
    });
  };
}
export const uploadPinnedVkNewsPhoto = createPinnedVkNewsUpload();
