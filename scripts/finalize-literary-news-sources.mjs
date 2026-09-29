import { readFile, writeFile } from 'node:fs/promises';
import { checkedProbeSourceId } from './lib/literary-news-probe-patterns.mjs';
import { LITERARY_NEWS_SOURCES } from './lib/literary-news-sources.mjs';
import { promotedNewsSourceEndpoint, serializeNewsSourceCode } from './lib/literary-news-source-promotion.mjs';

const root='reports/r10/sources';
const candidates=JSON.parse(await readFile('data/news/r10-source-candidates.json','utf8'));
const ipa=JSON.parse(await readFile(root+'/ipa-directory-discovery.json','utf8'));
const cenl=JSON.parse(await readFile(root+'/cenl-directory-details.json','utf8'));
const rejected={
  'pepa-com-ph':'Directory domain now exposes pigeon-trading articles; publishing organisation and literary relevance are not verified.',
  'rosman':'Selected sample is a toy launch without an evidenced book relation; needs a book-only news profile.',
  'lti-korea':'Probe detail headline is the site logo and excerpt is navigation; an exact press-article selector and stable identity are required.',
  'book-riot':'Selected sample is an affiliate shopping/deal promotion; a real literary news representative is required before profile admission.',
  'los-angeles-review-books':'Selected sample is a climate/travel essay without a demonstrated book news relation; needs a literature-specific profile.',
  'five-books':'Selected sample is a year/category book-list landing page rather than a separately identified article.',
  'literaturkritik':'Selected sample is a book/catalogue contents page with no demonstrated literary news article identity.',
  'doppiozero':'Selected sample is a mathematics/AI essay and the extracted headline is a loading placeholder; literary news relevance is not verified.',
  'afrocritik':'Selected sample is a film festival screening without an evidenced book/adaptation relation; needs a literary-only news profile.',
  'kent-literary-research':'The fetched sample is a staff research profile, not a demonstrated literary news event.',
  'eulac-org':'Sample is a scientific institutional research agenda; literary relevance not demonstrated.',
  'onb-ac-at':'Sample is a service/education centre landing page, not a demonstrated literary news item.',
  'nationallibrary-bg':'Sample concerns the music department anniversary; literary scope needs a narrower profile.',
  'rara-ee':'Sample is media literacy and misinformation; literary relevance not demonstrated.',
  'nb-no':'Sample is a crafts festival; literary relevance not demonstrated.',
  'bibnat-ro':'Sample is an administrative closure notice; excluded from literary agenda.',
  'nls-uk':'Sample is a library location page; excluded from literary agenda.',
  'vaticanlibrary-va':'Sample is a generic news landing page; detail identity not demonstrated.',
  'chinesepen-org':'Sample is a general political essay; literary news relevance not demonstrated.',
  'culture':'Sample is general theatre news; an explicit book/adaptation relation is required.',
  'jacana':'Feed includes a test title; profile held until content identity is repaired.',
  'galle-literary-festival':'Sample is a sponsor identity, not a literary news item.',
  'antares':'Sample is general print/advertising history; literary news relevance not demonstrated.',
  'polyandria':'Sample is a retail discount promotion; excluded from literary agenda.',
  'rsl':'Selected sample is a film-club discussion without an evidenced book relation; profile needs narrower selection.',
  'corpus':'Candidate headline is only a date; needs a source-specific headline selector before admission.',
};
const family=id=>['prh','prh-library','penguinrandomhousegrupoeditorial-com'].includes(id)?'penguin-random-house':['ast','corpus','eksmo'].includes(id)?'eksmo-ast':id;
const uncertainCountries=new Set(['penbelarus-org','pen-kurd-org','brittle-paper']);
const profiles=[];const records=[];const geography=new Map();
for(const c of candidates.candidates){
  checkedProbeSourceId(c.id);
  let r;try{r=JSON.parse(await readFile(root+'/'+c.id+'.json','utf8'));}catch{r={sourceId:c.id,status:'not_probed',reason:'No runtime evidence recorded.'};}
  c.sourceFamilyId=family(c.id);
  if(c.id==='netflix-book-adaptations'){c.discoveryEnabled=false;c.disabledReason='robots_disallowed';r.discoveryEnabled=false;r.disabledReason='robots_disallowed';await writeFile(root+'/'+c.id+'.json',JSON.stringify(r,null,2)+'\n');}
  const evidence={method:c.discovery.method,url:c.discovery.url,organisation:c.name,statement:'Organisation country is distinct from the country of each covered event.'};
  const ip=ipa.links.filter(x=>new URL(x.url).hostname.replace(/^www\./,'')===new URL(c.discovery.previousEntryUrl||c.entryUrl).hostname.replace(/^www\./,''));
  const ce=cenl.find(x=>x.url===c.discovery.url);
  if(ip.length){evidence.method='official_membership_directory';evidence.excerpt=ip.map(x=>x.context).sort((a,b)=>b.length-a.length)[0];}
  else if(ce){evidence.method='official_national_library_directory';evidence.excerpt=ce.label;}
  else if(c.discovery.url.includes('pen.org/the-pen-world')){evidence.method='official_PEN_centre_directory';evidence.excerpt=c.name;}
  else{evidence.method='official_organisation_identity';evidence.excerpt=c.name;}
  if(c.id==='asymptote'){evidence.url='https://www.asymptotejournal.com/about/';evidence.excerpt='Asymptote is incorporated in Singapore.';}
  if(uncertainCountries.has(c.id)){c.countryCodes=[];evidence.status='office_country_unconfirmed';evidence.statement='Literary constituency is recorded as coverage only; no office-country claim is made.';}
  else evidence.status='organisation_country';
  c.countryEvidence=evidence;
  geography.set(c.id,{sourceFamilyId:c.sourceFamilyId,countryCodes:c.countryCodes,coverageCountryCodes:c.coverageCountryCodes,countryEvidence:evidence});
  if(rejected[c.id]){
    r.technicalProbeStatus=r.technicalProbeStatus||r.status;r.status='editorial_profile_held';r.reason=rejected[c.id];
    await writeFile(root+'/'+c.id+'.json',JSON.stringify(r,null,2)+'\n');
  }
  c.status=r.status;c.probe={attemptedAt:r.attemptedAt||null,lastSuccessAt:r.status==='runtime_verified'?r.lastSuccessAt:null,reason:r.reason,report:root+'/'+c.id+'.json'};
  if(r.status==='runtime_verified'){
    const p={...promotedNewsSourceEndpoint(r.endpoint,r,LITERARY_NEWS_SOURCES),...geography.get(c.id)};
    p.sourceClass=c.sourceClass;
    p.evidenceReport=root+'/'+c.id+'.json';
    p.autoPublication=false;
    p.profileScope='Discovery only; source content cannot grant publication rights. Every item remains held pending factual and bilingual review.';
    p.refreshIntervalSeconds=['festival','awards'].includes(c.sourceClass)?21600:7200;
    profiles.push(p);
  }
  records.push({sourceId:c.id,name:c.name,countryCodes:c.countryCodes,coverageCountryCodes:c.coverageCountryCodes,sourceFamilyId:c.sourceFamilyId,sourceClass:c.sourceClass,status:r.status,reason:r.reason,endpoint:r.endpoint?.url||null,format:r.endpoint?.format||null,language:r.endpoint?.language||c.languageHint,finds:r.status==='runtime_verified'?r.candidateCount||0:0,ready:0,public:0,sample:r.status==='runtime_verified'?{url:r.sample.source.url,title:r.sample.title,detailHeadline:r.sample.detail.headline,sourcePublishedAt:r.sample.publishedAt||null,observedAt:r.sample.detail.accessedAt}:null,evidence:root+'/'+c.id+'.json'});
}
const serialize=serializeNewsSourceCode;
await writeFile('scripts/lib/literary-news-source-profiles.mjs','/** Code-owned destinations, promoted only after recorded bounded HTTP, runtime parser and item-detail probes. */\nexport const R10_SOURCE_PROFILES = [\n'+profiles.map(serialize).join(',\n')+'\n];\n\nexport const R10_SOURCE_GEOGRAPHY = '+JSON.stringify(Object.fromEntries(geography),null,2)+';\n');
await writeFile('data/news/r10-source-candidates.json',JSON.stringify(candidates,null,2)+'\n');
const counts={researchedCandidates:records.length,runtimeVerifiedEndpoints:profiles.length,verifiedSourceFamilies:new Set(profiles.map(x=>x.sourceFamilyId)).size,verifiedOrganisationCountries:[...new Set(profiles.flatMap(x=>x.countryCodes))].sort(),researchedOrganisationCountries:[...new Set(records.flatMap(x=>x.countryCodes))].sort(),languages:[...new Set(profiles.map(x=>x.language))].sort(),formats:Object.fromEntries(['rss','atom','html'].map(f=>[f,profiles.filter(x=>x.format===f).length])),finds:records.reduce((n,x)=>n+x.finds,0),ready:0,public:0};
const observedDates=candidates.candidates.map(c=>c.probe?.attemptedAt?.slice(0,10)).filter(Boolean).sort();
const summary={schemaVersion:1,generatedAt:new Date().toISOString(),observedPeriod:`${observedDates[0]} to ${observedDates.at(-1)}; no invented 7-day or 30-day history`,scope:'Local live source research and runtime parser probes; not a deployment or publication receipt.',counts,statusCounts:Object.fromEntries([...new Set(records.map(x=>x.status))].map(s=>[s,records.filter(x=>x.status===s).length])),records};
await writeFile(root+'/coverage.json',JSON.stringify(summary,null,2)+'\n');
await writeFile(root+'/README.md','# R10 source research\n\n'+`Investigated ${counts.researchedCandidates} real candidate organisations/endpoints. ${counts.runtimeVerifiedEndpoints} profiles passed a bounded HTTP fetch, the actual discovery parser and a separately fetched literary detail sample; ${counts.verifiedSourceFamilies} source families; ${counts.verifiedOrganisationCountries.length} organisation countries. Geography reflects organisation identity, never an author's nationality or an event location. Office country remains empty for uncertain/exiled organisations.\n\n`+'The candidate registry is not a runtime allowlist. Only the reviewed JavaScript profiles are imported by the collector. Existing source identities remain in the registry when their latest probe fails; no public records are withdrawn by this change. RSS endpoints are discovered in real link tags, not guessed. Empty RSS/challenge pages do not count. Seasonal or old sample articles prove availability, not freshness.\n\n'+`Observed finds: ${counts.finds}. Ready: 0; public: 0 for this source-only audit. This is not a claim about the separately prepared content batch. Individual reports contain response hashes, times, errors, extracted facts and a sample item. Full response bodies are temporary local parser inputs in .tmp and are not published.\n\n`+'For the complete source/country/language/category and find → ready → public map, read coverage.json. Causes of blocking remain in the candidate registry and individual reports. No 30-day yield is claimed.\n');
console.log(JSON.stringify(counts,null,2));
