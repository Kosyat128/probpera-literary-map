import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const origin = 'https://booky-journey-editor.test';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const catalog = { countries: [
  { id: 'country-a', label: { ru: 'Тестовая страна А', en: 'Synthetic country A' }, writers: [
    { id: 'writer-a', label: { ru: 'Тестовый писатель А', en: 'Synthetic writer A' }, works: [{ id: 'work-a', label: { ru: 'Тестовая книга А', en: 'Synthetic work A' } }] },
    { id: 'writer-b', label: { ru: 'Тестовый писатель Б', en: '' }, works: [{ id: 'work-b', label: { ru: 'Тестовая книга Б', en: 'Synthetic work B' } }] },
  ] },
  { id: 'country-b', label: { ru: 'Тестовая страна Б', en: 'Synthetic country B' }, writers: [
    { id: 'writer-c', label: { ru: 'Тестовый писатель В', en: 'Synthetic writer C' }, works: [{ id: 'work-c', label: { ru: 'Тестовая книга В', en: 'Synthetic work C' } }] },
  ] },
  { id: 'country-c', label: { ru: 'Тестовая страна В', en: 'Synthetic country C' }, writers: [
    { id: 'writer-d', label: { ru: 'Тестовый писатель Г', en: 'Synthetic writer D' }, works: [{ id: 'work-d', label: { ru: 'Тестовая книга Г', en: 'Synthetic work D' } }] },
  ] },
] };
const publicData = {
  publicCountries: catalog.countries.map(country => ({ id: country.id, name: country.label.ru,
    writers: country.writers.map(writer => ({ id: writer.id, name: writer.label.ru, fullName: writer.label.en })) })),
  publicBooks: [{ id: 'work-a', countryId: 'country-a', writerId: 'writer-a', editorial: { status: 'reviewed' },
    authorship: { kind: 'single', authors: [{ countryId: 'country-b', writerId: 'writer-c', attribution: 'credited' }] } }],
};
let fixture;
test.beforeAll(async () => {
  // Replace only the action import. Its fixture delegates normal validation to the actual semantic helper.
  const actionFixture = { name: 'booky-activity-action-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/app\/\(dashboard\)\/journeys\/actions$/ }, args => ({ path: args.path, namespace: 'booky-activity-action-fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'booky-activity-action-fixture' }, () => ({ loader: 'js', resolveDir: root, contents: `
      import {validateBookyJourneyDraftActivity} from ${JSON.stringify(path.join(root, 'apps/admin/lib/booky-journey-activity-validation.ts').replaceAll('\\', '/'))};
      const catalog=${JSON.stringify(catalog)}, publicData=${JSON.stringify(publicData)};
      window.__activityValidationCalls=[];
      export async function validateBookyJourneyDraftActivityAction(serialized) {
        const take=key=>{const value=Boolean(window[key]);window[key]=false;return value;};
        const hold=take('__activityHoldNext'), failSession=take('__activitySessionFailureNext'), failNetwork=take('__activityThrowNext');
        const wrongChecksum=take('__activityWrongChecksumNext'), stale=take('__activityStaleNext');
        const draft=JSON.parse(serialized), call={index:window.__activityValidationCalls.length,hold,failSession,failNetwork,wrongChecksum,stale,
          titleRu:draft.authoringSource.input.copy.ru.title,choices:draft.authoringSource.input.activity.choices,actualHelperCalled:false,completed:false};
        window.__activityValidationCalls.push(call);
        if(failNetwork){call.completed=true;call.stubbedFailure='network';throw new Error('Synthetic unavailable action transport');}
        if(failSession){call.completed=true;call.stubbedFailure='session';return {ok:false,errors:[{field:'activity.auth',message:'Не удалось подтвердить сессию редактора. Форма сохранена; проверку можно повторить.'}]};}
        const current=structuredClone(publicData);
        if(stale)current.publicBooks[0].authorship.authors=[{countryId:'country-c',writerId:'writer-d',attribution:'credited'}];
        const actual=validateBookyJourneyDraftActivity(serialized,catalog,current);
        call.actualHelperCalled=true;call.actualResult=structuredClone(actual);
        const reply=wrongChecksum&&actual.ok?{...actual,draftChecksum:'0'.repeat(64)}:actual;
        if(hold)await new Promise(resolve=>{window.__activityHeld={index:call.index,release:resolve};});
        call.completed=true;return reply;
      }
    ` }));
  } };
  const compiled = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {BookyJourneyDraftEditor} from './apps/admin/components/BookyJourneyDraftEditor';
      import './apps/admin/app/globals.css';
      createRoot(document.getElementById('root')).render(<BookyJourneyDraftEditor catalog={${JSON.stringify(catalog)}} />);`,
      loader: 'tsx', resolveDir: root },
    bundle: true, platform: 'browser', format: 'iife', target: 'es2020', write: false,
    outfile: 'editor.js', metafile: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [actionFixture],
  });
  const js = compiled.outputFiles.find(f => f.path.endsWith('.js'));
  const css = compiled.outputFiles.find(f => f.path.endsWith('.css'));
  expect(js).toBeTruthy(); expect(css).toBeTruthy();
  const sourceInputs = await Promise.all(Object.keys(compiled.metafile.inputs).filter(p => !p.startsWith('<') && !p.startsWith('booky-activity-action-fixture:') && !p.includes('node_modules/')).sort()
    .map(async p => ({ path: p.replaceAll('\\', '/'), sha256: sha(await fs.readFile(path.resolve(root, p))) })));
  fixture = { js: Buffer.from(js.contents), css: Buffer.from(css.contents), sourceInputs };
});

test('adult bilingual journey editor exports only a draft and clears dependent canonical selections', async ({ page }, testInfo) => {
  const errors = [], externalRequests = [], downloads = [], screenshots = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', value => downloads.push(value.suggestedFilename()));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.origin); return route.abort(); }
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/editor.css"></head><body><main id="root" style="padding:16px;max-width:1280px;margin:auto"></main><script src="/editor.js"></script></body></html>' });
    if (url.pathname === '/editor.js') return route.fulfill({ contentType: 'application/javascript', body: fixture.js });
    if (url.pathname === '/editor.css') return route.fulfill({ contentType: 'text/css', body: fixture.css });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(origin);
  const button = page.getByRole('button', { name: 'Скачать черновик JSON', exact: true });
  await expect(button).toBeVisible();
  if (await button.isEnabled()) await button.tap();
  expect(downloads).toEqual([]);
  const previewButton = page.getByRole('button', { name: 'Предпросмотр маршрута', exact: true });
  const preview = page.locator('[data-booky-journey-preview]');
  await previewButton.tap();
  await expect(preview).toHaveCount(0);
  for (const [label, value] of [
    ['Идентификатор маршрута', 'synthetic-journey'], ['Версия', '2'], ['Возраст от', '18'], ['Возраст до', '65'],
    ['Примерная длительность (мин)', '8'], ['Название маршрута (RU)', 'Тестовый маршрут'], ['Название маршрута (EN)', 'Synthetic journey'],
    ['Описание маршрута (RU)', 'Черновик для проверки редактора.'], ['Описание маршрута (EN)', 'A draft for testing the editor.'],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('Уровень чтения', { exact: true }).selectOption('plain');
  const country = page.getByLabel('Страна', { exact: true }), writer = page.getByLabel('Писатель', { exact: true }), work = page.getByLabel('Книга', { exact: true });
  await country.selectOption('country-a'); await writer.selectOption('writer-a'); await work.selectOption('work-a');
  await writer.selectOption('writer-b');
  await expect(work).toHaveValue('');
  await expect(work.locator('option[value="work-a"]')).toHaveCount(0);
  await work.selectOption('work-b');
  await expect(page.getByText('Английское название пока не подтверждено', { exact: false }).first()).toBeVisible();
  await previewButton.tap();
  await expect(preview.getByRole('note')).toContainText('Английское имя писателя пока не подтверждено.');
  await preview.getByRole('button', {name:'English',exact:true}).tap();
  await preview.getByRole('button', {name:'Следующий шаг',exact:true}).tap();
  await expect(preview.locator('[data-preview-step="writer"]')).toContainText('Английское название пока не подтверждено');
  await expect(preview.locator('[data-preview-step="writer"]')).not.toContainText('Тестовый писатель Б');
  await country.selectOption('country-b');
  await expect(preview).toHaveCount(0);
  await expect(writer).toHaveValue(''); await expect(work).toHaveValue('');
  await expect(writer.locator('option[value="writer-a"]')).toHaveCount(0);
  await country.selectOption('country-a'); await writer.selectOption('writer-a'); await work.selectOption('work-a');
  await page.evaluate(() => window.scrollTo(0, 0));
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await overflow()).toBe(false);
  async function capture(filename, scope) {
    const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
    screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  }
  await capture('booky-journey-editor-ru-320.png', 'Actual editor component with synthetic canonical choices; upper form at 320px.');
  await previewButton.tap();
  const previous=preview.getByRole('button',{name:'Предыдущий шаг',exact:true});
  const next=preview.getByRole('button',{name:'Следующий шаг',exact:true});
  await expect(previous).toBeDisabled();
  await expect(preview.locator('[data-preview-step="country"]')).toContainText('Откройте выбранную страну на глобусе.');
  await next.tap();
  await expect(preview.locator('[data-preview-step="writer"]')).toContainText('Откройте выбранного писателя.');
  await next.tap();
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Перейдите к выбранной книге в коллекции.');
  await preview.scrollIntoViewIfNeeded();
  expect(await overflow()).toBe(false);
  await capture('booky-journey-preview-ru-320.png','Actual local authoring preview, RU work step at 320px; not production route admission.');
  await next.tap();
  await expect(next).toBeDisabled();
  await expect(preview.locator('[data-preview-step="checkpoint"]')).toContainText('Отметьте завершение этого маршрута.');
  await previous.tap();
  await preview.getByRole('button',{name:'English',exact:true}).tap();
  await expect(preview.locator('[data-preview-step="work"]')).toHaveAttribute('lang','en');
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Synthetic work A');
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Go to the selected book in the collection.');
  await preview.scrollIntoViewIfNeeded();
  await capture('booky-journey-preview-en-320.png','Actual local authoring preview, same work step in EN at 320px.');
  for(const control of [previous,next,preview.getByRole('button',{name:'English',exact:true})])expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByLabel('Название маршрута (RU)',{exact:true}).fill('Тестовый маршрут обновлён');
  await expect(preview).toHaveCount(0);
  expect(downloads).toEqual([]);
  const downloaded = page.waitForEvent('download');
  await button.tap();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  const exportedPath = testInfo.outputPath('synthetic-journey-draft.json');
  await download.saveAs(exportedPath);
  const bytes = await fs.readFile(exportedPath), draft = JSON.parse(bytes.toString('utf8'));
  expect(sha(bytes)).toBe('7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5');
  expect(await page.evaluate(() => window.__activityValidationCalls)).toEqual([]);
  expect(draft.definitions).toHaveLength(2); expect(draft.dialogues).toHaveLength(8);
  expect(draft.definitions.map(d => d.locale).sort()).toEqual(['en', 'ru']);
  for (const definition of draft.definitions) {
    expect(definition.audience).toBe('adult'); expect(definition.id).toBe('synthetic-journey'); expect(definition.version).toBe(2);
    expect(definition.ageRange).toEqual({ min: 18, max: 65 }); expect(definition.readingLevel).toBe('plain');
    expect(definition.nodes.map(n => n.kind)).toEqual(['country', 'writer', 'work', 'checkpoint']);
    expect(definition.nodes[2].entity).toEqual({ kind: 'work', countryId: 'country-a', writerId: 'writer-a', workId: 'work-a' });
  }
  for (const record of draft.dialogues) expect(record.review).toMatchObject({ status: 'draft', reviewer: null, reviewedAt: null });
  for (const key of ['journeyApprovals', 'dialogueApprovals', 'currentVersions', 'availability']) expect(draft[key]).toEqual([]);
  expect(draft.releaseReady).toBe(false); expect(downloads).toHaveLength(1);
  const opener=page.locator('summary').filter({hasText:'Открыть локальный черновик'});
  await expect(opener.locator('..')).not.toHaveAttribute('open','');
  await opener.tap();
  const openDraft=page.getByLabel('Открыть черновик JSON',{exact:true});
  const routeTitle=page.getByLabel('Название маршрута (RU)',{exact:true});
  const upload=(name,buffer=bytes)=>openDraft.setInputFiles({name,mimeType:'application/json',buffer});
  await routeTitle.fill('Несохранённые правки');
  await previewButton.tap();
  const tampered=structuredClone(draft);tampered.releaseReady=true;
  await upload('tampered-draft.json',Buffer.from(JSON.stringify(tampered)));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(routeTitle).toHaveValue('Несохранённые правки');
  await expect(preview).toBeVisible();
  await upload('saved-draft.json');
  await expect(routeTitle).toHaveValue('Тестовый маршрут обновлён');
  await expect(page.getByLabel('Название маршрута (EN)',{exact:true})).toHaveValue('Synthetic journey');
  await expect(preview).toHaveCount(0);
  await expect(country).toHaveValue('country-a');await expect(writer).toHaveValue('writer-a');await expect(work).toHaveValue('work-a');
  await expect(openDraft).toHaveValue('');
  await page.evaluate(()=>{
    const original=File.prototype.text;
    File.prototype.text=function(){
      if(this.name==='delayed-draft.json'){
        window.__draftReadStarted=true;
        return new Promise(resolve=>{window.__finishDraftRead=()=>original.call(this).then(resolve);});
      }
      if(this.name==='unreadable-draft.json')return Promise.reject(new Error('Synthetic local read failure'));
      return original.call(this);
    };
  });
  await upload('delayed-draft.json');
  await page.waitForFunction(()=>window.__draftReadStarted===true);
  await routeTitle.fill('Правки во время чтения');
  await page.evaluate(()=>window.__finishDraftRead());
  await expect(routeTitle).toHaveValue('Правки во время чтения');
  await expect(openDraft).not.toHaveAttribute('aria-busy','true');
  await page.evaluate(()=>{window.__draftReadStarted=false;});
  await upload('delayed-draft.json');
  await page.waitForFunction(()=>window.__draftReadStarted===true);
  await upload('unreadable-draft.json');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(()=>window.__finishDraftRead());
  await expect(routeTitle).toHaveValue('Правки во время чтения');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(downloads).toHaveLength(1);
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await overflow()).toBe(false);
  await capture('booky-journey-editor-ru-1280.png', 'Actual editor component, same authored state, desktop upper form.');
  expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  await testInfo.attach('booky-journey-editor-evidence', { contentType: 'application/json', body: JSON.stringify({
    pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true,
    syntheticCatalog: true, authenticatedAdminServerTested: false, installedDeviceTested: false,
    bilingualDefinitions: 2, unapprovedDialogueDrafts: 8, cascadeResetsVerified: true, adultRuEnPreviewVerified:true, previewInvalidationVerified:true, missingCanonicalEnglishPreserved:true, localDraftRoundtripVerified:true, rejectedImportPreservesEditsAndPreview:true, delayedImportCannotOverwriteNewEdits:true, newerFileSelectionCancelsOlderResult:true, readFailurePreservesEdits:true, noActivityExportMatchesOriginalD223Bytes:true, activityServerValidationCalls:0, downloads,
    exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length }, sourceInputs: fixture.sourceInputs,
    screenshots, errors, externalRequests, productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  }, null, 2) });
});

test('optional adult RU EN author task uses current semantic validation and preserves edits through failed or obsolete operations', async ({ page }, testInfo) => {
  const errors = [], externalRequests = [], downloads = [], screenshots = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.addInitScript(() => {
    window.__draftExportBlobs = [];
    const nativeCreate = URL.createObjectURL;
    URL.createObjectURL = function(blob) { window.__draftExportBlobs.push(blob); return nativeCreate.call(URL, blob); };
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.origin); return route.abort(); }
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/editor.css"></head><body><main id="root" style="padding:16px;max-width:1280px;margin:auto"></main><script src="/editor.js"></script></body></html>' });
    if (url.pathname === '/editor.js') return route.fulfill({ contentType: 'application/javascript', body: fixture.js });
    if (url.pathname === '/editor.css') return route.fulfill({ contentType: 'text/css', body: fixture.css });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(origin);
  const routeTitle = page.getByLabel('Название маршрута (RU)', { exact: true });
  for (const [label, value] of [
    ['Идентификатор маршрута', 'synthetic-activity'], ['Версия', '3'], ['Возраст от', '18'], ['Возраст до', '65'],
    ['Примерная длительность (мин)', '10'], ['Название маршрута (RU)', 'Маршрут с заданием'], ['Название маршрута (EN)', 'Activity journey'],
    ['Описание маршрута (RU)', 'Черновик задания по текущему каталогу.'], ['Описание маршрута (EN)', 'A task draft checked against the current catalog.'],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('Уровень чтения', { exact: true }).selectOption('plain');
  await page.getByLabel('Страна', { exact: true }).selectOption('country-a');
  await page.getByLabel('Писатель', { exact: true }).selectOption('writer-a');
  await page.getByLabel('Книга', { exact: true }).selectOption('work-a');
  const activityOpener = page.locator('summary#journey-activity-heading');
  await expect(activityOpener.locator('..')).not.toHaveAttribute('open', '');
  await activityOpener.tap();
  const activityEnabled = page.getByLabel('Добавить задание «Книга и автор»', { exact: true });
  await expect(activityEnabled).not.toBeChecked();
  await activityEnabled.check();
  const firstChoice = page.getByLabel('Автор · вариант 1', { exact: true });
  const secondChoice = page.getByLabel('Автор · вариант 2', { exact: true });
  await expect(firstChoice).toHaveValue(JSON.stringify(['', '']));
  await expect(secondChoice).toHaveValue(JSON.stringify(['', '']));
  const untranslatedOption = firstChoice.locator('option').filter({ hasText: 'Тестовый писатель Б' });
  await expect(untranslatedOption).toHaveAttribute('disabled', '');
  expect(await untranslatedOption.evaluate(option => option.disabled)).toBe(true);
  await firstChoice.selectOption(JSON.stringify(['country-a', 'writer-a']));
  await secondChoice.selectOption(JSON.stringify(['country-c', 'writer-d']));
  const previewButton = page.getByRole('button', { name: 'Предпросмотр маршрута', exact: true });
  const downloadButton = page.getByRole('button', { name: 'Скачать черновик JSON', exact: true });
  const preview = page.locator('[data-booky-journey-preview]');
  const semanticMessage = 'Текущий публичный каталог не подтверждает единственный ответ для этого задания.';
  await previewButton.tap();
  await expect(page.getByRole('alert')).toContainText(semanticMessage);
  await expect(preview).toHaveCount(0);
  await downloadButton.tap();
  await expect(page.getByRole('alert')).toContainText(semanticMessage);
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => window.__draftExportBlobs.length)).toBe(0);
  const semanticRejections = await page.evaluate(() => window.__activityValidationCalls);
  expect(semanticRejections).toHaveLength(2);
  for (const call of semanticRejections) {
    expect(call.actualHelperCalled).toBe(true); expect(call.actualResult.ok).toBe(false);
    expect(call.choices).toEqual([{ countryId: 'country-a', writerId: 'writer-a' }, { countryId: 'country-c', writerId: 'writer-d' }]);
  }
  await secondChoice.selectOption(JSON.stringify(['country-b', 'writer-c']));
  await previewButton.tap();
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('status')).toContainText('Шаг 1 из 5');
  const next = preview.getByRole('button', { name: 'Следующий шаг', exact: true });
  const previous = preview.getByRole('button', { name: 'Предыдущий шаг', exact: true });
  for (let index = 0; index < 3; index++) await next.tap();
  const activityStep = preview.locator('[data-preview-step="activity"]');
  await expect(activityStep).toContainText('Кто автор этой книги?');
  await expect(activityStep.getByRole('list', { name: 'Варианты ответа' })).toContainText('Тестовый писатель А');
  await expect(activityStep.getByRole('list', { name: 'Варианты ответа' })).toContainText('Тестовый писатель В');
  await next.tap();
  await expect(preview.getByRole('status')).toContainText('Шаг 5 из 5');
  await expect(preview.locator('[data-preview-step="checkpoint"]')).toBeVisible();
  await expect(next).toBeDisabled();
  await previous.tap();
  const pendingDownload = page.waitForEvent('download');
  await downloadButton.tap();
  const download = await pendingDownload;
  expect(await download.failure()).toBeNull();
  const exportedPath = testInfo.outputPath('synthetic-activity-draft.json');
  await download.saveAs(exportedPath);
  const bytes = await fs.readFile(exportedPath), draft = JSON.parse(bytes.toString('utf8'));
  expect(downloads).toHaveLength(1);
  expect(await page.evaluate(() => window.__draftExportBlobs.length)).toBe(1);
  expect(await page.evaluate(() => window.__draftExportBlobs[0].text())).toBe(bytes.toString('utf8'));
  expect(draft.definitions).toHaveLength(2); expect(draft.dialogues).toHaveLength(10);
  expect(draft.definitions.map(definition => definition.locale).sort()).toEqual(['en', 'ru']);
  for (const definition of draft.definitions) {
    expect(definition.audience).toBe('adult'); expect(definition.ageRange).toEqual({ min: 18, max: 65 });
    expect(definition.readingLevel).toBe('plain');
    expect(definition.nodes.map(node => node.kind)).toEqual(['country', 'writer', 'work', 'activity', 'checkpoint']);
    expect(definition.nodes[3]).toMatchObject({ id: 'activity', kind: 'activity', entity: null, screen: 'globe' });
    expect(definition.nodes[3].activity.targetWork).toEqual({ kind: 'work', countryId: 'country-a', writerId: 'writer-a', workId: 'work-a' });
    expect(definition.nodes[3].activity.choices).toEqual([
      { id: 'choice-1', writer: { kind: 'writer', countryId: 'country-a', writerId: 'writer-a' } },
      { id: 'choice-2', writer: { kind: 'writer', countryId: 'country-b', writerId: 'writer-c' } },
    ]);
  }
  expect(draft.authoringSource.selection.activityChoices.map(choice => choice.writer.label)).toEqual([
    { ru: 'Тестовый писатель А', en: 'Synthetic writer A' }, { ru: 'Тестовый писатель В', en: 'Synthetic writer C' },
  ]);
  expect(draft.dialogues.filter(record => record.payload.intent === 'activity')).toHaveLength(2);
  for (const record of draft.dialogues) expect(record.review).toMatchObject({ status: 'draft', reviewer: null, reviewedAt: null });
  for (const key of ['journeyApprovals', 'dialogueApprovals', 'currentVersions', 'availability']) expect(draft[key]).toEqual([]);
  expect(draft.releaseReady).toBe(false); expect(JSON.stringify(draft)).not.toMatch(/answerKey|correctChoice/);

  const fileOpener = page.locator('summary').filter({ hasText: 'Открыть локальный черновик' });
  await expect(fileOpener.locator('..')).not.toHaveAttribute('open', '');
  await fileOpener.tap();
  const openDraft = page.getByLabel('Открыть черновик JSON', { exact: true });
  const upload = (name, buffer = bytes) => openDraft.setInputFiles({ name, mimeType: 'application/json', buffer });
  await routeTitle.fill('Правки перед импортом задания');
  await previewButton.tap();
  await expect(preview).toBeVisible();
  const preservedPreview = await preview.innerText();
  await upload('malformed-activity.json', Buffer.from('{'));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(routeTitle).toHaveValue('Правки перед импортом задания');
  expect(await preview.innerText()).toBe(preservedPreview);
  const beforeTamperCalls = await page.evaluate(() => window.__activityValidationCalls.length);
  const tampered = structuredClone(draft); tampered.authoringSource.input.activity.copy.ru.title = 'Подменённый вопрос';
  await upload('tampered-activity.json', Buffer.from(JSON.stringify(tampered)));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(routeTitle).toHaveValue('Правки перед импортом задания');
  expect(await preview.innerText()).toBe(preservedPreview);
  expect(await page.evaluate(() => window.__activityValidationCalls.length)).toBe(beforeTamperCalls);
  await page.evaluate(() => { window.__activityStaleNext = true; });
  await upload('stale-public-authorship-activity.json');
  await expect(page.getByRole('alert')).toContainText(semanticMessage);
  await expect(routeTitle).toHaveValue('Правки перед импортом задания');
  expect(await preview.innerText()).toBe(preservedPreview);
  const staleCall = await page.evaluate(() => window.__activityValidationCalls.at(-1));
  expect(staleCall.stale).toBe(true); expect(staleCall.actualHelperCalled).toBe(true); expect(staleCall.actualResult.ok).toBe(false);

  async function heldIndex() { await page.waitForFunction(() => window.__activityHeld); return page.evaluate(() => window.__activityHeld.index); }
  async function releaseHeld(index) {
    await page.evaluate(() => { window.__activityHeld.release(); delete window.__activityHeld; });
    await page.waitForFunction(index => window.__activityValidationCalls[index]?.completed === true, index);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await page.evaluate(() => { window.__activityHoldNext = true; });
  await downloadButton.tap();
  const heldExport = await heldIndex();
  await routeTitle.fill('Правки во время проверки экспорта');
  await releaseHeld(heldExport);
  await expect(routeTitle).toHaveValue('Правки во время проверки экспорта');
  expect(downloads).toHaveLength(1);
  expect(await page.evaluate(() => window.__draftExportBlobs.length)).toBe(1);
  const obsoleteExportCall = await page.evaluate(index => window.__activityValidationCalls[index], heldExport);
  expect(obsoleteExportCall.actualHelperCalled).toBe(true); expect(obsoleteExportCall.actualResult.ok).toBe(true);
  await page.evaluate(() => { window.__activitySessionFailureNext = true; });
  await downloadButton.tap();
  await expect(page.getByRole('alert')).toContainText('Не удалось подтвердить сессию редактора.');
  await expect(routeTitle).toHaveValue('Правки во время проверки экспорта');
  expect(downloads).toHaveLength(1);
  await page.evaluate(() => { window.__activityThrowNext = true; });
  await downloadButton.tap();
  await expect(page.getByRole('alert')).toContainText('Проверка задания сейчас недоступна. Форма сохранена; повторите действие.');
  await expect(routeTitle).toHaveValue('Правки во время проверки экспорта');
  expect(downloads).toHaveLength(1);
  await page.evaluate(() => { window.__activityWrongChecksumNext = true; });
  await downloadButton.tap();
  await expect(page.getByRole('alert')).toContainText('Каталог или черновик изменился во время проверки.');
  await expect(routeTitle).toHaveValue('Правки во время проверки экспорта');
  expect(downloads).toHaveLength(1);
  expect(await page.evaluate(() => window.__draftExportBlobs.length)).toBe(1);
  const wrongChecksumCall = await page.evaluate(() => window.__activityValidationCalls.at(-1));
  expect(wrongChecksumCall.wrongChecksum).toBe(true); expect(wrongChecksumCall.actualHelperCalled).toBe(true);
  expect(wrongChecksumCall.actualResult.ok).toBe(true); expect(wrongChecksumCall.actualResult.draftChecksum).not.toBe('0'.repeat(64));

  await page.evaluate(() => { window.__activityHoldNext = true; });
  await upload('held-activity-validation.json');
  const heldImport = await heldIndex();
  await routeTitle.fill('Правки во время проверки импорта');
  await releaseHeld(heldImport);
  await expect(routeTitle).toHaveValue('Правки во время проверки импорта');
  await expect(preview).toHaveCount(0);
  await expect(openDraft).not.toHaveAttribute('aria-busy', 'true');
  expect(downloads).toHaveLength(1);
  const obsoleteImportCall = await page.evaluate(index => window.__activityValidationCalls[index], heldImport);
  expect(obsoleteImportCall.actualHelperCalled).toBe(true); expect(obsoleteImportCall.actualResult.ok).toBe(true);
  const beforeImportCalls = await page.evaluate(() => window.__activityValidationCalls.length);
  await upload('valid-activity-draft.json');
  await expect(routeTitle).toHaveValue('Маршрут с заданием');
  await expect(page.getByLabel('Название маршрута (EN)', { exact: true })).toHaveValue('Activity journey');
  await expect(activityEnabled).toBeChecked();
  await expect(firstChoice).toHaveValue(JSON.stringify(['country-a', 'writer-a']));
  await expect(secondChoice).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  await expect(preview).toHaveCount(0);
  await expect(openDraft).toHaveValue('');
  expect(await page.evaluate(() => window.__activityValidationCalls.length)).toBe(beforeImportCalls + 1);
  const importedCall = await page.evaluate(() => window.__activityValidationCalls.at(-1));
  expect(importedCall.actualHelperCalled).toBe(true); expect(importedCall.actualResult.ok).toBe(true);
  await previewButton.tap();
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('status')).toContainText('Шаг 1 из 5');
  for (let index = 0; index < 3; index++) await next.tap();
  await expect(activityStep).toHaveAttribute('lang', 'ru');
  await expect(activityStep).toContainText('Кто автор этой книги?');
  const choices = activityStep.getByRole('list', { name: 'Варианты ответа' });
  await expect(choices).toContainText('Тестовый писатель А'); await expect(choices).toContainText('Тестовый писатель В');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await overflow()).toBe(false);
  for (const control of [activityOpener, firstChoice, secondChoice, previous, next, preview.getByRole('button', { name: 'English', exact: true }), activityEnabled.locator('..')]) {
    const bounds = await control.boundingBox(); expect(bounds).toBeTruthy(); expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  async function capture(filename, scope) {
    await activityStep.scrollIntoViewIfNeeded();
    const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
    screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  }
  await capture('booky-journey-activity-ru-320.png', 'Actual editor local activity preview after native draft reopen and current semantic helper validation, RU320; synthetic public corpus, mocked action transport.');
  await preview.getByRole('button', { name: 'English', exact: true }).tap();
  await expect(activityStep).toHaveAttribute('lang', 'en');
  await expect(activityStep).toContainText('Who wrote this book?');
  await expect(choices).toContainText('Synthetic writer A'); await expect(choices).toContainText('Synthetic writer C');
  expect(await overflow()).toBe(false);
  await capture('booky-journey-activity-en-320.png', 'Same reopened local activity preview in EN320 with independently rendered canonical option labels; no authenticated admin, runtime admission or device acceptance.');
  expect(screenshots).toHaveLength(2); expect(downloads).toHaveLength(1);
  expect(await page.evaluate(() => window.__draftExportBlobs.length)).toBe(1);
  expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  const validationCalls = await page.evaluate(() => window.__activityValidationCalls);
  expect(validationCalls.filter(call => call.hold)).toHaveLength(2);
  expect(validationCalls.filter(call => call.failSession)).toHaveLength(1);
  expect(validationCalls.filter(call => call.failNetwork)).toHaveLength(1);
  expect(validationCalls.filter(call => call.wrongChecksum)).toHaveLength(1);
  expect(validationCalls.filter(call => call.actualHelperCalled).length).toBeGreaterThanOrEqual(8);
  expect(validationCalls.every(call => call.completed)).toBe(true);
  await testInfo.attach('booky-journey-activity-evidence', { contentType: 'application/json', body: JSON.stringify({
    pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true, actualDraftParser: true,
    actualActivitySemanticHelper: true, actualActivityResolver: true, mockedServerActionTransport: true, syntheticCatalog: true,
    authenticatedAdminServerTested: false, sessionOrNetworkFailureStubbed: true, installedDeviceTested: false,
    routeWriterAIsNotCreditedAuthor: true, creditedWriterCSelectedIndependently: true, wrongChoicesADRejected: true,
    optionalActivityStartsCollapsed: true, bilingualDefinitions: 2, semanticNodesPerDefinition: 5, unapprovedDialogueDrafts: 10,
    nativeBlobExportObserved: true, nativeFileImportRevalidated: true, validImportRestoresFieldsBeforeFreshPreview: true,
    malformedAndTamperedImportPreserveInputsAndPreview: true, stalePublicAuthorshipRejectionPreservesInputsAndPreview: true,
    obsoleteSuccessfulExportCannotDownload: true, failedSessionOrNetworkCannotDownload: true, wrongChecksumCannotDownload: true,
    obsoleteSuccessfulActivityImportCannotOverwriteEdits: true, bilingualChoiceLabelsVerified: true, noAnswerKeyExported: true,
    narrow320LayoutHasNoHorizontalOverflow: true, minimumControlHitHeightCssPx: 44,
    downloads, exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length }, validationCalls,
    sourceInputs: fixture.sourceInputs, screenshots, errors, externalRequests,
    productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  }, null, 2) });
});
