/** Focused UI regression against the actual audited native Android/dev bundle.
 * Native plugins are explicit browser simulations. No source fixture, stylesheet
 * injection, native storage, editorial approval or installed-device claim. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { captureReleaseInputs, sha256 } from './release-readiness.mjs';
import { verifyNativeArtifact } from './verify-native-artifact.mjs';

if (process.argv.length !== 2) throw new Error('No remote URL or options accepted.');
const root = await fs.realpath(fileURLToPath(new URL('../../', import.meta.url)));
const out = path.join(root, '.tmp/mobile-native-dossier-contrast-' + randomUUID());
await fs.mkdir(out);
const input = await captureReleaseInputs(root);
const report = {
  schemaVersion: 1, kind: 'literary-planet-native-dossier-contrast', startedAt: new Date().toISOString(),
  binding: input, scriptSha256: sha256(await fs.readFile(fileURLToPath(import.meta.url))),
  pluginBoundary: 'simulation', installed: false, osStorageObserved: false, releaseReady: false,
  cases: [], errors: [], externalRequests: [], screenshots: [], automatedPass: false, pass: false,
  visualReview: 'PENDING', fullProductAcceptance: false,
};
const editions = ['behaim-1492', 'hondius-1615', 'coronelli-1697', 'scherer-1700', 'cassini-1790',
  'rand-mcnally-1887', 'us-army-general-reference-1943', 'nasa-blue-marble', 'natural-earth-2026'];
const origin = 'https://local-native-dossier.test', workKey = 'russia:dostoevsky:crime-and-punishment';
let browser, context;
try {
  report.audit = await verifyNativeArtifact({ rootDir: root });
  if (!report.audit.pass) throw new Error('Current native artifact integrity/source audit failed.');
  const metadata = await fs.readFile(path.join(root, 'dist-native/artifact.json'));
  const artifact = JSON.parse(metadata.toString('utf8'));
  if (artifact.kind !== 'literary-planet-bundled-native-preparation' || artifact.platform !== 'android'
    || artifact.channel !== 'dev' || artifact.sourceCommit !== input.sourceCommit || artifact.releaseReady !== false)
    throw new Error('Exact current-source Android/dev preparation required.');
  const audited = report.audit.identity;
  const derivedBuildId = sha256(Buffer.from(JSON.stringify({ sourceCommit: artifact.sourceCommit,
    sourceInputsSha256: artifact.sourceInputs.sha256, platform: artifact.platform, channel: artifact.channel,
    inventory: artifact.inventory }, null, 2) + '\n'));
  if (audited?.buildId !== artifact.buildId || audited.sourceCommit !== artifact.sourceCommit
    || audited.platform !== artifact.platform || audited.channel !== artifact.channel || derivedBuildId !== artifact.buildId)
    throw new Error('Artifact metadata changed after integrity audit.');
  report.artifactSha256 = sha256(metadata); report.buildId = artifact.buildId;
  report.artifactSourceInputsSha256 = artifact.sourceInputs.sha256;
  const files = new Map();
  for (const item of artifact.inventory) {
    const name = path.resolve(root, 'dist-native', item.path);
    const stat = await fs.lstat(name);
    if (!name.startsWith(path.join(root, 'dist-native') + path.sep) || !stat.isFile() || stat.isSymbolicLink()
      || await fs.realpath(name) !== name) throw new Error('Unsafe emitted bundle input.');
    const bytes = await fs.readFile(name);
    if (sha256(bytes) !== item.sha256 || bytes.length !== item.bytes) throw new Error('Emitted byte digest mismatch.');
    files.set('/' + item.path, bytes);
  }
  const preferences = new Map();
  browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.exposeBinding('fixturePreference', (_source, method, key, value) => {
    if (method === 'get') return preferences.get(key) ?? null;
    if (method === 'set') preferences.set(key, value); else if (method === 'remove') preferences.delete(key);
    return true;
  });
  await context.addInitScript(() => {
    window.androidBridge = { postMessage() { throw new Error('Actual OS bridge unavailable in browser regression.'); } };
    const plugins = { App: ['getAppLanguage', 'getState', 'getLaunchUrl', 'exitApp'], Network: ['getStatus'],
      Preferences: ['get', 'set', 'remove'], Browser: ['open', 'close'], AppLauncher: ['openUrl', 'canOpenUrl'],
      PlanetContentStore: ['get', 'put', 'remove', 'keys', 'capacity'], PlanetSecureStore: ['get', 'set', 'remove'] };
    window.Capacitor = {
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({ name, methods: [
        ...methods.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' },
        { name: 'removeListener', rtype: 'promise' } ] })),
      nativeCallback: () => 'synthetic-listener', nativePromise: async (plugin, method, options) => {
        if (method === 'removeListener') return {};
        if (plugin === 'App') {
          if (method === 'getAppLanguage') return { value: 'ru' };
          if (method === 'getState') return { isActive: true };
          if (method === 'getLaunchUrl') return undefined;
          return {};
        }
        if (plugin === 'Network') return { connected: false, connectionType: 'none' };
        if (plugin === 'Preferences') {
          const value = await window.fixturePreference(method, options.key, options.value);
          return method === 'get' ? { value } : {};
        }
        if (plugin === 'PlanetContentStore') {
          if (method === 'capacity') return { availableBytes: 256 * 1024 * 1024 };
          if (method === 'keys') return { keys: [] };
        }
        throw new Error('Native storage/operation unavailable in browser regression.');
      },
    };
  });
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.geojson': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg' };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { report.externalRequests.push(url.origin); await route.abort(); return; }
    const name = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname), bytes = files.get(name);
    if (!bytes) { report.errors.push('MISSING_BUNDLED_RESOURCE:' + name); await route.fulfill({ status: 404, body: '' }); return; }
    await route.fulfill({ status: 200, body: bytes, contentType: mime[path.extname(name)] ?? 'application/octet-stream' });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push('PAGE_ERROR:' + error.message));
  page.setDefaultTimeout(12000);
  const app = page.locator('.native-planet-app'), panel = page.locator('.native-planet-panel');
  const detail = panel.locator('#book-archive-detail'), reader = detail.locator('.book-dossier-reader');
  const menuToggle = page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]');
  const menu = page.locator('.atlas-application-chrome [data-atlas-application-menu-panel]');
  const pager = reader.locator('.book-dossier-reader__pager > span');
  const record = (id, details) => report.cases.push({ id, status: 'PASS', ...details });
  const capture = async name => {
    const filename = name + '.png'; await reader.screenshot({ path: path.join(out, filename), timeout: 10000 });
    report.screenshots.push({ path: filename, sha256: sha256(await fs.readFile(path.join(out, filename))),
      locale: await reader.getAttribute('lang'), edition: await app.getAttribute('data-planet-edition'), visuallyReviewed: false });
  };
  const closePanel = async () => {
    if (await panel.isVisible()) {
      await panel.getByRole('button', { name: /^(?:Вернуться к планете|Return to the planet)$/u }).click();
      await expect(panel).toBeHidden();
    }
  };
  const openPanel = async () => {
    if (!await panel.isVisible()) {
      if (await menuToggle.getAttribute('aria-expanded') !== 'true') await menuToggle.click();
      await menu.locator('[data-atlas-action="open-collection"]').click(); await expect(panel).toBeVisible();
    }
  };
  const language = async locale => {
    if (await page.locator('html').getAttribute('lang') !== locale)
      await panel.locator('[data-interface-language="' + locale + '"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(reader).toHaveAttribute('lang', locale);
  };
  await page.goto(origin + '/#atlas', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await expect(app).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.native-planet-launch')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('#atlas canvas').first()).toBeVisible({ timeout: 20000 });
  const canvas = await page.locator('#atlas canvas').first().elementHandle();
  if (!canvas) throw new Error('Actual canonical canvas unavailable.');
  await expect(page.locator('[data-planet-welcome]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-planet-welcome-action="search"]').click();
  await expect(page.locator('#country-search')).toBeFocused();
  await page.locator('#country-search').fill('Преступление и наказание');
  await page.locator('#country-results [data-option-key="book:' + workKey + '"]').click();
  await expect(detail).toBeVisible(); await expect(detail).toHaveAccessibleName('Преступление и наказание');
  await expect.poll(() => new URL(page.url()).searchParams.get('book')).toBe(workKey);
  const read = detail.locator('.book-detail-read-dossier'); if (await read.isVisible()) await read.click();
  await expect(reader).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  const firstEdition = await app.getAttribute('data-planet-edition');
  if (!editions.includes(firstEdition)) throw new Error('Unknown actual palette edition.');
  const order = [firstEdition, ...editions.filter(edition => edition !== firstEdition)];
  const colors = async control => control.evaluate(node => {
    const style = getComputedStyle(node), box = node.getBoundingClientRect();
    const rgb = value => {
      const match = /^rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d+(?:\.\d+)?))?\)$/u.exec(value);
      if (!match || match[4] !== undefined && +match[4] !== 1) throw new Error('Nonopaque/unknown computed control color.');
      return match.slice(1, 4).map(Number);
    };
    const light = channels => channels.map(value => value / 255).map(value => value <= .04045
      ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const a = light(rgb(style.color)), b = light(rgb(style.backgroundColor));
    return { text: node.textContent, color: style.color, background: style.backgroundColor, opacity: Number(style.opacity),
      fontSize: parseFloat(style.fontSize), contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
      width: box.width, height: box.height, hovered: node.matches(':hover'), focusVisible: node.matches(':focus-visible'),
      outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), disabled: node.disabled };
  });
  for (const edition of order) {
    await closePanel();
    const select = page.locator('.globe-edition-compact-select select:visible'); await expect(select).toHaveCount(1);
    const actual = await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value));
    if (JSON.stringify([...actual].sort()) !== JSON.stringify([...editions].sort())) throw new Error('Actual edition set changed.');
    await expect(select).toBeEnabled(); if (await select.inputValue() !== edition) await select.selectOption(edition);
    await expect(app).toHaveAttribute('data-planet-edition', edition, { timeout: 20000 });
    await expect(page.locator('.literary-globe')).toHaveAttribute('data-globe-edition', edition, { timeout: 20000 });
    await expect(select).toBeEnabled({ timeout: 20000 }); await openPanel();
    for (const locale of ['ru', 'en']) {
      await language(locale); await expect(reader).toBeVisible();
      const contents = reader.getByRole('button', { name: locale === 'ru' ? 'Оглавление' : 'Contents', exact: true });
      const previous = reader.getByRole('button', { name: locale === 'ru' ? 'Предыдущий раздел' : 'Previous section', exact: true });
      const next = reader.getByRole('button', { name: locale === 'ru' ? 'Следующий раздел' : 'Next section', exact: true });
      const navigation = reader.locator('#book-dossier-contents');
      await expect(contents).toHaveText(locale === 'ru' ? 'Оглавление' : 'Contents');
      await expect(previous).toHaveText('←'); await expect(next).toHaveText('→');
      if (await contents.getAttribute('aria-expanded') === 'true') await contents.click();
      await contents.click(); await expect(navigation).toBeVisible(); await expect(contents).toHaveAttribute('aria-expanded', 'true');
      await contents.click(); await expect(navigation).toBeHidden(); await expect(contents).toHaveAttribute('aria-expanded', 'false');
      // Reset through the actual contents action, never a catalog/state setter.
      await contents.click(); await navigation.getByRole('button').first().click(); await expect(navigation).toBeHidden();
      await expect(pager).toContainText(/(?:Раздел|Section) 1\s*\//u); await expect(previous).toBeDisabled();
      const disabled = await colors(previous);
      if (disabled.text !== '←' || disabled.opacity <= 0 || disabled.fontSize <= 0 || disabled.color === disabled.background
        || disabled.width < 44 || disabled.height < 44) throw new Error('Disabled previous glyph is not drawable.');
      if (edition === firstEdition) await capture('dossier-disabled-' + locale);
      await expect(next).toBeEnabled(); await next.click();
      await expect(pager).toContainText(/(?:Раздел|Section) 2\s*\//u); await expect(previous).toBeEnabled(); await expect(next).toBeEnabled();
      const observations = [];
      for (const [name, control] of [['contents', contents], ['previous', previous], ['next', next]]) {
        for (const state of ['base', 'hover', 'focus']) {
          await page.mouse.move(0, 0);
          if (state === 'base') await reader.focus();
          if (state === 'hover') { await control.hover(); await expect.poll(() => control.evaluate(node => node.matches(':hover'))).toBe(true); }
          if (state === 'focus') { await page.keyboard.press('Tab'); await control.focus(); await expect(control).toBeFocused(); }
          await expect.poll(async () => (await colors(control)).contrast).toBeGreaterThanOrEqual(4.5);
          const measured = await colors(control);
          if (measured.disabled || measured.opacity !== 1 || measured.fontSize <= 0 || measured.width < 44 || measured.height < 44
            || state === 'base' && (measured.hovered || measured.focusVisible)
            || state === 'focus' && (!measured.focusVisible || measured.outlineStyle === 'none' || measured.outlineWidth <= 0))
            throw new Error('Control text/touch/focus state failed: ' + name + '/' + state);
          observations.push({ name, state, ...measured });
        }
      }
      if (edition === firstEdition) {
        await next.hover(); await capture('dossier-hover-' + locale);
        await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await contents.focus(); await capture('dossier-focus-' + locale);
      }
      await previous.click(); await expect(pager).toContainText(/(?:Раздел|Section) 1\s*\//u); await expect(previous).toBeDisabled();
      await expect(page.locator('#atlas canvas')).toHaveCount(1);
      if (!await page.locator('#atlas canvas').first().evaluate((node, original) => node === original, canvas))
        throw new Error('Canonical canvas replaced during palette/locale changes.');
      if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) throw new Error('Horizontal viewport overflow.');
      record(edition + ':' + locale, { contentsOpenClose: true, nextPreviousNavigation: true, disabledPrevious: disabled,
        observations, sameCanvas: true, canonicalWorkKey: workKey });
      await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    }
  }
  await closePanel();
  const select = page.locator('.globe-edition-compact-select select:visible');
  if (await select.inputValue() !== firstEdition) await select.selectOption(firstEdition);
  await expect(app).toHaveAttribute('data-planet-edition', firstEdition, { timeout: 20000 });
  const after = await captureReleaseInputs(root);
  if (after.sourceFingerprint !== input.sourceFingerprint || after.sourceCommit !== input.sourceCommit
    || sha256(await fs.readFile(path.join(root, 'dist-native/artifact.json'))) !== report.artifactSha256)
    throw new Error('Source or actual bundle metadata changed during regression.');
  report.automatedPass = report.cases.length === 18 && report.screenshots.length === 6
    && report.errors.length === 0 && report.externalRequests.length === 0;
} catch (error) {
  report.errors.push(error.message);
} finally {
  await context?.close(); await browser?.close();
}
report.status = report.automatedPass ? 'AUTOMATED_PASS_VISUAL_REVIEW_PENDING' : 'FAIL';
report.finishedAt = new Date().toISOString();
report.limits = ['Native plugin/Preferences boundaries are explicit simulations.',
  'Only actual emitted dossier UI, canonical navigation and nine actual palette controls are covered.',
  'Six fresh snapshot hashes require separate root visual review before final focused PASS.',
  'No native storage, installed device, human editorial/legal approval or release acceptance.'];
await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(root, out), status: report.status, automatedPass: report.automatedPass,
  pass: false, visualReview: report.visualReview, cases: report.cases.length, screenshots: report.screenshots, errors: report.errors,
  installed: false, osStorageObserved: false, releaseReady: false }));
process.exitCode = report.automatedPass ? 0 : 1;
