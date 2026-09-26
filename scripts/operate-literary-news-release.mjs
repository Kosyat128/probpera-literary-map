import { mkdir,readFile,writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchPublishedAgenda } from "./publish-literary-news.mjs";
import { createNewsRuntimeStore } from "./lib/literary-news-social.mjs";
import { createNewsSocialTransport } from "./lib/literary-news-social-transport.mjs";
import { prepareRegisteredNewsMedia } from "./lib/literary-news-media.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";
import { NEWS_RELEASE_ACTIONS,NEWS_RELEASE_DESTINATIONS,operateNewsRelease,recheckNewsPublicHistory,verifyTelegramCanaryPublicPost } from "./lib/literary-news-release-operator.mjs";

export function parseNewsReleaseArguments(args) {
  const allowed=new Set(["action","platform","repository-sha","expected-control-id","history-sha256","canary-news-id","payload-sha256",
    "expected-canary-remote-id","native-observation-url","native-viewed"]),values={};
  if(args.length%2)throw new Error("operator_arguments_invalid");
  for(let i=0;i<args.length;i+=2){const name=args[i].slice(2);
    if(!args[i].startsWith("--") || !allowed.has(name) || name in values || args[i+1].startsWith("--"))throw new Error("operator_arguments_invalid");
    values[name]=args[i+1];}
  if(!NEWS_RELEASE_ACTIONS.includes(values.action) || !NEWS_RELEASE_DESTINATIONS[values.platform]
    || !/^[a-f0-9]{40}$/.test(values["repository-sha"]||"")
    || !/^(0|[1-9]\d{0,14})$/.test(values["expected-control-id"]||"0"))throw new Error("operator_arguments_invalid");
  return {action:values.action,platform:values.platform,repositorySha:values["repository-sha"],
    expectedControlId:Number(values["expected-control-id"]||0)||null,historyDigest:values["history-sha256"],
    canaryNewsId:values["canary-news-id"],payloadSha256:values["payload-sha256"],nativeObservation:{
      remoteId:values["expected-canary-remote-id"],url:values["native-observation-url"],viewed:values["native-viewed"]==="true"}};
}
export async function runNewsReleaseOperator({args=process.argv.slice(2),env=process.env,fetchImpl=fetch}={}) {
  const options=parseNewsReleaseArguments(args);
  if(!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("runtime_storage_not_configured");
  const supabase=createClient(trustedSupabaseOrigin(env.SUPABASE_URL),env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const registry=JSON.parse(await readFile(new URL("../data/news/social-release-approvals.json",import.meta.url),"utf8"));
  if(registry.schemaVersion!==1 || !Array.isArray(registry.approvals)
    || registry.approvals.filter(row=>row.platform===options.platform).length>1)throw new Error("release_registry_invalid");
  const approval=registry.approvals.find(row=>row.platform===options.platform);
  const destination=NEWS_RELEASE_DESTINATIONS[options.platform];
  const feed=options.action==="pause"?null:await fetchPublishedAgenda(fetchImpl);
  if(options.action!=="pause")await prepareRegisteredNewsMedia([destination]);
  const transport=createNewsSocialTransport({mode:options.action==="send-canary"?"live":"shadow",
    telegramToken:env.TELEGRAM_BOT_TOKEN,vkToken:env.VK_ACCESS_TOKEN,fetchImpl});
  return operateNewsRelease({...options,approval,feed,transport,store:createNewsRuntimeStore(supabase),
    verifyHead:args=>recheckNewsPublicHistory({...args,fetchImpl,vkToken:env.VK_ACCESS_TOKEN}),
    verifyNative:args=>verifyTelegramCanaryPublicPost({...args,fetchImpl}),
    operatorContext:{runId:env.GITHUB_RUN_ID||null,actor:env.GITHUB_ACTOR||null}});
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  let result;
  try{result=await runNewsReleaseOperator();}
  catch(error){result={status:"blocked",code:/^[a-z_]+$/.test(error?.message||"")?error.message:"release_operator_failed",delivered:null};process.exitCode=1;}
  await mkdir("news-runtime-operator",{recursive:true});
  await writeFile("news-runtime-operator/result.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
