// Isolated ArticleEditor component regression; no auth/DB/production/network.
// node apps/admin/tests/browser/article-form-browser.mjs --label=final --source-root=current
// --source-root=.tmp/m02-article-form-baseline-source selects recorded baseline copies.
import {createHash} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(directory,"../../../..");
const admin=path.join(root,"apps/admin");const require=createRequire(import.meta.url);
const {build}=require("esbuild"),{chromium}=require("playwright");
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const item=/^--([a-z-]+)=(.+)$/u.exec(value);if(!item||!["label","source-root","cases","chrome"].includes(item[1]))throw new Error("Invalid argument");return[item[1],item[2]];}));
const label=args.label||"current",sourceRoot=args["source-root"]||"current";
if(!/^[a-z0-9-]+$/u.test(label))throw new Error("Invalid label");
if(sourceRoot!=="current"&&(path.isAbsolute(sourceRoot)||sourceRoot.split(/[\\/]/u).includes("..")))throw new Error("Snapshot must remain inside checkout");
if(sourceRoot!=="current"&&!existsSync(path.join(root,sourceRoot,"manifest.json")))throw new Error("Recorded source manifest is unavailable");
await mkdir(path.join(root,".tmp"),{recursive:true});
const executablePath=args.chrome||"C:/Program Files/Google/Chrome/Application/chrome.exe";
if(!existsSync(executablePath))throw new Error("Installed Chrome unavailable; specify --chrome=<installed executable>. No installation is performed");
const prefix=path.join(root,`.tmp/m02-article-form-${label}`),fingerprints=new Map();
const virtual={
  "next/link":'import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children)}',
  "next/navigation":'export {unstable_rethrow} from "next/dist/client/components/unstable-rethrow.browser";const router={refresh(){window.__articleFormHarness.refreshCalls+=1}};export function useRouter(){return router}',
  "next/dynamic":'import React from "react";export default function dynamic(loader,options={}){const Component=React.lazy(async()=>{const loaded=await loader();return{default:loaded.default||loaded}});return function DynamicFixture(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props))}}',
  "@/app/(dashboard)/articles/actions":'export async function saveArticleAction(data){return window.__articleFormHarness.saveArticleAction(data)}export async function checkArticleOperationAction(){throw new Error("Lookup is unused in this fixture")}',
  "@/app/(dashboard)/articles/template-actions":'export async function saveEditorTemplateAction(input){return window.__articleFormHarness.templateBoundary("save",input)}export async function deleteEditorTemplateAction(id){return window.__articleFormHarness.templateBoundary("delete",id)}',
  "@/app/(dashboard)/editor-links/actions":'export async function searchEditorInternalLinksAction(){throw new Error("Unused search is outside the fixture")}',
  "@/app/(dashboard)/editor-autosave/actions":'export async function loadLatestEditorAutosaveAction(locator){return window.__articleFormHarness.autosaveBoundary("load",locator)}export async function saveEditorAutosaveAction(input){return window.__articleFormHarness.autosaveBoundary("save",input)}export async function deleteExactEditorAutosaveAction(input){return window.__articleFormHarness.autosaveBoundary("delete",input)}',
};
const bundle=await build({absWorkingDir:root,entryPoints:[path.join(directory,"fixtures/article-form-entry.jsx")],bundle:true,write:false,platform:"browser",format:"iife",target:"chrome120",jsx:"automatic",
  define:{"process.env.NODE_ENV":'"development"',"process.env.ADMIN_BASE_PATH":'"/admin"'},plugins:[{name:"isolated-article-boundaries",setup(builder){
    builder.onResolve({filter:/.*/},request=>{
      if(Object.hasOwn(virtual,request.path))return{path:request.path,namespace:"article-mock"};
      if(/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path))return{path:require.resolve("next/dist/compiled/"+request.path)};
      if(/@supabase|(?:^|\/)server-only$|\/lib\/auth(?:\.|\/)|\/lib\/supabase\/|^node:/u.test(request.path))throw new Error("Provider/server import is forbidden: "+request.path);
      if(request.path.startsWith("@/")){const target=path.join(admin,request.path.slice(2));const actual=[target,target+".ts",target+".tsx",target+".js"].find(existsSync);if(!actual)throw new Error("Unresolved import: "+request.path);return{path:actual};}
    });
    builder.onLoad({filter:/.*/,namespace:"article-mock"},request=>({contents:virtual[request.path],loader:"js",resolveDir:root}));
    builder.onLoad({filter:/\.[jt]sx?$/},async request=>{
      if(!request.path.startsWith(admin+path.sep))return;
      const relative=path.relative(admin,request.path),override=sourceRoot!=="current"?path.join(root,sourceRoot,relative):"";
      const actual=override&&existsSync(override)?override:request.path,contents=await readFile(actual,"utf8");
      if(/^["']use server["'];/u.test(contents.trimStart()))throw new Error("Unmocked server action module: "+relative);
      fingerprints.set(relative.replaceAll("\\","/"),{source:path.relative(root,actual).replaceAll("\\","/"),sha256:createHash("sha256").update(contents).digest("hex")});
      return{contents,loader:request.path.endsWith("tsx")?"tsx":request.path.endsWith("jsx")?"jsx":request.path.endsWith("ts")?"ts":"js"};
    });
    builder.onLoad({filter:/\.css$/},()=>({contents:"export default {}",loader:"js"}));
  }}]});
const code=bundle.outputFiles[0].text;await writeFile(prefix+"-bundle.js",code);
const loaderFile=fingerprints.get("components/ArticleEditorLoader.tsx");
const legacyArticleLoaderApi=/export default function ArticleEditorLoader\(props: ArticleEditorProps\)/u.test(await readFile(path.join(root,loaderFile.source),"utf8"));
const server=http.createServer((request,response)=>{if(request.url==="/bundle.js"){response.writeHead(200,{"Content-Type":"text/javascript"});return response.end(code)}if(request.url==="/favicon.ico"){response.writeHead(204);return response.end()}
  if(request.url?.endsWith(".svg")){response.writeHead(200,{"Content-Type":"image/svg+xml"});return response.end('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="white"/></svg>')}
  response.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});response.end('<!doctype html><meta charset="utf-8"><style>body{font-family:Arial;margin:16px}.ProseMirror{border:1px solid #888;padding:10px;min-height:60px}input,button{margin:4px}</style><div id="root"></div><script src="/bundle.js"></script>');});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const origin="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true,executablePath}),results=[],externalRequests=[];
