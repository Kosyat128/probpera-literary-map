import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Test-only synthetic input and controls around the real React hook and search
// compiler. No App, catalog, worker, entitlement or native runtime is simulated.
const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "https://search-preparation.test";
const sourcePaths = [
  "src/search/usePreparedSearchIndex.ts",
  "src/utils/prepareSearchIndex.ts",
  "src/utils/literarySearch.ts",
  "tests/host/search-preparation.spec.mjs",
  "playwright.search-preparation.config.mjs",
];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const captureSources = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, digest(await readFile(path.join(root, file)))])));
let browser, bundle, sourceBefore;

const fixture = String.raw`
  import { useCallback, useEffect, useRef, useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { usePreparedSearchIndex } from './src/search/usePreparedSearchIndex';
  import { compileLiterarySearchFields } from './src/utils/literarySearch';

  const evidence = window.__searchPreparation = { jobs: [], renders: [], pulses: [], initialTasks: [], hostTasks: [], actions: [] };
  const prepare = item => ({ language: item.language, id: item.id, fields: compileLiterarySearchFields(item.fields) });
  let autoLocaleSwitchScheduled = false;

  function PreparedList({ language, mode }) {
    const failureBudget = useRef(1);
    const source = useCallback(() => {
      const job = { id: evidence.jobs.length + 1, language, mode, consumed: 0, finalized: false, failed: false };
      evidence.jobs.push(job);
      // This unrelated host task is queued before the real helper's initial
      // yield. Its actual button handler must run before any iterator steps.
      setTimeout(() => {
        evidence.initialTasks.push({ job: job.id, consumed: job.consumed });
        document.getElementById('pulse').click();
      }, 0);
      return (function* () {
        try {
          for (let index = 0; index < 10000; index++) {
            if (mode === 'failure' && index === 200 && failureBudget.current) {
              failureBudget.current--;
              job.failed = true;
              throw undefined;
            }
            job.consumed++;
            const switchLocale = mode === 'locale-race' && language === 'ru' && !autoLocaleSwitchScheduled;
            if (index === 299 && (mode === 'unmount' || switchLocale)) {
              if (switchLocale) autoLocaleSwitchScheduled = true;
              // Trigger a real control from the next host task, at a known
              // progress boundary; do not mock the hook, scheduler or signal.
              setTimeout(() => document.getElementById(mode === 'unmount' ? 'unmount' : 'language-en').click(), 0);
            }
            const number = String(index).padStart(5, '0');
            yield { language, id: number, fields: [
              language === 'ru' ? 'Синтетический том ' + number : 'Synthetic volume ' + number,
              'Synthetic search capacity fixture; no catalog or editorial status.',
              'Поисковая запись для проверки отмены и языка интерфейса.',
            ] };
          }
        } finally { job.finalized = true; }
      })();
    }, [language, mode]);
    const index = usePreparedSearchIndex(source, prepare);
    // Render telemetry intentionally captures the first render before effect
    // cleanup, where stale records could otherwise escape a locale switch.
    evidence.renders.push({ language, mode, loading: index.loading, length: index.items.length,
      firstLanguage: index.items[0]?.language ?? null, firstId: index.items[0]?.id ?? null,
      wrongLanguage: index.items.some(item => item.language !== language), error: index.error?.message ?? null });
    useEffect(() => {
      if (!index.loading) return;
      const timer = setInterval(() => {
        const job = evidence.jobs.at(-1);
        if (evidence.hostTasks.length < 2000) evidence.hostTasks.push({ language, mode, job: job?.id, consumed: job?.consumed ?? 0 });
      }, 1);
      return () => clearInterval(timer);
    }, [index.loading, language, mode]);
    return <section id="prepared" data-language={language} data-mode={mode} data-loading={String(index.loading)} data-count={index.items.length}>
      <output id="state">{index.loading ? 'Preparing' : index.error ? index.error.message : 'Ready'}</output>
      <button id="retry" onClick={index.retry}>Retry preparation</button>
    </section>;
  }

  function Harness() {
    const [config, setConfig] = useState({ mounted: false, language: 'ru', mode: 'idle' });
    const [pulses, setPulses] = useState(0);
    const begin = mode => { evidence.actions.push({ action: 'begin', mode }); setConfig({ mounted: true, language: mode === 'unmount' ? 'en' : 'ru', mode }); };
    const language = next => { evidence.actions.push({ action: 'language', language: next }); setConfig(current => ({ ...current, language: next })); };
    return <main>
      <h1>Synthetic search preparation fixture</h1>
      <button onClick={() => begin('locale-race')}>Start locale race</button>
      <button onClick={() => begin('unmount')}>Start unmount case</button>
      <button onClick={() => begin('failure')}>Start failure case</button>
      <button id="language-ru" onClick={() => language('ru')}>RU</button>
      <button id="language-en" onClick={() => language('en')}>EN</button>
      <button id="pulse" onClick={() => {
        const job = evidence.jobs.at(-1);
        evidence.pulses.push({ job: job?.id ?? null, consumed: job?.consumed ?? 0 });
        setPulses(value => value + 1);
      }}>Pulse {pulses}</button>
      <button id="unmount" onClick={() => { evidence.actions.push({ action: 'unmount' }); setConfig(current => ({ ...current, mounted: false })); }}>Unmount preparation</button>
      {config.mounted && <PreparedList language={config.language} mode={config.mode} />}
    </main>;
  }
  createRoot(document.getElementById('root')).render(<Harness />);
`;

