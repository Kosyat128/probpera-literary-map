import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const nativeNavigation = nativeRequire("next/navigation");
const nativeRedirect = nativeRequire("next/dist/client/components/redirect");
const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = path.resolve(adminRoot, "../..");
const actionModule = "app/(dashboard)/seo/actions.ts";
const sourceGraph = new Map<string, { module: string; source: string; sha256: string }>();
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

// Only the opt-in action source changes between the before/current runs.
// Publication, native navigation, catalog context and URL validation execute
// their actual modules; Auth, SDK, cache and external providers are boundaries.
function loadAdminModule(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): Record<string, any> {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const source = relative === actionModule && process.env.M13_SEO_ACTIONS_BASELINE
    ? path.resolve(process.env.M13_SEO_ACTIONS_BASELINE) : filename;
  const bytes = readFileSync(source);
  sourceGraph.set(filename, {
    module: path.relative(repoRoot, filename).replaceAll("\\", "/"),
    source: path.relative(repoRoot, source).replaceAll("\\", "/"),
    sha256: hash(bytes),
  });
  const compiled = ts.transpileModule(bytes.toString(), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  cache.set(filename, module.exports);
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const local = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (local) return loadAdminModule(path.relative(adminRoot, local).replaceAll("\\", "/"), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

type Kind = "create" | "update" | "delete";
const kinds = ["create", "update", "delete"] as const;
const redirectId = "a1b2c3d4-1111-4111-8111-a1b2c3d4e5f6";
const foreignId = "f1e2d3c4-2222-4222-8222-f1e2d3c4b5a6";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const expectedStamp = "2026-09-30T10:00:00.123456+00:00";
const privateError = "PRIVATE_SEO_PROVIDER_TOKEN=synthetic_do_not_expose";
const formValues = {
  id: redirectId, expected_updated_at: expectedStamp,
  source_path: " /old-material/ ", destination_path: " /new-material/ ", status_code: "308", is_active: "on",
  catalog_q: "Ручной каталог", catalog_status: "active", catalog_code: "308", catalog_page: "7",
};
function form() {
  const data = new FormData();
  for (const [name, value] of Object.entries(formValues)) data.set(name, value);
  return data;
}
const preparedFields = {
  p_source_path: "/old-material", p_destination_path: "/new-material", p_status_code: 308, p_is_active: true,
};
const reasons: Record<Kind, string> = { create: "redirect.created", update: "redirect.updated", delete: "redirect.deleted" };
const runs: { kind: Kind; outboxMissing: boolean; rpcCalls: unknown[]; auditCalls: unknown[]; providerCalls: unknown[] }[] = [];
let nativeValueBridge: { file: string; sha256: string; scalar: string; provenance: unknown } | null = null;

function setup(kind: Kind, options: { result?: unknown; error?: unknown; outboxMissing?: boolean; actorId?: string } = {}) {
  const result = Object.hasOwn(options, "result") ? options.result : redirectId;
  const rpc = vi.fn(async (name: string, _input: unknown) => {
    if (name === `${kind}_seo_redirect_guarded`) return { data: result, error: options.error ?? null };
    if (name === "enqueue_public_build_request") return options.outboxMissing
      ? { data: null, error: { code: "PGRST202",
        message: "Could not find the function public.enqueue_public_build_request(p_entity_id, p_entity_type, p_metadata, p_reason) in the schema cache",
        details: "Searched for the function public.enqueue_public_build_request with parameters p_entity_id, p_entity_type, p_metadata, p_reason or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
        hint: null } }
      : { data: "73", error: null };
    throw new Error(`Unexpected synthetic RPC ${name}`);
  });
  const audit = vi.fn(async (_row: unknown) => ({ error: null }));
  const probeLimit = vi.fn(async (_count: number) => ({ data: null, error: {
    code: "PGRST205", message: "Could not find the table 'public.public_build_outbox' in the schema cache",
  } }));
  const probeSelect = vi.fn((_columns: string) => ({ limit: probeLimit }));
  const from = vi.fn((table: string) => {
    if (table === "public_build_outbox") return { select: probeSelect };
    if (table !== "admin_audit_log") throw new Error(`Unexpected synthetic table ${table}`);
    return { insert: audit };
  });
  const client = { rpc, from };
  const requireStaff = vi.fn(async () => ({ user: { id: options.actorId ?? actorId }, role: "admin" }));
  const createClient = vi.fn(async () => client);
  const triggerPublicBuild = vi.fn(async (_reason: string) => ({ configured: false, ok: false, provider: "none" }));
  const translate = vi.fn(async () => { throw new Error("A real translation must not run in the redirect fixture"); });
  const revalidatePath = vi.fn();
  const redirect = vi.fn((destination: string) => nativeNavigation.redirect(destination));
  const mocks = {
    "next/cache": { revalidatePath },
    "next/navigation": { ...nativeNavigation, redirect },
    "@/lib/auth": { requireStaff },
    "@/lib/supabase/server": { createServerSupabaseClient: createClient },
    "@/lib/public-build": { triggerPublicBuild },
    "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: translate },
  };
  const loaded = loadAdminModule(actionModule, mocks);
  const action = loaded[`${kind}RedirectAction`] as (data: FormData) => Promise<unknown>;
  const enqueueCalls = () => rpc.mock.calls.filter(call => call[0] === "enqueue_public_build_request");
  async function run(data: FormData) {
    const original = [...data.entries()];
    try {
      await action(data);
      throw new Error("Expected the existing native Next redirect");
    } catch (error) {
      expect((error as { digest?: string }).digest).toMatch(/^NEXT_REDIRECT;/u);
      expect(redirect).toHaveBeenCalledTimes(1);
      expect([...data.entries()]).toEqual(original);
      const destination = nativeRedirect.getURLFromRedirectError(error);
      expect(typeof destination).toBe("string");
      const url = new URL(destination, "https://fixture.invalid");
      expect(url.pathname).toBe("/seo");
      expect(Object.fromEntries(["q", "status", "code", "page"].map(name => [name, url.searchParams.get(name)])))
        .toEqual({ q: formValues.catalog_q, status: "active", code: "308", page: "7" });
      expect(url.href).not.toContain(privateError);
      expect(translate).not.toHaveBeenCalled();
      return url;
    } finally {
      runs.push({ kind, outboxMissing: Boolean(options.outboxMissing), rpcCalls: [...rpc.mock.calls],
        auditCalls: [...audit.mock.calls], providerCalls: [...triggerPublicBuild.mock.calls] });
    }
  }
  return { run, rpc, enqueueCalls, audit, from, probeSelect, probeLimit, triggerPublicBuild, revalidatePath, requireStaff };
}
function expectNoRelease(view: ReturnType<typeof setup>, url: URL) {
  expect(view.rpc.mock.calls.map(call => call[0])).toHaveLength(1);
  expect(view.enqueueCalls()).toHaveLength(0);
  expect(view.from).not.toHaveBeenCalled(); expect(view.audit).not.toHaveBeenCalled();
  expect(view.triggerPublicBuild).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled();
  expect(url.searchParams.has("saved")).toBe(false);
  expect(url.searchParams.has("deleted")).toBe(false);
  expect(url.searchParams.has("published")).toBe(false);
}

describe("M13 actual SEO guarded actions consume their scalar UUID contract", () => {
  it.each(kinds)("%s binds the exact scalar UUID through actual publication and one native redirect", async kind => {
    // Uppercase UUIDs denote the same update/delete identity. Both actual
    // outbox and confirmed missing-outbox audit paths preserve that identity.
    for (const outboxMissing of [false, true]) {
      const returnedId = kind === "create" ? redirectId : redirectId.toUpperCase();
      const view = setup(kind, { result: returnedId, outboxMissing });
      const url = await view.run(form());
      const expectedInput = kind === "create" ? preparedFields : kind === "update"
        ? { p_id: redirectId, p_expected_updated_at: expectedStamp, ...preparedFields }
        : { p_id: redirectId, p_expected_updated_at: expectedStamp };
      expect(view.rpc.mock.calls[0]).toEqual([`${kind}_seo_redirect_guarded`, expectedInput]);
      expect(view.enqueueCalls()).toHaveLength(1);
      const metadata = {
        ...(kind === "delete" ? {} : { sourcePath: "/old-material", destinationPath: "/new-material", statusCode: 308, isActive: true }),
        auto_translation: "skipped", auto_translation_model: null, auto_translation_error: null,
      };
      expect(view.enqueueCalls()[0][1]).toEqual({ p_entity_type: "redirect", p_entity_id: redirectId,
        p_reason: reasons[kind], p_metadata: metadata });
      if (outboxMissing) {
        expect(view.from.mock.calls).toEqual([["public_build_outbox"], ["admin_audit_log"]]);
        expect(view.probeSelect).toHaveBeenCalledExactlyOnceWith("id");
        expect(view.probeLimit).toHaveBeenCalledExactlyOnceWith(0);
        expect(view.audit).toHaveBeenCalledTimes(1);
        expect(view.probeLimit.mock.invocationCallOrder[0]).toBeLessThan(view.audit.mock.invocationCallOrder[0]);
        expect(view.audit.mock.calls[0][0]).toEqual({ actor_id: actorId, action: "public_build.requested",
          entity_type: "redirect", entity_id: redirectId, metadata: { ...metadata, reason: reasons[kind], requested_at: expect.any(String) } });
      } else {
        expect(view.from).not.toHaveBeenCalled(); expect(view.audit).not.toHaveBeenCalled();
      }
      expect(view.triggerPublicBuild).toHaveBeenCalledExactlyOnceWith(reasons[kind]);
      expect(view.revalidatePath).toHaveBeenCalledExactlyOnceWith("/seo");
      expect(view.requireStaff).toHaveBeenCalledWith(...(kind === "delete" ? [["owner", "admin"]] : []));
      expect(url.searchParams.get("published")).toBe("queued");
      expect(url.searchParams.get(kind === "delete" ? "deleted" : "saved")).toBe(kind === "delete" ? "1" : kind === "create" ? "created" : "updated");
      expect(url.searchParams.has("error")).toBe(false);
    }
  });

  const malformed = [
    { name: "null", value: null }, { name: "empty string", value: "" }, { name: "non-UUID string", value: "not-a-uuid" },
    { name: "row object", value: { id: redirectId } }, { name: "array", value: [redirectId] },
    { name: "unknown object", value: { unexpected: privateError } },
  ];
  it.each(kinds.flatMap(kind => malformed.map(shape => ({ kind, ...shape }))))(
    "$kind refuses $name without fabricating a known DB refusal or releasing an unbound result", async ({ kind, value }) => {
      const view = setup(kind, { result: value });
      const url = await view.run(form());
      expectNoRelease(view, url);
      expect(url.searchParams.get("error")).toMatch(/не подтвержд|не удалось подтвердить/iu);
    },
  );

  it.each(["update", "delete"] as const)("%s rejects a different valid returned UUID before publication", async kind => {
    const view = setup(kind, { result: foreignId });
    const url = await view.run(form());
    expectNoRelease(view, url);
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_id: redirectId, p_expected_updated_at: expectedStamp });
    expect(url.searchParams.get("error")).toMatch(/не подтвержд|не удалось подтвердить/iu);
  });

  const guardedErrors = {
    create: { code: "23505", message: "REDIRECT_SOURCE_EXISTS", expected: /уже существует/iu },
    update: { code: "40001", message: "REDIRECT_WRITE_CONFLICT", expected: /уже изменена или удалена/iu },
    delete: { code: "42501", message: "ADMIN_HIGH_RISK_ROLE_REQUIRED", expected: /права администратора или владельца/iu },
  };
  it.each(kinds)("%s keeps guarded errors distinct and hides provider diagnostics", async kind => {
    for (const known of [true, false]) {
      const expectedError = guardedErrors[kind];
      const view = setup(kind, { result: null, error: { code: expectedError.code,
        message: known ? expectedError.message : privateError, details: privateError, hint: privateError } });
      const url = await view.run(form());
      expectNoRelease(view, url);
      expect(url.searchParams.get("error")).toMatch(known ? expectedError.expected : /Не удалось сохранить переадресацию/iu);
    }
  });

  // No ignored artifact is needed by the ordinary 26 tests. This opt-in case
  // replays one actual native SQL value across a synthetic SDK boundary; it
  // does not execute a live GoTrue/PostgREST/publication transaction.
  if (process.env.M13_SEO_DB_RESULT_FILE) {
    it("binds the cached actual PostgreSQL scalar and original arguments through actual action/publication", async () => {
      const filename = path.resolve(process.env.M13_SEO_DB_RESULT_FILE!);
      const bytes = readFileSync(filename);
      const native = JSON.parse(bytes.toString());
      expect(native.status).toBe("PASS_LOCAL_NATIVE_SEO_SCALAR_UUID");
      expect(native.pgResultType).toBe("uuid");
      expect(native.regprocedureResult).toBe("uuid");
      expect(native.scalar).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu);
      expect([native.canonicalCount, native.auditCount, native.outboxCount]).toEqual([1, 1, 1]);
      expect([native.auditEntityId, native.outboxEntityId]).toEqual([native.scalar, native.scalar]);
      expect(native.request).toEqual({ rpc: "create_seo_redirect_guarded", actorId: native.actorId, args: {
        p_source_path: native.sourcePath, p_destination_path: native.destinationPath,
        p_status_code: native.statusCode, p_is_active: native.isActive,
      } });
      expect(native.realAuthDatabaseRls).toBe("NOT_VERIFIED");
      expect(native.production).toBe("NOT_VERIFIED");
      const provenance = native.provenance;
      const refs: { file: string; sha256: string }[] = [provenance.nativeReport, provenance.nativeStdout,
        provenance.effectiveSql, provenance.buildManifest, provenance.builder, provenance.nativeRunner, ...provenance.sources];
      for (const ref of refs) {
        const source = path.resolve(repoRoot, ref.file);
        expect(source.startsWith(`${repoRoot}${path.sep}`)).toBe(true);
        expect(hash(readFileSync(source))).toBe(ref.sha256);
      }
      const report = JSON.parse(readFileSync(path.resolve(repoRoot, provenance.nativeReport.file), "utf8"));
      expect(report.status).toBe("PASS");
      expect(report.commands.find((row: { label: string }) => row.label === "fixture-contract")?.status).toBe(0);
      expect(report.sqlSha256).toBe(provenance.effectiveSql.sha256);
      expect(report.markers).toEqual(provenance.markers);
      expect(Object.values(report.markers)).toEqual([true, true, true, true, true]);
      expect(report.cleanup).toEqual({ serverStopped: true, aliasRemoved: true, workspaceFilesPreserved: true });
      const stdout = readFileSync(path.resolve(repoRoot, provenance.nativeStdout.file), "utf8");
      const nativeRows = stdout.split(/\r?\n/u).filter(line => line.startsWith("M13_SEO_DB_RESULT_JSON:"));
      expect(nativeRows).toHaveLength(1);
      const actual = JSON.parse(nativeRows[0].slice("M13_SEO_DB_RESULT_JSON:".length));
      for (const [name, value] of Object.entries(actual)) expect(native[name]).toEqual(value);
      nativeValueBridge = { file: path.relative(repoRoot, filename).replaceAll("\\", "/"),
        sha256: hash(bytes), scalar: native.scalar, provenance };

      for (const outboxMissing of [false, true]) {
        const data = form();
        data.delete("id"); data.delete("expected_updated_at");
        data.set("source_path", native.sourcePath); data.set("destination_path", native.destinationPath);
        data.set("status_code", String(native.statusCode));
        if (native.isActive) data.set("is_active", "on"); else data.delete("is_active");
        const view = setup("create", { result: native.scalar, actorId: native.actorId, outboxMissing });
        const url = await view.run(data);
        expect(view.rpc.mock.calls[0]).toEqual([native.request.rpc, native.request.args]);
        const metadata = { sourcePath: native.sourcePath, destinationPath: native.destinationPath,
          statusCode: native.statusCode, isActive: native.isActive,
          auto_translation: "skipped", auto_translation_model: null, auto_translation_error: null };
        expect(view.enqueueCalls()).toHaveLength(1);
        expect(view.enqueueCalls()[0][1]).toEqual({ p_entity_type: "redirect", p_entity_id: native.scalar,
          p_reason: "redirect.created", p_metadata: metadata });
        if (outboxMissing) {
          expect(view.audit).toHaveBeenCalledExactlyOnceWith({ actor_id: native.actorId, action: "public_build.requested",
            entity_type: "redirect", entity_id: native.scalar,
            metadata: { ...metadata, reason: "redirect.created", requested_at: expect.any(String) } });
        } else {
          expect(view.audit).not.toHaveBeenCalled(); expect(view.from).not.toHaveBeenCalled();
        }
        expect(view.triggerPublicBuild).toHaveBeenCalledExactlyOnceWith("redirect.created");
        expect(view.revalidatePath).toHaveBeenCalledExactlyOnceWith("/seo");
        expect(url.searchParams.get("saved")).toBe("created");
        expect(url.searchParams.get("published")).toBe("queued");
        expect(url.searchParams.has("error")).toBe(false);
      }
    });
  }
});