const scenarios=["transport-bilingual","known-refusal-retry","known-refusal-local-write","unknown-result","pending-double-submit","local-getter","local-getitem","local-setitem","session-getter","session-setitem","native-redirect","native-not-found","restore-valid","restore-read-throw","spoofed-save-confirmed","template-backup-failure","template-save-transport","template-save-local-write","template-clear-unknown","template-clear-local-remove","template-malformed-shape"];
scenarios.push("read-retain","read-ready-revision","read-initial-null","read-cross-article","read-new-copy-isolation","read-copy-spelling","read-retry-modifiers","read-missing-selected-category");
scenarios.push(...["partial-v2","metadata-only","corrupt-json-ru","corrupt-json-en","unknown-node-ru","unknown-node-en","unknown-attr-ru","unknown-attr-en","corrupt-field","missing-version","full","full-empty","legacy-full","legacy-ru-only"].flatMap(kind=>["recovery-local-"+kind,"recovery-server-"+kind]),"recovery-local-null","recovery-local-array","recovery-local-serialized-invalid","recovery-server-discard");
const selected=args.cases==="recovery"?scenarios.filter(item=>item.startsWith("recovery-")):args.cases?args.cases.split(","):scenarios;if(selected.some(item=>!scenarios.includes(item)))throw new Error("Unknown scenario");
const ruTitle="Синтетический длинный русский заголовок",enTitle="Synthetic revised English title";
const ruText=Array.from({length:55},(_,i)=>`Синтетический русский абзац ${i+1}: точный введённый автором текст. `).join("");
const enText=Array.from({length:55},(_,i)=>`Synthetic English paragraph ${i+1}: retain exact author input. `).join("");
try{for(const scenario of selected){
  const context=await browser.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"}),errors=[],consoleErrors=[],assertions=[];
  const assert=(name,pass,details)=>assertions.push({name,pass:Boolean(pass),...(details===undefined?{}:{details})});
  await context.route("**/*",route=>{const url=route.request().url();if(url.startsWith(origin+"/"))return route.continue();externalRequests.push({scenario,url});return route.abort("blockedbyclient")});
  await context.addInitScript(({scenario,legacyArticleLoaderApi})=>{
    const h=window.__articleFormHarness={scenario,legacyArticleLoaderApi,refreshCalls:0,calls:[],autosaveCalls:[],templateCalls:[],storageFaults:[],componentErrors:[],restoreReadFault:false,
      saveArticleAction(formData){h.calls.push({data:Object.fromEntries(formData.entries()),state:"pending"});return new Promise((resolve,reject)=>{h.pendingResolve=resolve;h.pendingReject=reject})},
      settle(outcome){if(!h.pendingReject)throw new Error("No verified pending action");h.calls[h.calls.length-1].state=typeof outcome==="string"?outcome:outcome?.outcome;
        if(outcome==="transport")return h.pendingReject(new TypeError("SAFE_SYNTHETIC_ARTICLE_TRANSPORT"));
        if(outcome==="native-redirect"||outcome==="native-not-found"){const error=new Error("SAFE_SYNTHETIC_NATIVE_SIGNAL");error.digest=outcome==="native-redirect"?"NEXT_REDIRECT;replace;/articles/synthetic;303;":"NEXT_HTTP_ERROR_FALLBACK;404";return h.pendingReject(error)}const operationId=h.calls[h.calls.length-1].data.article_operation_id;return h.pendingResolve(outcome&&typeof outcome==="object"&&operationId?{...outcome,operationId}:outcome)},
      autosaveBoundary(kind,input){h.autosaveCalls.push({kind,input});return kind==="load"?{ok:true,recovery:scenario.startsWith("recovery-server-")?h.serverRecovery:null}:kind==="delete"?{ok:true}:{ok:false,error:"SAFE_SYNTHETIC_AUTOSAVE_UNAVAILABLE"}},
      templateBoundary(kind,input){h.templateCalls.push({kind,input});if(kind==="save"){if(scenario==="template-save-transport")throw new TypeError("SAFE_SYNTHETIC_TEMPLATE_TRANSPORT");return{template:{id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",label:input.label,html:input.html,json:input.json,canDelete:true,visibility:input.visibility}}}
        if(scenario==="template-clear-unknown"&&input.startsWith("cccc"))throw new TypeError("SAFE_SYNTHETIC_TEMPLATE_DELETE_TRANSPORT");return{ok:true}},
    };
    window.fetch=async()=>{throw new Error("Network disabled in isolated article fixture")};window.confirm=()=>true;window.prompt=()=>"Synthetic saved template";window.alert=message=>{h.alerts??=[];h.alerts.push(message)};
    let fault=scenario;if(["known-refusal-local-write","template-backup-failure","template-save-local-write"].includes(scenario))fault="local-setitem";
    const fail=kind=>{h.storageFaults.push(kind);throw new DOMException("SAFE_SYNTHETIC_STORAGE_UNAVAILABLE","SecurityError")};
    if(fault==="local-getter")Object.defineProperty(window,"localStorage",{configurable:true,get(){return fail(fault)}});
    if(fault==="session-getter")Object.defineProperty(window,"sessionStorage",{configurable:true,get(){return fail(fault)}});
    const local=fault!=="local-getter"?window.localStorage:null,session=fault!=="session-getter"?window.sessionStorage:null;
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
    if(scenario==="template-malformed-shape")set.call(local,"probpera-editor-custom-templates",JSON.stringify([{id:"x",label:123,html:"<p>Synthetic malformed template</p>"}]));
    if(scenario==="template-clear-local-remove")set.call(local,"probpera-editor-custom-templates",JSON.stringify([{id:"synthetic-local",label:"Synthetic local template",html:"<p>Synthetic local body</p>"}]));
    h.readBackups=()=>({local:get.call(local,"probpera-editor-66666666-6666-4666-8666-666666666666"),pending:get.call(session,"probpera-editor-pending-save-key"),autosave:get.call(session,"probpera-editor-autosave:article:66666666-6666-4666-8666-666666666666:bilingual:pending-canonical-save")});
    h.readLegacyTemplates=()=>get.call(local,"probpera-editor-custom-templates");
    Storage.prototype.getItem=function(key){if(fault==="local-getitem"&&this===local&&String(key).startsWith("probpera-editor"))return fail(fault);if(h.restoreReadFault&&this===local&&String(key).startsWith("probpera-editor-666"))return fail("restore-getitem");return get.call(this,key)};
    Storage.prototype.setItem=function(key,value){if(fault==="local-setitem"&&this===local&&String(key).startsWith("probpera-editor"))return fail(fault);if(fault==="session-setitem"&&this===session&&String(key).startsWith("probpera-editor"))return fail(fault);return set.call(this,key,value)};
    Storage.prototype.removeItem=function(key){if(scenario==="template-clear-local-remove"&&this===local&&key==="probpera-editor-custom-templates")return fail("local-removeitem");return remove.call(this,key)};
  },{scenario,legacyArticleLoaderApi});
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on("pageerror",error=>errors.push({name:error.name,message:error.message}));page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text().slice(0,700))});
  const state=()=>page.evaluate(()=>{const val=name=>document.querySelector(`input[name="${name}"]`)?.value;const text=document.body.innerText;return{ruTitle:val("title"),enTitle:val("english_title"),ruJson:val("content_json"),enJson:val("english_content_json"),dirty:text.includes("изменения ещё не отправлены в редакционную базу")||text.includes("изменения в форме ещё не подтверждены"),text,boundary:!!document.querySelector("[data-harness-error-boundary]"),calls:window.__articleFormHarness.calls}});
  const fillDraft=async()=>{await page.getByRole("textbox",{name:"Заголовок",exact:true}).fill(ruTitle);await page.locator('.ProseMirror[contenteditable="true"]').fill(ruText);
    await page.waitForFunction(()=>document.querySelector('input[name="content_json"]')?.value.includes("абзац 55"));
    await page.getByRole("button",{name:"EN · необязательный перевод",exact:true}).click();await page.getByRole("textbox",{name:"Заголовок английской версии",exact:true}).fill(enTitle);await page.locator('.ProseMirror[contenteditable="true"]').fill(enText);
    await page.waitForFunction(()=>document.querySelector('input[name="english_content_json"]')?.value.includes("paragraph 55"));};
  const retained=data=>data.ruTitle===ruTitle&&data.enTitle===enTitle&&JSON.parse(data.ruJson||"{}").content?.[0]?.content?.[0]?.text===ruText&&JSON.parse(data.enJson||"{}").content?.[0]?.content?.[0]?.text===enText;
  try{
    if(scenario==="pending-double-submit"||scenario==="read-copy-spelling"||scenario.startsWith("recovery-"))await page.clock.install();
    await page.goto(origin,{waitUntil:"load",timeout:20000});await page.waitForFunction(()=>window.__articleFormHarness.bundleLoaded,{timeout:10000});await page.waitForTimeout(120);
    if(scenario.startsWith("read-")&&scenario!=="read-initial-null")await page.waitForSelector('.ProseMirror[contenteditable="true"]',{timeout:5000});
    const mounted=await page.locator('.ProseMirror[contenteditable="true"]').count()===1;assert("actual ArticleEditor mounts despite storage faults",mounted);
    if(mounted&&scenario.startsWith("recovery-")){
      await page.clock.pauseAt(new Date(Date.now()+50));
      const server=scenario.startsWith("recovery-server-");
      await page.getByRole("textbox",{name:"Заголовок",exact:true}).fill("Ручной несохранённый RU заголовок");
      await page.locator('.ProseMirror[contenteditable="true"]').press("Control+Home");await page.keyboard.insertText("Ручной несохранённый RU ввод. ");
      await page.getByRole("button",{name:"EN · необязательный перевод",exact:true}).click();await page.getByRole("textbox",{name:"Заголовок английской версии",exact:true}).fill("Manual unsaved EN title");
      await page.locator('.ProseMirror[contenteditable="true"]').press("Control+Home");await page.keyboard.insertText("Manual unsaved EN input. ");
      if(!server)await page.getByRole("button",{name:"RU · авторский оригинал",exact:true}).click();
      const capture=()=>page.evaluate(()=>{
        const h=window.__articleFormHarness,form=document.querySelector("form"),data=form?Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,typeof value==="string"?value:{name:value.name,size:value.size,type:value.type}])):null;
        return {form:data,editableHtml:document.querySelector('.ProseMirror[contenteditable="true"]')?.innerHTML,editableText:document.querySelector('.ProseMirror[contenteditable="true"]')?.innerText,
          visibleTitle:document.querySelector("input.editor-title")?.value,dirty:document.body.innerText.includes("изменения в форме ещё не подтверждены"),
          localCopy:localStorage.getItem("probpera-editor-66666666-6666-4666-8666-666666666666"),serverPanel:!!document.querySelector(".editor-recovery-panel"),
          feedback:[...document.querySelectorAll('[role="alert"],.editor-autosave-status')].map(element=>element.innerText),alerts:h.alerts||[]};
      });
      const complete=scenario.endsWith("-full")&&!scenario.endsWith("legacy-full"),empty=scenario.endsWith("full-empty"),legacyRu=scenario.endsWith("legacy-ru-only"),legacy=scenario.endsWith("legacy-full")||legacyRu,accepted=complete||empty||legacy;
      const before=await capture();
      assert("recovery fixture starts complete bilingual text, metadata, media rights and CAS",!!before.form&&before.form.content_json.includes("Manual ru permission")&&before.form.english_content_json.includes("Manual en permission")&&before.form.sources==="Synthetic source RU"&&before.form.english_sources==="Synthetic source EN"&&before.form.category_id==="88888888-8888-4888-8888-888888888888"&&before.form.expected_updated_at==="2026-09-30T16:00:00.123456+00:00"&&before.form.english_expected_updated_at==="2026-09-30T16:00:00.654321+00:00"&&before.form.working_draft_version==="2",{form:before.form});
      await page.getByRole("button",{name:server?"Восстановить в редактор":"Восстановить локальную копию",exact:true}).click();await page.waitForTimeout(80);const after=await capture();
      await page.evaluate(({before,after})=>{window.__articleFormHarness.recoveryObservations={before,after}}, {before,after});
      const tokens=data=>["expected_updated_at","english_expected_updated_at","working_draft_version","id","previous_status"].map(name=>[name,data.form?.[name]]);
      assert("recovery never replaces canonical article/CAS/draft identity",JSON.stringify(tokens(after))===JSON.stringify(tokens(before)),{before:tokens(before),after:tokens(after)});
      if(accepted){
        if(empty){assert("intentional empty full snapshot restores explicit empty author fields",after.form.title===""&&after.form.english_title===""&&after.form.sources===""&&after.form.english_sources===""&&after.form.category_id===""&&after.form.cover_external_url===""&&!after.form.content_json.includes("исходный русский текст")&&!after.form.english_content_json.includes("original English text"));}
        else{
          assert("validated full copy restores exact author body and titles",after.form.title==="Синтетический восстановленный заголовок"&&after.form.content_html.includes("Синтетический восстановленный русский текст")&&(legacyRu?after.form.english_title===before.form.english_title&&after.form.english_content_html===before.form.english_content_html:after.form.english_title==="Synthetic recovered English title"&&after.form.english_content_html.includes("Synthetic recovered English text")));
          if(complete)assert("full v2 restores both media rights, sources, covers and manual metadata",after.form.content_json.includes("Manual ru permission")&&after.form.english_content_json.includes("Manual en permission")&&after.form.sources==="Synthetic recovered source RU"&&after.form.english_sources==="Synthetic recovered source EN"&&after.form.cover_external_url.endsWith("/recovered-cover.svg")&&after.form.seo_title==="Ручное RU SEO"&&after.form.english_seo_title==="Manual English SEO"&&!after.form.allow_indexing);
          if(legacy)assert("older full HTML-only copy preserves unspecified metadata, links, cover and sources",after.form.category_id===before.form.category_id&&after.form.cover_external_url===before.form.cover_external_url&&after.form.sources===before.form.sources&&after.form.english_sources===before.form.english_sources&&after.form.seo_title===before.form.seo_title&&after.form.english_seo_title===before.form.english_seo_title);
          // Accepted setContent may update Placeholder extension decorations;
          // require exact document/text/locale/title rather than decoration HTML.
          if(legacyRu)assert("older RU-only full copy preserves exact English document and active English editor",after.form.english_content_json===before.form.english_content_json&&(!server||after.editableText===before.editableText&&after.form.preview_locale==="en"&&after.visibleTitle===before.visibleTitle));
        }
        assert("accepted recovered copy is dirty and leaves no server recovery panel",after.dirty&&(!server||!after.serverPanel));
      }else{
        assert("incomplete/corrupt recovery retains every exact RU/EN submitted field",JSON.stringify(after.form)===JSON.stringify(before.form),{before:before.form,after:after.form});
        assert("refused recovery retains active editor DOM, locale and dirty state",after.editableHtml===before.editableHtml&&after.visibleTitle===before.visibleTitle&&after.dirty===before.dirty,{beforeHtml:before.editableHtml,afterHtml:after.editableHtml,beforeDirty:before.dirty,afterDirty:after.dirty});
        assert("refused recovery retains original backup without automatic delete",after.localCopy===before.localCopy&&(!server||after.serverPanel)&&await page.evaluate(()=>window.__articleFormHarness.autosaveCalls.filter(call=>call.kind==="delete").length)===0);
        assert("refused recovery gives visible safe feedback without false loaded success",JSON.stringify(after.feedback)!==JSON.stringify(before.feedback)&&!after.feedback.some(value=>value.includes("Автокопия загружена в редактор")),{before:before.feedback,after:after.feedback,alerts:after.alerts});
      }
      if(scenario==="recovery-server-discard"){
        const immediatelyBeforeDiscard=await capture();await page.getByRole("button",{name:"Удалить автокопию",exact:true}).click();await page.waitForTimeout(80);const discarded=await capture();
        const deletes=await page.evaluate(()=>window.__articleFormHarness.autosaveCalls.filter(call=>call.kind==="delete"));
        assert("explicit discard deletes only exact stored receipt and hides panel",deletes.length===1&&JSON.stringify(deletes[0].input)===JSON.stringify({id:"99999999-9999-4999-8999-999999999999",clientSessionId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",sequence:12,snapshotHash:"c".repeat(64)})&&!discarded.serverPanel,{deletes});
        assert("explicit discard preserves complete author input, rights, sources and CAS",JSON.stringify(discarded.form)===JSON.stringify(immediatelyBeforeDiscard.form)&&discarded.editableHtml===immediatelyBeforeDiscard.editableHtml);
      }
      await page.evaluate(({before,after})=>{window.__articleFormHarness.recoveryObservations={before,after}}, {before,after});
    }else if(scenario==="read-initial-null"){
      assertions.pop();assert("initial unavailable bundle never opens an empty editor",!mounted&&await page.locator('[data-harness-read-unavailable]').count()===1);
      await page.evaluate(()=>window.__articleFormHarness.updateRead(true));await page.waitForSelector('.ProseMirror[contenteditable="true"]');assert("verified first bundle opens original bilingual content",(await state()).ruTitle==="Синтетическая исходная статья"&&(await state()).enTitle==="Synthetic original English article");
    }else if(mounted&&scenario.startsWith("read-")){
      await fillDraft();assert("read-boundary fixture typed both actual editors",retained(await state()));
      const tokens=()=>page.evaluate(()=>{const val=name=>document.querySelector(`[name="${name}"]`)?.value;return{ru:val("expected_updated_at"),en:val("english_expected_updated_at"),draft:val("working_draft_version"),category:val("category_id"),cover:val("cover_external_url"),canonical:val("canonical_url"),englishCanonical:val("english_canonical_url"),previousStatus:val("previous_status")}});
      const key="article:66666666-6666-4666-8666-666666666666";
      if(scenario==="read-missing-selected-category"){
        const originalCategory="88888888-8888-4888-8888-888888888888";
        const selected=()=>page.evaluate(()=>({value:document.querySelector('select[name="category_id"]')?.value,formData:new FormData(document.querySelector("form")).get("category_id")}));
        assert("unlisted initial selected category remains in actual DOM and FormData",(await selected()).value===originalCategory&&(await selected()).formData===originalCategory);
        await page.getByRole("button",{name:"Сохранить черновик",exact:true}).click();await page.waitForFunction(()=>window.__articleFormHarness.calls.length===1,{timeout:4000});const sent=(await state()).calls[0].data;
        assert("real action preserves initial category omitted from visible catalog",sent.category_id===originalCategory&&sent.content_json===(await state()).ruJson&&sent.english_content_json===(await state()).enJson,{categorySent:sent.category_id});
        await page.evaluate(()=>window.__articleFormHarness.settle({outcome:"rejected",reason:"validation"}));await page.waitForTimeout(100);
        await page.locator('select[name="category_id"]').selectOption("");assert("explicit user removal still emits empty category",(await selected()).value===""&&(await selected()).formData==="");
      }else if(scenario==="read-retain"||scenario==="read-ready-revision"){
        await page.getByRole("button",{name:"RU · авторский оригинал",exact:true}).click();await page.locator('select[name="category_id"]').selectOption("12121212-1212-4212-8212-121212121212");
        await page.locator('input[name="cover_external_url"]').fill(origin+"/synthetic-cover.svg");await page.waitForTimeout(150);
        const original=await tokens();
        if(scenario==="read-retain"){
          await page.evaluate(key=>window.__articleFormHarness.updateRead(false,key),key);await page.waitForTimeout(120);
          assert("failed same-identity reread retains exact dirty RU and EN",retained(await state())&&(await state()).dirty);
          assert("read failure keeps category/media and original tokens",JSON.stringify(await tokens())===JSON.stringify(original));
          const saves=page.locator('button[type="submit"]');assert("all visible submit intents disabled while bundle unavailable",await saves.count()===5&&(await saves.evaluateAll(buttons=>buttons.every(button=>button.disabled))));
          assert("actual workspace availability closes under read failure",await page.evaluate(()=>window.__articleFormHarness.workspaceSnapshot?.canSave===false&&window.__articleFormHarness.workspaceSnapshot?.canPreview===false&&window.__articleFormHarness.workspaceSnapshot?.canPublish===false));
          if(await page.locator("form").count())await page.locator("form").evaluate(form=>form.requestSubmit());await page.evaluate(()=>window.__articleFormHarness.workspaceActions?.save());await page.waitForTimeout(100);assert("native and actual workspace submit do not call action on unread bundle",(await state()).calls.length===0);
        }
        await page.evaluate(key=>window.__articleFormHarness.updateRead(true,key,true),key);await page.waitForSelector('.ProseMirror[contenteditable="true"]');await page.waitForTimeout(150);
        assert("successful same-identity reread retains bilingual edits",retained(await state())&&(await state()).dirty);
        assert("fresh revisions/catalog do not rebase original CAS/draft/category/media/canonical",JSON.stringify(await tokens())===JSON.stringify(original),{original,after:await tokens()});
        await page.getByRole("button",{name:"Сохранить черновик",exact:true}).click();await page.waitForFunction(()=>window.__articleFormHarness.calls.length===1,{timeout:4000});const data=(await state()).calls[0].data;
        assert("real action after reread submits original versions and selected category/media",data.expected_updated_at===original.ru&&data.english_expected_updated_at===original.en&&data.working_draft_version===original.draft&&data.category_id===original.category&&data.cover_external_url===original.cover&&data.canonical_url===original.canonical&&data.english_canonical_url===original.englishCanonical&&data.content_json===(await state()).ruJson&&data.english_content_json===(await state()).enJson);
        await page.evaluate(()=>window.__articleFormHarness.settle({outcome:"rejected",reason:"validation"}));
      }else if(scenario==="read-cross-article"||scenario==="read-new-copy-isolation"){
        const targets=scenario==="read-cross-article"?["article:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]:["new","copy:dddddddd-dddd-4ddd-8ddd-dddddddddddd","copy:ffffffff-ffff-4fff-8fff-ffffffffffff"];
        for(const nextKey of targets){await page.evaluate(nextKey=>window.__articleFormHarness.updateRead(false,nextKey),nextKey);await page.waitForTimeout(100);assert("different identity has no cached form: "+nextKey,await page.locator('.ProseMirror[contenteditable="true"]').count()===0&&!(await state()).text.includes(ruText));
          await page.evaluate(nextKey=>window.__articleFormHarness.updateRead(true,nextKey),nextKey);await page.waitForSelector('.ProseMirror[contenteditable="true"]');const fresh=await state();assert("verified different identity starts own original bilingual input: "+nextKey,fresh.ruTitle!==ruTitle&&fresh.enTitle!==enTitle&&!fresh.ruJson.includes("абзац 55")&&!fresh.enJson.includes("paragraph 55"));}
      }else if(scenario==="read-copy-spelling"){
        await page.clock.runFor(1100);const localKeys=()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith("probpera-editor-draft-")).sort());const originalKeys=await localKeys();assert("copy fixture really persists its scoped draft",originalKeys.length>0);
        await page.evaluate(()=>window.__articleFormHarness.updateRead(true,"copy:dddddddd-dddd-4ddd-8ddd-dddddddddddd",true,"dddddddd-dddd-4ddd-8ddd-dddddddddddd"));await page.clock.runFor(1100);assert("same normalized copy identity keeps original draft scope and input",retained(await state())&&JSON.stringify(await localKeys())===JSON.stringify(originalKeys),{originalKeys,after:await localKeys()});
      }else{
        await page.evaluate(key=>window.__articleFormHarness.updateRead(false,key),key);await page.waitForTimeout(100);
        if(await page.locator("form").count()){
          const modifierResult=await page.getByRole("link",{name:"Synthetic article retry",exact:true}).evaluate(anchor=>{const cases=[{ctrlKey:true},{metaKey:true},{shiftKey:true},{button:1}];return cases.map(options=>{const event=new MouseEvent("click",{bubbles:true,cancelable:true,...options});let prevented=false;const original=Event.prototype.preventDefault;event.preventDefault=function(){prevented=true;return original.call(this)};
            // The real React handler runs at the root before this document
            // listener. Cancel only the fixture's default navigation after
            // observing whether the actual handler intercepted the event.
            const preventFixtureNavigation=received=>{if(received===event)original.call(received)};document.addEventListener("click",preventFixtureNavigation);anchor.dispatchEvent(event);document.removeEventListener("click",preventFixtureNavigation);return prevented})});
          assert("modified/middle retry remains native to browser handler",modifierResult.every(value=>value===false)&&await page.evaluate(()=>window.__articleFormHarness.refreshCalls)===0);
          await page.getByRole("link",{name:"Synthetic article retry",exact:true}).click();assert("ordinary retry uses refresh without leaving dirty form",await page.evaluate(()=>window.__articleFormHarness.refreshCalls)===1&&retained(await state()));
        }else assert("same-identity failed retry still has its mounted editor",false);
      }
    }else if(mounted&&scenario==="template-malformed-shape"){
      assert("malformed legacy template shape does not erase stored data",await page.evaluate(()=>window.__articleFormHarness.readLegacyTemplates())===JSON.stringify([{id:"x",label:123,html:"<p>Synthetic malformed template</p>"}]));
    }else if(mounted&&scenario==="spoofed-save-confirmed"){
      const copies=await page.evaluate(()=>window.__articleFormHarness.readBackups());assert("untrusted save flag preserves canonical local backup",typeof copies.local==="string");assert("untrusted save flag preserves pending markers",typeof copies.pending==="string"&&typeof copies.autosave==="string");
      assert("untrusted save flag never deletes server autosave",await page.evaluate(()=>window.__articleFormHarness.autosaveCalls.filter(call=>call.kind==="delete").length)===0);
    }else if(mounted&&scenario.startsWith("restore-")){
      const before=await state();if(scenario==="restore-read-throw")await page.evaluate(()=>{window.__articleFormHarness.restoreReadFault=true});
      await page.getByRole("button",{name:"Восстановить локальную копию",exact:true}).click();await page.waitForTimeout(100);const after=await state();
      if(scenario==="restore-valid"){assert("valid recovery restores RU and EN exact stored bodies",after.ruTitle==="Синтетический восстановленный заголовок"&&after.enTitle==="Synthetic recovered English title"&&after.ruJson.includes("восстановленный русский текст")&&after.enJson.includes("Synthetic recovered English text"));assert("restored draft remains dirty",after.dirty)}
      else assert("failed recovery read preserves original form and shows feedback",after.ruJson===before.ruJson&&after.enJson===before.enJson&&after.text!==before.text);
    }else if(mounted){
      await fillDraft();const before=await state();assert("actual typing retains long RU and EN snapshots",retained(before)&&before.dirty);
      if(scenario.startsWith("template-")){
        await page.getByRole("button",{name:"RU · авторский оригинал",exact:true}).click();await page.locator("details.editor-template-bar > summary").click();
        if(scenario==="template-backup-failure")await page.getByRole("button",{name:/Мнение о книге/u}).click();
        else if(scenario.startsWith("template-save-"))await page.getByRole("button",{name:/Сохранить как шаблон/u}).click();
        else await page.getByRole("button",{name:"Удалить мои шаблоны",exact:true}).click();
        await page.waitForTimeout(150);const after=await state();assert("template operation retains mounted exact author text",!after.boundary&&retained(after)&&after.dirty);
        if(scenario==="template-backup-failure")assert("failed template backup reports safe refusal",after.text.includes("Не удалось")||after.text.includes("недоступ"));
        if(scenario==="template-save-transport")assert("unknown template save reports safe state",after.text.includes("Не удалось подтвердить сохранение шаблона"));
        if(scenario==="template-save-local-write")assert("acknowledged template save survives local write failure",after.text.includes("Шаблон сохранён в редакционной базе")&&await page.getByRole("button",{name:/Synthetic saved template/u}).count()===1);
        if(scenario==="template-clear-unknown")assert("only confirmed template deletion removes its item",await page.getByRole("button",{name:/Synthetic acknowledged template/u}).count()===0&&await page.getByRole("button",{name:/Synthetic uncertain template/u}).count()===1);
        if(scenario==="template-clear-local-remove")assert("failed local template cleanup retains local item",await page.getByRole("button",{name:/Synthetic local template/u}).count()===1);
      }else{
        await page.getByRole("button",{name:"Сохранить черновик",exact:true}).click();await page.waitForFunction(()=>window.__articleFormHarness.calls.length>=1,{timeout:4000});
        const sent=(await state()).calls[0].data;assert("real React19 function action receives both locales and exact versions",sent.title===ruTitle&&sent.english_title===enTitle&&sent.content_json===before.ruJson&&sent.english_content_json===before.enJson&&sent.intent==="save"&&sent.expected_updated_at==="2026-09-30T16:00:00.123456+00:00"&&sent.english_expected_updated_at==="2026-09-30T16:00:00.654321+00:00");
        if(scenario==="pending-double-submit"){
          const unload=()=>page.evaluate(()=>{const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented});assert("pending save protects unload before15seconds",await unload());
          await page.clock.runFor(16000);await page.locator("form").evaluate(form=>form.requestSubmit());await page.waitForTimeout(100);assert("unresolved action beyond15seconds blocks duplicate requestSubmit",(await state()).calls.length===1);assert("pending save still protects unload after15seconds",await unload());assert("pending request keeps both locales unchanged",retained(await state()));
        }else{
          const native=scenario.startsWith("native-"),known=scenario.startsWith("known-refusal");const outcome=native?scenario:known?{outcome:"rejected",reason:"validation"}:scenario==="unknown-result"?{outcome:"unknown-outcome"}:"transport";
          await page.evaluate(outcome=>window.__articleFormHarness.settle(outcome),outcome);await page.waitForTimeout(150);const after=await state();
          if(native)assert("native signal digest escapes unchanged",await page.evaluate(scenario=>window.__articleFormHarness.componentErrors[0]?.digest===(scenario==="native-redirect"?"NEXT_REDIRECT;replace;/articles/synthetic;303;":"NEXT_HTTP_ERROR_FALLBACK;404"),scenario));
          else{assert("ordinary refusal/transport retains mounted exact RU and EN draft",!after.boundary&&retained(after)&&after.dirty);const save=page.getByRole("button",{name:"Сохранить черновик",exact:true});
            assert("action outcome has explicit safe feedback",known?after.text.includes("Сохранение не выполнено"):after.text.includes("Не удалось подтвердить результат сохранения"));
            assert("known refusal is retryable and unknown outcome blocks blind retry",await save.count()===1&&await save.isDisabled()===!known);
            if(known&&await save.count()){await save.click();await page.waitForFunction(()=>window.__articleFormHarness.calls.length===2,{timeout:4000});const retry=(await state()).calls[1].data;assert("actual second submit after known refusal retains both locales and intent",retry.title===sent.title&&retry.english_title===sent.english_title&&retry.content_json===sent.content_json&&retry.english_content_json===sent.english_content_json&&retry.intent===sent.intent);await page.evaluate(()=>window.__articleFormHarness.settle({outcome:"rejected",reason:"validation"}));await page.waitForTimeout(80)}
          }
        }
      }
    }
  }catch(error){assert("fixture completes its real browser assertions",false,{name:error.name,message:error.message})}
  const observed=await page.evaluate(()=>{const h=window.__articleFormHarness;return{reactVersion:h.reactVersion,calls:h.calls,autosaveCalls:h.autosaveCalls,templateCalls:h.templateCalls,storageFaults:h.storageFaults,componentErrors:h.componentErrors,refreshCalls:h.refreshCalls,workspaceSnapshot:h.workspaceSnapshot||null,recoveryFixture:h.recoveryFixture||null,recoveryObservations:h.recoveryObservations||null}}).catch(()=>null);
  if(!scenario.startsWith("native-"))assert("ordinary failures do not escape as browser/component errors",errors.length===0&&observed?.componentErrors.length===0);
  const fault=["known-refusal-local-write","template-backup-failure","template-save-local-write"].includes(scenario)?"local-setitem":scenario==="restore-read-throw"?"restore-getitem":scenario==="template-clear-local-remove"?"local-removeitem":/^(local|session)-(getter|getitem|setitem)$/u.test(scenario)?scenario:null;
  if(fault)assert("requested storage fault actually executes",observed?.storageFaults.includes(fault));
  if(assertions.some(item=>!item.pass))await page.screenshot({path:prefix+"-"+scenario+".png"});
  const result={scenario,status:assertions.every(item=>item.pass)?"PASS":"FAIL",assertions,state:observed,errors,consoleErrors:consoleErrors.slice(0,5)};results.push(result);
  console.log(JSON.stringify({scenario,status:result.status,failures:assertions.filter(item=>!item.pass).map(item=>item.name),verifiedActionCalls:observed?.calls.length,verifiedTemplateCalls:observed?.templateCalls.length}));await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
const evidence={checkedAt:new Date().toISOString(),label,sourceRoot,level:"isolated real ArticleEditor browser/component integration",authenticatedDatabaseE2E:false,sourceFingerprint:Object.fromEntries(fingerprints),runnerSha256:createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).digest("hex"),
  realDependencies:["ArticleEditor/ArticleEditorShell and child panels","ArticleEditorLoader and ArticleEditorWorkspaceProvider/context","TipTap and client node views","current RecoveryController metadata adapter","installed headless Chrome","Next compiled React19/ReactDOM","native unstable_rethrow when imported by actual component"],
  mockedDependencies:["saveArticleAction","template save/delete actions","three autosave actions","NextLink routing","next/dynamic implemented with React.lazy/Suspense and actual ArticleEditor","useRouter refresh spy","unused internal link search","browser network disabled","synthetic confirmation/prompt dialogs"],
  loaderFixtureComposition:legacyArticleLoaderApi?"Actual old caller composition: current ? legacy ArticleEditorLoader(current props) : fallback":"Actual ArticleEditorLoader with stable editorKey/current boundary props",
  limitations:["No actual Next action serialization/router/Flight","Modifier dispatch observes actual handler before fixture cancels native navigation; not a real new-tab navigation test","No real auth/RPC/DB/RLS/publishing","New preflight refusal DTO mock is approved contract, not an assertion that legacy action returned it","Only saved baseline files overridden; other transitive imports current","Synthetic RU/EN content only"],externalRequests,results};
await writeFile(prefix+"-evidence.json",JSON.stringify(evidence,null,2)+"\n");const passed=results.filter(item=>item.status==="PASS").length;console.log(JSON.stringify({label,cases:results.length,passed,failed:results.length-passed,evidence:path.relative(root,prefix+"-evidence.json")}));process.exitCode=passed===results.length&&externalRequests.length===0?0:1;
