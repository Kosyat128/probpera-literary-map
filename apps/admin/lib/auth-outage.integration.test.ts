import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
class Redirected extends Error {
  constructor(public location: string) { super("isolated redirect"); }
}
type Exports = Record<string, any>;
const loadModule = (relative: string, mocks: Record<string, unknown>): Exports => {
  const filename = path.join(root, relative);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as Exports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith(".")) {
      const target = path.resolve(path.dirname(filename), name);
      const sourceFile = [target, target + ".ts", target + ".tsx"].find(candidate => existsSync(candidate));
      if (sourceFile) return loadModule(path.relative(root, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
};
function fixture(overrides: Record<string, any> = {}) {
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: "verified-staff", email: "staff@example.org" } }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: "verified-staff" } }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null })) },
    ...overrides,
  };
  const membership = { select: vi.fn(function(this: unknown) { return this; }),
    eq: vi.fn(function(this: unknown) { return this; }),
    maybeSingle: vi.fn(async () => ({ data: { role: "owner" }, error: null })) };
  const supabase = { auth, from: vi.fn(() => membership) };
  const server = { createServerSupabaseClient: vi.fn(async () => supabase) };
  const env = { isSupabaseConfigured: true, adminEnv: {
    adminSiteUrl: "https://admin.probpera.ru", supabaseUrl: "https://fixture.supabase.co",
    supabasePublishableKey: "isolated-fixture", publicSiteUrl: "https://probpera.ru",
  } };
  const base = {
    "@/lib/supabase/server": server, "@/lib/env": env,
    "@/lib/navigation": { withAdminBasePath: (value: string) => value,
      redirect: (value: string) => { throw new Redirected(value); } },
    react: { cache: (fn: unknown) => fn },
  };
  const service = loadModule("lib/auth-service-error.ts", base);
  const mocks = { ...base, "@/lib/auth-service-error": service,
    "@/lib/admin-mfa-policy": loadModule("lib/admin-mfa-policy.ts", base) };
  return { auth, supabase, mocks, membership };
}
const loginForm = () => { const form = new FormData(); form.set("email", "staff@example.org"); form.set("password", "strong-password"); return form; };
const passwordForm = () => { const form = new FormData(); form.set("password", "strong-new-password"); form.set("confirmation", "strong-new-password"); return form; };
async function redirectOf(action: () => Promise<unknown>) {
  try { await action(); }
  catch (error) { if (error instanceof Redirected) return new URL(error.location, "https://admin.probpera.ru"); throw error; }
  throw Error("Expected a safe redirect");
}
const outage = { status: 402, code: "exceed_cached_egress_quota", message: "private provider diagnostics" };

