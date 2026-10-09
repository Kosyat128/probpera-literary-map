import React from "react";
import { createRoot } from "react-dom/client";
import ArticleEditor from "@/components/ArticleEditor";
import ArticleEditorLoader from "@/components/ArticleEditorLoader";
import {ArticleEditorWorkspaceProvider,useArticleEditorWorkspace} from "@/components/ArticleEditorContext";
import { pendingArticleSaveValue, PENDING_ARTICLE_SAVE_KEY } from "@/lib/article-recovery";

const harness = window.__articleFormHarness;
const id = "66666666-6666-4666-8666-666666666666";
const doc = text => ({type:"doc",content:[{type:"paragraph",content:[{type:"text",text}]}]});
const article = { id, updated_at:"2026-09-30T16:00:00.123456+00:00", working_draft_version:2,
  title:"Синтетическая исходная статья", slug:"synthetic-article", category_id:"88888888-8888-4888-8888-888888888888", status:"draft",
  content_html:"<p>Синтетический исходный русский текст.</p>", content_json:doc("Синтетический исходный русский текст."),
  excerpt:"Синтетическое описание статьи.", sources:["Synthetic source RU"], bibliography:["Synthetic bibliography RU"], allow_indexing:true };
const englishTranslation = {id:"77777777-7777-4777-8777-777777777777",article_id:id,locale:"en",updated_at:"2026-09-30T16:00:00.654321+00:00",
  title:"Synthetic original English article",slug:"synthetic-article-en",status:"draft",source_article_updated_at:article.updated_at,
  content_html:"<p>Synthetic original English text.</p>",content_json:doc("Synthetic original English text."),
  excerpt:"Synthetic English excerpt.",sources:["Synthetic source EN"],bibliography:["Synthetic bibliography EN"]};
const stored = {version:2,activeLocale:"ru",title:"Синтетический восстановленный заголовок",subtitle:"Восстановленный подзаголовок",excerpt:"Ручное восстановленное описание",slug:"synthetic-recovered",slugEdited:true,
  categoryId:article.category_id,status:"draft",scheduledAt:"",featured:false,showOnHomepage:true,pinned:false,contentHtml:"<p>Синтетический восстановленный русский текст.</p>",
  contentJson:JSON.stringify(doc("Синтетический восстановленный русский текст.")),coverUrl:"",coverAlt:"",seoTitle:"Ручное RU SEO",seoDescription:"Ручное RU SEO описание",seoKeywords:"RU manual",canonicalUrl:"https://public.invalid/recovered",canonicalEdited:true,ogTitle:"Ручное RU OG",ogDescription:"Ручное RU OG описание",
  sourceText:"Synthetic recovered source RU",bibliographyText:"Synthetic recovered bibliography RU",legacyPath:"/recovered-legacy",allowIndexing:false,russianSourceChanged:false,
  english:{enabled:true,title:"Synthetic recovered English title",subtitle:"Synthetic recovered English subtitle",excerpt:"Synthetic recovered English excerpt",slug:"synthetic-recovered-en",slugEdited:true,status:"draft",
    contentHtml:"<p>Synthetic recovered English text.</p>",contentJson:JSON.stringify(doc("Synthetic recovered English text.")),coverAlt:"",seoTitle:"Manual English SEO",seoDescription:"Manual English SEO description",seoKeywords:"EN manual",canonicalUrl:"https://public.invalid/en/recovered",canonicalEdited:true,ogTitle:"Manual English OG",ogDescription:"Manual English OG description",
    sourceText:"Synthetic recovered source EN",bibliographyText:"Synthetic recovered bibliography EN",confirmedCurrentSource:false}};