test.beforeAll(async () => {
  sourceBefore = await captureSources();
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: fixture, resolveDir: root, sourcefile: "search-preparation-test-entry.jsx", loader: "jsx" },
    bundle: true, write: false, outfile: path.join(root, ".tmp/search-preparation-memory.js"),
    platform: "browser", format: "iife", target: "es2022", jsx: "automatic", logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  bundle = result.outputFiles[0].contents;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});

test.afterAll(async () => { await browser?.close(); });

test("mounted search preparation preserves locale snapshots and cancels obsolete work", async ({}, testInfo) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [], assertions = {};
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url() === origin + "/"
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' })
    : route.abort());
  try {
    await page.goto(origin + "/");
    await page.addScriptTag({ content: Buffer.from(bundle).toString("utf8") });
    await page.getByRole("button", { name: "Start locale race", exact: true }).click();
    await expect(page.locator("#prepared")).toHaveAttribute("data-language", "en");
    await expect(page.locator("#prepared")).toHaveAttribute("data-count", "10000");
    await expect(page.locator("#state")).toHaveText("Ready");
    const race = await page.evaluate(() => window.__searchPreparation);
    const oldRu = race.jobs.find(job => job.mode === "locale-race" && job.language === "ru");
    const readyEn = race.jobs.find(job => job.mode === "locale-race" && job.language === "en");
    expect(oldRu).toMatchObject({ finalized: true, failed: false });
    expect(oldRu.consumed).toBeGreaterThanOrEqual(300);
    expect(oldRu.consumed).toBeLessThan(10000);
    expect(readyEn).toMatchObject({ consumed: 10000, finalized: true, failed: false });
    expect(race.initialTasks.length).toBeGreaterThanOrEqual(2);
    expect(race.initialTasks.every(task => task.consumed === 0)).toBe(true);
    expect(race.pulses.some(pulse => pulse.job === oldRu.id && pulse.consumed === 0)).toBe(true);
    expect(race.hostTasks.some(task => task.consumed > 0 && task.consumed < 10000)).toBe(true);
    expect(race.renders.find(render => render.mode === "locale-race" && render.language === "en"))
      .toMatchObject({ loading: true, length: 0, firstLanguage: null, error: null });
    expect(race.renders.every(render => !render.wrongLanguage && (!render.loading || render.length === 0))).toBe(true);
    assertions.initialYieldAndHostInterleaving = true;
    assertions.obsoleteLocaleCancelledAndNeverRendered = true;

    // An ordinary state update with unchanged callbacks must retain the ready
    // snapshot, without recreating or consuming the source.
    await page.getByRole("button", { name: /^Pulse / }).click();
    expect(await page.evaluate(() => window.__searchPreparation.jobs.length)).toBe(race.jobs.length);
    await expect(page.locator("#prepared")).toHaveAttribute("data-count", "10000");
    assertions.stableCallbacksReuseCompletedPreparation = true;

    // Unlike the first cancellation race, this switch starts with a fully
    // published old-locale snapshot. Inspect the first new render itself.
    const beforeRuSwitch = await page.evaluate(() => window.__searchPreparation.renders.length);
    await page.getByRole("button", { name: "RU", exact: true }).click();
    await expect(page.locator("#prepared")).toHaveAttribute("data-language", "ru");
    await expect(page.locator("#prepared")).toHaveAttribute("data-count", "10000");
    const readyRu = await page.evaluate(() => window.__searchPreparation.renders);
    expect(readyRu[beforeRuSwitch]).toMatchObject({ language: "ru", loading: true, length: 0, firstLanguage: null, error: null });
    expect(readyRu.at(-1)).toMatchObject({ language: "ru", loading: false, length: 10000, firstLanguage: "ru", firstId: "00000" });
    assertions.completedOldLocaleHiddenBeforeEffectCleanup = true;

    await page.getByRole("button", { name: "Start unmount case", exact: true }).click();
    await expect(page.locator("#prepared")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__searchPreparation.jobs.find(job => job.mode === "unmount")?.finalized)).toBe(true);
    const unmounted = await page.evaluate(async () => {
      const job = window.__searchPreparation.jobs.find(value => value.mode === "unmount");
      const before = job.consumed;
      // Observe later host turns after iterator finalization; no wall-clock sleep.
      for (let turn = 0; turn < 3; turn++) await new Promise(resolve => setTimeout(resolve, 0));
      return { before, after: job.consumed, finalized: job.finalized };
    });
    expect(unmounted.before).toBeGreaterThanOrEqual(300);
    expect(unmounted.before).toBeLessThan(10000);
    expect(unmounted.after).toBe(unmounted.before);
    expect(unmounted.finalized).toBe(true);
    assertions.unmountStopsIteratorConsumption = true;

    await page.getByRole("button", { name: "Start failure case", exact: true }).click();
    await expect(page.locator("#state")).toHaveText("Search index preparation failed");
    await expect(page.locator("#prepared")).toHaveAttribute("data-loading", "false");
    await expect(page.locator("#prepared")).toHaveAttribute("data-count", "0");
    const beforeRetry = await page.evaluate(() => window.__searchPreparation.renders.length);
    await page.getByRole("button", { name: "Retry preparation", exact: true }).click();
    await expect(page.locator("#prepared")).toHaveAttribute("data-count", "10000");
    await expect(page.locator("#state")).toHaveText("Ready");
    const retried = await page.evaluate(() => window.__searchPreparation);
    expect(retried.renders[beforeRetry]).toMatchObject({ loading: true, length: 0, error: null });
    const failureJobs = retried.jobs.filter(job => job.mode === "failure");
    expect(failureJobs).toHaveLength(2);
    expect(failureJobs[0]).toMatchObject({ consumed: 200, finalized: true, failed: true });
    expect(failureJobs[1]).toMatchObject({ consumed: 10000, finalized: true, failed: false });
    expect(retried.renders.every(render => !render.wrongLanguage && (!render.loading || render.length === 0))).toBe(true);
    expect(errors).toEqual([]);
    assertions.undefinedFailureHandledAndRetryFresh = true;
  } finally {
    const sourceAfter = await captureSources();
    const runtime = await page.evaluate(() => window.__searchPreparation ?? null).catch(() => null);
    await testInfo.attach("search-preparation-lifecycle.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({
        scope: "Real mounted React hook and compiler; 10000 synthetic rows only; not full App or installed-device performance evidence",
        sourceBefore, sourceAfter, sourceUnchanged: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter),
        bundleSha256: digest(bundle), assertions, errors, runtime,
        stageAccepted: false, releaseReady: false,
      }, null, 2)),
    });
    await context.close();
    expect(sourceAfter).toEqual(sourceBefore);
  }
});