afterAll(() => {
  const output = process.env.M13_SEO_ACTIONS_EVIDENCE;
  if (!output) return;
  const target = path.resolve(output);
  const ignoredPrefix = `${path.join(repoRoot, ".tmp", "m13-").toLowerCase()}`;
  if (!target.toLowerCase().startsWith(ignoredPrefix) || !target.endsWith(".json")) throw new Error("Evidence output must be an ignored .tmp/m13- JSON artifact");
  writeFileSync(target, `${JSON.stringify({
    status: "TRACE_LOCAL_SEO_ACTIONS_NOT_ACCEPTANCE", checkedAt: new Date().toISOString(),
    fixture: { file: path.relative(repoRoot, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
    baseline: process.env.M13_SEO_ACTIONS_BASELINE ?? null,
    sourceGraph: [...sourceGraph.values()].sort((a, b) => a.module.localeCompare(b.module)),
    dependencies: { typescript: ts.version, next: nativeRequire("next/package.json").version, node: process.version },
    runs, nativeValueBridge,
    limitations: ["Auth and SDK/RPC data are synthetic; no actual SQL/GoTrue/RLS transaction is executed",
      "Actual requestPublicBuild runs with a provider stub configured=false,ok=false; no external dispatch or paid translation",
      "A malformed post-commit result is unconfirmed; these tests cannot establish DB rollback",
      "Only the captured action is overridden in baseline mode; every other actual module is read from current source",
      "An opt-in nativeValueBridge replays one completed native SQL scalar into the synthetic SDK; it is not a live PostgREST chain"],
  }, null, 2)}\n`);
});
