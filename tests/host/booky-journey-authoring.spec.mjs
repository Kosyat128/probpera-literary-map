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
  const widthPanel = preview.locator('[data-booky-preview-width]');
  const previewFrame = preview.locator('[data-booky-preview-frame]');
  const reviewReport = preview.locator('[data-booky-review-report]');
  const comparison = preview.locator('[data-booky-copy-comparison]');
  const comparisonColumns = comparison.locator('[data-booky-comparison-columns]');
  const comparisonRu = comparison.locator('[data-comparison-locale="ru"]');
  const comparisonEn = comparison.locator('[data-comparison-locale="en"]');
  const previewWidthMeasurements = [];
  async function measurePreviewWidth() {
    const measured = await previewFrame.evaluate(node => ({ mode: node.dataset.previewWidth,
      width: node.getBoundingClientRect().width, available: node.parentElement.getBoundingClientRect().width,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
    previewWidthMeasurements.push(measured);
    expect(measured.width).toBeLessThanOrEqual(measured.available + 1);
    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);
    return measured;
  }
  await previewButton.tap();
  await expect(preview).toHaveCount(0);
  const searchPanel = kind => page.locator(`[data-booky-entity-search="${kind}"]`);
  const searchQuery = kind => searchPanel(kind).locator('input[type="search"]');
  for (const kind of ['country', 'writer', 'work']) await expect(searchPanel(kind)).not.toHaveAttribute('open', '');
  await expect(searchQuery('country')).toBeEnabled(); await expect(searchQuery('writer')).toBeDisabled(); await expect(searchQuery('work')).toBeDisabled();
  const initiallyInvalidCountry = page.getByRole('combobox', { name: 'Страна', exact: true });
  await expect(initiallyInvalidCountry).toHaveAttribute('aria-invalid', 'true');
  const initialCountryErrorIds = await initiallyInvalidCountry.getAttribute('aria-describedby'); expect(initialCountryErrorIds).toBeTruthy();
  await searchPanel('country').locator('summary').focus(); await searchPanel('country').locator('summary').press('Enter');
  await expect(searchPanel('country').getByRole('searchbox', { name: 'Поиск страны (RU / EN / ID)', exact: true })).toBeVisible();
  await searchQuery('country').fill('country-a'); await expect(initiallyInvalidCountry).toHaveValue('');
  await expect(initiallyInvalidCountry).toHaveAttribute('aria-invalid', 'true'); await expect(initiallyInvalidCountry).toHaveAttribute('aria-describedby', initialCountryErrorIds);
  await searchPanel('country').getByRole('button', { name: 'Очистить поиск', exact: true }).tap();
  await searchPanel('country').locator('summary').tap();
  for (const [label, value] of [
    ['Идентификатор маршрута', 'synthetic-journey'], ['Версия', '2'], ['Возраст от', '18'], ['Возраст до', '65'],
    ['Примерная длительность (мин)', '8'], ['Название маршрута (RU)', 'Тестовый маршрут'], ['Название маршрута (EN)', 'Synthetic journey'],
    ['Описание маршрута (RU)', 'Черновик для проверки редактора.'], ['Описание маршрута (EN)', 'A draft for testing the editor.'],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('Уровень чтения', { exact: true }).selectOption('plain');
  const country = page.getByLabel('Страна', { exact: true }), writer = page.getByLabel('Писатель', { exact: true }), work = page.getByLabel('Книга', { exact: true });
  await country.selectOption('country-a'); await writer.selectOption('writer-a'); await work.selectOption('work-a');
  await searchPanel('work').locator('summary').tap(); await searchQuery('work').fill('work-a');
  await writer.selectOption('writer-b');
  await expect(searchQuery('work')).toHaveValue(''); await expect(searchQuery('work')).toBeEnabled();
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
  await searchPanel('country').locator('summary').tap(); await searchQuery('country').fill('SYNTHETIC COUNTRY');
  await searchPanel('writer').locator('summary').tap(); await searchQuery('writer').fill('writer-b'); await searchQuery('work').fill('work-b');
  await country.selectOption('country-b');
  await expect(searchQuery('country')).toHaveValue('SYNTHETIC COUNTRY');
  await expect(searchQuery('writer')).toHaveValue(''); await expect(searchQuery('work')).toHaveValue('');
  await expect(searchQuery('writer')).toBeEnabled(); await expect(searchQuery('work')).toBeDisabled();
  await expect(preview).toHaveCount(0);
  await expect(writer).toHaveValue(''); await expect(work).toHaveValue('');
  await expect(writer.locator('option[value="writer-a"]')).toHaveCount(0);
  await country.selectOption('country-a'); await writer.selectOption('writer-a'); await work.selectOption('work-a');
  await searchPanel('country').getByRole('button', { name: 'Очистить поиск', exact: true }).tap();
  for (const kind of ['country', 'writer', 'work']) await searchPanel(kind).locator('summary').tap();
  await page.evaluate(() => window.scrollTo(0, 0));
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await overflow()).toBe(false);
  async function capture(filename, scope) {
    const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
    screenshots.push({ filename, sha256: sha(await fs.readFile(p)), viewport: page.viewportSize(), scope });
  }
  for (const [kind, select, expectedId, queries, total] of [
    ['country', country, 'country-a', ['  ТЕСТОВАЯ СТРАНА А  ', 'SYNTHETIC COUNTRY A', ' COUNTRY-A '], 3],
    ['writer', writer, 'writer-a', ['ТЕСТОВЫЙ ПИСАТЕЛЬ А', ' SYNTHETIC WRITER A ', 'WRITER-A'], 2],
    ['work', work, 'work-a', ['ТЕСТОВАЯ КНИГА А', 'SYNTHETIC WORK A', ' WORK-A '], 1],
  ]) {
    const panel = searchPanel(kind), query = searchQuery(kind), result = panel.locator('[data-booky-search-result]');
    await panel.locator('summary').tap();
    const searchNames = { country: 'Поиск страны (RU / EN / ID)', writer: 'Поиск писателя (RU / EN / ID)', work: 'Поиск книги (RU / EN / ID)' };
    await expect(panel.getByRole('searchbox', { name: searchNames[kind], exact: true })).toHaveCount(1); await expect(query).toHaveAttribute('id', /.+/);
    const searchDescriptionIds = await query.getAttribute('aria-describedby'); expect(searchDescriptionIds).toBeTruthy();
    expect(await query.evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id => document.getElementById(id)))).toBe(true);
    for (const value of queries) {
      await query.fill(value); await expect(result).toHaveText('Совпадений: 1.');
      await expect(select.locator('option')).toHaveCount(2); await expect(select).toHaveValue(expectedId);
    }
    await query.fill('нет-соответствия');
    await expect(result).toHaveText('Совпадений: 0. Текущий выбор остаётся в списке и не входит в число совпадений.');
    await expect(select.locator('option')).toHaveCount(2); await expect(select.locator(`option[value="${expectedId}"]`)).toHaveCount(1);
    await expect(select).toHaveValue(expectedId); await query.press('Enter'); expect(downloads).toEqual([]);
    for (const control of [panel.locator('summary'), query, panel.getByRole('button'), select]) {
      const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    }
    expect(await overflow()).toBe(false);
    if (kind === 'country') {
      await panel.locator('summary').evaluate(node => { node.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
      for (const control of [panel.locator('summary'), query, result, select]) {
        const bounds = await control.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
      }
    }
    await panel.getByRole('button', { name: 'Очистить поиск', exact: true }).tap();
    await expect(query).toHaveValue(''); await expect(result).toHaveText(`Совпадений: ${total}.`);
    await expect(select.locator('option')).toHaveCount(total + 1); await expect(select).toHaveValue(expectedId);
    await panel.locator('summary').tap();
  }
  await searchPanel('country').locator('summary').tap(); await searchQuery('country').fill('country-b');
  await expect(searchPanel('country').locator('[data-booky-search-result]')).toHaveText('Совпадений: 1. Текущий выбор остаётся в списке и не входит в число совпадений.');
  await expect(country.locator('option')).toHaveCount(3); await expect(country).toHaveValue('country-a');
  await searchPanel('country').getByRole('button', { name: 'Очистить поиск', exact: true }).tap(); await searchPanel('country').locator('summary').tap();
  expect(await page.evaluate(() => ({ validation: window.__activityValidationCalls, answer: window.__activityAnswerCalls }))).toEqual({ validation: [], answer: [] });
  const enCountryVariants = page.locator('[data-booky-copy-variants="country"][data-copy-locale="en"]');
  const invalidEnCaption = enCountryVariants.getByRole('textbox', { name: 'Caption “Country” (EN)', exact: true, includeHidden: true });
  await enCountryVariants.locator('summary').tap();
  const authoredInvalidCaption = ' Untrimmed\ncaption ';
  await invalidEnCaption.fill(authoredInvalidCaption);
  const originalCaptionId = await invalidEnCaption.getAttribute('id'); expect(originalCaptionId).toBeTruthy();
  await enCountryVariants.locator('summary').tap(); await expect(enCountryVariants).not.toHaveAttribute('open', '');
  await previewButton.tap(); await expect(preview).toHaveCount(0);
  const captionErrorAction = page.locator('[data-booky-error-target="copy.en.nodes.country.caption"]');
  await expect(captionErrorAction).toHaveCount(1); await expect(captionErrorAction).toBeVisible();
  await expect(invalidEnCaption).toHaveAttribute('aria-invalid', 'true');
  const captionErrorIds = await invalidEnCaption.getAttribute('aria-describedby'); expect(captionErrorIds).toBeTruthy();
  expect(await invalidEnCaption.evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id =>
    document.getElementById(id)?.querySelector('[data-booky-error-target]')?.getAttribute('data-booky-error-target') === 'copy.en.nodes.country.caption'))).toBe(true);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('aria-describedby', 'journey-open-description');
  await expect(country).not.toHaveAttribute('aria-invalid', 'true'); await expect(country).toHaveValue('country-a');
  await expect(page.getByLabel('Название маршрута (RU)', { exact: true })).toHaveValue('Тестовый маршрут');
  await captionErrorAction.scrollIntoViewIfNeeded();
  const errorActionBounds = await captionErrorAction.boundingBox(); expect(errorActionBounds.height).toBeGreaterThanOrEqual(44); expect(errorActionBounds.width).toBeGreaterThanOrEqual(44);
  expect(errorActionBounds.x).toBeGreaterThanOrEqual(0); expect(errorActionBounds.x + errorActionBounds.width).toBeLessThanOrEqual(321);
  expect(await overflow()).toBe(false);
  await capture('booky-journey-editor-ru-320.png', 'Actual 320px authoring error summary with its 44px recovery action for a hidden EN multiline caption rejected because of outer whitespace. This is the real compiler error path; no translation or editorial judgment. Native touch and keyboard focus recovery is then verified against the existing textarea.');
  await captionErrorAction.tap(); await expect(enCountryVariants).toHaveAttribute('open', ''); await expect(invalidEnCaption).toBeFocused();
  await expect(invalidEnCaption).toHaveValue(authoredInvalidCaption); await expect(invalidEnCaption).toHaveAttribute('lang', 'en');
  await enCountryVariants.locator('summary').tap(); await expect(enCountryVariants).not.toHaveAttribute('open', '');
  await captionErrorAction.focus(); await expect(captionErrorAction).toBeFocused(); await page.keyboard.press('Enter');
  await expect(enCountryVariants).toHaveAttribute('open', ''); await expect(invalidEnCaption).toBeFocused();
  await expect(invalidEnCaption).toHaveAttribute('id', originalCaptionId); await expect(invalidEnCaption).toHaveValue(authoredInvalidCaption);
  await invalidEnCaption.fill(''); await expect(captionErrorAction).toHaveCount(0);
  await expect(invalidEnCaption).not.toHaveAttribute('aria-invalid', 'true'); await expect(invalidEnCaption).not.toHaveAttribute('aria-describedby', /.+/);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('aria-describedby', 'journey-open-description');
  await expect(page.getByLabel('Название маршрута (RU)', { exact: true })).toHaveValue('Тестовый маршрут');
  await enCountryVariants.locator('summary').tap();
  const ageMinimum = page.getByLabel('Возраст от', { exact: true }), ageMaximum = page.getByLabel('Возраст до', { exact: true });
  await ageMaximum.fill('17'); await previewButton.tap(); await expect(preview).toHaveCount(0);
  const ageErrorAction = page.locator('[data-booky-error-target="ageRange"]');
  await expect(ageErrorAction).toHaveCount(1);
  await expect(ageMinimum).toHaveAttribute('aria-invalid', 'true'); await expect(ageMaximum).toHaveAttribute('aria-invalid', 'true');
  const ageErrorIds = await ageMinimum.getAttribute('aria-describedby'); expect(ageErrorIds).toBeTruthy();
  await expect(ageMaximum).toHaveAttribute('aria-describedby', ageErrorIds);
  expect(await ageMinimum.evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id =>
    document.getElementById(id)?.querySelector('[data-booky-error-target]')?.getAttribute('data-booky-error-target') === 'ageRange'))).toBe(true);
  await ageErrorAction.tap(); await expect(ageMinimum).toBeFocused();
  await expect(ageMinimum).toHaveValue('18'); await expect(ageMaximum).toHaveValue('17');
  await expect(country).toHaveValue('country-a'); await expect(work).toHaveValue('work-a');
  await ageMaximum.fill('65'); await expect(ageErrorAction).toHaveCount(0);
  for (const control of [ageMinimum, ageMaximum]) {
    await expect(control).not.toHaveAttribute('aria-invalid', 'true'); await expect(control).not.toHaveAttribute('aria-describedby', /.+/);
  }
  expect(await page.evaluate(() => ({ validation: window.__activityValidationCalls, answer: window.__activityAnswerCalls }))).toEqual({ validation: [], answer: [] });
  await previewButton.tap();
  const previous=preview.getByRole('button',{name: /^(?:Предыдущий шаг|Previous step)$/});
  const next=preview.getByRole('button',{name: /^(?:Следующий шаг|Next step)$/});
  await expect(widthPanel).not.toHaveAttribute('open', '');
  await expect(reviewReport).not.toHaveAttribute('open', '');
  await expect(comparison).not.toHaveAttribute('open','');
  await expect(reviewReport.locator('summary')).toHaveText('Отчёт по черновику (4)');
  await expect(previewFrame).toHaveAttribute('data-preview-width', 'available');
  await measurePreviewWidth();
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
  await expect(comparison).toHaveAttribute('data-comparison-node','work');
  await expect(comparison.locator('summary')).toHaveText('Сравнить тексты RU и EN');
  await comparison.locator('summary').focus(); await comparison.locator('summary').press('Enter'); await expect(comparison.locator('summary')).toBeFocused();
  await expect(comparisonRu).toHaveAttribute('lang','ru'); await expect(comparisonEn).toHaveAttribute('lang','en');
  await expect(comparisonRu.locator('[data-comparison-title]')).toHaveText('Откройте книгу');
  await expect(comparisonEn.locator('[data-comparison-title]')).toHaveText('Open the book');
  await expect(comparisonRu.locator('[data-comparison-copy="body"]')).toHaveText('Перейдите к выбранной книге в коллекции.');
  await expect(comparisonEn.locator('[data-comparison-copy="body"]')).toHaveText('Go to the selected book in the collection.');
  await expect(comparison.locator('[data-comparison-presence="authored"]')).toHaveCount(2);
  const narrowComparisonRu = await comparisonRu.boundingBox(), narrowComparisonEn = await comparisonEn.boundingBox();
  expect(narrowComparisonEn.y).toBeGreaterThanOrEqual(narrowComparisonRu.y+narrowComparisonRu.height);
  expect(narrowComparisonEn.x).toBeCloseTo(narrowComparisonRu.x,0);
  expect(await comparisonColumns.evaluate(node => node.scrollWidth > node.clientWidth+1)).toBe(false);
  expect((await comparison.locator('summary').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await previewCopyView.selectOption('caption');
  await expect(comparisonRu.locator('[data-comparison-copy="caption"]')).toHaveText('Откройте книгу');
  await expect(comparisonEn.locator('[data-comparison-copy="caption"]')).toHaveText('Open the book');
  await expect(comparison.locator('[data-comparison-presence="title-fallback"]')).toHaveCount(2);
  await previewCopyView.selectOption('reduced'); await expect(comparison.locator('[data-comparison-presence="title-fallback"]')).toHaveCount(2);
  await previewCopyView.selectOption('body'); await comparison.locator('summary').press('Enter');
  await expect(comparison).not.toHaveAttribute('open','');
  await expect(previewFrame).toHaveAttribute('data-preview-width','available'); await expect(previewCopyView).toHaveValue('body');
  expect(await page.evaluate(() => window.__activityValidationCalls)).toEqual([]);
  await reviewReport.locator('summary').focus(); await reviewReport.locator('summary').press('Enter');
  await expect(reviewReport.locator('summary')).toBeFocused();
  expect(await reviewReport.locator('[data-review-node]').evaluateAll(nodes => nodes.map(node => node.dataset.reviewNode))).toEqual(['country','writer','work','checkpoint']);
  await expect(reviewReport.locator('[data-review-copy="main"][data-copy-presence="authored"]')).toHaveCount(8);
  await expect(reviewReport.locator('[data-review-copy="caption"][data-copy-presence="title-fallback"]')).toHaveCount(8);
  await expect(reviewReport.locator('[data-review-copy="reduced"][data-copy-presence="title-fallback"]')).toHaveCount(8);
  await expect(reviewReport.locator('[data-review-sources]')).toHaveCount(0);
  const inspectEnCountry = reviewReport.locator('[data-review-node="country"] [data-review-inspect="en"]');
  await inspectEnCountry.focus(); await inspectEnCountry.press('Enter'); await expect(inspectEnCountry).toBeFocused();
  await expect(preview.locator('[data-preview-step="country"]')).toHaveAttribute('lang','en');
  await expect(reviewReport.locator('summary')).toHaveText('Draft review report (4)');
  await expect(inspectEnCountry).toHaveAttribute('aria-current','step');
  await reviewReport.locator('[data-review-node="work"] [data-review-inspect="ru"]').tap();
  await expect(preview.locator('[data-preview-step="work"]')).toHaveAttribute('lang','ru');
  await expect(previewFrame).toHaveAttribute('data-preview-width','available'); await expect(previewCopyView).toHaveValue('body');
  for (const control of [reviewReport.locator('summary'), ...await reviewReport.getByRole('button').all()]) {
    const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  }
  expect(await overflow()).toBe(false); await reviewReport.locator('summary').tap();
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
  await profilePanel.locator('summary').tap(); await overviewSummary.tap();
  const widthSummaryRu = widthPanel.locator('summary');
  await expect(widthSummaryRu).toHaveText('Ширина предпросмотра');
  await widthSummaryRu.focus(); await widthSummaryRu.press('Enter'); await expect(widthSummaryRu).toBeFocused();
  const widthChoiceRu = widthPanel.getByRole('combobox', { name: 'Ширина области предпросмотра', exact: true });
  await expect(widthChoiceRu).toHaveValue('available');
  await expect(widthChoiceRu.locator('option')).toHaveText(['По доступной ширине', '320 пикс.', '768 пикс.']);
  await widthChoiceRu.focus(); await widthChoiceRu.selectOption('320'); await expect(widthChoiceRu).toBeFocused();
  await expect(previewFrame).toHaveAttribute('data-preview-width', '320'); await measurePreviewWidth();
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  await expect(profilePanel.locator('input[type="number"]')).toHaveValue('30'); await expect(profilePanel.locator('select')).toHaveValue('plain');
  await expect(previewCopyView).toHaveValue('body'); await expect(previewCopy).toHaveText('Перейдите к выбранной книге в коллекции.');
  await expect(overview.locator('[data-preview-step-choice="work"]')).toHaveAttribute('aria-current', 'step');
  for (const control of [widthSummaryRu, widthChoiceRu]) {
    const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  }
  await widthPanel.scrollIntoViewIfNeeded();
  await widthPanel.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 12));
  for (const control of [widthSummaryRu, widthChoiceRu]) {
    const bounds = await control.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  }
  const narrowFrameBounds = await previewFrame.boundingBox();
  expect(narrowFrameBounds.y).toBeGreaterThanOrEqual(0); expect(narrowFrameBounds.y).toBeLessThan(844);
  expect(narrowFrameBounds.x + narrowFrameBounds.width).toBeLessThanOrEqual(321);
  expect(await overflow()).toBe(false);
  await widthSummaryRu.press('Enter'); await profilePanel.locator('summary').tap(); await overviewSummary.tap();
  await profileEnabledRu.uncheck(); await expect(profileReport).toHaveCount(0); await profilePanel.locator('summary').tap();
  await next.tap();
  await expect(next).toBeDisabled();
  await expect(preview.locator('[data-preview-step="checkpoint"]')).toContainText('Отметьте завершение этого маршрута.');
  await previous.tap();
  await preview.getByRole('button',{name:'English',exact:true}).tap();
  await widthPanel.locator('summary').tap();
  await expect(widthPanel.locator('summary')).toHaveText('Preview width');
  const widthChoiceEn = widthPanel.getByRole('combobox', { name: 'Preview frame width', exact: true });
  await expect(widthChoiceEn).toHaveValue('320');
  await expect(widthChoiceEn.locator('option')).toHaveText(['Available width', '320 px', '768 px']);
  await widthChoiceEn.selectOption('768'); await measurePreviewWidth();
  await expect(preview.locator('[data-preview-step="work"]')).toHaveAttribute('lang', 'en');
  await widthChoiceEn.selectOption('320'); await widthPanel.locator('summary').tap();
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
  await workCaption.fill('Откройте книгу'); await previewButton.tap();
  await expect(reviewReport).not.toHaveAttribute('open',''); await reviewReport.locator('summary').tap();
  await expect(reviewReport.locator('[data-review-node="work"] [data-review-locale="ru"] [data-review-copy="caption"]')).toHaveAttribute('data-copy-presence','authored');
  await expect(reviewReport.locator('[data-review-node="work"] [data-review-locale="ru"]')).toContainText('Подпись: авторский текст');
  await expect(reviewReport.locator('[data-review-node="work"] [data-review-locale="en"] [data-review-copy="caption"]')).toHaveAttribute('data-copy-presence','title-fallback');
  await reviewReport.locator('[data-review-node="work"] [data-review-inspect="ru"]').tap(); await previewCopyView.selectOption('caption');
  await expect(comparison).not.toHaveAttribute('open',''); await comparison.locator('summary').tap();
  await expect(comparisonRu.locator('[data-comparison-copy="caption"]')).toHaveText('Откройте книгу');
  await expect(comparisonEn.locator('[data-comparison-copy="caption"]')).toHaveText('Open the book');
  await expect(comparisonRu.locator('[data-comparison-presence]')).toHaveAttribute('data-comparison-presence','authored');
  await expect(comparisonEn.locator('[data-comparison-presence]')).toHaveAttribute('data-comparison-presence','title-fallback');
  await previewCopyView.selectOption('body');
  await workCaption.fill(''); await expect(reviewReport).toHaveCount(0);
  await expect(comparison).toHaveCount(0);
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
  expect(Object.hasOwn(draft.authoringSource.input,'previewWidth')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input,'reviewReport')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input,'copyComparison')).toBe(false);
  expect(Object.hasOwn(draft.authoringSource.input,'entityQueries')).toBe(false);
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
  await reviewReport.locator('summary').tap(); const preservedReport = await reviewReport.innerText();
  await comparison.locator('summary').tap(); const preservedComparison = await comparison.innerText();
  for (const kind of ['country', 'writer', 'work']) {
    await searchPanel(kind).locator('summary').tap(); await searchQuery(kind).fill('preserve-' + kind);
  }
  const tampered=structuredClone(draft);tampered.releaseReady=true;
  await upload('tampered-draft.json',Buffer.from(JSON.stringify(tampered)));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(routeTitle).toHaveValue('Несохранённые правки');
  await expect(preview).toBeVisible();
  expect(await reviewReport.innerText()).toBe(preservedReport);
  expect(await comparison.innerText()).toBe(preservedComparison);
  for (const kind of ['country', 'writer', 'work']) await expect(searchQuery(kind)).toHaveValue('preserve-' + kind);
  await upload('saved-draft.json');
  await expect(routeTitle).toHaveValue('Тестовый маршрут обновлён');
  await expect(page.getByLabel('Название маршрута (EN)',{exact:true})).toHaveValue('Synthetic journey');
  await expect(preview).toHaveCount(0);
  await expect(comparison).toHaveCount(0);
  await expect(country).toHaveValue('country-a');await expect(writer).toHaveValue('writer-a');await expect(work).toHaveValue('work-a');
  for (const kind of ['country', 'writer', 'work']) {
    await expect(searchQuery(kind)).toHaveValue(''); await searchPanel(kind).locator('summary').tap();
  }
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
  await upload('restore-before-width-preview.json'); await expect(routeTitle).toHaveValue('Тестовый маршрут обновлён');
  await previewButton.click(); await overviewSummary.click(); await overviewWork.click(); await overviewSummary.click();
  await widthPanel.locator('summary').click();
  const desktopWidthChoice = widthPanel.getByRole('combobox', { name: 'Ширина области предпросмотра', exact: true });
  const formWidthBefore = (await page.locator('form').boundingBox()).width;
  await desktopWidthChoice.selectOption('available');
  const availableWidth = await measurePreviewWidth(); expect(availableWidth.width).toBeCloseTo(availableWidth.available, 0);
  await desktopWidthChoice.focus(); await desktopWidthChoice.press('ArrowDown');
  await expect(desktopWidthChoice).toHaveValue('320'); await expect(desktopWidthChoice).toBeFocused();
  expect((await measurePreviewWidth()).width).toBeCloseTo(320, 0);
  await previewCopyView.selectOption('caption'); await expect(previewCopy).toHaveText('Откройте книгу');
  await desktopWidthChoice.selectOption('768'); expect((await measurePreviewWidth()).width).toBeCloseTo(768, 0);
  await expect(previewCopyView).toHaveValue('caption'); await expect(previewCopy).toHaveText('Откройте книгу');
  await previewCopyView.selectOption('reduced'); await expect(previewCopy).toHaveText('Откройте книгу');
  await previewCopyView.selectOption('body');
  await profilePanel.locator('summary').click(); await profileEnabledRu.check();
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  await expect(profileAgeRu).toHaveValue('30'); await expect(profileLevelRu).toHaveValue('plain');
  await desktopWidthChoice.selectOption('768');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  expect((await page.locator('form').boundingBox()).width).toBe(formWidthBefore);
  await profilePanel.locator('summary').click(); await reviewReport.locator('summary').click();
  await expect(reviewReport.locator('summary')).toHaveText('Отчёт по черновику (4)');
  await expect(reviewReport.locator('[data-review-node="work"] [data-review-copy="caption"]')).toHaveText(['название шага','title fallback']);
  await widthPanel.scrollIntoViewIfNeeded(); await widthPanel.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 12));
  for (const control of [widthPanel.locator('summary'), desktopWidthChoice]) {
    const bounds = await control.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(960);
  }
  const desktopFrameBounds = await previewFrame.boundingBox(); expect(desktopFrameBounds.y).toBeGreaterThanOrEqual(0); expect(desktopFrameBounds.y).toBeLessThan(960);
  for (const control of [reviewReport.locator('summary'), reviewReport.locator('[data-review-node="country"]')]) {
    const bounds = await control.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(960);
  }
  await reviewReport.locator('summary').click();
  await expect(comparison).not.toHaveAttribute('open',''); await comparison.locator('summary').click();
  await expect(comparisonRu.locator('[data-comparison-copy="body"]')).toHaveText('Перейдите к выбранной книге в коллекции.');
  await expect(comparisonEn.locator('[data-comparison-copy="body"]')).toHaveText('Go to the selected book in the collection.');
  const desktopComparisonRu = await comparisonRu.boundingBox(), desktopComparisonEn = await comparisonEn.boundingBox();
  expect(desktopComparisonEn.y).toBeCloseTo(desktopComparisonRu.y,0);
  expect(desktopComparisonEn.x).toBeGreaterThanOrEqual(desktopComparisonRu.x+desktopComparisonRu.width);
  await expect(previewFrame).toHaveAttribute('data-preview-width','768'); await expect(previewCopyView).toHaveValue('body');
  await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  await comparison.locator('summary').evaluate(node => {node.scrollIntoView({block:'start'});window.scrollBy(0,-12);});
  for (const control of [comparison.locator('summary'),comparisonColumns]) {
    const bounds = await control.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y+bounds.height).toBeLessThanOrEqual(960);
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x+bounds.width).toBeLessThanOrEqual(1281);
  }
  expect(await overflow()).toBe(false);
  await capture('booky-journey-editor-ru-1280.png', 'Actual current Work RU/EN compiled-copy comparison at1280, showing both exact titles and full text in measured side-by-side columns inside the768px local preview frame. Opening this display keeps age30/plain, current step and body view. Human comparison only; no translation/editorial validation or device acceptance.');
  await page.setViewportSize({ width: 320, height: 844 });
  const prerequisitesPanel = page.locator('[data-booky-prerequisites]');
  const prerequisiteField = (index, field) => prerequisitesPanel.getByRole(field === 'id' ? 'textbox' : 'spinbutton', {
    name: `${field === 'id' ? 'ID' : 'Версия'} предварительного маршрута ${index}`, exact: true,
  });
  const addPrerequisite = prerequisitesPanel.getByRole('button', { name: 'Добавить предварительный маршрут', exact: true });
  await expect(prerequisitesPanel).not.toHaveAttribute('open', '');
  await prerequisitesPanel.locator('summary').tap(); await expect(prerequisitesPanel).toContainText('Ссылки не заданы.');
  await addPrerequisite.tap(); await expect(preview).toHaveCount(0);
  await expect(prerequisiteField(1, 'id')).toHaveValue(''); await expect(prerequisiteField(1, 'version')).toHaveValue('1');
  await prerequisiteField(1, 'id').fill('synthetic-journey'); await previewButton.tap(); await expect(preview).toHaveCount(0);
  const selfReferenceAction = page.locator('[data-booky-error-target="prerequisites.0.id"]');
  await expect(selfReferenceAction).toHaveCount(1); await expect(prerequisiteField(1, 'id')).toHaveAttribute('aria-invalid', 'true');
  const prerequisiteErrorIds = await prerequisiteField(1, 'id').getAttribute('aria-describedby'); expect(prerequisiteErrorIds).toBeTruthy();
  expect(await prerequisiteField(1, 'id').evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id =>
    document.getElementById(id)?.querySelector('[data-booky-error-target]')?.getAttribute('data-booky-error-target') === 'prerequisites.0.id'))).toBe(true);
  await prerequisitesPanel.locator('summary').tap(); await selfReferenceAction.tap();
  await expect(prerequisitesPanel).toHaveAttribute('open', ''); await expect(prerequisiteField(1, 'id')).toBeFocused();
  await expect(prerequisiteField(1, 'id')).toHaveValue('synthetic-journey');
  await prerequisiteField(1, 'id').fill('unresolved.route-v1'); await prerequisiteField(1, 'version').fill('2.5'); await previewButton.tap();
  const versionReferenceAction = page.locator('[data-booky-error-target="prerequisites.0.version"]');
  await expect(versionReferenceAction).toHaveCount(1); await expect(prerequisiteField(1, 'version')).toHaveAttribute('aria-invalid', 'true');
  await versionReferenceAction.tap(); await expect(prerequisiteField(1, 'version')).toBeFocused(); await expect(prerequisiteField(1, 'version')).toHaveValue('2.5');
  await prerequisiteField(1, 'version').fill('7'); await expect(versionReferenceAction).toHaveCount(0);
  await expect(prerequisiteField(1, 'version')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(selfReferenceAction).toHaveCount(0); await expect(prerequisiteField(1, 'id')).not.toHaveAttribute('aria-invalid', 'true');
  await addPrerequisite.tap(); await prerequisiteField(2, 'id').fill('unresolved.next');
  await prerequisitesPanel.locator('summary').evaluate(node => { node.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
  for (const control of [prerequisitesPanel.locator('summary'), prerequisiteField(1, 'id'), prerequisiteField(1, 'version'), prerequisiteField(2, 'id'), prerequisiteField(2, 'version'), addPrerequisite]) {
    const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  }
  expect(await overflow()).toBe(false);
  await capture('booky-journey-preview-ru-320.png', 'Actual 320px route-conditions form with two explicit prerequisite ID/version references, labelled as unconfirmed. These are configured references only; this image does not establish existence, completion, current versions, review, graph validation or runtime admission. It does not show all sixteen supported rows.');
  await previewButton.tap(); await expect(preview).toBeVisible();
  const prerequisiteDownloadPromise = page.waitForEvent('download'); await button.tap(); const prerequisiteDownload = await prerequisiteDownloadPromise;
  expect(await prerequisiteDownload.failure()).toBeNull();
  const prerequisiteExportedPath = testInfo.outputPath('synthetic-journey-prerequisites-draft.json'); await prerequisiteDownload.saveAs(prerequisiteExportedPath);
  const prerequisiteBytes = await fs.readFile(prerequisiteExportedPath), prerequisiteDraft = JSON.parse(prerequisiteBytes.toString('utf8'));
  const references = [{ id: 'unresolved.route-v1', version: 7 }, { id: 'unresolved.next', version: 1 }];
  expect(prerequisiteDraft.authoringSource.input.prerequisites).toEqual(references);
  expect(prerequisiteDraft.definitions.map(definition => definition.prerequisites)).toEqual([references, references]);
  expect(prerequisiteDraft.authoringSourceChecksum).not.toBe(draft.authoringSourceChecksum);
  for (const key of ['journeyApprovals', 'dialogueApprovals', 'currentVersions', 'availability']) expect(prerequisiteDraft[key]).toEqual([]);
  expect(prerequisiteDraft.releaseReady).toBe(false);
  const preservedPrerequisitePreview = await preview.innerText();
  const tamperedPrerequisites = structuredClone(prerequisiteDraft); tamperedPrerequisites.authoringSource.input.prerequisites[0].version = 8;
  tamperedPrerequisites.authoringSourceChecksum = await page.evaluate(source => window.__copyVariantRecordHash(source), tamperedPrerequisites.authoringSource);
  await upload('rehashed-prerequisite-source.json', Buffer.from(JSON.stringify(tamperedPrerequisites)));
  await expect(page.getByRole('alert')).toBeVisible(); expect(await preview.innerText()).toBe(preservedPrerequisitePreview);
  await expect(prerequisiteField(1, 'id')).toHaveValue('unresolved.route-v1'); await expect(prerequisiteField(1, 'version')).toHaveValue('7');
  await prerequisiteField(1, 'id').fill('unsaved.reference'); await expect(preview).toHaveCount(0);
  await upload('native-prerequisite-draft.json', prerequisiteBytes);
  await expect(prerequisiteField(1, 'id')).toHaveValue('unresolved.route-v1'); await expect(prerequisiteField(1, 'version')).toHaveValue('7');
  await expect(prerequisiteField(2, 'id')).toHaveValue('unresolved.next'); await expect(preview).toHaveCount(0);
  await prerequisitesPanel.getByRole('button', { name: 'Удалить ссылку 2', exact: true }).tap();
  await prerequisitesPanel.getByRole('button', { name: 'Удалить ссылку 1', exact: true }).tap();
  await expect(prerequisitesPanel).toContainText('Ссылки не заданы.'); await expect(prerequisiteField(1, 'id')).toHaveCount(0);
  await previewButton.tap(); await expect(preview).toBeVisible();
  const restoredDownloadPromise = page.waitForEvent('download'); await button.tap(); const restoredDownload = await restoredDownloadPromise;
  expect(await restoredDownload.failure()).toBeNull();
  const restoredExportedPath = testInfo.outputPath('synthetic-journey-after-prerequisite-removal.json'); await restoredDownload.saveAs(restoredExportedPath);
  const restoredBytes = await fs.readFile(restoredExportedPath); expect(sha(restoredBytes)).toBe('7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5');
  expect(Object.hasOwn(JSON.parse(restoredBytes.toString('utf8')).authoringSource.input, 'prerequisites')).toBe(false);
  expect(downloads).toHaveLength(3); expect(await page.evaluate(() => window.__activityValidationCalls)).toEqual([]);
  expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  const profileStorageWrites=await page.evaluate(()=>window.__previewProfileStorageWrites); expect(profileStorageWrites).toEqual([]);
  await testInfo.attach('booky-journey-editor-evidence', { contentType: 'application/json', body: JSON.stringify({
    pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true,
    syntheticCatalog: true, authenticatedAdminServerTested: false, installedDeviceTested: false,
    bilingualDefinitions: 2, unapprovedDialogueDrafts: 8, cascadeResetsVerified: true, adultRuEnPreviewVerified:true, previewInvalidationVerified:true, missingCanonicalEnglishPreserved:true, localDraftRoundtripVerified:true, rejectedImportPreservesEditsAndPreview:true, delayedImportCannotOverwriteNewEdits:true, newerFileSelectionCancelsOlderResult:true, readFailurePreservesEdits:true, noActivityExportMatchesOriginalD223Bytes:true, activityServerValidationCalls:0,
    optionalStepOverviewStartsCollapsed:true, actualFourNodeOverviewRuEnVerified:true, currentStepAriaCurrentVerified:true,
    trustedKeyboardAndTouchJumpOnlyLocalPreview:true, overviewControlsMinimum44CssPx:true, overviewWrapHasNo320Overflow:true, sequentialPreviewControlsRetained:true, downloads,
    omittedCopyVariantsUseTitleFallback:true, previewCopyViewRuEnLabelsVerified:true, clearedCopyVariantFieldsDeleteOwnKeysAndPreserveOriginalExportBytes:true,
    reviewReportStartsCollapsedAndFollowsActualFourNodeRoute:true, authoredCaptionEqualToTitleRemainsAuthored:true,
    omittedVariantsReportedAsTitleFallbackIndependentlyRuEn:true, atomicInspectSelectsActualNodeAndLocale:true,
    reportInspectHasNativeKeyboardFocusAndMinimum44CssPx:true, reportUsesFreshPreviewAndRejectedImportPreservesSnapshot:true,
    reportHasNoExportFieldStorageWriteOrActivityRequest:true,
    currentNodeCopyComparisonStartsCollapsedAndUsesExactCompiledRuEnPayloads:true, independentComparisonLangAttributesVerified:true,
    comparisonTracksExistingBodyCaptionReducedViewAndAuthoredEqualsTitlePresence:true,
    narrowComparisonStacksAndDesktopComparisonUsesActualSideBySideColumns:true,
    comparisonSourceEditInvalidatesAndRejectedImportPreservesCurrentSnapshot:true, comparisonHasNoExportFieldStorageWriteOrValidationRequest:true,
    localEntitySearchStartsCollapsedAndUsesOnlyExistingNativeSelectors:true, entitySearchRuEnAndIdTrimmedCaseInsensitiveMatchesVerified:true,
    nonmatchingSelectedOptionRetainedAndExcludedFromExplicitResultCount:true, searchDoesNotAutomaticallySelectOrClearExistingInvalidAssociation:true,
    nativeSearchControlsMinimum44CssPxAndNo320Overflow:true, searchInputEnterDoesNotSubmitOrExport:true,
    parentSelectionResetsOnlyDescendantQueriesAndSuccessfulImportClearsQueries:true, rejectedImportPreservesQueries:true,
    localSearchHasNoDraftExportFieldStorageWriteOrActivityRequest:true,
    optionalPrerequisiteBlockStartsCollapsedAndUsesNativeIdVersionFields:true, directSelfReferenceHasExactAccessibleErrorRecoveryAndEditsClearIt:true,
    twoUnconfirmedPrerequisiteReferencesSurviveActualNativeExportAndReopen:true, independentlyRehashedSourceTamperingIsRejectedWithoutReplacingCurrentForm:true,
    removingEveryPrerequisiteDeletesOwnSourceKeyAndRestoresExactOriginalNativeDownloadBytes:true,
    prerequisiteReferencesDoNotCreateReviewCompletionCurrentVersionOrAdmissionAuthority:true,
    prerequisiteExportedDraft: { path: prerequisiteExportedPath, sha256: sha(prerequisiteBytes), bytes: prerequisiteBytes.length },
    restoredExportedDraft: { path: restoredExportedPath, sha256: sha(restoredBytes), bytes: restoredBytes.length },
    localPreviewWidthStartsCollapsedAndAvailable:true, localizedNativeWidthChoicesRuEnVerified:true, actualPreviewFrameFitsParentAt320:true,
    actualDesktopFrameWidths320And768Verified:true, availableWidthRestoresActualParentWidth:true, widthControlsMinimum44CssPxAndKeyboardFocusVerified:true,
    widthSelectionPreservesWorkProfileAndCopyView:true, widthSelectionDoesNotChangeExportedBytesOrFormWidth:true, previewWidthHasNoStorageWrites:true, previewWidthMeasurements,
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
  const activityOpener = page.locator('summary[data-booky-draft-field="activity"]');
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
  const authorSearch = page.locator('[data-booky-author-search]');
  const authorQuery = authorSearch.getByRole('searchbox', { name: 'Поиск авторов задания (RU / EN / ID)', exact: true });
  const authorResult = authorSearch.locator('[data-booky-author-search-result]');
  const clearAuthorQuery = authorSearch.getByRole('button', { name: 'Очистить поиск авторов', exact: true });
  await expect(authorSearch).toHaveCount(1); await expect(authorQuery).toHaveValue(''); await expect(clearAuthorQuery).toBeDisabled();
  await expect(authorResult).toHaveText('Совпадений: 4.');
  const originalAuthorSearchId = await authorQuery.getAttribute('id'); expect(originalAuthorSearchId).toBeTruthy();
  expect(await authorQuery.evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id => document.getElementById(id)))).toBe(true);
  for (const [query, count] of [
    ['  ТЕСТОВЫЙ ПИСАТЕЛЬ В  ', 1], ['SYNTHETIC WRITER C', 1], [' WRITER-C ', 1],
    ['ТЕСТОВАЯ СТРАНА А', 2], [' SYNTHETIC COUNTRY A ', 2], ['COUNTRY-A', 2], ['synthetic writer', 3],
  ]) {
    await authorQuery.fill(query); await expect(authorResult).toHaveText(`Совпадений: ${count}.`);
    await expect(firstChoice.locator('option')).toHaveCount(count + 1); await expect(secondChoice.locator('option')).toHaveCount(count + 1);
    await expect(firstChoice).toHaveValue(JSON.stringify(['', ''])); await expect(secondChoice).toHaveValue(JSON.stringify(['', '']));
  }
  expect(await firstChoice.locator('option').evaluateAll(options => options.map(option => option.value))).toEqual([
    JSON.stringify(['', '']), JSON.stringify(['country-a', 'writer-a']), JSON.stringify(['country-b', 'writer-c']), JSON.stringify(['country-c', 'writer-d']),
  ]);
  await authorQuery.fill('WRITER-B'); await expect(authorResult).toHaveText('Совпадений: 1.');
  await expect(untranslatedOption).toHaveAttribute('disabled', ''); await expect(untranslatedOption).toHaveText('Тестовый писатель Б · Тестовая страна А · EN пока не подтверждён');
  await clearAuthorQuery.tap(); await expect(authorResult).toHaveText('Совпадений: 4.');
  await firstChoice.selectOption(JSON.stringify(['country-a', 'writer-a']));
  await secondChoice.selectOption(JSON.stringify(['country-c', 'writer-d']));
  await authorQuery.fill('writer-a');
  const duplicateFirstAuthor = secondChoice.locator('option[value=\'["country-a","writer-a"]\']');
  await expect(duplicateFirstAuthor).toHaveAttribute('disabled', '');
  await expect(firstChoice.locator('option[value=\'["country-a","writer-a"]\']')).not.toHaveAttribute('disabled', '');
  await expect(secondChoice).toHaveValue(JSON.stringify(['country-c', 'writer-d']));
  await authorQuery.fill('writer-c'); await page.getByRole('button', { name: 'Добавить вариант автора', exact: true }).tap();
  const thirdChoice = page.getByRole('combobox', { name: 'Автор · вариант 3', exact: true });
  await expect(authorQuery).toHaveValue('writer-c'); await expect(thirdChoice).toHaveValue(JSON.stringify(['', '']));
  await thirdChoice.selectOption(JSON.stringify(['country-b', 'writer-c']));
  for (const select of [firstChoice, secondChoice]) await expect(select.locator('option[value=\'["country-b","writer-c"]\']')).toHaveAttribute('disabled', '');
  await page.getByRole('button', { name: 'Удалить вариант 3', exact: true }).tap(); await expect(thirdChoice).toHaveCount(0);
  await expect(authorQuery).toHaveValue('writer-c');
  for (const select of [firstChoice, secondChoice]) await expect(select.locator('option[value=\'["country-b","writer-c"]\']')).not.toHaveAttribute('disabled', '');
  await authorQuery.fill('no-matching-author'); await authorQuery.focus(); await authorQuery.press('Enter'); await expect(authorQuery).toBeFocused();
  await expect(authorResult).toHaveText('Совпадений: 0. Выбранные авторы вне результатов остаются в своих списках и не входят в число совпадений.');
  await expect(firstChoice.locator('option')).toHaveCount(2); await expect(secondChoice.locator('option')).toHaveCount(2);
  await expect(firstChoice).toHaveValue(JSON.stringify(['country-a', 'writer-a'])); await expect(secondChoice).toHaveValue(JSON.stringify(['country-c', 'writer-d']));
  await authorQuery.evaluate(node => { node.closest('label').scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); });
  for (const control of [authorQuery, clearAuthorQuery, firstChoice, secondChoice]) {
    const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  const authorSearchScreenshot = testInfo.outputPath('booky-journey-activity-ru-320.png');
  await page.screenshot({ path: authorSearchScreenshot });
  screenshots.push({ filename: 'booky-journey-activity-ru-320.png', sha256: sha(await fs.readFile(authorSearchScreenshot)), viewport: page.viewportSize(),
    scope: 'Actual 320px activity editor with one shared author search, zero matches and two unchanged selected authors retained in their native lists. The count excludes these selections; this image shows authoring controls, without answer-verdict, staff-session, editorial or runtime acceptance.' });
  await activityEnabled.uncheck(); await expect(authorSearch).toHaveCount(0); await activityEnabled.check();
  await expect(authorQuery).toHaveValue(''); await expect(authorQuery).toHaveAttribute('id', originalAuthorSearchId);
  await expect(firstChoice).toHaveValue(JSON.stringify(['', ''])); await expect(secondChoice).toHaveValue(JSON.stringify(['', '']));
  await firstChoice.selectOption(JSON.stringify(['country-a', 'writer-a'])); await secondChoice.selectOption(JSON.stringify(['country-c', 'writer-d']));
  expect(await page.evaluate(() => ({ validation: window.__activityValidationCalls, answer: window.__activityAnswerCalls }))).toEqual({ validation: [], answer: [] });
  expect(downloads).toEqual([]);
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
  const activityErrorAction = page.locator('[data-booky-error-target="activity"]');
  await expect(activityErrorAction).toHaveCount(1); await expect(activityOpener).toHaveAttribute('aria-invalid', 'true');
  const activityErrorIds = await activityOpener.getAttribute('aria-describedby'); expect(activityErrorIds).toBeTruthy();
  await authorQuery.fill('writer-c'); await expect(activityOpener).toHaveAttribute('aria-invalid', 'true'); await expect(activityOpener).toHaveAttribute('aria-describedby', activityErrorIds);
  expect(await activityOpener.evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id =>
    document.getElementById(id)?.querySelector('[data-booky-error-target]')?.getAttribute('data-booky-error-target') === 'activity'))).toBe(true);
  await activityOpener.tap(); await expect(activityOpener.locator('..')).not.toHaveAttribute('open', '');
  await activityErrorAction.tap(); await expect(activityOpener).toBeFocused(); await expect(activityOpener.locator('..')).toHaveAttribute('open', '');
  await expect(firstChoice).toHaveValue(JSON.stringify(['country-a', 'writer-a'])); await expect(secondChoice).toHaveValue(JSON.stringify(['country-c', 'writer-d']));
  await expect(authorQuery).toHaveValue('writer-c');
  await clearAuthorQuery.tap(); await expect(activityOpener).toHaveAttribute('aria-invalid', 'true'); await expect(activityOpener).toHaveAttribute('aria-describedby', activityErrorIds);
  await authorQuery.fill('writer-c');
  expect(await page.evaluate(() => ({ validation: window.__activityValidationCalls.length, answer: window.__activityAnswerCalls.length }))).toEqual({ validation: 2, answer: 0 });
  await secondChoice.selectOption(JSON.stringify(['country-b', 'writer-c']));
  await expect(authorQuery).toHaveValue('writer-c');
  await expect(activityErrorAction).toHaveCount(0); await expect(activityOpener).not.toHaveAttribute('aria-invalid', 'true');
  await expect(activityOpener).not.toHaveAttribute('aria-describedby', /.+/);
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
  expect(Object.hasOwn(draft.authoringSource.input, 'authorQuery')).toBe(false);

  const fileOpener = page.locator('summary').filter({ hasText: 'Открыть локальный черновик' });
  await expect(fileOpener.locator('..')).not.toHaveAttribute('open', '');
  await fileOpener.tap();
  const openDraft = page.getByLabel('Открыть черновик JSON', { exact: true });
  const upload = (name, buffer = bytes) => openDraft.setInputFiles({ name, mimeType: 'application/json', buffer });
  await routeTitle.fill('Правки перед импортом задания');
  await previewButton.tap();
  await expect(preview).toBeVisible();
  const preservedPreview = await preview.innerText();
  await authorQuery.fill('preserve-author-search');
  await upload('malformed-activity.json', Buffer.from('{'));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(routeTitle).toHaveValue('Правки перед импортом задания');
  expect(await preview.innerText()).toBe(preservedPreview);
  await expect(authorQuery).toHaveValue('preserve-author-search');
  const beforeTamperCalls = await page.evaluate(() => window.__activityValidationCalls.length);
  const tampered = structuredClone(draft); tampered.authoringSource.input.activity.copy.ru.title = 'Подменённый вопрос';
  await upload('tampered-activity.json', Buffer.from(JSON.stringify(tampered)));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(routeTitle).toHaveValue('Правки перед импортом задания');
  expect(await preview.innerText()).toBe(preservedPreview);
  expect(await page.evaluate(() => window.__activityValidationCalls.length)).toBe(beforeTamperCalls);
  await expect(authorQuery).toHaveValue('preserve-author-search');
  await page.evaluate(() => { window.__activityStaleNext = true; });
  await upload('stale-public-authorship-activity.json');
  await expect(page.getByRole('alert')).toContainText(semanticMessage);
  await expect(routeTitle).toHaveValue('Правки перед импортом задания');
  expect(await preview.innerText()).toBe(preservedPreview);
  const staleCall = await page.evaluate(() => window.__activityValidationCalls.at(-1));
  expect(staleCall.stale).toBe(true); expect(staleCall.actualHelperCalled).toBe(true); expect(staleCall.actualResult.ok).toBe(false);
  await expect(authorQuery).toHaveValue('preserve-author-search');

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
  await expect(authorQuery).toHaveValue('');
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
  const activityReview = preview.locator('[data-booky-review-report]');
  const activityComparison = preview.locator('[data-booky-copy-comparison]');
  await expect(activityReview).not.toHaveAttribute('open',''); await activityReview.locator('summary').tap();
  expect(await activityReview.locator('[data-review-node]').evaluateAll(nodes => nodes.map(node => node.dataset.reviewNode))).toEqual(['country','writer','work','activity','checkpoint']);
  const inspectRuActivity = activityReview.locator('[data-review-node="activity"] [data-review-inspect="ru"]');
  const inspectEnActivity = activityReview.locator('[data-review-node="activity"] [data-review-inspect="en"]');
  const inspectRuWork = activityReview.locator('[data-review-node="work"] [data-review-inspect="ru"]');
  const callsBeforeReport = await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}));
  await expect(activityComparison).not.toHaveAttribute('open','');
  await activityComparison.locator('summary').focus(); await activityComparison.locator('summary').press('Enter');
  await expect(activityComparison.locator('summary')).toBeFocused(); await expect(activityComparison).toHaveAttribute('data-comparison-node','activity');
  await expect(activityComparison.locator('[data-comparison-locale="ru"] [data-comparison-copy="body"]')).toHaveText('Выберите имя автора среди предложенных вариантов.');
  await expect(activityComparison.locator('[data-comparison-locale="en"] [data-comparison-copy="body"]')).toHaveText("Choose the author's name from the options.");
  await activityComparison.locator('summary').press('Enter');
  await expect(correctAnswer).toHaveAttribute('aria-pressed','true'); await expect(verdict).toHaveAttribute('data-verdict','correct');
  await inspectRuActivity.focus(); await inspectRuActivity.press('Enter'); await expect(inspectRuActivity).toBeFocused();
  await expect(correctAnswer).toHaveAttribute('aria-pressed','true'); await expect(verdict).toHaveAttribute('data-verdict','correct');
  expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(callsBeforeReport);
  const activityWidthPanel = preview.locator('[data-booky-preview-width]');
  const activityFrame = preview.locator('[data-booky-preview-frame]');
  await expect(activityWidthPanel).not.toHaveAttribute('open', '');
  await activityWidthPanel.locator('summary').tap();
  const activityWidthChoice = activityWidthPanel.getByRole('combobox', { name: 'Ширина области предпросмотра', exact: true });
  const callsBeforeWidthChange = await page.evaluate(() => window.__activityAnswerCalls.length);
  await activityWidthChoice.selectOption('320'); await activityWidthChoice.selectOption('320');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true'); await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await expect(activityFrame).toHaveAttribute('data-preview-width', '320');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeWidthChange);
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
  const heldWidthVerdict = await answerHeldIndex();
  const widthPendingCallCount = await page.evaluate(() => window.__activityAnswerCalls.length);
  const pendingSearchPreview = { width: await activityFrame.getAttribute('data-preview-width'), view: await preview.locator('[data-booky-preview-copy-view]').inputValue(),
    step: await stepStatus.innerText(), title: await routeTitle.inputValue() };
  const callsBeforePendingSearch = await page.evaluate(() => ({ validation: window.__activityValidationCalls.length, answer: window.__activityAnswerCalls.length }));
  const downloadsBeforePendingSearch = downloads.length;
  for (const [kind, value] of [['country', 'country-b'], ['writer', 'WRITER-B'], ['work', 'no-matching-work']]) {
    const panel = page.locator(`[data-booky-entity-search="${kind}"]`), query = panel.locator('input[type="search"]');
    await expect(panel).not.toHaveAttribute('open', ''); await panel.locator('summary').tap(); await query.fill(value); await query.press('Enter');
    await expect(panel.locator('[data-booky-search-result]')).toContainText('Текущий выбор остаётся в списке и не входит в число совпадений.');
    await expect(page.getByRole('combobox', { name: { country: 'Страна', writer: 'Писатель', work: 'Книга' }[kind], exact: true })).toHaveValue(kind + '-a');
    await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true'); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: 'Очистить поиск', exact: true }).tap(); await panel.locator('summary').tap();
  }
  await authorQuery.fill('no-pending-author-match'); await authorQuery.press('Enter');
  await expect(authorResult).toHaveText('Совпадений: 0. Выбранные авторы вне результатов остаются в своих списках и не входят в число совпадений.');
  await expect(firstChoice).toHaveValue(JSON.stringify(['country-a', 'writer-a'])); await expect(secondChoice).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true'); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  for (const kind of ['country', 'writer', 'work']) await expect(page.locator(`[data-booky-entity-search="${kind}"] input[type="search"]`)).toHaveValue('');
  await clearAuthorQuery.tap(); await expect(authorQuery).toHaveValue('');
  expect(await page.evaluate(() => ({ validation: window.__activityValidationCalls.length, answer: window.__activityAnswerCalls.length }))).toEqual(callsBeforePendingSearch);
  expect(downloads).toHaveLength(downloadsBeforePendingSearch);
  expect({ width: await activityFrame.getAttribute('data-preview-width'), view: await preview.locator('[data-booky-preview-copy-view]').inputValue(),
    step: await stepStatus.innerText(), title: await routeTitle.inputValue() }).toEqual(pendingSearchPreview);
  await activityComparison.locator('summary').tap(); await activityComparison.locator('summary').tap();
  await expect(activityComparison).not.toHaveAttribute('open','');
  await inspectRuActivity.tap(); await expect(answerCheckRu).toHaveAttribute('aria-busy','true');
  await activityWidthChoice.selectOption('768'); await activityWidthChoice.selectOption('768'); await activityWidthChoice.selectOption('available');
  await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true'); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  await expect(verdict).toHaveCount(0); await expect(answerError).toHaveCount(0);
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(widthPendingCallCount);
  await releaseAnswer(heldWidthVerdict);
  await expect(verdict).toHaveAttribute('data-verdict', 'correct'); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  await activityWidthChoice.selectOption('320'); await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await activityWidthPanel.locator('summary').tap();
  await correctAnswer.tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await answerCheckRu.tap();
  const heldStepVerdict = await answerHeldIndex();
  const callsBeforePendingCurrentStep = await page.evaluate(() => window.__activityAnswerCalls.length);
  await overviewActivity.tap();
  await expect(answerCheckRu).toHaveAttribute('aria-busy', 'true');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforePendingCurrentStep);
  await inspectRuActivity.tap(); await expect(answerCheckRu).toHaveAttribute('aria-busy','true');
  await activityComparison.locator('summary').tap();
  await inspectRuWork.focus(); await inspectRuWork.press('Enter'); await expect(inspectRuWork).toBeFocused();
  await expect(activityComparison).toHaveAttribute('open',''); await expect(activityComparison).toHaveAttribute('data-comparison-node','work');
  await expect(activityComparison.locator('[data-comparison-locale="en"] [data-comparison-copy="body"]')).toHaveText('Go to the selected book in the collection.');
  await expect(preview.locator('[data-preview-step="work"]')).toBeVisible();
  await expect(preview.locator('[data-preview-step="work"]')).toHaveAttribute('lang','ru');
  await expect(activityFrame).toHaveAttribute('data-preview-width','320'); await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforePendingCurrentStep);
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
  const callsBeforeInspectLocale = await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}));
  await inspectEnActivity.tap();
  expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(callsBeforeInspectLocale);
  await releaseAnswer(heldLocaleVerdict);
  await expect(activityReview.locator('summary')).toHaveText('Draft review report (5)');
  await expect(activityComparison.locator('summary')).toHaveText('Compare RU and EN copy');
  await expect(activityComparison).toHaveAttribute('data-comparison-node','activity');
  await expect(inspectEnActivity).toHaveAttribute('aria-current','step');
  await expect(activityFrame).toHaveAttribute('data-preview-width','320'); await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
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
  await expect(activityComparison).toHaveCount(0);
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
  await expect(activityComparison).not.toHaveAttribute('open','');
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
  await expect(activityReview).not.toHaveAttribute('open',''); await activityReview.locator('summary').tap();
  const callsBeforeProfileInspect = await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}));
  await activityComparison.locator('summary').tap(); await activityComparison.locator('summary').tap();
  await inspectRuActivity.tap(); await expect(answerCheckRu).toHaveAttribute('aria-busy','true');
  await expect(profileAge).toHaveValue('30'); await expect(profileLevel).toHaveValue('plain');
  await expect(profileReport).toHaveAttribute('data-profile-status','matches');
  expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(callsBeforeProfileInspect);
  await activityReview.locator('summary').tap();
  await profileAge.fill('30'); await profileLevel.selectOption('plain');
  await activityWidthPanel.locator('summary').tap();
  await activityWidthChoice.selectOption('320'); await activityWidthChoice.selectOption('768'); await activityWidthChoice.selectOption('768');
  await expect(profileAge).toHaveValue('30'); await expect(profileLevel).toHaveValue('plain');
  await expect(profileReport).toHaveAttribute('data-profile-status', 'matches');
  await expect(preview.locator('[data-booky-preview-copy-view]')).toHaveValue('body');
  await activityWidthPanel.locator('summary').tap();
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
  await activityComparison.locator('summary').tap(); await expect(verdict).toHaveAttribute('data-verdict','correct');
  await activityCopyView.selectOption('body');
  await expect(verdict).toHaveAttribute('data-verdict', 'correct');
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__activityAnswerCalls.length)).toBe(callsBeforeSameCopyView);
  await activityCopyView.selectOption('caption');
  await expect(verdict).toHaveCount(0); await expect(correctAnswer).toHaveAttribute('aria-pressed', 'false');
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  await expect(preview.locator('[data-booky-preview-copy]')).toHaveText('Who wrote this book?');
  await expect(activityComparison.locator('[data-comparison-copy="caption"]')).toHaveText(['Кто автор этой книги?','Who wrote this book?']);
  await expect(activityComparison.locator('[data-comparison-presence="title-fallback"]')).toHaveCount(2);
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
  expect(answerCalls.filter(call => call.hold)).toHaveLength(7);
  expect(answerCalls.filter(call => call.wrongChecksum)).toHaveLength(1);
  expect(answerCalls.filter(call => call.wrongChoice)).toHaveLength(1);
  expect(answerCalls.filter(call => call.failSession)).toHaveLength(1);
  expect(answerCalls.filter(call => call.failNetwork)).toHaveLength(1);
  expect(answerCalls.every(call => call.completed)).toBe(true);
  for (const index of [heldWidthVerdict, heldStepVerdict, heldChoiceVerdict, heldLocaleVerdict, heldEditVerdict, heldVariantEditVerdict, heldProfileVerdict]) {
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
    actualFiveNodeReviewReportUsesCompiledOrder:true, sameReportInspectPreservesChoiceVerdictAndPendingLease:true,
    changedReportNodeAndLocaleRejectLateVerdictsWithoutExtraHelperCalls:true,
    reportInspectPreservesWidthTextViewAndMatchingProfile:true,
    comparisonOpenCloseKeepsSelectedVerdictAndExistingHeldReplyLease:true, comparisonDisplayDoesNotRequestHelperChecks:true,
    comparisonTracksActualWorkActivityNodeAndLocaleThroughReportNavigation:true,
    comparisonPreservesMatchingProfileWidthAndTextViewWhileAnswerPending:true, editedOrNativeReopenedDraftRebuildsComparison:true,
    differentStepJumpClearsAnswerAndRejectsLateVerdict: true, heldStepVerdictCallIndex: heldStepVerdict,
    copyVariantEditRejectsLateAnswerAndNativeImportRestoresOmission: true, heldVariantEditVerdictCallIndex: heldVariantEditVerdict,
    sameCopyViewKeepsVerdictAndDifferentCopyViewClearsAnswerWithoutMovingStep: true,
    previewWidthChangesAndSameSelectionPreserveChoiceVerdictAndPendingLease:true, actualHeldWidthReplyStillAppliesToCurrentBoundDraft:true,
    widthChangesDoNotRequestAnswerChecksOrAdvanceStep:true, heldWidthVerdictCallIndex:heldWidthVerdict,
    localEntityQueriesAndClearPreserveHeldAnswerChoiceLeaseDraftStepWidthAndView:true, heldSearchReusesExistingWidthVerdictCallAndDoesNotAddRequestsOrDownloads:true,
    oneSharedAuthorSearchUsesOnlyExistingLoadedWriterCountryLabelsAndIds:true, sharedAuthorSearchRuEnIdAndMultipleCountriesVerified:true,
    emptyChoiceRemainsEmptyAndRetainedNonmatchesExcludedFromHonestCount:true, duplicateAndMissingEnglishOptionsRemainDisabled:true,
    addAndRemoveChoiceKeepQueryAndRecomputeDuplicateAvailability:true, toggleAndSuccessfulImportClearAuthorQueryAndRejectedImportPreservesIt:true,
    authorSearchAndClearPreserveExistingValidationErrorsAndHeldAnswerLeaseWithoutNewRequestsOrDownloads:true,
    authorSearchKeepsMainEntityQueriesIndependentAndHasNoExportFieldOrStorageWrite:true,
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
  const factOpener = page.locator('summary[data-booky-draft-field="fact"]');
  const activityOpener = page.locator('summary[data-booky-draft-field="activity"]');
  await expect(factOpener.locator('..')).not.toHaveAttribute('open', '');
  await expect(activityOpener.locator('..')).not.toHaveAttribute('open', '');
  expect(await factOpener.evaluate((node, activityId) => Boolean(node.compareDocumentPosition(document.getElementById(activityId)) & Node.DOCUMENT_POSITION_FOLLOWING), await activityOpener.getAttribute('id'))).toBe(true);
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
  const factReview = preview.locator('[data-booky-review-report]');
  const factComparison = preview.locator('[data-booky-copy-comparison]');
  async function verifyFactComparison(view) {
    await expect(factComparison).toHaveAttribute('data-comparison-node','sourced-fact');
    for (const locale of ['ru','en']) {
      const localized = factComparison.locator(`[data-comparison-locale="${locale}"]`);
      await expect(localized).toHaveAttribute('lang',locale);
      await expect(localized.locator('[data-comparison-title]')).toHaveText(copy[locale].title);
      expect(await localized.locator(`[data-comparison-copy="${view}"]`).evaluate(node => node.textContent)).toBe(copy[locale][view] ?? copy[locale].title);
      await expect(localized.locator('[data-comparison-presence]')).toHaveAttribute('data-comparison-presence',Object.hasOwn(copy[locale],view) ? 'authored' : 'title-fallback');
      expect(await localized.locator(`[data-comparison-copy="${view}"]`).evaluate(node => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
    }
  }
  async function verifyFactReview(order) {
    expect(await factReview.locator('[data-review-node]').evaluateAll(nodes => nodes.map(node => node.dataset.reviewNode))).toEqual(order);
    const factRow = factReview.locator('[data-review-node="sourced-fact"]');
    for (const locale of ['ru','en']) {
      const localized = factRow.locator(`[data-review-locale="${locale}"]`);
      await expect(localized.locator('[data-review-copy="main"]')).toHaveAttribute('data-copy-presence','authored');
      await expect(localized.locator('[data-review-copy="caption"]')).toHaveAttribute('data-copy-presence','authored');
      await expect(localized.locator('[data-review-copy="reduced"]')).toHaveAttribute('data-copy-presence',locale === 'ru' ? 'authored' : 'title-fallback');
      await expect(localized.locator('[data-review-sources]')).toHaveAttribute('data-source-count',String(copy[locale].sources.length));
      await expect(localized.locator('[data-review-sources]')).toHaveText(locale === 'ru' ? 'Указано источников (не проверены): 2' : 'Supplied sources (unreviewed): 1');
    }
    await expect(factReview.locator('[data-review-sources]')).toHaveCount(2);
    await expect(factReview.locator('[data-review-node="work"] [data-review-locale="ru"] [data-review-copy="caption"]')).toHaveAttribute('data-copy-presence','authored');
    await expect(factReview.locator('[data-review-node="work"] [data-review-locale="en"] [data-review-copy="caption"]')).toHaveAttribute('data-copy-presence','title-fallback');
  }
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
  const factErrorAction = page.locator('[data-booky-error-target="fact"]');
  await expect(factErrorAction).toHaveCount(1); await expect(factOpener).toHaveAttribute('aria-invalid', 'true');
  const factErrorIds = await factOpener.getAttribute('aria-describedby'); expect(factErrorIds).toBeTruthy();
  expect(await factOpener.evaluate(node => (node.getAttribute('aria-describedby') || '').split(' ').every(id =>
    document.getElementById(id)?.querySelector('[data-booky-error-target]')?.getAttribute('data-booky-error-target') === 'fact'))).toBe(true);
  await expect(sourceField('Дата обращения к источнику', 1, 'en')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('aria-describedby', 'journey-open-description');
  await factOpener.tap(); await expect(factOpener.locator('..')).not.toHaveAttribute('open', '');
  const factErrorBounds = await factErrorAction.boundingBox(); expect(factErrorBounds.height).toBeGreaterThanOrEqual(44); expect(factErrorBounds.width).toBeGreaterThanOrEqual(44);
  await factErrorAction.focus(); await expect(factErrorAction).toBeFocused(); await page.keyboard.press('Enter');
  await expect(factOpener).toBeFocused(); await expect(factOpener.locator('..')).toHaveAttribute('open', '');
  await expect(factEnabled).toBeChecked(); await expect(sourceField('Дата обращения к источнику', 1, 'en')).toHaveValue('');
  await expect(sourceField('HTTPS URL источника', 1, 'ru')).toHaveValue(copy.ru.sources[0].url);
  await expect(page.getByRole('textbox', { name: 'Текст факта (EN)', exact: true })).toHaveValue(copy.en.body);
  expect(await page.evaluate(() => ({ validation: window.__activityValidationCalls, answer: window.__activityAnswerCalls }))).toEqual({ validation: [], answer: [] });
  await sourceField('Дата обращения к источнику', 1, 'en').fill(copy.en.sources[0].accessedAt);
  await expect(factErrorAction).toHaveCount(0); await expect(factOpener).not.toHaveAttribute('aria-invalid', 'true');
  await expect(factOpener).not.toHaveAttribute('aria-describedby', /.+/);
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
  await expect(factReview).not.toHaveAttribute('open',''); await factReview.locator('summary').tap();
  await expect(factReview.locator('summary')).toHaveText('Отчёт по черновику (5)');
  await verifyFactReview(['country','writer','work','sourced-fact','checkpoint']); await factReview.locator('summary').tap();
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
  const factBodyRu = factStep.locator('[data-booky-preview-copy="body"]');
  expect(await factBodyRu.evaluate(node => node.textContent)).toBe(copy.ru.body);
  expect(await factBodyRu.evaluate(node => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
  await expect(factComparison).not.toHaveAttribute('open',''); await factComparison.locator('summary').tap();
  await verifyFactComparison('body'); await factComparison.locator('summary').tap();
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
  expect(Object.hasOwn(draft.authoringSource.input, 'optionalNodeOrder')).toBe(false);
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
  await expect(factReview).toHaveCount(0);
  await expect(factComparison).toHaveCount(0);
  await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap();
  await factReview.locator('summary').tap(); await verifyFactReview(['country','writer','work','sourced-fact','checkpoint']);
  await factComparison.locator('summary').tap();
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
  await expect(factReview).not.toHaveAttribute('open','');
  const factCopyView = preview.locator('[data-booky-preview-copy-view]');
  const factCopyText = preview.locator('[data-booky-preview-copy]');
  await expect(factCopyView).toHaveValue('body');
  await expect(factComparison).not.toHaveAttribute('open',''); await factComparison.locator('summary').tap(); await verifyFactComparison('body');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  async function capture(filename, scope, anchor) {
    await anchor.evaluate(node => node.scrollIntoView({ block: 'start' })); const p = testInfo.outputPath(filename); await page.screenshot({ path: p });
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
  await verifyFactComparison('caption');
  await factCopyView.selectOption('reduced'); expect(await factCopyText.evaluate(node => node.textContent)).toBe(copy.ru.reduced);
  await verifyFactComparison('reduced');
  const factWidthPanel = preview.locator('[data-booky-preview-width]');
  const factFrame = preview.locator('[data-booky-preview-frame]');
  await expect(factWidthPanel).not.toHaveAttribute('open', ''); await factWidthPanel.locator('summary').tap();
  await factWidthPanel.getByRole('combobox', { name: 'Ширина области предпросмотра', exact: true }).selectOption('320');
  await expect(factCopyView).toHaveValue('reduced'); expect(await factCopyText.evaluate(node => node.textContent)).toBe(copy.ru.reduced);
  await expect(factStep.locator('[data-booky-fact-sources]').getByRole('link')).toHaveCount(copy.ru.sources.length);
  expect(await factFrame.evaluate(node => node.scrollWidth > node.clientWidth + 1)).toBe(false);
  await factWidthPanel.locator('summary').tap();
  await expect(stepStatus).toContainText(/^(?:Шаг 4 из 5|Step 4 of 5)/);
  for (const control of [factOpener, factEnabled.locator('..'), factTitleRu, sourceField('ID источника', 1, 'ru'), sourceField('HTTPS URL источника', 1, 'ru'), sourceField('Дата обращения к источнику', 1, 'ru'), previous, next])
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await factReview.locator('summary').tap();
  const factInspectCalls = await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}));
  const inspectEnFact = factReview.locator('[data-review-node="sourced-fact"] [data-review-inspect="en"]');
  await inspectEnFact.focus(); await inspectEnFact.press('Enter'); await expect(inspectEnFact).toBeFocused();
  await expect(factReview.locator('summary')).toHaveText('Draft review report (5)'); await verifyFactReview(['country','writer','work','sourced-fact','checkpoint']);
  await expect(factFrame).toHaveAttribute('data-preview-width','320');
  expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(factInspectCalls);
  await factReview.locator('summary').tap();
  await expect(factCopyView).toHaveValue('reduced'); await expect(factCopyText).toHaveText(copy.en.title);
  await expect(factComparison.locator('summary')).toHaveText('Compare RU and EN copy'); await verifyFactComparison('reduced');
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
  await verifyFactComparison('caption');
  await factWidthPanel.locator('summary').tap();
  await factWidthPanel.getByRole('combobox', { name: 'Preview frame width', exact: true }).selectOption('768');
  await expect(factCopyView).toHaveValue('caption'); expect(await factCopyText.evaluate(node => node.textContent)).toBe(copy.en.caption);
  await expect(factStep.locator('[data-booky-fact-sources]').getByRole('link')).toHaveCount(copy.en.sources.length);
  expect(await factFrame.evaluate(node => node.getBoundingClientRect().width <= node.parentElement.getBoundingClientRect().width + 1)).toBe(true);
  expect(await factFrame.evaluate(node => node.scrollWidth > node.clientWidth + 1)).toBe(false);
  await factWidthPanel.locator('summary').tap();
  expect(await factCopyText.evaluate(node => getComputedStyle(node).whiteSpace)).toBe('pre-wrap');
  expect((await factCopyView.boundingBox()).height).toBeGreaterThanOrEqual(44); expect(await overflow()).toBe(false);
  await activityOpener.tap();
  const combinedActivityEnabled = page.getByLabel('Добавить задание «Книга и автор»', { exact: true });
  await combinedActivityEnabled.check();
  await page.getByLabel('Автор · вариант 1', { exact: true }).selectOption(JSON.stringify(['country-a', 'writer-a']));
  await page.getByLabel('Автор · вариант 2', { exact: true }).selectOption(JSON.stringify(['country-b', 'writer-c']));
  await previewButton.tap(); await expect(preview).toBeVisible(); await expect(stepStatus).toContainText(/^(?:Шаг 1 из 6|Step 1 of 6)/);
  await expect(factReview).not.toHaveAttribute('open',''); await factReview.locator('summary').tap();
  await expect(factReview.locator('summary')).toHaveText('Отчёт по черновику (6)');
  await verifyFactReview(['country','writer','work','sourced-fact','activity','checkpoint']); await factReview.locator('summary').tap();
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
  await expect(factComparison).not.toHaveAttribute('open',''); await factComparison.locator('summary').tap();
  await verifyFactComparison('body'); await factComparison.locator('summary').tap();
  await overview.locator('[data-preview-step-choice="activity"]').tap();
  const activityStep = preview.locator('[data-preview-step="activity"]');
  await expect(stepStatus).toContainText(/^(?:Шаг 5 из 6|Step 5 of 6)/);
  await expect(factComparison).toHaveAttribute('data-comparison-node','activity');
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
  const orderPanel = page.locator('[data-booky-optional-order]');
  const orderRows = orderPanel.locator('[data-optional-node-kind] > span');
  const factEarlier = orderPanel.getByRole('button', { name: 'Переместить шаг «Факт» раньше', exact: true });
  const activityEarlier = orderPanel.getByRole('button', { name: 'Переместить шаг «Задание» раньше', exact: true });
  const activityLater = orderPanel.getByRole('button', { name: 'Переместить шаг «Задание» позже', exact: true });
  await expect(orderPanel).not.toHaveAttribute('open', ''); await orderPanel.locator('summary').tap();
  await expect(orderRows).toHaveText(['4. Факт', '5. Задание']);
  await expect(factEarlier).toHaveAttribute('aria-disabled', 'true');
  await expect(activityLater).toHaveAttribute('aria-disabled', 'true');
  for (const control of [orderPanel.locator('summary'), ...await orderPanel.getByRole('button').all()]) {
    const bounds = await control.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  }
  expect(await overflow()).toBe(false);
  await overview.locator('[data-preview-step-choice="activity"]').tap();
  await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  await page.evaluate(() => { window.__answerHoldNext = true; });
  await activityStep.getByRole('button', { name: 'Проверить ответ', exact: true }).tap();
  await expect(activityStep.locator('[data-booky-activity-answer-pending]')).toBeVisible();
  const heldOrderVerdict = await page.evaluate(() => window.__answerHeld.index);
  await factEarlier.focus(); await page.keyboard.press('Enter');
  await expect(factEarlier).toBeFocused(); await expect(activityStep.locator('[data-booky-activity-answer-pending]')).toBeVisible();
  await expect(stepStatus).toContainText('Шаг 5 из 6 · Задание');
  await activityEarlier.focus(); await page.keyboard.press('Enter');
  await expect(activityEarlier).toBeFocused(); await expect(activityEarlier).toHaveAttribute('aria-disabled', 'true');
  await expect(orderRows).toHaveText(['4. Задание', '5. Факт']); await expect(preview).toHaveCount(0);
  expect(await overflow()).toBe(false);
  await capture('booky-journey-fact-ru-320.png', 'Actual optional-order editor in RU320 after trusted keyboard move: Activity precedes Fact, the focused Earlier control remains visible, and editing has closed the local preview. Fixed base anchors, synthetic authored content; no publication or graph acceptance.', orderPanel);
  await expect(page.getByRole('textbox', { name: 'Текст факта (RU)', exact: true })).toHaveValue(copy.ru.body);
  await expect(sourceField('HTTPS URL источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].url);
  await expect(page.getByLabel('Автор · вариант 2', { exact: true })).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  await page.evaluate(index => { if (window.__answerHeld?.index !== index) throw new Error('Unexpected held order reply'); window.__answerHeld.release(); }, heldOrderVerdict);
  await expect.poll(() => page.evaluate(index => window.__activityAnswerCalls[index].completed, heldOrderVerdict)).toBe(true);
  await expect(preview).toHaveCount(0); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  expect(downloads).toHaveLength(1);
  await previewButton.tap(); await expect(preview).toBeVisible();
  await factReview.locator('summary').tap(); await verifyFactReview(['country','writer','work','activity','sourced-fact','checkpoint']);
  await factReview.locator('summary').tap();
  await overview.locator('summary').tap();
  await expect(overview.getByRole('button')).toHaveText(['1. Страна', '2. Писатель', '3. Книга', '4. Задание', '5. Факт', '6. Завершение']);
  await overview.locator('[data-preview-step-choice="activity"]').tap();
  await expect(stepStatus).toContainText('Шаг 4 из 6 · Задание');
  await factComparison.locator('summary').tap();
  await expect(factComparison).toHaveAttribute('data-comparison-node','activity');
  await expect(factComparison.locator('[data-comparison-title]')).toHaveText(['Кто автор этой книги?','Who wrote this book?']);
  await factComparison.locator('summary').tap();
  await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  await activityStep.getByRole('button', { name: 'Проверить ответ', exact: true }).tap();
  await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict', 'correct');
  const reversedDownloadEvent = page.waitForEvent('download'); await downloadButton.tap();
  const reversedDownload = await reversedDownloadEvent; expect(await reversedDownload.failure()).toBeNull();
  const reversedPath = testInfo.outputPath('synthetic-activity-first-draft.json'); await reversedDownload.saveAs(reversedPath);
  const reversedBytes = await fs.readFile(reversedPath), reversedDraft = JSON.parse(reversedBytes.toString('utf8'));
  expect(await page.evaluate(() => window.__factExportBlobs[1].text())).toBe(reversedBytes.toString('utf8'));
  expect(reversedDraft.authoringSource.input.optionalNodeOrder).toEqual(['activity', 'sourced-fact']);
  expect(reversedDraft.authoringSource.input.fact).toEqual({ copy }); expect(reversedDraft.dialogues).toHaveLength(12);
  for (const definition of reversedDraft.definitions) {
    expect(definition.nodes.map(node => node.kind)).toEqual(['country', 'writer', 'work', 'activity', 'sourced-fact', 'checkpoint']);
    expect(definition.nodes[4].entity).toEqual({ kind: 'work', countryId: 'country-a', writerId: 'writer-a', workId: 'work-a' });
    for (const binding of definition.nodes[4].fact.dialogues)
      expect(binding.contentChecksum).toBe(reversedDraft.dialogues.find(record => record.payload.locale === binding.locale && record.payload.id === binding.id).review.contentChecksum);
  }
  await previewButton.tap(); await overview.locator('summary').tap(); await overview.locator('[data-preview-step-choice="activity"]').tap();
  await factReview.locator('summary').tap(); await verifyFactReview(['country','writer','work','activity','sourced-fact','checkpoint']);
  await factComparison.locator('summary').tap();
  const preservedReversedPreview = await preview.innerText();
  const rehashedOrderTamper = await page.evaluate(original => {
    const forged = structuredClone(original), hash = window.__copyVariantRecordHash;
    for (const definition of forged.definitions) {
      [definition.nodes[3], definition.nodes[4]] = [definition.nodes[4], definition.nodes[3]];
      forged.definitionsChecksums.find(binding => binding.locale === definition.locale).checksum = hash(definition);
    }
    return forged;
  }, reversedDraft);
  expect(rehashedOrderTamper.authoringSource).toEqual(reversedDraft.authoringSource);
  expect(rehashedOrderTamper.definitionsChecksums).not.toEqual(reversedDraft.definitionsChecksums);
  const wrongOptionalSet = structuredClone(reversedDraft); wrongOptionalSet.authoringSource.input.optionalNodeOrder = ['activity'];
  for (const [filename, invalid] of [['rehashed-derived-order.json', rehashedOrderTamper], ['missing-enabled-optional-step.json', wrongOptionalSet]]) {
    await upload(filename, Buffer.from(JSON.stringify(invalid))); await expect(page.getByRole('alert')).toBeVisible();
    expect(await preview.innerText()).toBe(preservedReversedPreview); await expect(orderRows).toHaveText(['4. Задание', '5. Факт']);
    await expect(sourceField('ID источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].id); expect(downloads).toHaveLength(2);
  }
  await upload('valid-activity-first-draft.json', reversedBytes); await expect(preview).toHaveCount(0);
  await expect(factReview).toHaveCount(0);
  await expect(openDraft).toHaveValue(''); await expect(orderRows).toHaveText(['4. Задание', '5. Факт']);
  await expect(factVariantField('ru', 'caption')).toHaveValue(copy.ru.caption);
  await expect(page.getByLabel('Автор · вариант 2', { exact: true })).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  await previewButton.tap(); await preview.getByRole('button', { name: 'English', exact: true }).tap();
  await overview.locator('summary').tap();
  await expect(overview.getByRole('button')).toHaveText(['1. Country', '2. Writer', '3. Work', '4. Activity', '5. Fact', '6. Finish']);
  await overview.locator('[data-preview-step-choice="sourced-fact"]').tap(); await expect(stepStatus).toContainText('Step 5 of 6 · Fact');
  await verifySources('en');
  await overview.locator('[data-preview-step-choice="activity"]').tap(); await expect(stepStatus).toContainText('Step 4 of 6 · Activity');
  await expect(factCopyView).toHaveValue('body');
  await factCopyView.selectOption('caption');
  await expect(factCopyView).toHaveValue('caption');
  await activityStep.locator('[data-answer-choice-id="choice-2"]').tap();
  await activityStep.getByRole('button', { name: 'Check answer', exact: true }).tap();
  await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict', 'correct');
  await expect(overview).toHaveAttribute('open', '');
  await expect(overview.locator('[data-preview-step-choice="activity"]')).toHaveAttribute('aria-current', 'step');
  await expect(factReview).not.toHaveAttribute('open',''); await factReview.locator('summary').tap();
  await expect(factReview.locator('summary')).toHaveText('Draft review report (6)');
  await verifyFactReview(['country','writer','work','activity','sourced-fact','checkpoint']);
  const reopenedReportCalls = await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}));
  await factReview.locator('[data-review-node="activity"] [data-review-inspect="en"]').tap();
  await expect(activityStep.locator('[data-answer-choice-id="choice-2"]')).toHaveAttribute('aria-pressed','true');
  await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict','correct');
  await expect(factCopyView).toHaveValue('caption'); await expect(factFrame).toHaveAttribute('data-preview-width','768');
  expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(reopenedReportCalls);
  expect(await overflow()).toBe(false);
  await expect(factComparison).not.toHaveAttribute('open',''); await factComparison.locator('summary').tap();
  await expect(activityStep.locator('[data-booky-activity-verdict]')).toHaveAttribute('data-verdict','correct');
  await expect(factComparison.locator('[data-comparison-copy="caption"]')).toHaveText(['Кто автор этой книги?','Who wrote this book?']);
  await factReview.locator('[data-review-node="sourced-fact"] [data-review-inspect="en"]').tap();
  await expect(stepStatus).toContainText('Step 5 of 6 · Fact'); await expect(page.locator('[data-booky-activity-verdict]')).toHaveCount(0);
  await verifyFactComparison('caption'); await expect(factCopyView).toHaveValue('caption'); await expect(factFrame).toHaveAttribute('data-preview-width','768');
  expect(await page.evaluate(() => ({validation:window.__activityValidationCalls.length,answer:window.__activityAnswerCalls.length}))).toEqual(reopenedReportCalls);
  const narrowRuComparison = await factComparison.locator('[data-comparison-locale="ru"]').boundingBox();
  const narrowEnComparison = await factComparison.locator('[data-comparison-locale="en"]').boundingBox();
  expect(narrowEnComparison.y).toBeGreaterThanOrEqual(narrowRuComparison.y+narrowRuComparison.height);
  expect(narrowEnComparison.x).toBeCloseTo(narrowRuComparison.x,0);
  await factComparison.locator('summary').evaluate(node => { node.scrollIntoView({block:'start'}); window.scrollBy(0,-12); });
  for (const control of [factComparison.locator('summary'),factComparison.locator('[data-booky-comparison-columns]')]) {
    const bounds = await control.boundingBox(); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  }
  expect(await factComparison.locator('[data-booky-comparison-columns]').evaluate(node => node.scrollWidth > node.clientWidth+1)).toBe(false);
  await capture('booky-journey-fact-en-320.png', 'Actual native-reopened reverse-order six-node draft at its fifth Fact: open EN-localized RU/EN copy comparison visibly stacks exact authored multiline captions and titles inside the768px frame clamped to320-browser available width. Current caption view is preserved; synthetic copy is for human comparison, not translation, source or editorial validation.', factComparison.locator('summary'));
  await activityLater.focus(); await page.keyboard.press('Enter'); await expect(activityLater).toBeFocused();
  await expect(activityLater).toHaveAttribute('aria-disabled', 'true');
  await expect(orderRows).toHaveText(['4. Факт', '5. Задание']); await expect(preview).toHaveCount(0);
  await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  const defaultDownloadEvent = page.waitForEvent('download'); await downloadButton.tap();
  const defaultDownload = await defaultDownloadEvent; expect(await defaultDownload.failure()).toBeNull();
  const defaultPath = testInfo.outputPath('synthetic-default-combined-draft.json'); await defaultDownload.saveAs(defaultPath);
  const defaultBytes = await fs.readFile(defaultPath), defaultDraft = JSON.parse(defaultBytes.toString('utf8'));
  expect(await page.evaluate(() => window.__factExportBlobs[2].text())).toBe(defaultBytes.toString('utf8'));
  expect(Object.hasOwn(defaultDraft.authoringSource.input, 'optionalNodeOrder')).toBe(false);
  for (const definition of defaultDraft.definitions)
    expect(definition.nodes.map(node => node.kind)).toEqual(['country', 'writer', 'work', 'sourced-fact', 'activity', 'checkpoint']);
  expect(await page.evaluate(value => window.__copyVariantRecordHash(value), defaultDraft)).toBe(validationCalls[0].actualResult.draftChecksum);
  await activityEarlier.tap(); await orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true }).tap();
  await expect(orderRows).toHaveText(['4. Факт', '5. Задание']);
  await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  await activityEarlier.tap(); await factEnabled.uncheck();
  await expect(orderRows).toHaveText(['4. Задание']);
  await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Автор · вариант 2', { exact: true })).toHaveValue(JSON.stringify(['country-b', 'writer-c']));
  await previewButton.tap(); await expect(stepStatus).toContainText('Шаг 1 из 5 · Страна');
  await upload('restore-combined-before-removing-activity.json', reversedBytes); await combinedActivityEnabled.uncheck();
  await expect(orderRows).toHaveText(['4. Факт']);
  await expect(orderPanel.getByRole('button', { name: 'Вернуть обычный порядок', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Текст факта (RU)', exact: true })).toHaveValue(copy.ru.body);
  await expect(sourceField('HTTPS URL источника', 2, 'ru')).toHaveValue(copy.ru.sources[1].url);
  await previewButton.tap(); for (let index = 0; index < 3; index++) await next.tap(); await verifySources('ru');
  const finalValidationCalls = await page.evaluate(() => window.__activityValidationCalls);
  const finalAnswerCalls = await page.evaluate(() => window.__activityAnswerCalls);
  expect(finalAnswerCalls).toHaveLength(4); expect(finalAnswerCalls[heldOrderVerdict].hold).toBe(true);
  for (const call of finalAnswerCalls) {
    expect(call.actualHelperCalled).toBe(true); expect(call.actualResult.ok).toBe(true); expect(call.actualResult.correct).toBe(true);
  }
  expect(finalAnswerCalls[heldOrderVerdict].actualResult.draftChecksum).toBe(validationCalls[0].actualResult.draftChecksum);
  expect(finalAnswerCalls[2].actualResult.draftChecksum).not.toBe(validationCalls[0].actualResult.draftChecksum);
  expect(finalAnswerCalls[2].actualResult.draftChecksum).toBe(await page.evaluate(value => window.__copyVariantRecordHash(value), reversedDraft));
  expect(finalAnswerCalls[3].actualResult.draftChecksum).toBe(finalAnswerCalls[2].actualResult.draftChecksum);
  for (const call of finalValidationCalls) { expect(call.actualHelperCalled).toBe(true); expect(call.actualResult.ok).toBe(true); }
  expect(downloads).toHaveLength(3); expect(screenshots).toHaveLength(2);
  expect(await page.evaluate(() => window.__factExportBlobs.length)).toBe(3);
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
    localWidthChoicesPreserveCurrentLocaleAuthoredFactVariantsAndSourceLinks:true, selected768WidthFitsNarrowAvailableParent:true,
    englishPreviewConditionsStepLabelsRecordScreenAndSequentialNavigationLocalized: true,
    sourceLinksHaveHttpsNoopenerNoreferrer: true, narrow320LayoutHasNoHorizontalOverflow: true, minimumControlHitHeightCssPx: 44,
    combinedFactThenActivityPreviewVerified: true, combinedDraftAnswerBoundToSameWholeHash: true,
    factFiveNodeOverviewRuEnVerified: true, combinedSixNodeOverviewUsesActualDefinitionOrder: true,
    reviewReportFollowsActualFiveAndBothSixNodeOrders:true, independentRuTwoEnOneCitationsReportedUnreviewed:true,
    reportUsesExactAuthoredBaseFactVariantPresenceAndIndependentEnTitleFallback:true,
    changedReportLocaleKeepsFactWidthAndTextViewWithoutHelperRequest:true,
    nativeReopenBuildsFreshReportAndRejectedFullHashTamperPreservesCurrentReport:true,
    sameReopenedReportInspectPreservesActivityChoiceVerdictWidthAndCopyView:true,
    exactCompiledFactRuEnComparisonBodyCaptionReducedAndIndependentFallbackVerified:true,
    comparisonTracksBothOptionalOrdersAndFreshNativeReopenedCurrentNode:true,
    comparisonDoesNotAlterWholeDraftHashExportsSourceMetadataOrHelperCallCounts:true,
    nativeReopenedNarrowComparisonBothMultilineCaptionsAndLocalizedSummaryDirectlyCaptured:true,
    trustedOverviewFactAndActivityJumpsStayLocal: true, combinedOverviewControlsMinimum44CssPx: true,
    combinedCurrentCreditedAuthorCheckUsesActualHelper: true, mockedServerActionTransport: true,
    optionalOrderStartsCollapsedWithFixedBaseAnchors: true, trustedKeyboardReorderPreservesFocusAndMinimum44CssPx: true,
    unchangedBoundaryOrderKeepsPendingAnswer: true, changedOrderInvalidatesPreviewAndRejectsHeldAnswer: true, heldOrderVerdictCallIndex: heldOrderVerdict,
    bothOptionalOrdersUseActualDefinitionOrderInRuEnPreview: true, nativeCombinedOrderExportAndImportVerified: true,
    optionalOrderRuControlsAndEnReopenedReverseComparisonCaptured: true,
    rehashedDerivedOrderAndWrongEnabledSetCannotReplaceInputOrPreview: true,
    returningDefaultOmitsOwnOrderAndRestoresOriginalWholeDraftHash: true, changingOptionalPresenceClearsCustomOrderAndPreservesRemainingAuthoredFields: true,
    authenticatedAdminServerTested: false, installedDeviceTested: false, answerCheckDoesNotAdvanceStep: true,
    storageWrites, downloads, exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length },
    combinedExports: [{ path: reversedPath, sha256: sha(reversedBytes), bytes: reversedBytes.length }, { path: defaultPath, sha256: sha(defaultBytes), bytes: defaultBytes.length }],
    validationCalls: finalValidationCalls, answerCalls: finalAnswerCalls, sourceInputs: fixture.sourceInputs, screenshots, errors, externalRequests,
    productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  }, null, 2) });
});