if(harness.scenario.startsWith("recovery-")) {
  const richDoc=(text,locale,recovered=false)=>({type:"doc",content:[...doc(text).content,{type:"image",attrs:{
    src:`/${recovered?"recovered":"original"}-${locale}.svg`,alt:`Manual ${locale} alt`,title:`Manual ${locale} title`,caption:`Manual ${locale} caption`,
    credit:`Manual ${locale} author`,source:`https://sources.invalid/${locale}`,license:`Manual ${locale} permission`,licenseUrl:`https://rights.invalid/${locale}`,mediaId:`${locale}-media-preserved`,
    layout:"wide",focusX:0.35,focusY:0.65,link:"",lightbox:true,decorative:false}}]});
  article.content_json=richDoc("Синтетический исходный русский текст.","ru");
  englishTranslation.content_json=richDoc("Synthetic original English text.","en");
  Object.assign(article,{subtitle:"Ручной исходный подзаголовок",cover_external_url:"/initial-cover.svg",cover_alt:"Ручная подпись обложки",seo_title:"Ручной исходный RU SEO",seo_description:"Ручное исходное RU SEO описание",seo_keywords:["manual RU"],og_title:"Ручной исходный RU OG",og_description:"Ручное исходное RU OG описание",canonical_url:"https://public.invalid/original",legacy_path:"/original-legacy",featured:true,pinned:true,allow_indexing:false});
  Object.assign(englishTranslation,{subtitle:"Manual original English subtitle",cover_alt:"Manual English cover alt",seo_title:"Manual original English SEO",seo_description:"Manual original English SEO description",seo_keywords:["manual EN"],og_title:"Manual original English OG",og_description:"Manual original English OG description",canonical_url:"https://public.invalid/en/original"});
  const full=JSON.parse(JSON.stringify(stored));
  full.contentJson=JSON.stringify(richDoc("Синтетический восстановленный русский текст.","ru",true));
  full.english.contentJson=JSON.stringify(richDoc("Synthetic recovered English text.","en",true));
  full.coverUrl="/recovered-cover.svg";full.coverAlt="Ручная восстановленная подпись обложки";full.english.coverAlt="Manual recovered English cover alt";
  let recovery=full;
  if(harness.scenario.endsWith("partial-v2"))recovery={version:2,title:"Неполная RU копия",contentHtml:"<p>Неполный русский текст</p>",contentJson:JSON.stringify(doc("Неполный русский текст"))};
  if(harness.scenario.endsWith("metadata-only")||harness.scenario.endsWith("discard"))recovery={version:2,activeLocale:"en",seoTitle:"Неполные метаданные",english:{seoTitle:"Incomplete English metadata"}};
  if(harness.scenario.endsWith("corrupt-json-ru"))recovery.contentJson='{"type":"doc","content":';
  if(harness.scenario.endsWith("corrupt-json-en"))recovery.english.contentJson='{"type":"doc","content":';
  if(harness.scenario.endsWith("unknown-node-ru"))recovery.contentJson=JSON.stringify({type:"doc",content:[{type:"unknownSavedNode",content:[{type:"text",text:"Synthetic unsupported content"}]}]});
  if(harness.scenario.endsWith("unknown-node-en"))recovery.english.contentJson=JSON.stringify({type:"doc",content:[{type:"unknownSavedNode",content:[{type:"text",text:"Synthetic unsupported content"}]}]});
  if(harness.scenario.endsWith("unknown-attr-ru")){const value=JSON.parse(recovery.contentJson);value.content[1].attrs.unrecognizedSavedRights="Do not strip this value";recovery.contentJson=JSON.stringify(value)}
  if(harness.scenario.endsWith("unknown-attr-en")){const value=JSON.parse(recovery.english.contentJson);value.content[1].attrs.unrecognizedSavedRights="Do not strip this value";recovery.english.contentJson=JSON.stringify(value)}
  if(harness.scenario.endsWith("corrupt-field"))recovery.sourceText=["Synthetic wrong type source"];
  if(harness.scenario.endsWith("missing-version"))delete recovery.version;
  if(harness.scenario.endsWith("null"))recovery=null;
  if(harness.scenario.endsWith("array"))recovery=[];
  if(harness.scenario.endsWith("legacy-full"))recovery={title:full.title,slug:full.slug,contentHtml:full.contentHtml,english:{enabled:true,title:full.english.title,subtitle:full.english.subtitle,excerpt:full.english.excerpt,slug:full.english.slug,contentHtml:full.english.contentHtml}};
  if(harness.scenario.endsWith("legacy-ru-only"))recovery={title:full.title,slug:full.slug,contentHtml:full.contentHtml};
  if(harness.scenario.endsWith("full-empty")){
    for(const key of Object.keys(recovery))if(typeof recovery[key]==="string")recovery[key]="";
    for(const key of Object.keys(recovery.english))if(typeof recovery.english[key]==="string")recovery.english[key]="";
    recovery.activeLocale="ru";recovery.status="draft";recovery.contentJson=JSON.stringify({type:"doc",content:[]});recovery.english.status="draft";recovery.english.contentJson=JSON.stringify({type:"doc",content:[]});
  }
  const serialized=harness.scenario.endsWith("serialized-invalid")?'{"version":2,':JSON.stringify(recovery);
  harness.recoveryFixture={snapshot:recovery,serialized,complete:full};
  harness.serverRecovery={id:"99999999-9999-4999-8999-999999999999",clientSessionId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",sequence:12,snapshotHash:"c".repeat(64),state:"saved",updatedAt:article.updated_at,baseUpdatedAt:article.updated_at,expiresAt:"2026-10-01T16:00:00+00:00",snapshot:recovery};
  if(harness.scenario.startsWith("recovery-local-"))window.localStorage.setItem(`probpera-editor-${id}`,serialized);
}
if(harness.scenario.startsWith("restore-")||harness.scenario==="spoofed-save-confirmed") {
  const key=`probpera-editor-${id}`;
  window.localStorage.setItem(key,JSON.stringify(stored));
  if(harness.scenario==="spoofed-save-confirmed") {
    window.sessionStorage.setItem(PENDING_ARTICLE_SAVE_KEY,pendingArticleSaveValue(key,stored));
    window.sessionStorage.setItem(`probpera-editor-autosave:article:${id}:bilingual:pending-canonical-save`,JSON.stringify({
      id:"99999999-9999-4999-8999-999999999999",clientSessionId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",sequence:1,
      snapshotHash:"a".repeat(64),state:"saved",updatedAt:article.updated_at,baseUpdatedAt:article.updated_at,expiresAt:"2026-10-01T16:00:00+00:00"}));
  }
}
class Boundary extends React.Component {
  state={error:null};static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error){harness.componentErrors.push({name:error.name,message:error.message,digest:error.digest||null});}
  render(){return this.state.error?<p data-harness-error-boundary="true">Synthetic fixture caught an unhandled error.</p>:this.props.children;}
}
const templates=harness.scenario.startsWith("template-clear-")||harness.scenario==="template-malformed-shape"?[
  {id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",label:"Synthetic acknowledged template",html:"<p>Synthetic template one</p>",canDelete:true},
  {id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",label:"Synthetic uncertain template",html:"<p>Synthetic template two</p>",canDelete:true},
]:[];
const categoryTwo={id:"12121212-1212-4212-8212-121212121212",name:"Синтетическая вторая категория",slug:"synthetic-two"};
function readProps(editorKey, refreshed=false, copySpelling) {
  const existing=editorKey.startsWith("article:");
  const articleId=existing?editorKey.slice(8):undefined;
  const translated={...englishTranslation,article_id:articleId,id:existing?englishTranslation.id:undefined,
    updated_at:existing?(refreshed?"2026-09-30T17:00:00.999999+00:00":englishTranslation.updated_at):undefined,
    source_content_hash:refreshed?"b".repeat(64):"a".repeat(64)};
  return {article:{...article,id:articleId,updated_at:existing?(refreshed?"2026-09-30T17:00:00.888888+00:00":article.updated_at):undefined,
    working_draft_version:existing?(refreshed?9:2):0,cover_external_url:refreshed?window.location.origin+"/reread-cover.svg":null,
    title:articleId&&articleId!==id?"Синтетическая другая исходная статья":article.title},
    englishTranslation:translated,categories:refreshed||harness.scenario==="read-missing-selected-category"?[]:[{id:article.category_id,name:"Синтетическая категория",slug:"synthetic"},categoryTwo],
    publicSiteUrl:"https://public.invalid",draftKey:editorKey.startsWith("copy:")?"copy-"+(copySpelling||editorKey.slice(5)):undefined,
    canPublish:true,canOverridePublicationChecklist:true};
}
function ReadHarness() {
  const initialKey=harness.scenario==="read-copy-spelling"?"copy:dddddddd-dddd-4ddd-8ddd-dddddddddddd":`article:${id}`;
  const [editorKey,setEditorKey]=React.useState(initialKey);
  const [current,setCurrent]=React.useState(harness.scenario==="read-initial-null"?null:readProps(initialKey,false,
    harness.scenario==="read-copy-spelling"?"DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD":undefined));
  harness.updateRead=(available,nextKey=initialKey,refreshed=false,copySpelling)=>{
    setEditorKey(nextKey);setCurrent(available?readProps(nextKey,refreshed,copySpelling):null);
  };
  const retryHref="/articles/synthetic?read-retry=1";
  const fallback=<p data-harness-read-unavailable="true">Synthetic article read unavailable. <a href={retryHref}>Synthetic article retry</a></p>;
  // Match the actual old route's conditional composition, without sending the
  // new boundary DTO into a legacy ArticleEditorProps component.
  return harness.legacyArticleLoaderApi?current?<ArticleEditorLoader {...current}/>:fallback:
    <ArticleEditorLoader editorKey={editorKey} current={current} fallback={fallback} retryHref={retryHref}
      before={<p data-harness-read-before="true">Synthetic verified before.</p>} after={<p data-harness-read-after="true">Synthetic verified after.</p>}/>;
}
function WorkspaceObserver(){const workspace=useArticleEditorWorkspace();harness.workspaceSnapshot=workspace?.snapshot||null;harness.workspaceActions=workspace?.actions||null;return null;}
harness.reactVersion=React.version;
createRoot(document.getElementById("root")).render(<Boundary>{harness.scenario.startsWith("read-")?<ArticleEditorWorkspaceProvider><ReadHarness/><WorkspaceObserver/></ArticleEditorWorkspaceProvider>:<ArticleEditor article={article} englishTranslation={englishTranslation}
  categories={[{id:article.category_id,name:"Синтетическая категория",slug:"synthetic"}]} publicSiteUrl="https://public.invalid" templates={templates}
  saveConfirmed={harness.scenario==="spoofed-save-confirmed"} canPublish={false}/>}</Boundary>);
harness.bundleLoaded=true;
