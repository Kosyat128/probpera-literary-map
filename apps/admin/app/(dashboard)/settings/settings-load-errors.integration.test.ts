import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffRole, StaffSession } from "../../../lib/auth";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Real SettingsPage, result parser, MFA loader/policy and confirmation button.
// Provider, auth, Next dynamic/Link and server actions are isolated boundaries.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/")
        ? path.join(adminRoot, name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const sourceFile = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const ownId = "111111ab\u002dcdef\u002d4111\u002d8abc\u002d111111abcdef";
const memberId = "22222222\u002d2222\u002d4222\u002d8222\u002d222222222222";
const privateError = "PRIVATE_PROVIDER_SECRET=never\u002drender\u002dthis\u002dfixture";
const createdAt = "2026\u002d09\u002d23T12:30:00.000Z";
const members = [
  { user_id: ownId, role: "owner", created_at: createdAt, created_by: ownId, updated_at: createdAt },
  { user_id: memberId, role: "editor", created_at: createdAt, created_by: ownId, updated_at: createdAt },
];
const session: StaffSession = {
  configured: true,
  user: { id: ownId, email: "owner@example.test" },
  role: "owner",
  mfa: { currentLevel: "aal2", nextLevel: "aal2", required: true },
};

type QueryParams = { error?: string; saved?: string; deleted?: string };
async function renderSettings(options: {
  response?: unknown;
  rejection?: unknown;
  role?: StaffRole | null;
  query?: QueryParams;
  mfa?: StaffSession["mfa"];
} = {}) {
  const response = Object.hasOwn(options, "response") ? options.response : { data: members, error: null };
  const { rejection, role = "owner", query = {}, mfa = session.mfa } = options;
  const save = vi.fn();
  const remove = vi.fn();
  const auth = vi.fn(async () => ({ ...session, role, mfa }));
  const select = vi.fn();
  const order = vi.fn((column: string) => {
    expect(column).toBe("created_at");
    return Promise.resolve().then(() => {
      if (rejection !== undefined) throw rejection;
      return response;
    });
  });
  select.mockImplementation((selection: string) => {
    expect(selection).toBe("*");
    return { order };
  });
  const from = vi.fn((table: string) => {
    expect(table).toBe("staff_memberships");
    return { select };
  });
  const rpc = vi.fn();
  const mfaProps = vi.fn();
  const mocks = {
    "@/lib/supabase/server": {
      createServerSupabaseClient: async () => ({ from, rpc }),
    },
    "@/lib/auth": { getStaffSession: auth },
    "./actions": { saveStaffMemberAction: save, removeStaffMemberAction: remove },
    "next/dynamic": {
      __esModule: true,
      default: () => (props: Record<string, unknown>) => {
        mfaProps(props);
        return createElement("section", { "data-mfa-loader": "true" }, "MFA boundary");
      },
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }: { children?: ReactNode }) =>
        createElement("a", { ...props, "data-next-link": "true" }, children),
    },
  };
  const SettingsPage = loadAdminModule("app/(dashboard)/settings/page.tsx", mocks).default as
    (props: { searchParams: Promise<QueryParams> }) => Promise<ReactNode>;
  const markup = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve(query) }));
  expect(auth).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledTimes(1);
  expect(order).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
  expect(mfaProps).toHaveBeenCalledWith({
    initialCurrentLevel: mfa.currentLevel,
    initialNextLevel: mfa.nextLevel,
    initialCheckError: mfa.checkError,
  });
  return { markup, $: load(markup) };
}

type RenderedSettings = Awaited<ReturnType<typeof renderSettings>>;
function expectIndependentPanels(settings: RenderedSettings) {
  const { $ } = settings;
  expect($(".status-list > div").length).toBe(6);
  expect(settings.markup).toContain("owner@example.test");
  expect($(".badge").first().text()).toBe("owner");
  expect($('[data-mfa-loader="true"]').length).toBe(1);
}
function expectUnavailable(settings: RenderedSettings) {
  expectIndependentPanels(settings);
  expect(settings.markup).not.toContain(privateError);
  expect(settings.$("form").length).toBe(0);
  expect(settings.$("table").length).toBe(0);
  expect(settings.markup).toContain("Состав команды недоступен");
  expect(settings.markup).not.toContain("После назначения первого владельца команда появится здесь.");
  const retry = settings.$("a").filter((_index, item) => /Повторить/i.test(settings.$(item).text()));
  expect(retry.length).toBeGreaterThan(0);
  expect(retry.attr("data-next-link")).toBeUndefined();
}

afterEach(() => vi.unstubAllEnvs());

