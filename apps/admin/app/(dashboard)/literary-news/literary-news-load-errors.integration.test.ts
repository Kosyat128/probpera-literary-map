import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      if (target.endsWith(".json")) return nativeRequire(target);
      const sourceFile = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}
const privateError = "PRIVATE_PROVIDER_SECRET=news_fixture";
const revision = "a".repeat(64);
const stamp = "2026\u002d09\u002d30T12:00:00Z";
const destinationId = "\u002d10012345";
const job = { newsId: "a", destination: { platform: "telegram", id: destinationId }, status: "pending", originalAdmission: stamp, desiredRevision: revision, prepared: { payload: { text: "Original prepared literary news text" } } };
const row = { id: 1, snapshot_upper_id: "1", entity_id: `post:news:a:telegram:${destinationId}`, metadata: job };
type OverviewLoader = (client: { rpc?: (...args: unknown[]) => unknown; from: (...args: unknown[]) => unknown } | null) => Promise<{
  configured: boolean; complete: boolean; readError: boolean; invalidRows: number; hasRuntime: boolean;
  posts: { status: string; preparedText: string | null; expectedVersion: string | null }[];
}>;
async function render(options: { data?: unknown; error?: unknown; rejected?: boolean; noClient?: boolean; legacy?: boolean } = {}) {
  const data = Object.hasOwn(options, "data") ? options.data : [row];
  const rpc = vi.fn(async () => { if (options.rejected) throw new Error(privateError); return { data, error: options.error ?? null }; });
  const from = vi.fn(() => {
    if (!options.legacy) throw new Error("Unexpected fallback to audit history");
    let columns = "";
    const builder = { select: (value: string) => { columns = value; return builder; }, eq: () => builder, order: () => builder, limit: () => builder, lt: () => builder, in: () => builder,
      then: (yes: (value: unknown) => unknown, no: (error: unknown) => unknown) => Promise.resolve().then(() => {
        if (columns === "id,entity_id") return { data: [{ id: 1, entity_id: row.entity_id }], error: null };
        return { data, error: options.error ?? null };
      }).then(yes, no),
    };
    return builder;
  });
  const action = vi.fn();
  const cloudflare = vi.fn(() => { throw new Error("Unexpected Cloudflare binding read"); });
  const mocks = {
    "@/app/(dashboard)/literary-news/actions": { updateLiteraryNewsRuntimeAction: action },
    "@opennextjs/cloudflare": { getCloudflareContext: cloudflare },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children) },
  };
  const loader = loadAdminModule("lib/literary-news-runtime-overview.ts", mocks).loadLiteraryNewsRuntimeOverview as OverviewLoader;
  const client = options.noClient ? null : options.legacy ? { from } : { from, rpc };
  const snapshot = await loader(client);
  const component = loadAdminModule("components/LiteraryNewsDeliveryOverview.tsx", mocks).default as
    (props: { snapshot: unknown; query: {}; canManage: boolean }) => ReactNode;
  const markup = renderToStaticMarkup(createElement(component, { snapshot, query: {}, canManage: false }));
  expect(action).not.toHaveBeenCalled(); expect(cloudflare).not.toHaveBeenCalled();
  return { markup, $: load(markup), snapshot, rpc, from };
}
type View = Awaited<ReturnType<typeof render>>;
function expectUnknown(view: View) {
  expect(view.snapshot.complete).toBe(false);
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(view.$(".empty-state").length).toBe(0);
  expect(view.markup).not.toContain("Журнал отправок ещё не получен");
  expect(view.markup).not.toContain("Сохранённых заданий отправки пока нет");
  expect(view.markup).not.toContain("Сохранённые назначения каналов не найдены");
  expect(view.markup).toContain("неизвестно");
  expect(view.markup).not.toContain(privateError);
}
describe("M02 actual news runtime projection and read-only overview SSR", () => {
  it("keeps a confirmed complete empty runtime distinct from unreadable state", async () => {
    const view = await render({ data: [] });
    expect(view.snapshot).toMatchObject({ complete: true, hasRuntime: false, readError: false, invalidRows: 0 });
    expect(view.$(".empty-state").length).toBe(1); expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.from).not.toHaveBeenCalled();
  });
  it.each([null, [], "malformed"].map(metadata => ({ metadata })))("treats malformed first RPC metadata $metadata as unknown", async ({ metadata }) => {
    const view = await render({ data: [{ ...row, metadata }] }); expectUnknown(view);
    expect(view.snapshot).toMatchObject({ hasRuntime: false, readError: false, invalidRows: 1 });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.from).not.toHaveBeenCalled();
  });
  it("keeps a first payload that exceeds the eight MiB cap unknown", async () => {
    const view = await render({ data: [{ ...row, metadata: { padding: "x".repeat(8 * 1024 * 1024) } }] }); expectUnknown(view);
    expect(view.snapshot).toMatchObject({ hasRuntime: false, readError: false, invalidRows: 0 });
  });
  it.each([null, []].map(metadata => ({ metadata })))("treats malformed legacy hydration metadata $metadata as unknown", async ({ metadata }) => {
    const view = await render({ legacy: true, data: [{ ...row, metadata }] }); expectUnknown(view);
    expect(view.snapshot).toMatchObject({ hasRuntime: false, readError: false, invalidRows: 1 });
    expect(view.from).toHaveBeenCalledTimes(2); expect(view.rpc).not.toHaveBeenCalled();
  });
  it("keeps a missing selected legacy payload unknown without recovering older state", async () => {
    const view = await render({ legacy: true, data: [] }); expectUnknown(view);
    expect(view.snapshot.invalidRows).toBe(1); expect(view.from).toHaveBeenCalledTimes(2);
  });
  it.each([{ code: "quota", status: 402 }, { code: "42501", status: 403 }, { code: "unexpected", status: 500 }])("keeps RPC %j errors unknown and hides raw details", async error => {
    const view = await render({ data: [row], error: { ...error, message: privateError } }); expectUnknown(view);
    expect(view.snapshot.readError).toBe(true); expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.from).not.toHaveBeenCalled();
  });
  it("keeps a rejected RPC unknown with no extra history replay", async () => {
    const view = await render({ rejected: true }); expectUnknown(view); expect(view.snapshot.readError).toBe(true); expect(view.from).not.toHaveBeenCalled();
  });
  it.each([null, {}])("keeps malformed RPC body %j unknown", async data => {
    const view = await render({ data }); expectUnknown(view); expect(view.snapshot.readError).toBe(true);
  });
  it("preserves readable prepared text when another row makes the snapshot incomplete", async () => {
    const view = await render({ data: [{ ...row, snapshot_upper_id: "2" }, { id: 2, snapshot_upper_id: "2", entity_id: "post:news:b:telegram:" + destinationId, metadata: null }] });
    expect(view.snapshot.complete).toBe(false); expect(view.snapshot.posts).toHaveLength(1);
    expect(view.markup).toContain(job.prepared.payload.text); expect(view.$('[role="alert"]').length).toBe(1);
  });
  it("preserves receipt-backed sent_current and exact prepared text", async () => {
    const view = await render({ data: [{ ...row, metadata: { ...job, status: "sent_current", remoteId: "7", acknowledgedAt: stamp, acknowledgedRevision: revision } }] });
    expect(view.snapshot.complete).toBe(true); expect(view.snapshot.posts[0].status).toBe("sent_current");
    expect(view.markup).toContain("Подтверждена текущая версия"); expect(view.markup).toContain(job.prepared.payload.text); expect(view.$("form").length).toBe(0);
  });
  it("keeps sent_current without an actual acknowledgment unknown", async () => {
    const view = await render({ data: [{ ...row, metadata: { ...job, status: "sent_current" } }] });
    expect(view.snapshot.posts[0].status).toBe("unknown"); expect(view.markup).not.toContain("Подтверждена текущая версия");
    expect(view.markup).toContain("Неизвестное состояние");
  });
  it("does not substitute an empty confirmed runtime for a missing configured client", async () => {
    const view = await render({ noClient: true }); expect(view.snapshot).toMatchObject({ configured: false, complete: false, hasRuntime: false });
    expect(view.markup).toContain("Состояние отправок неизвестно"); expect(view.$(".empty-state").length).toBe(0);
    expect(view.rpc).not.toHaveBeenCalled(); expect(view.from).not.toHaveBeenCalled();
  });
});
