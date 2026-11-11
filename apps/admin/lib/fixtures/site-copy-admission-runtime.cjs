const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {createRequire} = require('node:module');
const repo = process.env.SITE_COPY_ADMISSION_REPO || path.resolve(__dirname, '../../../..');
const sourceRoot = process.env.SITE_COPY_ADMISSION_SOURCE_ROOT || repo;
const output = process.env.SITE_COPY_ADMISSION_OUTPUT_ROOT || fs.mkdtempSync(path.join(path.resolve(repo, '../work'), 'site-copy-admission-current-'));
fs.mkdirSync(output, {recursive: true});
const native = createRequire(path.join(repo, 'package.json')), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const initialSources=new Map(['apps/admin/lib/fixtures/site-copy-admission-runtime.cjs','apps/admin/lib/fixtures/site-copy-admission-cases.cjs',
  'apps/admin/lib/site-copy-admission.integration.test.ts','apps/admin/lib/site-copy-translation-operation-rpc.integration.test.ts',
  'apps/admin/lib/site-copy-translation-candidate-freshness-rpc.integration.test.ts','apps/admin/lib/fixtures/site-copy-translation-operation-native-goldens.json']
  .filter(file=>fs.existsSync(path.join(sourceRoot,file))).map(file=>[file,fs.readFileSync(path.join(sourceRoot,file))]));
const supportFile = 'apps/admin/lib/fixtures/site-copy-machine-review.cjs';
const supportBytes = fs.readFileSync(path.join(sourceRoot, supportFile)), source = supportBytes.toString('utf8');
const cut = source.indexOf('\nasync function main()'); assert.ok(cut > 0);
const fixtureEnv = {env: {SITE_COPY_REPO: repo, SITE_COPY_SOURCE_ROOT: sourceRoot, SITE_COPY_OUTPUT_ROOT: path.join(output, 'sources')}};
const base = new Function('require', '__dirname', '__filename', 'process', source.slice(0, cut) +
  '\nreturn {fixture,graph,actorId,blockId,key,englishText,canonicalEnglish,russianText};')(
  native, path.join(sourceRoot, 'apps/admin/lib/fixtures'), path.join(sourceRoot, supportFile), fixtureEnv);
base.graph.set(supportFile, {file: supportFile, sha256: sha(supportBytes)});

function createSiteCopyAdmissionRuntime(options = {}) {
  const view = base.fixture(options), requests = [], original = view.ai.run.bind(view.ai);
  let exposed;
  const clock = {now: Date.parse('2026-10-30T12:00:00.000Z')};
  options.now ||= () => clock.now;
  view.ai.run = async (model, input) => {
    const content = JSON.parse(input.messages[1].content);
    const pass = content.INVALID_DRAFT_TRANSLATION ? 'repair' : content.DRAFT_TRANSLATION ? 'review' : 'translation';
    const record = {model, pass, request: structuredClone(input), source: structuredClone(content.SOURCE_DATA)};
    requests.push(record);
    let value = await original(model, input);
    if (options.invalidPasses?.includes(requests.length)) value = {...value, response: JSON.stringify({items: content.SOURCE_DATA.items.map(item => ({key: item.key, text: 'Неверный русский ответ'}))})};
    await options.onProvider?.({view: exposed, call: record, number: requests.length, value, clock});
    if (options.unknownFirst && requests.length === 1) {const error = new Error('Controlled accepted synthetic response delivery lost'); error.name = 'TimeoutError'; throw error;}
    return value;
  };
  const env = () => view.loaded.load('apps/admin/lib/env.ts').adminEnv;
  const candidate = () => structuredClone(view.privateDraft);
  const snapshot = () => ({canonical: view.snapshot(), builds: structuredClone(view.builds), writes: structuredClone(view.mutations)});
  async function batchForm(values = {}) {
    const form=new FormData();for(const [key,value] of Object.entries(values))form.set(key,String(value));
    const {isRedirectError}=native('next/dist/client/components/redirect-error'),{getURLFromRedirectError}=native('next/dist/client/components/redirect');
    const wireStart=view.wire.length;
    try{await view.loaded.load('apps/admin/app/(dashboard)/translations/actions.ts').translatePremiumSiteCopyBatchAction(form);throw new Error('Actual action must redirect');}
    catch(error){assert.equal(isRedirectError(error),true,error.stack);const url=new URL(getURLFromRedirectError(error),'https://admin.fixture.invalid');
      return {form:Object.fromEntries(form),url:url.href,params:Object.fromEntries(url.searchParams),wire:structuredClone(view.wire.slice(wireStart))};}
  }
  exposed = {...view, get privateDraft() {return view.privateDraft;}, requests, clock, graph: base.graph,
    actorId: base.actorId, blockId: base.blockId, key: base.key, englishText: base.englishText,
    canonicalEnglish: base.canonicalEnglish, russianText: base.russianText, env, candidate, stateSnapshot: snapshot, batchForm,
    helper: extra => view.invoke(extra),
    stopNewExpense() {env().openAiAutoTranslateSiteCopy = false; env().openAiPremiumTranslationReview = false; env().cloudflareTranslationModel = 'changed-current-model'; options.gateOff = true;},
    missingSource() {view.setRow(null); options.firstReadIssue = 'unavailable'; options.latestReadIssue = 'unavailable';},
    recreateSource() {const row = view.snapshot(); row.id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'; row.updated_at = '2026-10-30T13:00:00.123457+00:00'; view.setRow(row);},
    changeSourceItems(count = 1) {
      const row = view.snapshot(); row.settings.siteCopy.ru = {}; row.settings.siteCopy.en = {}; row.settings.premiumTranslation.siteCopyEn = {};
      for (let index = 0; index < count; index++) row.settings.siteCopy.ru[`interface.Ключ${String(index).padStart(3,'0')}`] = `  Русский текст ${index}\r\n\u2014 исходник  `;
      view.setRow(row); return row;
    },
  };
  return exposed;
}
function sourceBindings() {
  for (const [file,bytes] of initialSources) {
    assert.equal(sha(fs.readFileSync(path.join(sourceRoot,file))),sha(bytes),`Source changed during actual execution: ${file}`);
    base.graph.set(file,{file,sha256:sha(bytes)});
  }
  return [...base.graph.values()].map(row => {
    const bytes = fs.readFileSync(path.join(sourceRoot, row.file)); assert.equal(sha(bytes), row.sha256, `Actual executed source drift: ${row.file}`);
    const destination=path.join(output,'captured-current',row.file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
    return {...row, bytes: bytes.length};
  });
}
module.exports = {createSiteCopyAdmissionRuntime, sourceBindings, repo, sourceRoot, output, base};
