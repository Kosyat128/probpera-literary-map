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
      import {evaluateBookyJourneyDraftActivity,validateBookyJourneyDraftActivity} from ${JSON.stringify(path.join(root, 'apps/admin/lib/booky-journey-activity-validation.ts').replaceAll('\\', '/'))};
      import {contentRecordHash} from ${JSON.stringify(path.join(root, 'src/planet/contentExportHash.ts').replaceAll('\\', '/'))};
      window.__copyVariantRecordHash=contentRecordHash;
      const catalog=${JSON.stringify(catalog)}, publicData=${JSON.stringify(publicData)};
      window.__activityValidationCalls=[];
      window.__activityAnswerCalls=[];
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
      export async function evaluateBookyJourneyDraftActivityAction(serialized,choiceId) {
        const take=key=>{const value=Boolean(window[key]);window[key]=false;return value;};
        const hold=take('__answerHoldNext'),failSession=take('__answerSessionFailureNext'),failNetwork=take('__answerThrowNext');
        const wrongChecksum=take('__answerWrongChecksumNext'),wrongChoice=take('__answerWrongChoiceNext');
        const draft=JSON.parse(serialized),call={index:window.__activityAnswerCalls.length,choiceId,hold,failSession,failNetwork,wrongChecksum,wrongChoice,
          titleRu:draft.authoringSource.input.copy.ru.title,actualHelperCalled:false,completed:false};
        window.__activityAnswerCalls.push(call);
        if(failNetwork){call.completed=true;call.stubbedFailure='network';throw new Error('Synthetic unavailable answer transport');}
        if(failSession){call.completed=true;call.stubbedFailure='session';return {ok:false,errors:[{field:'activity.auth',message:'Synthetic unavailable editor session'}]};}
        const actual=evaluateBookyJourneyDraftActivity(serialized,choiceId,catalog,structuredClone(publicData));
        call.actualHelperCalled=true;call.actualResult=structuredClone(actual);
        const reply=actual.ok?{...actual,...(wrongChecksum?{draftChecksum:'0'.repeat(64)}:{}),...(wrongChoice?{choiceId:choiceId==='choice-1'?'choice-2':'choice-1'}:{})}:actual;
        if(hold)await new Promise(resolve=>{window.__answerHeld={index:call.index,release:resolve};});
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
  await page.addInitScript(() => {
    window.__previewProfileStorageWrites = [];
    const nativeStore = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__previewProfileStorageWrites.push({ key, local: this === localStorage }); return nativeStore.call(this, key, value); };
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
  await preview.getByRole('button', {name: /^(?:Следующий шаг|Next step)$/}).tap();
  await expect(preview.locator('[data-preview-step="writer"]')).toContainText('English title is not confirmed');
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
  const previous=preview.getByRole('button',{name: /^(?:Предыдущий шаг|Previous step)$/});
  const next=preview.getByRole('button',{name: /^(?:Следующий шаг|Next step)$/});
  await expect(previous).toBeDisabled();
  const overview=preview.locator('[data-booky-journey-step-overview]');
  const overviewSummary=overview.locator('summary');
  await expect(overview).not.toHaveAttribute('open','');
  await expect(overviewSummary).toHaveText('Шаги маршрута (4)');
  await overviewSummary.tap();
  await expect(overview.getByRole('button')).toHaveText(['1. Страна','2. Писатель','3. Книга','4. Завершение']);
  await expect(overview.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(overview.locator('[data-preview-step-choice="country"]')).toHaveAttribute('aria-current','step');
  const overviewWork=overview.getByRole('button',{name:'3. Книга',exact:true});
  await overviewWork.focus(); await overviewWork.press('Enter'); await expect(overviewWork).toBeFocused();
  await expect(preview.locator('[data-preview-step="work"]')).toBeVisible();
  await expect(overviewWork).toHaveAttribute('aria-current','step');
  await overview.getByRole('button',{name:'1. Страна',exact:true}).tap();
  await expect(previous).toBeDisabled();
  await expect(overview.locator('[data-preview-step-choice="country"]')).toHaveAttribute('aria-current','step');
  for(const control of [overviewSummary,...await overview.getByRole('button').all()]) {
    const bounds=await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  }
  expect(await overflow()).toBe(false);
  await expect(preview.locator('[data-preview-step="country"]')).toContainText('Откройте выбранную страну на глобусе.');
  await next.tap();
  await expect(preview.locator('[data-preview-step="writer"]')).toContainText('Откройте выбранного писателя.');
  await next.tap();
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Перейдите к выбранной книге в коллекции.');
  const previewCopyView=preview.locator('[data-booky-preview-copy-view]');
  const previewCopy=preview.locator('[data-booky-preview-copy]');
  await expect(previewCopyView).toHaveValue('body');
  await expect(previewCopyView.locator('option')).toHaveText(['Полный текст','Подпись','Короткий текст']);
  await previewCopyView.selectOption('caption'); await expect(previewCopy).toHaveText('Откройте книгу');
  await previewCopyView.selectOption('reduced'); await expect(previewCopy).toHaveText('Откройте книгу');
  await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current','step');
  await previewCopyView.selectOption('body'); await expect(previewCopy).toHaveText('Перейдите к выбранной книге в коллекции.');
  const profilePanel=preview.locator('[data-booky-preview-profile]');
  const profileReport=preview.locator('[data-booky-preview-profile-report]');
  await expect(profilePanel).not.toHaveAttribute('open',''); await profilePanel.locator('summary').tap();
  const profileEnabledRu=profilePanel.getByRole('checkbox',{name:'Сравнить взрослый профиль',exact:true});
  await expect(profileEnabledRu).not.toBeChecked(); await expect(profileReport).toHaveCount(0);
  await profileEnabledRu.check();
  const profileAgeRu=profilePanel.getByLabel('Возраст для предпросмотра',{exact:true});
  const profileLevelRu=profilePanel.getByRole('combobox',{name:'Уровень чтения для предпросмотра',exact:true});
  await expect(profileAgeRu).toHaveValue(''); await expect(profileLevelRu).toHaveValue('');
  await expect(profileReport).toHaveAttribute('data-profile-status','invalid');
  await expect(profileReport).toContainText('Укажите целый возраст от 18 до 120 лет и выберите уровень чтения.');
  await profileLevelRu.selectOption('plain');
  for(const [age,status] of [['18','matches'],['65','matches'],['66','outside'],['17','invalid'],['18.5','invalid'],['','invalid'],['30','matches']]) {
    await profileAgeRu.fill(age); await expect(profileReport).toHaveAttribute('data-profile-status',status);
    await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current','step');
    await expect(previewCopyView).toHaveValue('body'); await expect(previewCopy).toHaveText('Перейдите к выбранной книге в коллекции.');
  }
  await profileLevelRu.selectOption('developing');
  await expect(profileReport).toHaveAttribute('data-profile-status','outside');
  await expect(profileReport).toContainText('Уровень чтения отличается от заданного в черновике.');
  await profileLevelRu.selectOption('plain'); await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  for(const control of [profilePanel.locator('summary'),profileEnabledRu.locator('..'),profileAgeRu,profileLevelRu])
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await profilePanel.locator('summary').scrollIntoViewIfNeeded();
  await profilePanel.locator('summary').evaluate(node=>window.scrollBy(0,node.getBoundingClientRect().top-12));
  for(const bounds of [await profilePanel.boundingBox(),await profileReport.boundingBox()]) {
    expect(bounds).toBeTruthy(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(321); expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  }
  expect(await overflow()).toBe(false);
  await capture('booky-journey-preview-ru-320.png','Actual local RU320 work-step preview with expanded adult profile age30/plain and matching draft-condition feedback; no runtime admission.');
  await profileEnabledRu.uncheck(); await expect(profileReport).toHaveCount(0); await profilePanel.locator('summary').tap();
  await next.tap();
  await expect(next).toBeDisabled();
  await expect(preview.locator('[data-preview-step="checkpoint"]')).toContainText('Отметьте завершение этого маршрута.');
  await previous.tap();
  await preview.getByRole('button',{name:'English',exact:true}).tap();
  await expect(overview).toHaveAttribute('lang','en');
  await expect(overviewSummary).toHaveText('Journey steps (4)');
  await expect(overview.getByRole('button')).toHaveText(['1. Country','2. Writer','3. Work','4. Finish']);
  await expect(overview.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current','step');
  await expect(previewCopyView.locator('option')).toHaveText(['Full text','Caption','Short text']);
  await expect(preview.locator('[data-preview-step="work"]')).toHaveAttribute('lang','en');
  await expect(preview.getByRole('status')).toContainText('Step 3 of 4 · Work');
  await expect(preview).toContainText('Age: 18–65 years · Reading level: Plain · Estimate: 8 min');
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Canonical record: Synthetic work A');
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Screen: Collection');
  await expect(preview.getByRole('button',{name:'Previous step',exact:true})).toBeVisible();
  await expect(preview.getByRole('button',{name:'Next step',exact:true})).toBeVisible();
  await expect(profilePanel.locator('summary')).toHaveText('Preview profile'); await profilePanel.locator('summary').tap();
  const profileEnabledEn=profilePanel.getByRole('checkbox',{name:'Compare an adult profile',exact:true});
  await profileEnabledEn.check(); await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  await expect(profileReport).toContainText('Age and reading level match the draft conditions.');
  const profileAgeEn=profilePanel.getByLabel('Preview age',{exact:true});
  const profileLevelEn=profilePanel.getByRole('combobox',{name:'Preview reading level',exact:true});
  await profileAgeEn.fill('66'); await expect(profileReport).toHaveAttribute('data-profile-status','outside');
  await expect(profileReport).toContainText('This age is outside the draft range.');
  await profilePanel.locator('summary').scrollIntoViewIfNeeded();
  await profilePanel.locator('summary').evaluate(node=>window.scrollBy(0,node.getBoundingClientRect().top-12));
  for(const bounds of [await profilePanel.boundingBox(),await profileReport.boundingBox()]) {
    expect(bounds).toBeTruthy(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(321); expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  }
  expect(await overflow()).toBe(false);
  await capture('booky-journey-preview-en-320.png','Actual local EN320 work-step preview with expanded adult profile age66/plain and outside draft-range feedback; no runtime admission.');
  await profileAgeEn.fill('30'); await profileLevelEn.selectOption('fluent');
  await expect(profileReport).toHaveAttribute('data-profile-status','outside');
  await expect(profileReport).toContainText('The reading level differs from the draft.');
  await profileLevelEn.selectOption('plain'); await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  await profileEnabledEn.uncheck(); await expect(profileReport).toHaveCount(0); await profilePanel.locator('summary').tap();
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Synthetic work A');
  await expect(preview.locator('[data-preview-step="work"]')).toContainText('Go to the selected book in the collection.');
  await preview.scrollIntoViewIfNeeded();
  for(const control of [previous,next,preview.getByRole('button',{name:'English',exact:true})])expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByLabel('Название маршрута (RU)',{exact:true}).fill('Тестовый маршрут обновлён');
  await expect(preview).toHaveCount(0);
  expect(downloads).toEqual([]);
  const workVariants=page.locator('[data-booky-copy-variants="work"][data-copy-locale="ru"]');
  await expect(workVariants).not.toHaveAttribute('open',''); await workVariants.locator('summary').tap();
  const workCaption=workVariants.getByRole('textbox',{name:'Подпись «Книга» (RU)',exact:true});
  const workReduced=workVariants.getByRole('textbox',{name:'Короткий текст «Книга» (RU)',exact:true});
  await expect(workCaption).toHaveValue(''); await expect(workReduced).toHaveValue('');
  await workCaption.fill('Временная подпись'); await workCaption.fill('');
  await workReduced.fill('Временный короткий текст'); await workReduced.fill('');
  const downloaded = page.waitForEvent('download');
  await button.tap();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  const exportedPath = testInfo.outputPath('synthetic-journey-draft.json');
  await download.saveAs(exportedPath);
  const bytes = await fs.readFile(exportedPath), draft = JSON.parse(bytes.toString('utf8'));
  expect(sha(bytes)).toBe('7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5');
  expect(Object.hasOwn(draft.authoringSource.input.copy.ru.nodes.work,'caption')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input.copy.ru.nodes.work,'reduced')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input,'previewProfile')).toBe(false);
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
  const profileStorageWrites=await page.evaluate(()=>window.__previewProfileStorageWrites); expect(profileStorageWrites).toEqual([]);
  await testInfo.attach('booky-journey-editor-evidence', { contentType: 'application/json', body: JSON.stringify({
    pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true,
    syntheticCatalog: true, authenticatedAdminServerTested: false, installedDeviceTested: false,
    bilingualDefinitions: 2, unapprovedDialogueDrafts: 8, cascadeResetsVerified: true, adultRuEnPreviewVerified:true, previewInvalidationVerified:true, missingCanonicalEnglishPreserved:true, localDraftRoundtripVerified:true, rejectedImportPreservesEditsAndPreview:true, delayedImportCannotOverwriteNewEdits:true, newerFileSelectionCancelsOlderResult:true, readFailurePreservesEdits:true, noActivityExportMatchesOriginalD223Bytes:true, activityServerValidationCalls:0,
    optionalStepOverviewStartsCollapsed:true, actualFourNodeOverviewRuEnVerified:true, currentStepAriaCurrentVerified:true,
    trustedKeyboardAndTouchJumpOnlyLocalPreview:true, overviewControlsMinimum44CssPx:true, overviewWrapHasNo320Overflow:true, sequentialPreviewControlsRetained:true, downloads,
    omittedCopyVariantsUseTitleFallback:true, previewCopyViewRuEnLabelsVerified:true, clearedCopyVariantFieldsDeleteOwnKeysAndPreserveOriginalExportBytes:true,
    actualDraftProfileConditionHelper:true, ordinaryPreviewStartsWithCollapsedDisabledAdultScenario:true, explicitAgeAndLevelInitiallyBlank:true,
    adultProfileBoundaryInvalidAgeAndReadingMismatchVerified:true, profileReportRuEnParityVerified:true,
    previewScenarioKeepsDraftStepCopyViewAndOriginalExportBytes:true, previewProfileStorageWrites:profileStorageWrites,
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
    window.__draftStorageWrites = [];
    const nativeStore = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__draftStorageWrites.push({ key, local: this === localStorage }); return nativeStore.call(this, key, value); };
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
  await expect(preview.getByRole('status')).toContainText(/^(?:Шаг 1 из 5|Step 1 of 5)/);
  const next = preview.getByRole('button', { name: /^(?:Следующий шаг|Next step)$/ });
  const previous = preview.getByRole('button', { name: /^(?:Предыдущий шаг|Previous step)$/ });
  for (let index = 0; index < 3; index++) await next.tap();
  const activityStep = preview.locator('[data-preview-step="activity"]');
  await expect(activityStep).toContainText('Кто автор этой книги?');
  await expect(activityStep.getByRole('list', { name: 'Варианты ответа' })).toContainText('Тестовый писатель А');
  await expect(activityStep.getByRole('list', { name: 'Варианты ответа' })).toContainText('Тестовый писатель В');
  await next.tap();
  await expect(preview.getByRole('status')).toContainText(/^(?:Шаг 5 из 5|Step 5 of 5)/);
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
  await expect(preview.getByRole('status')).toContainText(/^(?:Шаг 1 из 5|Step 1 of 5)/);
  for (let index = 0; index < 3; index++) await next.tap();
  await expect(activityStep).toHaveAttribute('lang', 'ru');
  await expect(activityStep).toContainText('Кто автор этой книги?');
  const choices = activityStep.getByRole('list', { name: 'Варианты ответа' });
  await expect(choices).toContainText('Тестовый писатель А'); await expect(choices).toContainText('Тестовый писатель В');
  const wrongAnswer = choices.locator('[data-answer-choice-id="choice-1"]');
  const correctAnswer = choices.locator('[data-answer-choice-id="choice-2"]');
  const verdict = activityStep.locator('[data-booky-activity-verdict]');
  const answerError = activityStep.locator('[data-booky-activity-answer-error]');
  const stepStatus = preview.locator('p[role="status"]').filter({ hasText: /^(?:Шаг |Step )/ });
  const answerCheckRu = activityStep.getByRole('button', { name: 'Проверить ответ', exact: true });
  const answerResetRu = activityStep.getByRole('button', { name: 'Сбросить ответ', exact: true });
  const answerCheckEn = activityStep.getByRole('button', { name: 'Check answer', exact: true });
  const answerResetEn = activityStep.getByRole('button', { name: 'Reset answer', exact: true });
  await expect(answerCheckRu).toBeDisabled();
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await wrongAnswer.tap();
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'true');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await answerCheckRu.tap();
  await expect(verdict).toHaveAttribute('data-verdict', 'wrong');
  await expect(verdict).toContainText('Этот вариант не подходит. Попробуйте другой.');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  const firstWrongVerdict = await page.evaluate(() => window.__activityAnswerCalls.at(-1));
  expect(firstWrongVerdict.actualHelperCalled).toBe(true); expect(firstWrongVerdict.actualResult.correct).toBe(false);
  await answerResetRu.tap();
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(answerCheckRu).toBeDisabled();
  await correctAnswer.focus();
  await expect(correctAnswer).toBeFocused();
  await correctAnswer.press('Space');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  await expect(correctAnswer).toBeFocused();
  await answerCheckRu.focus();
  await answerCheckRu.press('Enter');
  await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await expect(verdict).toContainText('Верно.');
  await expect(answerCheckRu).toBeFocused();
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  const firstCorrectVerdict = await page.evaluate(() => window.__activityAnswerCalls.at(-1));
  expect(firstCorrectVerdict.actualHelperCalled).toBe(true); expect(firstCorrectVerdict.actualResult.correct).toBe(true);
  const overview = preview.locator('[data-booky-journey-step-overview]');
  await expect(overview).not.toHaveAttribute('open', '');
  await overview.locator('summary').tap();
  await expect(overview.getByRole('button')).toHaveText(['1. Страна', '2. Писатель', '3. Книга', '4. Задание', '5. Завершение']);
  const overviewActivity = overview.locator('[data-preview-step-choice="activity"]');
  const overviewWork = overview.locator('[data-preview-step-choice="work"]');
  await expect(overviewActivity).toHaveAttribute('aria-current', 'step');
  const callsBeforeCurrentStep = await page.evaluate(() => window.__activityAnswerCalls.length);
  await overviewActivity.tap();
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeCurrentStep);
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await next.tap();
  await expect(preview.locator('[data-preview-step="checkpoint"]')).toBeVisible();
  await expect(overview.locator('[data-preview-step-choice="checkpoint"]')).toHaveAttribute('aria-current', 'step');
  await expect(verdict).toHaveCount(0);
  await previous.tap();
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(verdict).toHaveCount(0);
  async function answerHeldIndex() { await page.waitForFunction(() => window.__answerHeld); return page.evaluate(() => window.__answerHeld.index); }
  async function releaseAnswer(index) {
    await page.evaluate(() => { window.__answerHeld.release(); delete window.__answerHeld; });
    await page.waitForFunction(index => window.__activityAnswerCalls[index]?.completed === true, index);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckRu.tap();
  const heldStepVerdict = await answerHeldIndex();
  const callsBeforePendingCurrentStep = await page.evaluate(() => window.__activityAnswerCalls.length);
  await overviewActivity.tap();
  await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforePendingCurrentStep);
  await overviewWork.tap();
  await expect(preview.locator('[data-preview-step="work"]')).toBeVisible();
  await expect(overviewWork).toHaveAttribute('aria-current', 'step');
  await releaseAnswer(heldStepVerdict);
  await expect(stepStatus).toContainText(/^(?:Шаг 3 из 5|Step 3 of 5)/);
  await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  await expect(page.locator('[data-booky-activity-answer-error]')).toHaveCount(0);
  await overviewActivity.tap();
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(answerCheckRu).toBeDisabled();
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckRu.tap();
  const heldChoiceVerdict = await answerHeldIndex();
  await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true');
  await expect(answerCheckRu).toHaveAttribute('aria-disabled', 'true');
  const pendingAnswerCalls = await page.evaluate(() => window.__activityAnswerCalls.length);
  await answerCheckRu.focus(); await answerCheckRu.press('Enter');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(pendingAnswerCalls);
  await wrongAnswer.tap();
  await releaseAnswer(heldChoiceVerdict);
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'true');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckRu.tap();
  const heldLocaleVerdict = await answerHeldIndex();
  await preview.getByRole('button', { name: 'English', exact: true }).tap();
  await releaseAnswer(heldLocaleVerdict);
  await expect(overview.locator('summary')).toHaveText('Journey steps (5)');
  await expect(overview.getByRole('button')).toHaveText(['1. Country', '2. Writer', '3. Work', '4. Activity', '5. Finish']);
  await expect(overviewActivity).toHaveAttribute('aria-current', 'step');
  await expect(activityStep).toHaveAttribute('lang', 'en');
  await expect(stepStatus).toContainText('Step 4 of 5 · Activity');
  await expect(activityStep).toContainText('Screen: Globe');
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await expect(answerCheckEn).toBeDisabled();
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await correctAnswer.tap();
  for (const [knob, message] of [
    ['__answerWrongChecksumNext', 'The check is out of date. Try again.'],
    ['__answerWrongChoiceNext', 'The check is out of date. Try again.'],
    ['__answerSessionFailureNext', 'Could not check the answer. Your choice is preserved; try again.'],
    ['__answerThrowNext', 'Could not check the answer. Your choice is preserved; try again.'],
  ]) {
    await page.evaluate(knob => { window[knob] = true; }, knob);
    await answerCheckEn.tap();
    await expect(answerError).toContainText(message);
    await expect(verdict).toHaveCount(0);
    await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
    await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  }
  await answerResetEn.tap();
  await expect(answerError).toHaveCount(0); await expect(verdict).toHaveCount(0);
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckEn.tap();
  const heldEditVerdict = await answerHeldIndex();
  await routeTitle.fill('Правки во время проверки ответа');
  await releaseAnswer(heldEditVerdict);
  await expect(routeTitle).toHaveValue('Правки во время проверки ответа');
  await expect(preview).toHaveCount(0);
  await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  expect(downloads).toHaveLength(1);
  await upload('restore-after-answer-edit.json');
  await expect(routeTitle).toHaveValue('Маршрут с заданием');
  await previewButton.tap();
  await expect(preview).toBeVisible();
  for (let index = 0; index < 3; index++) await next.tap();
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  const activityVariants = page.locator('[data-booky-copy-variants="activity"][data-copy-locale="ru"]');
  await expect(activityVariants).not.toHaveAttribute('open', ''); await activityVariants.locator('summary').tap();
  const activityReduced = activityVariants.getByRole('textbox', { name: 'Короткий текст «Задание» (RU)', exact: true });
  await expect(activityReduced).toHaveValue('');
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckRu.tap();
  const heldVariantEditVerdict = await answerHeldIndex();
  await activityReduced.fill('Краткая подсказка: выберите автора.');
  await releaseAnswer(heldVariantEditVerdict);
  await expect(activityReduced).toHaveValue('Краткая подсказка: выберите автора.');
  await expect(preview).toHaveCount(0); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  await upload('restore-after-copy-variant-edit.json');
  await expect(activityReduced).toHaveValue('');
  await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap();
  await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  const profilePanel = preview.locator('[data-booky-preview-profile]');
  const profileReport = preview.locator('[data-booky-preview-profile-report]');
  const profileEnabled = profilePanel.getByRole('checkbox', { name: 'Сравнить взрослый профиль', exact: true });
  await expect(profilePanel).not.toHaveAttribute('open', ''); await profilePanel.locator('summary').tap();
  await expect(profileEnabled).not.toBeChecked(); await profileEnabled.check();
  const profileAge = profilePanel.getByLabel('Возраст для предпросмотра', { exact: true });
  const profileLevel = profilePanel.getByRole('combobox', { name: 'Уровень чтения для предпросмотра', exact: true });
  await expect(profileAge).toHaveValue(''); await expect(profileLevel).toHaveValue('');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'invalid');
  await correctAnswer.tap(); await expect(answerCheckRu).toHaveAttribute('aria-disabled', 'true');
  const callsBeforeInvalidProfile = await page.evaluate(() => window.__activityAnswerCalls.length);
  await answerCheckRu.focus(); await answerCheckRu.press('Enter'); await expect(answerCheckRu).toBeFocused();
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeInvalidProfile);
  await expect(verdict).toHaveCount(0);
  await profileAge.fill('30'); await profileLevel.selectOption('plain');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckRu.tap();
  const heldProfileVerdict = await answerHeldIndex();
  await profileAge.fill('30'); await profileLevel.selectOption('plain');
  await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  const callsBeforeOutsideProfile = await page.evaluate(() => window.__activityAnswerCalls.length);
  await profileAge.fill('66');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'outside');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await correctAnswer.tap(); await expect(answerCheckRu).toHaveAttribute('aria-disabled', 'true');
  await answerCheckRu.focus(); await answerCheckRu.press('Enter'); await expect(answerCheckRu).toBeFocused();
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeOutsideProfile);
  await releaseAnswer(heldProfileVerdict);
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await expect(profileReport).toHaveAttribute('data-profile-status', 'outside');
  await profileEnabled.uncheck(); await expect(profileReport).toHaveCount(0);
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await correctAnswer.tap();
  await answerCheckRu.tap();
  await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await upload('reopen-discards-answer-verdict.json');
  await expect(preview).toHaveCount(0);
  await previewButton.tap();
  await expect(preview).toBeVisible();
  for (let index = 0; index < 3; index++) await next.tap();
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(profilePanel).not.toHaveAttribute('open', ''); await profilePanel.locator('summary').tap();
  await profileEnabled.check(); await profileAge.fill('30'); await profileLevel.selectOption('plain');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  await profilePanel.locator('summary').tap();
  await wrongAnswer.tap();
  await answerCheckRu.tap();
  await expect(verdict).toHaveAttribute('data-verdict', 'wrong');
  await expect(verdict).toHaveAttribute('aria-live', 'polite');
  await expect(verdict).toHaveAttribute('lang', 'ru');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await overflow()).toBe(false);
  for (const control of [activityOpener, firstChoice, secondChoice, previous, next, preview.getByRole('button', { name: 'English', exact: true }), activityEnabled.locator('..'), wrongAnswer, correctAnswer, answerCheckRu, answerResetRu]) {
    const bounds = await control.boundingBox(); expect(bounds).toBeTruthy(); expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  async function capture(filename, scope) {
    await activityStep.scrollIntoViewIfNeeded();
    const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
    screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  }
  await capture('booky-journey-activity-ru-320.png', 'Actual local adult activity preview after native reopen, explicit wrong writer A and current semantic evaluation, RU320; calm wrong feedback, synthetic corpus and mocked action transport.');
  await preview.getByRole('button', { name: 'English', exact: true }).tap();
  await expect(activityStep).toHaveAttribute('lang', 'en');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  await expect(profileReport).toContainText('Age and reading level match the draft conditions.');
  await expect(activityStep).toContainText('Who wrote this book?');
  await expect(choices).toContainText('Synthetic writer A'); await expect(choices).toContainText('Synthetic writer C');
  await expect(verdict).toHaveCount(0); await expect(wrongAnswer).toHaveAttribute('aria-pressed', 'false');
  await correctAnswer.focus(); await correctAnswer.press('Space');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  await answerCheckEn.focus(); await answerCheckEn.press('Enter');
  await expect(answerCheckEn).toBeFocused();
  await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await expect(verdict).toHaveAttribute('aria-live', 'polite');
  await expect(verdict).toHaveAttribute('lang', 'en');
  await expect(verdict).toContainText('Correct.');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  for (const control of [wrongAnswer, correctAnswer, answerCheckEn, answerResetEn]) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await overflow()).toBe(false);
  await capture('booky-journey-activity-en-320.png', 'Same local adult preview in EN320 after keyboard choice/check of credited writer C; calm current correct feedback without automatic advance, publication or runtime admission.');
  const activityCopyView = preview.locator('[data-booky-preview-copy-view]');
  const callsBeforeSameCopyView = await page.evaluate(() => window.__activityAnswerCalls.length);
  await activityCopyView.selectOption('body');
  await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeSameCopyView);
  await activityCopyView.selectOption('caption');
  await expect(verdict).toHaveCount(0); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await expect(preview.locator('[data-booky-preview-copy]')).toHaveText('Who wrote this book?');
  await activityCopyView.selectOption('body');
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
  const answerCalls = await page.evaluate(() => window.__activityAnswerCalls);
  expect(answerCalls.filter(call => call.hold)).toHaveLength(6);
  expect(answerCalls.filter(call => call.wrongChecksum)).toHaveLength(1);
  expect(answerCalls.filter(call => call.wrongChoice)).toHaveLength(1);
  expect(answerCalls.filter(call => call.failSession)).toHaveLength(1);
  expect(answerCalls.filter(call => call.failNetwork)).toHaveLength(1);
  expect(answerCalls.every(call => call.completed)).toBe(true);
  for (const index of [heldStepVerdict, heldChoiceVerdict, heldLocaleVerdict, heldEditVerdict, heldVariantEditVerdict, heldProfileVerdict]) {
    expect(answerCalls[index].actualHelperCalled).toBe(true); expect(answerCalls[index].actualResult.correct).toBe(true);
  }
  expect(answerCalls.filter(call => call.actualHelperCalled && call.actualResult.ok && call.actualResult.correct === false).length).toBeGreaterThanOrEqual(2);
  expect(answerCalls.filter(call => call.actualHelperCalled && call.actualResult.ok && call.actualResult.correct === true).length).toBeGreaterThanOrEqual(3);
  const storageWrites = await page.evaluate(() => window.__draftStorageWrites);
  expect(storageWrites).toEqual([]);
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
    actualActivityAnswerEvaluator: true, trustedWrongAndCorrectChecksVerified: true, keyboardChoiceCheckAndFocusVerified: true,
    explicitAnswerResetVerified: true, pendingAnswerSemanticDisabledAndDuplicateRequestGuardVerified: true, navigationAndLocaleDiscardAnswerVerified: true, nativeImportDiscardsAnswerVerified: true,
    heldVerdictCannotSurviveNewChoiceLocaleOrEdit: true, mismatchedResponseHashOrChoiceCannotShowVerdict: true,
    actualFiveNodeOverviewRuEnVerified: true, currentStepJumpPreservesSelectedVerdictAndPendingAttempt: true,
    differentStepJumpClearsAnswerAndRejectsLateVerdict: true, heldStepVerdictCallIndex: heldStepVerdict,
    copyVariantEditRejectsLateAnswerAndNativeImportRestoresOmission: true, heldVariantEditVerdictCallIndex: heldVariantEditVerdict,
    sameCopyViewKeepsVerdictAndDifferentCopyViewClearsAnswerWithoutMovingStep: true,
    actualDraftProfileConditionHelper: true, invalidAndOutsideProfilesBlockKeyboardCheckWithoutHelperRequest: true,
    sameExplicitProfileKeepsPendingAnswer: true, newerOutsideProfileRejectsHeldAnswer: true, heldProfileVerdictCallIndex: heldProfileVerdict,
    returningToOrdinaryPreviewRestoresExplicitAnswerCheck: true, previewProfileScenarioHasNoStoredReaderPolicy: true,
    failedSessionOrNetworkCannotShowVerdict: true, localizedCalmAriaLiveFeedbackVerified: true,
    answerCheckDoesNotAdvanceStep: true, answerStateStorageWrites: storageWrites,
    downloads, exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length }, validationCalls, answerCalls,
    sourceInputs: fixture.sourceInputs, screenshots, errors, externalRequests,
    productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  }, null, 2) });
});