describe("M02 settings/team actual SSR reads", () => {
  it("isolates a read error instead of declaring the team empty", async () => {
    expectUnavailable(await renderSettings({ response: {
      data: null, error: { code: "57014", message: privateError },
    } }));
  });

  it("does not use success-looking rows together with a read error", async () => {
    expectUnavailable(await renderSettings({ response: {
      data: members, error: { code: "57014", message: privateError },
    } }));
  });

  it("isolates a rejected request from independent readiness, session and MFA", async () => {
    expectUnavailable(await renderSettings({ rejection: new TypeError(privateError) }));
  });

  it.each([
    ["null response", null], ["undefined response", undefined],
    ["missing data", { error: null }], ["null data", { data: null, error: null }],
    ["non-array data", { data: {}, error: null }], ["null row", { data: [null], error: null }],
    ["non-object row", { data: ["owner"], error: null }],
    ["missing ID", { data: [{ role: "owner", created_at: createdAt }], error: null }],
    ["object ID", { data: [{ ...members[0], user_id: {} }], error: null }],
    ["non-UUID ID", { data: [{ ...members[0], user_id: "not\u002dan\u002daccount" }], error: null }],
    ["unknown role", { data: [{ ...members[0], role: "superadmin" }], error: null }],
    ["object role", { data: [{ ...members[0], role: {} }], error: null }],
    ["missing date", { data: [{ user_id: ownId, role: "owner" }], error: null }],
    ["object date", { data: [{ ...members[0], created_at: {} }], error: null }],
    ["invalid date", { data: [{ ...members[0], created_at: "not\u002da\u002ddate" }], error: null }],
  ])("keeps %s unavailable without exposing access changes", async (_label, response) => {
    expectUnavailable(await renderSettings({ response }));
  });

  it.each([
    ["42P01", "не соответствует запросу"],
    ["57014", "временно недоступна"],
    ["42501", "проверить доступ"],
  ])("classifies %s safely without proposing a migration for all failures", async (code, message) => {
    const settings = await renderSettings({ response: { data: null, error: { code, message: privateError } } });
    expectUnavailable(settings);
    expect(settings.markup).toContain(message);
    if (code !== "42P01") expect(settings.markup).not.toContain("не соответствует запросу");
  });

  it("preserves confirmed empty team and the existing owner add form", async () => {
    const settings = await renderSettings({ response: { data: [], error: null } });
    expectIndependentPanels(settings);
    expect(settings.markup).toContain("После назначения первого владельца команда появится здесь.");
    expect(settings.$("tbody > tr").length).toBe(0);
    expect(settings.$('form input[name="email"]').length).toBe(1);
    expect(settings.markup).not.toContain("Состав команды недоступен");
  });

  it("retains exact IDs, roles and owner protections on a verified team", async () => {
    const settings = await renderSettings();
    expectIndependentPanels(settings);
    const rows = settings.$("tbody > tr");
    expect(rows.length).toBe(2);
    for (const [index, member] of members.entries()) {
      expect(rows.eq(index).children("td").eq(0).text()).toBe(member.user_id);
      expect(rows.eq(index).children("td").eq(1).text()).toBe(member.role);
    }
    expect(settings.$('input[name="user_id"]').map((_index, node) => settings.$(node).attr("value")).get()).toEqual([memberId]);
    expect(settings.$('form input[name="email"]').length).toBe(1);
    expect(settings.markup).not.toContain("Состав команды недоступен");
  });

  it("does not offer self-removal when the same owner UUID has different letter case", async () => {
    const displayedId = ownId.toUpperCase();
    const data = [{ ...members[0], user_id: displayedId }, members[1]];
    const snapshot = structuredClone(data);
    const settings = await renderSettings({ response: { data, error: null } });
    expect(settings.$("tbody > tr").first().children("td").first().text()).toBe(displayedId);
    expect(settings.$('input[name="user_id"]').map((_index, node) => settings.$(node).attr("value")).get()).toEqual([memberId]);
    expect(data).toEqual(snapshot);
  });

  it.each(["admin", "editor", null] as const)("keeps %s outside owner access forms", async (role) => {
    const settings = await renderSettings({ role });
    expect(settings.$("form").length).toBe(0);
    expect(settings.$("tbody > tr").length).toBe(2);
  });

  it("preserves MFA check-error state and all loader props during a team outage", async () => {
    const settings = await renderSettings({
      response: { data: null, error: { code: "57014" } },
      mfa: { currentLevel: "aal1", nextLevel: "aal2", required: true, checkError: "Безопасное сообщение" },
    });
    expectUnavailable(settings);
    expect(settings.$(".status-list > div").last().children("strong").text()).toBe("Проверка недоступна");
  });

  it.each([
    ["/", "/settings"], ["/admin", "/admin/settings"], ["/staff/panel", "/staff/panel/settings"],
  ])("retries via fresh GET under base path %s", async (basePath, href) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    const settings = await renderSettings({ response: { data: null, error: { code: "57014" } } });
    expectUnavailable(settings);
    const retry = settings.$("a").filter((_index, item) => /Повторить/i.test(settings.$(item).text()));
    expect(retry.attr("href")).toBe(href);
  });

  it("does not render arbitrary action-query text as a provider message", async () => {
    const settings = await renderSettings({ query: { error: privateError } });
    expect(settings.markup).not.toContain(privateError);
    expect(settings.markup).toContain("Не удалось изменить состав команды");
  });

  it.each([
    "Нельзя удалить или понизить последнего владельца",
    "Участник команды не найден",
    "Требуются права владельца",
    "Для удаления собственного доступа используйте другую учётную запись владельца",
    "Пользователь должен сначала зарегистрироваться на сайте",
    "Не удалось изменить состав команды",
    "Проверьте email и роль",
    "База данных не подключена",
    "Некорректный пользователь",
  ])("retains known safe action error: %s", async (error) => {
    const settings = await renderSettings({ query: { error } });
    expect(settings.$(".form-message").text()).toContain(error);
  });

  it.each([{ saved: "1" }, { deleted: "1" }, { saved: "1", deleted: "1" }])(
    "does not treat action query flags as a commit receipt", async (query) => {
      const settings = await renderSettings({ query });
      expect(settings.markup).not.toContain("Доступ редакции обновлён.");
      expect(settings.markup).not.toContain("Доступ редакции отозван.");
      expect(settings.$(".form-success").length).toBe(0);
      expect(settings.markup).toContain("Проверьте актуальный состав команды");
    },
  );
});
