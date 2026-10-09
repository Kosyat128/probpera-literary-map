/**
 * Isolated real Chrome + Next compiled React + TipTap component regression.
 * Launch from the repository root:
 * node apps/admin/tests/browser/page-form-browser.mjs --label=final --source-root=current
 * Optional --source-root=.tmp/m02-page-form-baseline-source selects saved source copies.
 * Optional --chrome=<installed executable>; no browser/dependency installation is performed.
 * Optional --cases=<comma-separated fixture names> performs a selected diagnostic run.
 * Server actions, link routing and the busy media flag are explicit fixtures. No authenticated
 * Next request, database, real upload/delete, credentials or external network are exercised.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
const adminRoot = path.join(root, "apps/admin");
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const { chromium } = require("playwright");
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
  if (!match || !["label", "source-root", "chrome", "cases"].includes(match[1])) throw new Error("Unsupported fixture argument");
  return [match[1], match[2]];
}));
const label = args.label || "current";
if (!/^[a-z0-9-]+$/u.test(label)) throw new Error("Label must contain only lowercase letters, digits or hyphens");
const sourceArgument = args["source-root"] || "current";
const isCurrent = sourceArgument === "current";
if (!isCurrent && (path.isAbsolute(sourceArgument) || sourceArgument.split(/[\\/]/u).includes(".."))) throw new Error("Snapshot root must be a relative path within this checkout");
const snapshotRoot = isCurrent ? adminRoot : path.resolve(root, sourceArgument);
if (!existsSync(snapshotRoot)) throw new Error("Source root is unavailable");
await mkdir(path.join(root, ".tmp"), { recursive: true });
const prefix = path.join(root, `.tmp/m02-page-form-${label}`);
const executablePath = args.chrome || "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!existsSync(executablePath)) throw new Error("Installed browser unavailable; specify --chrome=<installed executable>. No install is performed.");
const forbidden = /(?:\/lib\/supabase\/|\/lib\/auth(?:\.|\/)|@supabase|node:|(?:^|\/)server-only$)/u;
const virtualModules = {
  "next/link": 'import React from "react"; export default function Link({children,...props}) { return React.createElement("a",props,children); }',
  "next/navigation": 'export { unstable_rethrow } from "next/dist/client/components/unstable-rethrow.browser"; const router = { refresh() { window.__pageFormHarness.routerRefreshCalls += 1; } }; export function useRouter() { return router; }',
  "next/dynamic": `import React from "react"; export default function dynamic(loader, options = {}) {
    const Component = React.lazy(async () => { const loaded = await loader(); return {default: loaded.default || loaded}; });
    return function DynamicFixture(props) { return React.createElement(React.Suspense, {fallback: options.loading ? React.createElement(options.loading) : null}, React.createElement(Component, props)); };
  }`,
  "@/app/(dashboard)/pages/actions": 'export async function savePageAction(formData) { return await window.__pageFormHarness.savePageAction(formData); }',
  "@/app/(dashboard)/editor-links/actions": 'export async function searchEditorInternalLinksAction() { throw new Error("Internal link search is outside this fixture"); }',
  "@/app/(dashboard)/editor-autosave/actions": `
    export async function loadLatestEditorAutosaveAction(locator) { return window.__pageFormHarness.autosaveBoundary("load", locator); }
    export async function saveEditorAutosaveAction(input) { return window.__pageFormHarness.autosaveBoundary("save", input); }
    export async function deleteExactEditorAutosaveAction(input) { return window.__pageFormHarness.autosaveBoundary("delete", input); }
  `,
  "@/components/useEditorMediaWorkflow": `
    import { useEditorMediaWorkflow as realWorkflow } from "m02-real-media-workflow";
    export function useEditorMediaWorkflow(options) {
      const workflow = realWorkflow(options);
      return window.__pageFormHarness.scenario === "media-busy" ? {...workflow, busy:true} : workflow;
    }
  `,
};
const readSources = new Map();
const bundle = await build({
  absWorkingDir: root, entryPoints: [path.join(directory, "fixtures/page-form-entry.jsx")],
  bundle: true, write: false, format: "iife", platform: "browser", target: "chrome120", jsx: "automatic", sourcemap: false,
  define: { "process.env.NODE_ENV": '"development"', "process.env.ADMIN_BASE_PATH": '"/admin"' },
  plugins: [{ name: "isolated-real-editor-boundaries", setup(builder) {
    builder.onResolve({ filter: /.*/ }, request => {
      if (Object.hasOwn(virtualModules, request.path)) return { path: request.path, namespace: "m02-page-form-mock" };
      if (request.path === "m02-real-media-workflow") return { path: path.join(adminRoot, "components/useEditorMediaWorkflow.ts") };
      if (/^react(?:\/|$)|^react-dom(?:\/|$)/u.test(request.path)) return { path: require.resolve("next/dist/compiled/" + request.path) };
      if (forbidden.test(request.path)) throw new Error("Forbidden provider/server import in browser harness: " + request.path);
      if (request.path.startsWith("@/")) {
        const target = path.join(adminRoot, request.path.slice(2));
        const actual = [target, target + ".ts", target + ".tsx", target + ".js"].find(existsSync);
        if (!actual) throw new Error("Unresolved admin import: " + request.path);
        return { path: actual };
      }
    });
    builder.onLoad({ filter: /.*/, namespace: "m02-page-form-mock" }, request => ({ contents: virtualModules[request.path], loader: "js", resolveDir: root }));
    builder.onLoad({ filter: /\.[jt]sx?$/ }, async request => {
      if (!request.path.startsWith(adminRoot + path.sep)) return;
      const relative = path.relative(adminRoot, request.path);
      const alternate = !isCurrent ? path.join(snapshotRoot, relative) : "";
      const source = alternate && existsSync(alternate) ? alternate : request.path;
      const contents = await readFile(source, "utf8");
      if (/^["']use server["'];/u.test(contents.trimStart())) throw new Error("Unmocked server action module: " + relative);
      readSources.set(relative.replaceAll("\\", "/"), { source: path.relative(root, source).replaceAll("\\", "/"), sha256: createHash("sha256").update(contents).digest("hex") });
      return { contents, loader: request.path.endsWith("tsx") ? "tsx" : request.path.endsWith("jsx") ? "jsx" : request.path.endsWith("ts") ? "ts" : "js" };
    });
    builder.onLoad({ filter: /\.css$/ }, () => ({ contents: "export default {}", loader: "js" }));
  } }],
});
const code = bundle.outputFiles[0].text;
const loaderSource = readSources.get("components/PageEditorLoader.tsx");
const legacyLoaderApi = /export default function PageEditorLoader\(props: PageEditorProps\)/u.test(await readFile(path.join(root, loaderSource.source), "utf8"));
await writeFile(prefix + "-bundle.js", code);
const server = http.createServer((request, response) => {
  if (request.url === "/bundle.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(code); return; }
  if (request.url === "/favicon.ico") { response.writeHead(204); response.end(); return; }
  response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
  response.end('<!doctype html><html><head><meta charset="utf-8"><title>Isolated editor fixture</title><style>body{font-family:Arial;margin:20px}.ProseMirror{min-height:100px;border:1px solid #888;padding:12px}button{margin:4px}input,textarea{margin:4px}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true, executablePath });
const results = [], requests = [];
const cases = [
  "confirmed-rejection", "dependency-unavailable", "transport-failure", "unknown-result", "undefined-result", "malformed-wrong-id", "malformed-same-cas", "conflict",
  "saved", "saved-newer-edit", "saved-newer-controls", "saved-second-cas", "duplicate-submit", "publish-intent", "pending-unchanged-unload", "native-redirect", "native-not-found", "media-busy",
  "local-getter", "local-getitem", "local-setitem", "session-getter", "session-getitem", "session-setitem",
  "restore-metadata", "restore-empty-html", "restore-unknown-node", "restore-invalid-text", "restore-unknown-attrs", "cleanup-malformed", "cleanup-reject", "cleanup-removeitem",
  "autosave-local-failed", "autosave-session-sequence", "fallback-void", "fallback-false",
  "loader-reread-retain", "loader-initial-null", "loader-cross-id",
];
const selectedCases = args.cases ? args.cases.split(",") : cases;
if (selectedCases.some(scenario => !cases.includes(scenario)) || new Set(selectedCases).size !== selectedCases.length) throw new Error("Requested cases must be unique known fixture names");
const longTitle = "Synthetic revised title";
const longText = Array.from({ length: 55 }, (_, index) => `Synthetic paragraph ${index + 1}: retain this exact user input. `).join("");
const previousCas = "2026-09-30T10:00:00.123456+00:00", nextCas = "2026-09-30T12:00:00.654321+00:00";
const pageId = "11111111-1111-4111-8111-111111111111";

try {
  for (const scenario of selectedCases) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
    const errors = [], consoleErrors = [];
    await context.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(origin + "/")) return route.continue();
      requests.push({ scenario, url, method: route.request().method() });
      return route.abort("blockedbyclient");
    });
    await context.addInitScript(({ scenario, previousCas, nextCas, pageId, legacyLoaderApi }) => {
      const pendingKey = `probpera-editor-autosave:page:${pageId}:default:pending-canonical-save`;
      const localKey = `probpera-page-editor-${pageId}`;
      const harness = window.__pageFormHarness = {
        scenario, legacyLoaderApi, calls: [], autosaveCalls: [], storageFaults: [], componentErrors: [], localFallbackCalls: 0, routerRefreshCalls: 0,
        savePageAction(formData) {
          const data = Object.fromEntries(formData.entries());
          harness.readLiveIntent = () => formData.get("intent");
          harness.calls.push({ data, state: "pending" });
          return new Promise((resolve, reject) => { harness.pendingResolve = resolve; harness.pendingReject = reject; });
        },
        settle(outcome) {
          if (!harness.pendingReject) throw new Error("No verified pending action boundary");
          harness.calls[harness.calls.length - 1].state = typeof outcome === "string" ? outcome : outcome?.outcome;
          if (outcome === "transport") return harness.pendingReject(new TypeError("SAFE_FIXTURE_TRANSPORT_FAILED"));
          if (outcome === "native-redirect" || outcome === "native-not-found") {
            const error = new Error("SAFE_FIXTURE_NATIVE_SIGNAL");
            error.digest = outcome === "native-redirect" ? "NEXT_REDIRECT;replace;/pages/synthetic;303;" : "NEXT_HTTP_ERROR_FALLBACK;404";
            return harness.pendingReject(error);
          }
          return harness.pendingResolve(outcome);
        },
        autosaveBoundary(kind, input) {
          harness.autosaveCalls.push({ kind, input });
          if (kind === "load") return { ok: true, recovery: null };
          if (kind === "delete") {
            if (scenario === "cleanup-reject") throw new TypeError("SAFE_FIXTURE_CLEANUP_TRANSPORT_FAILED");
            return { ok: true };
          }
          if (scenario === "autosave-session-sequence") return { ok: true, receipt: {
            id: "22222222-2222-4222-8222-222222222222", state: "saved", sequence: input.clientSequence,
            snapshotHash: "a".repeat(64), baseUpdatedAt: previousCas, updatedAt: nextCas, expiresAt: "2026-10-01T12:00:00+00:00",
          } };
          return { ok: false, error: "SAFE_AUTOSAVE_UNAVAILABLE" };
        },
      };
      window.fetch = async () => { throw new Error("Network APIs are disabled in the isolated browser fixture"); };
      const storageFault = scenario === "autosave-local-failed" ? "local-setitem" : scenario === "autosave-session-sequence" ? "session-setitem" : scenario;
      const storageError = kind => { harness.storageFaults.push(kind); throw new DOMException("SAFE_FIXTURE_STORAGE_UNAVAILABLE", "SecurityError"); };
      if (storageFault === "local-getter") Object.defineProperty(window, "localStorage", { configurable: true, get() { return storageError(storageFault); } });
      if (storageFault === "session-getter") Object.defineProperty(window, "sessionStorage", { configurable: true, get() { return storageError(storageFault); } });
      const local = storageFault !== "local-getter" ? window.localStorage : null;
      const session = storageFault !== "session-getter" ? window.sessionStorage : null;
      const originalGet = Storage.prototype.getItem, originalSet = Storage.prototype.setItem, originalRemove = Storage.prototype.removeItem;
      if (scenario.startsWith("restore-")) {
        let copy = { version: 2, title: "Synthetic recovered metadata title" };
        if (scenario === "restore-empty-html") copy = { version: 2, title: "Synthetic recovered empty title", contentHtml: "" };
        if (scenario === "restore-unknown-node") copy.contentJson = JSON.stringify({ type: "doc", content: [{ type: "unknown_fixture_node" }] });
        if (scenario === "restore-invalid-text") copy.contentJson = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: 99 }] }] });
        if (scenario === "restore-unknown-attrs") copy.contentJson = JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { unknown_fixture_attr: "unsafe" }, content: [{ type: "text", text: "Synthetic unsupported replacement" }] }] });
        originalSet.call(local, localKey, JSON.stringify(copy));
      }
      if (scenario.startsWith("cleanup-")) originalSet.call(session, pendingKey, scenario === "cleanup-malformed" ? "{broken-json" : JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222", clientSessionId: "33333333-3333-4333-8333-333333333333",
        sequence: 1, snapshotHash: "a".repeat(64), state: "saved", baseUpdatedAt: previousCas, updatedAt: nextCas, expiresAt: "2026-10-01T12:00:00+00:00",
      }));
      harness.readPendingReceipt = () => originalGet.call(session, pendingKey);
      Storage.prototype.getItem = function(key) {
        if (storageFault === "local-getitem" && this === local && String(key).startsWith("probpera-page-editor-")) return storageError(storageFault);
        if (storageFault === "session-getitem" && this === session && String(key).startsWith("probpera-editor-autosave")) return storageError(storageFault);
        return originalGet.call(this, key);
      };
      Storage.prototype.setItem = function(key, value) {
        if (storageFault === "local-setitem" && this === local && String(key).startsWith("probpera-page-editor-")) return storageError(storageFault);
        if (storageFault === "session-setitem" && this === session && String(key).startsWith("probpera-editor-autosave")) return storageError(storageFault);
        return originalSet.call(this, key, value);
      };
      Storage.prototype.removeItem = function(key) {
        if (scenario === "cleanup-removeitem" && this === session && key === pendingKey) return storageError("session-removeitem");
        return originalRemove.call(this, key);
      };
    }, { scenario, previousCas, nextCas, pageId, legacyLoaderApi });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ name: error.name, message: error.message }));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 800)); });
    const assertions = [];
    const assert = (name, pass, details) => assertions.push({ name, pass: Boolean(pass), ...(details === undefined ? {} : { details }) });
    const state = () => page.evaluate(() => ({ calls: window.__pageFormHarness.calls, autosaveCalls: window.__pageFormHarness.autosaveCalls,
      title: document.querySelector('input[name="title"]')?.value, json: document.querySelector('input[name="content_json"]')?.value,
      cas: document.querySelector('input[name="expected_updated_at"]')?.value, text: document.body.innerText,
      dirty: document.body.innerText.includes("Есть несохранённые изменения"), boundary: Boolean(document.querySelector('[data-harness-error-boundary]')) }));
    const typeDraft = async () => {
      await page.getByRole("textbox", { name: "Название страницы" }).fill(longTitle);
      await page.locator('.ProseMirror[contenteditable="true"]').fill(longText);
      await page.waitForFunction(text => document.querySelector('input[name="content_json"]')?.value.includes(text), "Synthetic paragraph 55", { timeout: 5000 });
    };
    const saved = (stamp = nextCas, id = pageId) => ({ outcome: "saved", receipt: { pageId: id, updatedAt: stamp }, auditState: "recorded", publicationState: "queued", revalidationState: "complete" });
    try {
      if (scenario.startsWith("autosave-") || scenario.startsWith("fallback-")) await page.clock.install();
      await page.goto(origin, { waitUntil: "load", timeout: 20000 });
      await page.waitForFunction(() => window.__pageFormHarness?.bundleLoaded, { timeout: 10000 });
      await page.waitForTimeout(100);
      if (scenario.startsWith("loader-") && scenario !== "loader-initial-null") await page.waitForSelector('input[name="title"]', { timeout: 5000 });
      const recoveryOnly = scenario.startsWith("fallback-");
      const mounted = recoveryOnly ? await page.locator(".editor-recovery-controller").count() === 1 : await page.locator('input[name="title"]').count() === 1;
      if (scenario === "loader-initial-null") {
        assert("initial failed read never opens an empty editor", !mounted && await page.locator('[data-harness-loader-unavailable]').count() === 1);
        await page.evaluate(() => window.__pageFormHarness.updateLoader(true));
        await page.waitForSelector('input[name="title"]', { timeout: 5000 });
        assert("verified initial read opens original content", (await state()).title === "Synthetic page title" && (await state()).text.includes("Synthetic original paragraph."));
      } else if (mounted && scenario.startsWith("loader-")) {
        assert("actual loader opens its actual editor", mounted);
        await typeDraft();
        const nextId = scenario === "loader-cross-id" ? "44444444-4444-4444-8444-444444444444" : pageId;
        await page.evaluate(nextId => window.__pageFormHarness.updateLoader(false, nextId), nextId);
        await page.waitForTimeout(100);
        const failedRead = await state();
        if (scenario === "loader-reread-retain") {
          assert("failed reread preserves exact mounted dirty title and body", !failedRead.boundary && failedRead.title === longTitle && failedRead.dirty && JSON.parse(failedRead.json || "{}").content?.[0]?.content?.[0]?.text === longText);
          const save = page.getByRole("button", { name: "Сохранить", exact: true }), publish = page.getByRole("button", { name: "Опубликовать", exact: true });
          assert("unavailable reread blocks Save and Publish without removing editor", await save.count() === 1 && await save.isDisabled() && await publish.isDisabled());
          if (await page.locator("form").count()) await page.locator("form").evaluate(form => form.requestSubmit());
          await page.waitForTimeout(70);
          assert("unavailable reread also blocks native requestSubmit", (await state()).calls.length === 0);
          if (await page.locator('input[name="title"]').count()) {
            await page.getByRole("link", { name: "Synthetic retry read", exact: true }).click();
            assert("retry delegates to mocked refresh while keeping dirty form", await page.evaluate(() => window.__pageFormHarness.routerRefreshCalls) === 1 && (await state()).title === longTitle);
          }
        } else assert("different identity cannot reuse cached dirty editor", failedRead.title === undefined && !failedRead.text.includes(longText));
        await page.evaluate(nextId => window.__pageFormHarness.updateLoader(true, nextId), nextId);
        await page.waitForSelector('input[name="title"]', { timeout: 5000 });
        await page.waitForTimeout(100);
        const recoveredRead = await state();
        if (scenario === "loader-reread-retain") {
          assert("verified reread reenables Save without replacing newer edits", recoveredRead.title === longTitle && recoveredRead.dirty && JSON.parse(recoveredRead.json || "{}").content?.[0]?.content?.[0]?.text === longText && !(await page.getByRole("button", { name: "Сохранить", exact: true }).isDisabled()));
          await page.getByRole("button", { name: "Сохранить", exact: true }).click();
          await page.waitForFunction(() => window.__pageFormHarness.calls.length === 1, { timeout: 4000 });
          assert("reenabled save submits retained input", (await state()).calls[0].data.title === longTitle);
          await page.evaluate(() => window.__pageFormHarness.settle({ outcome: "rejected", reason: "validation" }));
        } else assert("verified different identity opens fresh original content", recoveredRead.title === "Synthetic page title" && !recoveredRead.dirty && recoveredRead.text.includes("Synthetic original paragraph.") && await page.locator('input[name="id"]').inputValue() === nextId);
      } else if (mounted && scenario.startsWith("restore-")) {
        assert("real component remains mounted", mounted);
        const before = await state();
        await page.getByRole("button", { name: "Восстановить локальную копию", exact: true }).click();
        await page.waitForTimeout(100);
        const after = await state();
        assert("restored metadata is applied", after.title === (scenario === "restore-empty-html" ? "Synthetic recovered empty title" : "Synthetic recovered metadata title"));
        assert("restored copy remains dirty", after.dirty);
        assert(scenario === "restore-empty-html" ? "explicit empty legacy HTML intentionally clears body" : "missing or unsupported recovered body preserves existing JSON",
          scenario === "restore-empty-html" ? !after.text.includes("Synthetic original paragraph.") && !after.json.includes("Synthetic original paragraph.") : after.json === before.json && after.text.includes("Synthetic original paragraph."));
      } else if (mounted && scenario.startsWith("cleanup-")) {
        assert("real component remains mounted", mounted);
        const data = await page.evaluate(() => ({ pending: window.__pageFormHarness.readPendingReceipt(), deletes: window.__pageFormHarness.autosaveCalls.filter(call => call.kind === "delete"), text: document.body.innerText }));
        assert("cleanup is an exact mocked boundary", data.deletes.length === (scenario === "cleanup-malformed" ? 0 : 1));
        assert("cleanup does not invent a canonical save receipt", (await state()).cas === previousCas);
        assert("unconfirmed or blocked storage cleanup retains metadata", typeof data.pending === "string");
        if (scenario === "cleanup-reject") assert("cleanup transport failure reports safe state", data.text.includes("Не удалось подтвердить удаление серверной автокопии."));
      } else if (mounted && (scenario.startsWith("autosave-") || recoveryOnly)) {
        assert("real component remains mounted", mounted);
        if (!recoveryOnly) await typeDraft();
        await page.clock.runFor(16000);
        await page.waitForTimeout(100);
        const after = await state();
        const saves = after.autosaveCalls.filter(call => call.kind === "save");
        assert("actual autosave interval executes mocked boundary", saves.length === 1 && saves[0].input.clientSequence === 1);
        if (scenario === "autosave-session-sequence") {
          assert("acknowledged autosave remains server-saved despite metadata write failure", await page.locator(".editor-autosave-status.is-saved").count() === 1 && await page.locator(".editor-autosave-status.is-local").count() === 0);
          await page.getByRole("textbox", { name: "Название страницы" }).fill("Synthetic later autosave title");
          await page.clock.runFor(16000);
          await page.waitForTimeout(100);
          const sequence = (await state()).autosaveCalls.filter(call => call.kind === "save");
          assert("volatile metadata preserves session identity and increasing sequence", sequence.length === 2 && sequence[0].input.clientSessionId === sequence[1].input.clientSessionId && sequence[1].input.clientSequence === 2);
        } else {
          assert("failed or unacknowledged local fallback never claims local success", await page.locator(".editor-autosave-status.is-error").count() === 1 && await page.locator(".editor-autosave-status.is-local").count() === 0);
          if (recoveryOnly) assert("void/false fallback actually executes", await page.evaluate(() => window.__pageFormHarness.localFallbackCalls) === 1);
          else assert("autosave failure retains exact draft", after.title === longTitle && JSON.parse(after.json).content[0].content[0].text === longText && after.dirty);
        }
      } else if (mounted) {
        assert("real component remains mounted", mounted);
        if (scenario !== "pending-unchanged-unload") {
          await typeDraft();
          assert("dirty marker follows actual typing", (await state()).dirty);
        }
        if (scenario === "media-busy") {
          assert("both Save and Publish are disabled while media is busy", await page.getByRole("button", { name: "Сохранить", exact: true }).isDisabled() && await page.getByRole("button", { name: "Опубликовать", exact: true }).isDisabled());
          await page.locator("form").evaluate(form => form.requestSubmit());
          await page.waitForTimeout(100);
          assert("busy workflow blocks programmatic native submit too", (await state()).calls.length === 0 && (await state()).dirty);
        } else {
          const intent = scenario === "publish-intent" ? "publish" : "save";
          await page.getByRole("button", { name: intent === "publish" ? "Опубликовать" : "Сохранить", exact: true }).click();
          await page.waitForFunction(() => window.__pageFormHarness.calls.length >= 1, { timeout: 4000 });
          await page.waitForTimeout(70);
          const pending = await state(), sent = pending.calls[0]?.data;
          assert("real function form action boundary is invoked once", pending.calls.length === 1);
          assert("submitted FormData retains intent, context and exact CAS", sent?.intent === intent && sent.catalog_q === "Synthetic context" && sent.catalog_page === "2" && sent.editor_revision_page === "3" && sent.expected_updated_at === previousCas);
          if (scenario === "pending-unchanged-unload") {
            assert("unchanged pending submit still protects unload", await page.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }));
          } else {
            assert("pending request retains dirty and exact typed draft", pending.dirty && pending.title === longTitle && JSON.parse(pending.json).content[0].content[0].text === longText);
          }
          if (scenario === "duplicate-submit") {
            await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
            await page.waitForTimeout(70);
            assert("pending duplicate native submits do not call action again", (await state()).calls.length === 1);
          }
          if (scenario === "saved-newer-edit") await page.getByRole("textbox", { name: "Название страницы" }).fill("Synthetic newer unsaved title");
          if (scenario === "saved-newer-controls") {
            await page.locator('select[name="status"]').selectOption("hidden");
            await page.locator('input[name="allow_indexing"]').uncheck();
          }
          let outcome = { outcome: "rejected", reason: "validation" };
          if (scenario === "transport-failure") outcome = "transport";
          if (scenario === "dependency-unavailable") outcome = { outcome: "dependency-unavailable" };
          if (scenario === "conflict") outcome = { outcome: "conflict" };
          if (scenario === "unknown-result") outcome = { outcome: "unknown-outcome" };
          if (scenario === "undefined-result") outcome = undefined;
          if (scenario === "malformed-wrong-id") outcome = saved(nextCas, "99999999-9999-4999-8999-999999999999");
          if (scenario === "malformed-same-cas") outcome = saved(previousCas);
          if (["saved", "saved-newer-edit", "saved-newer-controls", "saved-second-cas", "publish-intent"].includes(scenario)) outcome = saved();
          if (scenario === "saved") outcome.revalidationState = "scheduled";
          if (scenario.startsWith("native-")) outcome = scenario;
          await page.evaluate(outcome => window.__pageFormHarness.settle(outcome), outcome);
          await page.waitForTimeout(120);
          const after = await state();
          if (scenario === "duplicate-submit") assert("queued native duplicates never execute after first callback settles", after.calls.length === 1);
          if (scenario.startsWith("native-")) {
            const digest = await page.evaluate(() => window.__pageFormHarness.componentErrors[0]?.digest);
            assert("actual Next unstable_rethrow preserves native navigation signal", after.boundary && digest === (scenario === "native-redirect" ? "NEXT_REDIRECT;replace;/pages/synthetic;303;" : "NEXT_HTTP_ERROR_FALLBACK;404"));
          } else {
            assert("settled action retains mounted form", !after.boundary && typeof after.title === "string");
            if (scenario !== "pending-unchanged-unload") assert("settled action retains exact rich text", JSON.parse(after.json || "{}").content?.[0]?.content?.[0]?.text === longText);
            const success = ["saved", "saved-newer-edit", "saved-newer-controls", "saved-second-cas", "publish-intent"].includes(scenario);
            assert("CAS advances only on matching acknowledged receipt", after.cas === (success ? nextCas : previousCas));
            if (success) {
              assert("acknowledged snapshot clears dirty only when current edits match", after.dirty === (scenario === "saved-newer-edit" || scenario === "saved-newer-controls"));
              assert("acknowledged result preserves current typed title", after.title === (scenario === "saved-newer-edit" ? "Synthetic newer unsaved title" : longTitle));
              assert("saved-version receipt is shown truthfully", /Отправленная версия сохранена|Страница сохранена/u.test(after.text));
              if (scenario === "saved-newer-controls") assert("newer select and checkbox values survive native callback completion", await page.locator('select[name="status"]').inputValue() === "hidden" && !(await page.locator('input[name="allow_indexing"]').isChecked()));
              if (scenario === "publish-intent") {
                const selectedStatus = await page.locator('select[name="status"]').inputValue();
                await page.getByRole("button", { name: "Развернуть редактор", exact: true }).click();
                assert("acknowledged publish updates current status", selectedStatus === "published", {
                  selectedStatus, statusAfterHarmlessRerender: await page.locator('select[name="status"]').inputValue(),
                  liveIntent: await page.evaluate(() => window.__pageFormHarness.readLiveIntent()), text: after.text.slice(-1200),
                });
              }
              if (scenario === "saved-second-cas") {
                await page.getByRole("textbox", { name: "Название страницы" }).fill("Synthetic second saved title");
                await page.getByRole("button", { name: "Сохранить", exact: true }).click();
                await page.waitForFunction(() => window.__pageFormHarness.calls.length === 2, { timeout: 4000 });
                assert("next save submits exact returned CAS timestamp", (await state()).calls[1].data.expected_updated_at === nextCas);
                await page.evaluate(() => window.__pageFormHarness.settle({ outcome: "rejected", reason: "validation" }));
                await page.waitForTimeout(70);
                assert("second rejected save leaves newer draft dirty", (await state()).dirty && (await state()).title === "Synthetic second saved title");
              }
            } else {
              assert("unconfirmed save retains dirty draft", after.dirty);
              assert("unconfirmed result has no saved receipt claim", !/Отправленная версия сохранена|Страница сохранена|Страница опубликована/u.test(after.text));
              const blocked = ["transport-failure", "unknown-result", "undefined-result", "malformed-wrong-id", "malformed-same-cas", "conflict"].includes(scenario);
              assert("retry policy follows confirmed outcome", await page.getByRole("button", { name: "Сохранить", exact: true }).isDisabled() === blocked);
              if (blocked) {
                assert("uncertain/conflicting outcome offers independent saved-version comparison", await page.locator('a[target="_blank"]').count() >= 1);
                await page.locator("form").evaluate(form => form.requestSubmit());
                await page.waitForTimeout(70);
                assert("blocked programmatic submit cannot blindly retry", (await state()).calls.length === 1);
              }
            }
          }
        }
      } else assert("real component remains mounted", false);
    } catch (error) {
      assert("browser fixture completes its assertions", false, { name: error.name, message: error.message });
    }
    const observed = await page.evaluate(() => {
      const h = window.__pageFormHarness;
      return { reactVersion: h.reactVersion, calls: h.calls, autosaveCalls: h.autosaveCalls, storageFaults: h.storageFaults, componentErrors: h.componentErrors, localFallbackCalls: h.localFallbackCalls, routerRefreshCalls: h.routerRefreshCalls };
    }).catch(() => null);
    const requiredFault = scenario === "autosave-local-failed" ? "local-setitem" : scenario === "autosave-session-sequence" ? "session-setitem" : scenario === "cleanup-removeitem" ? "session-removeitem" : /^(local|session)-(getter|getitem|setitem)$/u.test(scenario) ? scenario : null;
    if (requiredFault) assert("requested storage fault really executes", observed?.storageFaults.includes(requiredFault));
    if (!scenario.startsWith("native-")) assert("ordinary failures never escape to browser/component errors", errors.length === 0 && observed?.componentErrors.length === 0);
    if (assertions.some(assertion => !assertion.pass)) await page.screenshot({ path: prefix + "-" + scenario + ".png", fullPage: false });
    const result = { scenario, status: assertions.every(assertion => assertion.pass) ? "PASS" : "FAIL", assertions, state: observed, errors, consoleErrors: consoleErrors.slice(0, 6) };
    results.push(result);
    console.log(JSON.stringify({ scenario, status: result.status, failures: assertions.filter(assertion => !assertion.pass).map(assertion => assertion.name), verifiedActionCalls: observed?.calls.length, verifiedAutosaveCalls: observed?.autosaveCalls.filter(call => call.kind === "save").length }));
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
const evidence = {
  checkedAt: new Date().toISOString(), label, sourceRoot: sourceArgument,
  level: "isolated real browser/component integration", authenticatedDatabaseE2E: false,
  executablePath, sourceFingerprint: Object.fromEntries(readSources),
  runnerSha256: createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).digest("hex"),
  loaderFixtureComposition: legacyLoaderApi ? "actual old conditional caller: current ? actualOldLoader(current) : fallback" : "actual new stable PageEditorLoader boundary",
  mockedDependencies: ["NextLink", "Next dynamic via React.lazy resolving actual imported PageEditor", "useRouter refresh receipt only", "savePageAction", "three editor autosave actions", "unused internal link action", "busy-only media workflow flag", "browser network disabled"],
  realDependencies: ["PageEditor", "PageEditorLoader", "RecoveryController", "TipTap editor/extensions/views", "Next compiled React/ReactDOM and unstable_rethrow", "installed headless Chrome", "actual timer callbacks with Playwright clock"],
  limitations: ["No actual Next server action serialization or router", "No auth/session/RLS/DB", "No storage upload/delete", "No external network", "Synthetic content only", "Snapshot overrides saved files only; other transitive imports use current checkout"],
  externalRequests: requests, results,
};
await writeFile(prefix + "-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
const passed = results.filter(result => result.status === "PASS").length;
console.log(JSON.stringify({ label, cases: results.length, passed, failed: results.length - passed, evidence: path.relative(root, prefix + "-evidence.json") }));
process.exitCode = passed === results.length && requests.length === 0 ? 0 : 1;