test('optional bilingual work fact preserves authored source metadata through strict local export and reopen', async ({ page }, testInfo) => {
  const errors = [], externalRequests = [], downloads = [], screenshots = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.addInitScript(() => {
    window.__factExportBlobs = [];
    const nativeCreate = URL.createObjectURL;
    URL.createObjectURL = function(blob) { window.__factExportBlobs.push(blob); return nativeCreate.call(URL, blob); };
    window.__factStorageWrites = [];
    const nativeStore = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__factStorageWrites.push({ key, local: this === localStorage }); return nativeStore.call(this, key, value); };
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
  const copy = {
    ru: { title: 'Синтетическая запись о книге', body: 'Это вымышленный текст для проверки редактора.\nЭто не проверенный литературный факт.',
      caption: 'Синтетическая подпись.\nИсточники не проверены.', reduced: 'Короткая синтетическая запись; источники не проверены.', sources: [
      { id: 'synthetic-ru-one', url: 'https://example.test/ru/unverified-work-note', accessedAt: '2026-09-29T10:15:00.000Z' },
      { id: 'synthetic-ru-two', url: 'https://example.test/ru/unverified-second-note', accessedAt: '2026-09-29T11:45:00.000Z' },
    ] },
    en: { title: 'Synthetic work note', body: 'This is fictional text for checking the editor, not a verified literary fact.',
      caption: 'Synthetic caption.\nSources have not been reviewed.', sources: [
      { id: 'synthetic-en-one', url: 'https://example.test/en/unverified-work-note', accessedAt: '2026-09-28T09:30:00.000Z' },
    ] },
  };
  for (const [label, value] of [
    ['Идентификатор маршрута', 'synthetic-fact'], ['Версия', '4'], ['Возраст от', '18'], ['Возраст до', '65'],
    ['Примерная длительность (мин)', '10'], ['Название маршрута (RU)', 'Маршрут с черновиком факта'], ['Название маршрута (EN)', 'Journey with a draft fact'],
    ['Описание маршрута (RU)', 'Синтетический текст и непроверенные ссылки для проверки формы.'], ['Описание маршрута (EN)', 'Synthetic text and unverified references for checking the form.'],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('Страна', { exact: true }).selectOption('country-a');
  await page.getByLabel('Писатель', { exact: true }).selectOption('writer-a');
  await page.getByLabel('Книга', { exact: true }).selectOption('work-a');
  const factOpener = page.locator('summary#journey-fact-heading');
  const activityOpener = page.locator('summary#journey-activity-heading');
  await expect(factOpener.locator('..')).not.toHaveAttribute('open', '');
  await expect(activityOpener.locator('..')).not.toHaveAttribute('open', '');
  expect(await factOpener.evaluate(node => Boolean(node.compareDocumentPosition(document.getElementById('journey-activity-heading')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await factOpener.tap();
  const factEnabled = page.getByLabel('Добавить факт об этой книге', { exact: true });
  await expect(factEnabled).not.toBeChecked();
  await factEnabled.check();
  const editor = page.locator('[data-booky-fact-editor]');
  const sourceField = (name, number, locale) => page.getByLabel(`${name} ${number} (${locale.toUpperCase()})`, { exact: true });
  const factVariantPanel = locale => page.locator(`[data-booky-copy-variants="sourced-fact"][data-copy-locale="${locale}"]`);
  const factVariantField = (locale, field) => factVariantPanel(locale).getByRole('textbox', { name: locale === 'ru'
    ? `${field === 'caption' ? 'Подпись' : 'Короткий текст'} «Факт» (RU)`
    : `${field === 'caption' ? 'Caption' : 'Short text'} “Fact” (EN)`, exact: true });
  for (const locale of ['ru', 'en']) {
    await expect(page.getByLabel(`Название факта (${locale.toUpperCase()})`, { exact: true })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: `Текст факта (${locale.toUpperCase()})`, exact: true })).toHaveValue('');
    for (const name of ['ID источника', 'HTTPS URL источника', 'Дата обращения к источнику']) {
      await expect(sourceField(name, 1, locale)).toHaveValue('');
      await expect(sourceField(name, 2, locale)).toHaveCount(0);
    }
    await expect(factVariantPanel(locale)).not.toHaveAttribute('open', '');
    await factVariantPanel(locale).locator('summary').tap();
    await expect(factVariantField(locale, 'caption')).toHaveValue('');
    await expect(factVariantField(locale, 'reduced')).toHaveValue('');
    for (const control of [factVariantPanel(locale).locator('summary'), factVariantField(locale, 'caption'), factVariantField(locale, 'reduced')])
      expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(factVariantField(locale, 'caption')).toHaveAttribute('lang', locale);
    await expect(factVariantField(locale, 'reduced')).toHaveAttribute('lang', locale);
  }
  const previewButton = page.getByRole('button', { name: 'Предпросмотр маршрута', exact: true });
  const downloadButton = page.getByRole('button', { name: 'Скачать черновик JSON', exact: true });
  const preview = page.locator('[data-booky-journey-preview]');
  const factStep = preview.locator('[data-preview-step="sourced-fact"]');
  await previewButton.tap();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(preview).toHaveCount(0);
  await downloadButton.tap(); expect(downloads).toEqual([]);
  expect(await page.evaluate(() => window.__factExportBlobs.length)).toBe(0);
  for (const locale of ['ru', 'en']) {
    await page.getByLabel(`Название факта (${locale.toUpperCase()})`, { exact: true }).fill(copy[locale].title);
    await page.getByRole('textbox', { name: `Текст факта (${locale.toUpperCase()})`, exact: true }).fill(copy[locale].body);
    await factVariantField(locale, 'caption').fill(copy[locale].caption);
    if (Object.hasOwn(copy[locale], 'reduced')) await factVariantField(locale, 'reduced').fill(copy[locale].reduced);
    const source = copy[locale].sources[0];
    await sourceField('ID источника', 1, locale).fill(source.id);
    await sourceField('HTTPS URL источника', 1, locale).fill(source.url);
    if (locale === 'ru') await sourceField('Дата обращения к источнику', 1, locale).fill(source.accessedAt);
  }
  await expect(sourceField('Дата обращения к источнику', 1, 'en')).toHaveValue('');
  await previewButton.tap(); await expect(preview).toHaveCount(0);
  await downloadButton.tap(); expect(downloads).toEqual([]);
  await expect(sourceField('Дата обращения к источнику', 1, 'en')).toHaveValue('');
  await sourceField('Дата обращения к источнику', 1, 'en').fill(copy.en.sources[0].accessedAt);
  const workVariants = page.locator('[data-booky-copy-variants="work"][data-copy-locale="ru"]');
  await workVariants.locator('summary').tap();
  const workCaption = workVariants.getByRole('textbox', { name: 'Подпись «Книга» (RU)', exact: true });
  await workCaption.fill('Авторская синтетическая подпись шага книги.');
  await page.getByRole('button', { name: 'Добавить источник (RU)', exact: true }).tap();
  for (const [name, key] of [['ID источника', 'id'], ['HTTPS URL источника', 'url'], ['Дата обращения к источнику', 'accessedAt']])
    await sourceField(name, 2, 'ru').fill(copy.ru.sources[1][key]);
  await previewButton.tap(); await expect(preview).toBeVisible();
  const next = preview.getByRole('button', { name: /^(?:Следующий шаг|Next step)$/ });
  const previous = preview.getByRole('button', { name: /^(?:Предыдущий шаг|Previous step)$/ });
  const stepStatus = preview.locator('p[role="status"]').filter({ hasText: /^(?:Шаг |Step )/ });
  await expect(stepStatus).toContainText(/^(?:Шаг 1 из 5|Step 1 of 5)/);
  const overview = preview.locator('[data-booky-journey-step-overview]');
  await expect(overview).not.toHaveAttribute('open', '');
  await overview.locator('summary').tap();
  await expect(overview.getByRole('button')).toHaveText(['1. Страна', '2. Писатель', '3. Книга', '4. Факт', '5. Завершение']);
  await overview.locator('[data-preview-step-choice="sourced-fact"]').tap();
  await expect(factStep).toBeVisible();
  await expect(overview.locator('[data-preview-step-choice="sourced-fact"]')).toHaveAttribute('aria-current', 'step');
  await overview.locator('[data-preview-step-choice="country"]').tap();
  await expect(stepStatus).toContainText(/^(?:Шаг 1 из 5|Step 1 of 5)/);
  await overview.locator('summary').tap();
  await expect(preview.locator('[data-booky-fact-sources]')).toHaveCount(0);
  for (let index = 0; index < 3; index++) await next.tap();
  await expect(factStep).toHaveAttribute('lang', 'ru');
  await expect(factStep).toContainText(copy.ru.title); await expect(factStep).toContainText(copy.ru.body);
  const factBodyRu = factStep.locator('p').filter({ hasText: 'Это вымышленный текст для проверки редактора.' });
  expect(await factBodyRu.evaluate(node => node.textContent)).toBe(copy.ru.body);
  expect(await factBodyRu.evaluate(node => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
  await expect(factStep).toContainText('Тестовая книга А'); await expect(factStep).toContainText('Экран: Коллекция');
  await expect(factStep.getByRole('note')).toContainText('Черновик факта — источники ещё требуют проверки');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await next.tap(); await expect(preview.locator('[data-preview-step="checkpoint"]')).toBeVisible();
  await expect(next).toBeDisabled(); await expect(preview.locator('[data-booky-fact-sources]')).toHaveCount(0);
  await previous.tap();
  const pendingDownload = page.waitForEvent('download');
  await downloadButton.tap();
  const download = await pendingDownload;
  expect(await download.failure()).toBeNull();
  const exportedPath = testInfo.outputPath('synthetic-fact-draft.json'); await download.saveAs(exportedPath);
  const bytes = await fs.readFile(exportedPath), draft = JSON.parse(bytes.toString('utf8'));
  expect(downloads).toHaveLength(1); expect(await page.evaluate(() => window.__factExportBlobs.length)).toBe(1);
  expect(await page.evaluate(() => window.__factExportBlobs[0].text())).toBe(bytes.toString('utf8'));
  expect(draft.authoringSource.input.fact).toEqual({ copy });
  expect(draft.authoringSource.input.copy.ru.nodes.work.caption).toBe('Авторская синтетическая подпись шага книги.');
  expect(Object.hasOwn(draft.authoringSource.input.copy.ru.nodes.work, 'reduced')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input.fact.copy.en, 'reduced')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input, 'activity')).toBe(false);
  expect(draft.definitions).toHaveLength(2); expect(draft.dialogues).toHaveLength(10);
  for (const definition of draft.definitions) {
    expect(definition.audience).toBe('adult'); expect(definition.ageRange).toEqual({ min: 18, max: 65 });
    expect(definition.readingLevel).toBe('plain');
    expect(definition.nodes.map(node => node.kind)).toEqual(['country', 'writer', 'work', 'sourced-fact', 'checkpoint']);
    expect(definition.nodes[3]).toMatchObject({ id: 'sourced-fact', kind: 'sourced-fact', screen: 'collection',
      entity: { kind: 'work', countryId: 'country-a', writerId: 'writer-a', workId: 'work-a' },
      fact: { schemaVersion: 1, id: 'synthetic-fact.work-fact', version: 4 },
    });
    expect(definition.nodes[3].fact.dialogues.map(binding => binding.locale)).toEqual(['ru', 'en']);
    for (const binding of definition.nodes[3].fact.dialogues) {
      expect(binding.id).toBe('synthetic-fact.sourced-fact'); expect(binding.version).toBe(4);
      const record = draft.dialogues.find(record => record.payload.locale === binding.locale && record.payload.id === binding.id);
      expect(binding.contentChecksum).toBe(record.review.contentChecksum);
    }
    expect(definition.nodes[3].dialogue.contentChecksum).toBe(definition.nodes[3].fact.dialogues.find(binding => binding.locale === definition.locale).contentChecksum);
  }
  expect(draft.definitions[0].nodes[3].fact).toEqual(draft.definitions[1].nodes[3].fact);
  const factRecords = draft.dialogues.filter(record => record.payload.intent === 'sourced-fact');
  expect(factRecords).toHaveLength(2);
  for (const record of factRecords) {
    expect(record.payload.claimKind).toBe('factual');
    expect(record.payload.copy).toEqual({ title: copy[record.payload.locale].title, body: copy[record.payload.locale].body,
      caption: copy[record.payload.locale].caption, reduced: copy[record.payload.locale].reduced ?? copy[record.payload.locale].title });
    expect(record.payload.factualSources).toEqual(copy[record.payload.locale].sources);
    expect(record.payload.provenance.sourceRef).toBe(`/input/fact/copy/${record.payload.locale}`);
    expect(record.payload.provenance.sourceSha256).toBe(draft.authoringSourceChecksum);
  }
  for (const record of draft.dialogues) expect(record.review).toMatchObject({ status: 'draft', reviewer: null, reviewedAt: null });
  for (const key of ['journeyApprovals', 'dialogueApprovals', 'currentVersions', 'availability']) expect(draft[key]).toEqual([]);
  expect(draft.releaseReady).toBe(false); expect(draft.humanReviewed).toBe(false);
  expect(draft.childApproved).toBe(false); expect(draft.narrationApproved).toBe(false);
  expect(await page.evaluate(() => window.__activityValidationCalls)).toEqual([]);
  const fileOpener = page.locator('summary#journey-open-heading'); await fileOpener.tap();
  const openDraft = page.getByLabel('Открыть черновик JSON', { exact: true });
  const upload = (name, buffer = bytes) => openDraft.setInputFiles({ name, mimeType: 'application/json', buffer });
  const factTitleRu = page.getByLabel('Название факта (RU)', { exact: true });
  await factTitleRu.fill('Текущие несохранённые правки факта');
  await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap();
  const preservedPreview = await preview.innerText();
  const missingInputSources = structuredClone(draft); missingInputSources.authoringSource.input.fact.copy.en.sources = [];
  const missingPayloadSources = structuredClone(draft); missingPayloadSources.dialogues.find(record => record.payload.intent === 'sourced-fact').payload.factualSources = [];
  const metadataTamper = structuredClone(draft); metadataTamper.authoringSource.input.fact.copy.ru.sources[0].url = 'https://example.test/ru/tampered-reference';
  const bindingTamper = structuredClone(draft); bindingTamper.definitions[1].nodes[3].fact.dialogues[0].contentChecksum = '0'.repeat(64);
  const rehashedVariantTamper = await page.evaluate(original => {
    const forged = structuredClone(original), hash = window.__copyVariantRecordHash;
    const record = forged.dialogues.find(record => record.payload.intent === 'sourced-fact' && record.payload.locale === 'ru');
    record.payload.copy.caption = 'Подменённая подпись с пересчитанными производными хешами.';
    record.review.contentChecksum = hash(record.payload);
    record.checksum = hash({ payload: record.payload, review: record.review });
    for (const definition of forged.definitions) {
      const node = definition.nodes.find(node => node.kind === 'sourced-fact');
      if (definition.locale === 'ru') node.dialogue.contentChecksum = record.review.contentChecksum;
      node.fact.dialogues.find(binding => binding.locale === 'ru').contentChecksum = record.review.contentChecksum;
      forged.definitionsChecksums.find(binding => binding.locale === definition.locale).checksum = hash(definition);
    }
    return forged;
  }, draft);
  expect(rehashedVariantTamper.authoringSource).toEqual(draft.authoringSource);
  expect(rehashedVariantTamper.dialogues.find(record => record.payload.intent === 'sourced-fact' && record.payload.locale === 'ru').review.contentChecksum)
    .not.toBe(draft.dialogues.find(record => record.payload.intent === 'sourced-fact' && record.payload.locale === 'ru').review.contentChecksum);
  for (const [filename, buffer] of [
    ['malformed-fact.json', Buffer.from('{')],
    ['missing-fact-input-sources.json', Buffer.from(JSON.stringify(missingInputSources))],
    ['missing-fact-payload-sources.json', Buffer.from(JSON.stringify(missingPayloadSources))],
    ['tampered-fact-source.json', Buffer.from(JSON.stringify(metadataTamper))],
    ['tampered-fact-binding.json', Buffer.from(JSON.stringify(bindingTamper))],
    ['rehashed-fact-copy-variant.json', Buffer.from(JSON.stringify(rehashedVariantTamper))],
  ]) {
    await upload(filename, buffer); await expect(page.getByRole('alert')).toBeVisible();
    await expect(factTitleRu).toHaveValue('Текущие несохранённые правки факта');
    await expect(sourceField('ID источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].id);
    await expect(factVariantField('ru', 'caption')).toHaveValue(copy.ru.caption);
    await expect(factVariantField('en', 'reduced')).toHaveValue('');
    expect(await preview.innerText()).toBe(preservedPreview);
    expect(downloads).toHaveLength(1);
  }
  await upload('valid-fact-draft.json');
  await expect(factEnabled).toBeChecked(); await expect(preview).toHaveCount(0); await expect(openDraft).toHaveValue('');
  await expect(workCaption).toHaveValue('Авторская синтетическая подпись шага книги.');
  for (const locale of ['ru', 'en']) {
    await expect(page.getByLabel(`Название факта (${locale.toUpperCase()})`, { exact: true })).toHaveValue(copy[locale].title);
    await expect(page.getByRole('textbox', { name: `Текст факта (${locale.toUpperCase()})`, exact: true })).toHaveValue(copy[locale].body);
    await expect(factVariantField(locale, 'caption')).toHaveValue(copy[locale].caption);
    await expect(factVariantField(locale, 'reduced')).toHaveValue(copy[locale].reduced ?? '');
    for (let index = 0; index < copy[locale].sources.length; index++) {
      for (const [name, key] of [['ID источника', 'id'], ['HTTPS URL источника', 'url'], ['Дата обращения к источнику', 'accessedAt']])
        await expect(sourceField(name, index + 1, locale)).toHaveValue(copy[locale].sources[index][key]);
    }
  }
  await sourceField('HTTPS URL источника', 1, 'ru').fill('https://example.test/ru/edited-first-reference');
  await expect(sourceField('HTTPS URL источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].url);
  await sourceField('HTTPS URL источника', 1, 'ru').fill(copy.ru.sources[0].url);
  await page.getByRole('button', { name: 'Добавить источник (EN)', exact: true }).tap();
  await expect(sourceField('ID источника', 2, 'en')).toHaveValue('');
  await page.getByRole('button', { name: 'Удалить источник 2 (EN)', exact: true }).tap();
  await expect(sourceField('ID источника', 2, 'en')).toHaveCount(0);
  await expect(sourceField('ID источника', 1, 'en')).toHaveValue(copy.en.sources[0].id);
  await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap();
  const factCopyView = preview.locator('[data-booky-preview-copy-view]');
  const factCopyText = preview.locator('[data-booky-preview-copy]');
  await expect(factCopyView).toHaveValue('body');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  async function capture(filename, scope) {
    await factStep.scrollIntoViewIfNeeded(); const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
    screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  }
  async function verifySources(locale) {
    const metadata = factStep.locator('[data-booky-fact-sources]');
    await expect(factStep).toHaveAttribute('lang', locale);
    await expect(factStep).toContainText(copy[locale].title); await expect(factStep).toContainText(copy[locale].body);
    await expect(metadata.getByRole('link')).toHaveCount(copy[locale].sources.length);
    for (const source of copy[locale].sources) {
      await expect(metadata).toContainText(source.id); await expect(metadata).toContainText(source.accessedAt);
      const link = metadata.getByRole('link', { name: source.url, exact: true });
      await expect(link).toHaveAttribute('href', source.url); await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('target', '_blank'); expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(metadata.locator(`time[datetime="${source.accessedAt}"]`)).toHaveText(source.accessedAt);
    }
    expect(await overflow()).toBe(false);
  }
  await verifySources('ru');
  await expect(factStep.getByRole('note')).toContainText('Черновик факта — источники ещё требуют проверки');
  await factCopyView.selectOption('caption'); expect(await factCopyText.evaluate(node => node.textContent)).toBe(copy.ru.caption);
  await factCopyView.selectOption('reduced'); expect(await factCopyText.evaluate(node => node.textContent)).toBe(copy.ru.reduced);
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  for (const control of [factOpener, factEnabled.locator('..'), factTitleRu, sourceField('ID источника', 1, 'ru'), sourceField('HTTPS URL источника', 1, 'ru'), sourceField('Дата обращения к источнику', 1, 'ru'), previous, next])
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await capture('booky-journey-fact-ru-320.png', 'Actual local sourced-fact preview after native reopen, RU320 short-text view; explicitly authored synthetic reduced copy and unverified source references, never fetched or attested.');
  await preview.getByRole('button', { name: 'English', exact: true }).tap();
  await expect(factCopyView).toHaveValue('reduced'); await expect(factCopyText).toHaveText(copy.en.title);
  await factCopyView.selectOption('body');
  await verifySources('en');
  await expect(stepStatus).toContainText('Step 4 of 5 · Fact');
  await expect(factStep).toContainText('Canonical record: Synthetic work A');
  await expect(factStep).toContainText('Screen: Collection');
  await expect(overview.locator('summary')).toHaveText('Journey steps (5)');
  await overview.locator('summary').tap();
  await expect(overview.getByRole('button')).toHaveText(['1. Country', '2. Writer', '3. Work', '4. Fact', '5. Finish']);
  await expect(overview.locator('[data-preview-step-choice="sourced-fact"]')).toHaveAttribute('aria-current', 'step');
  await overview.locator('summary').tap();
  await expect(factStep.getByRole('note')).toContainText('Draft fact — sources still need review');
  await factCopyView.selectOption('caption'); expect(await factCopyText.evaluate(node => node.textContent)).toBe(copy.en.caption);
  expect(await factCopyText.evaluate(node => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
  expect((await factCopyView.boundingBox()).height).toBeGreaterThanOrEqual(44); expect(await overflow()).toBe(false);
  await capture('booky-journey-fact-en-320.png', 'Same selected-work draft fact in EN320 caption view; independent authored multiline caption, source ID/HTTPS URL/manual UTC date and explicit review notice.');
  await activityOpener.tap();
  await page.getByLabel('Добавить задание «Книга и автор»', { exact: true }).check();
  await page.getByLabel('Автор · вариант 1', { exact: true }).selectOption(JSON.stringify(['country-a', 'writer-a']));
  await page.getByLabel('Автор · вариант 2', { exact: true }).selectOption(JSON.stringify(['country-b', 'writer-c']));
  await previewButton.tap(); await expect(preview).toBeVisible(); await expect(stepStatus).toContainText(/^(?:Шаг 1 из 6|Step 1 of 6)/);
  await expect(overview).not.toHaveAttribute('open', '');
  await overview.locator('summary').tap();
  await expect(overview.locator('summary')).toHaveText('Шаги маршрута (6)');
  await expect(overview.getByRole('button')).toHaveText(['1. Страна', '2. Писатель', '3. Книга', '4. Факт', '5. Задание', '6. Завершение']);
  for (const control of await overview.getByRole('button').all()) {
    const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  }
  expect(await overflow()).toBe(false);
  await overview.locator('[data-preview-step-choice="sourced-fact"]').tap();
  await expect(factStep).toBeVisible();
  await overview.locator('[data-preview-step-choice="activity"]').tap();
  const activityStep = preview.locator('[data-preview-step="activity"]');
  await expect(stepStatus).toContainText(/^(?:Шаг 5 из 6|Step 5 of 6)/);
  await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  await activityStep.getByRole('button', { name: 'Проверить ответ', exact: true }).tap();
  await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict', 'correct');
  await expect(stepStatus).toContainText(/^(?:Шаг 5 из 6|Step 5 of 6)/);
  const validationCalls = await page.evaluate(() => window.__activityValidationCalls);
  const answerCalls = await page.evaluate(() => window.__activityAnswerCalls);
  expect(validationCalls).toHaveLength(1); expect(answerCalls).toHaveLength(1);
  expect(validationCalls[0].actualHelperCalled).toBe(true); expect(validationCalls[0].actualResult.ok).toBe(true);
  expect(answerCalls[0].actualHelperCalled).toBe(true); expect(answerCalls[0].actualResult.correct).toBe(true);
  expect(answerCalls[0].actualResult.draftChecksum).toBe(validationCalls[0].actualResult.draftChecksum);
  await previous.tap(); await expect(factStep).toBeVisible(); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  expect(downloads).toHaveLength(1); expect(screenshots).toHaveLength(2);
  expect(await page.evaluate(() => window.__factExportBlobs.length)).toBe(1);
  const storageWrites = await page.evaluate(() => window.__factStorageWrites); expect(storageWrites).toEqual([]);
  expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  await testInfo.attach('booky-journey-fact-evidence', { contentType: 'application/json', body: JSON.stringify({
    pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true, actualDraftParser: true,
    syntheticCatalog: true, authoredSyntheticUnverifiedFact: true, sourceUrlsFetched: false, sourcesAttested: false,
    optionalFactStartsCollapsedBeforeActivity: true, initialFactCopyAndSourceFieldsBlank: true, noAutomaticAccessDate: true,
    missingFieldsPreventPreviewAndDownload: true, selectedWorkAnchorOnCollection: true,
    bilingualDefinitions: 2, factOnlySemanticNodesPerDefinition: 5, unapprovedDialogueDrafts: 10,
    independentRuEnSourcesPreserved: true, orderedRuEnContentBindingVerified: true, nativeBlobExportObserved: true,
    nativeFileImportRestoresEverySourceRow: true, importedMultiSourceEditsPreserveOtherRows: true, sourceAddRemoveVerified: true,
    malformedMissingSourceAndFullEnvelopeTamperPreserveInputAndPreview: true,
    factPreviewShowsOnlyCurrentLocaleSourceMetadata: true, draftSourceReviewNoticeLocalized: true,
    authoredBaseAndFactCopyVariantsExportedAndNativeImported: true, optionalVariantsStartBlankInCollapsedLocaleDetails: true,
    independentOptionalEnReducedOmissionUsesCompiledTitleFallback: true, localizedExplicitCopyViewKeepsCurrentSemanticStep: true,
    multilineCaptionAndShortTextPreviewPreserved: true, rehashedDerivedCopyVariantTamperCannotReplaceInputOrPreview: true,
    englishPreviewConditionsStepLabelsRecordScreenAndSequentialNavigationLocalized: true,
    sourceLinksHaveHttpsNoopenerNoreferrer: true, narrow320LayoutHasNoHorizontalOverflow: true, minimumControlHitHeightCssPx: 44,
    combinedFactThenActivityPreviewVerified: true, combinedDraftAnswerBoundToSameWholeHash: true,
    factFiveNodeOverviewRuEnVerified: true, combinedSixNodeOverviewUsesActualDefinitionOrder: true,
    trustedOverviewFactAndActivityJumpsStayLocal: true, combinedOverviewControlsMinimum44CssPx: true,
    combinedCurrentCreditedAuthorCheckUsesActualHelper: true, mockedServerActionTransport: true,
    authenticatedAdminServerTested: false, installedDeviceTested: false, answerCheckDoesNotAdvanceStep: true,
    storageWrites, downloads, exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length },
    validationCalls, answerCalls, sourceInputs: fixture.sourceInputs, screenshots, errors, externalRequests,
    productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  }, null, 2) });
});