describe("auth outage behavior through actual server actions and staff gates", () => {
  it("an unavailable MFA check cannot authorize a staff mutation", async () => {
    const f = fixture(); f.auth.mfa.getAuthenticatorAssuranceLevel.mockRejectedValue(new TypeError("private network reply"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(await loadModule("lib/auth.ts", f.mocks).requireStaff()).toBeNull(); }
    finally { log.mockRestore(); }
  });

  it("a 402 MFA response cannot authorize a staff mutation", async () => {
    const f = fixture(); f.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: outage } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(await loadModule("lib/auth.ts", f.mocks).requireStaff()).toBeNull(); }
    finally { log.mockRestore(); }
  });


  it("a missing SDK MFA session with null AAL levels cannot reuse an earlier verified staff role", async () => {
    const f = fixture();
    f.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] }, error: null,
    } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(await loadModule("lib/auth.ts", f.mocks).requireStaff()).toBeNull(); }
    finally { log.mockRestore(); }
  });
  it("verified AAL2 still authorizes the allowed staff role, while enrolled AAL1 requires MFA", async () => {
    const f = fixture(), module = loadModule("lib/auth.ts", f.mocks);
    expect((await module.requireStaff(["owner"]))?.user.id).toBe("verified-staff");
    f.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect(await module.requireStaff()).toBeNull();
  });

  it("a restricted login never redirects to the dashboard", async () => {
    const f = fixture(); f.auth.signInWithPassword.mockResolvedValue({ data: null, error: outage } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const location = await redirectOf(() => loadModule("app/(auth)/login/actions.ts", f.mocks).loginAction(loginForm()));
      expect(location.pathname).toBe("/login"); expect(location.searchParams.get("error")).toContain("временно ограничен");
      expect(location.searchParams.has("success")).toBe(false);
    } finally { log.mockRestore(); }
  });

  it("a recovery-email 402 never claims the email was sent", async () => {
    const f = fixture(); f.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: outage } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const location = await redirectOf(() => loadModule("app/(auth)/login/actions.ts", f.mocks).resetPasswordAction(loginForm()));
      expect(location.searchParams.get("error")).toContain("временно ограничен");
      expect(location.searchParams.has("success")).toBe(false); expect(f.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  it("a falsy thrown recovery error cannot become a success response", async () => {
    const f = fixture(); f.auth.resetPasswordForEmail.mockRejectedValue(undefined);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const location = await redirectOf(() => loadModule("app/(auth)/login/actions.ts", f.mocks).resetPasswordAction(loginForm()));
      expect(location.searchParams.has("error")).toBe(true); expect(location.searchParams.has("success")).toBe(false);
    } finally { log.mockRestore(); }
  });

  it("a recovery-session 402 stops before updating the password and is not called expiry", async () => {
    const f = fixture(); f.auth.getUser.mockResolvedValue({ data: { user: null }, error: outage } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const location = await redirectOf(() => loadModule("app/(auth)/reset-password/actions.ts", f.mocks).updatePasswordAction(passwordForm()));
      expect(location.searchParams.get("error")).toContain("временно ограничен");
      expect(location.searchParams.get("error")).not.toContain("истекла");
      expect(f.auth.updateUser).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("the recovery page shows the service restriction instead of an expired-link message", async () => {
    const f = fixture(); f.auth.getUser.mockResolvedValue({ data: { user: null }, error: outage } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const location = await redirectOf(() => loadModule("app/(auth)/reset-password/page.tsx", f.mocks).default({ searchParams: Promise.resolve({}) }));
      expect(location.searchParams.get("error")).toContain("временно ограничен");
      expect(location.searchParams.get("error")).not.toContain("свежую ссылку");
    } finally { log.mockRestore(); }
  });

  it("a genuinely missing recovery session still requests a fresh link", async () => {
    const f = fixture(); f.auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } } as any);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const location = await redirectOf(() => loadModule("app/(auth)/reset-password/page.tsx", f.mocks).default({ searchParams: Promise.resolve({}) }));
      expect(location.pathname).toBe("/login"); expect(location.searchParams.get("error")).toContain("свежую ссылку");
      expect(f.auth.updateUser).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("middleware network failure leaves the login page available without weakening staff gates", async () => {
    const f = fixture(); f.auth.getUser.mockRejectedValue(new TypeError("private network reply"));
    const response = { headers: new Headers(), cookies: { set: vi.fn() } };
    const mocks = { ...f.mocks,
      "@supabase/ssr": { createServerClient: () => f.supabase },
      "next/server": { NextResponse: { next: () => response } },
      "@/lib/admin-path": { getAdminBasePathFromEnv: () => "" },
      "@/lib/content-security-policy": { createAdminCspNonce: () => "test-nonce", buildAdminContentSecurityPolicy: () => "default-src 'none'" },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const request = { headers: new Headers(), nextUrl: { pathname: "/login" }, cookies: { getAll: () => [], set: vi.fn() } };
      expect(await loadModule("middleware.ts", mocks).middleware(request)).toBe(response);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await loadModule("lib/auth.ts", f.mocks).requireStaff()).toBeNull();
    } finally { log.mockRestore(); }
  });
});
