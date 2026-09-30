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
] };
let fixture;
test.beforeAll(async () => {
  const compiled = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {BookyJourneyDraftEditor} from './apps/admin/components/BookyJourneyDraftEditor';
      import './apps/admin/app/globals.css';
      createRoot(document.getElementById('root')).render(<BookyJourneyDraftEditor catalog={${JSON.stringify(catalog)}} />);`,
      loader: 'tsx', resolveDir: root },
    bundle: true, platform: 'browser', format: 'iife', target: 'es2020', write: false,
    outfile: 'editor.js', metafile: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = compiled.outputFiles.find(f => f.path.endsWith('.js'));
  const css = compiled.outputFiles.find(f => f.path.endsWith('.css'));
  expect(js).toBeTruthy(); expect(css).toBeTruthy();
  const sourceInputs = await Promise.all(Object.keys(compiled.metafile.inputs).filter(p => !p.startsWith('<') && !p.includes('node_modules/')).sort()
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
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await overflow()).toBe(false);
  await capture('booky-journey-editor-ru-1280.png', 'Actual editor component, same authored state, desktop upper form.');
  expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
  await testInfo.attach('booky-journey-editor-evidence', { contentType: 'application/json', body: JSON.stringify({
    pass: true, actualEditorComponent: true, actualEditorStyles: true, actualDraftCompiler: true,
    syntheticCatalog: true, authenticatedAdminServerTested: false, installedDeviceTested: false,
    bilingualDefinitions: 2, unapprovedDialogueDrafts: 8, cascadeResetsVerified: true, adultRuEnPreviewVerified:true, previewInvalidationVerified:true, missingCanonicalEnglishPreserved:true, downloads,
    exportedDraft: { path: exportedPath, sha256: sha(bytes), bytes: bytes.length }, sourceInputs: fixture.sourceInputs,
    screenshots, errors, externalRequests, productionActionsPerformed: false, stageAccepted: false, releaseReady: false,
  }, null, 2) });
});
