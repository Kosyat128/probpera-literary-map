import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../planet/localization";
import { PlatformServicesProvider } from "../platform/PlatformServices";
import { createWebPlatformAdapter } from "../platform/adapters/web/WebPlatformAdapter";
import type { WebLicenseClient, WebLicenseDenial, WebLicenseResult } from "../platform/adapters/web/WebLicense";
import PwaAccessBoundary, { createPwaAccessController, pwaAccessDeadline, pwaAccessMessage } from "./PwaAccessBoundary";
import { pwaCopy } from "./pwaCopy";

const NOW = 1_800_000_000;
const online = { connectivity: "online", visibility: "active" } as const;
const offline = { connectivity: "offline", visibility: "active" } as const;
const controllers: ReturnType<typeof createPwaAccessController>[] = [];
function authorized(exp = NOW + 600, offlineUntil = NOW + 120): Extract<WebLicenseResult, { status: "authorized" }> {
  return Object.freeze({ status: "authorized", validUntil: exp, claims: Object.freeze({
    v: 1, iss: "test-authority", aud: "test-web", product: "test-product", sub: "test-independent-identity",
    model: "one-time", status: "active", jti: "test-verified-result", iat: NOW - 60, nbf: NOW - 60, exp, offlineUntil,
  }) });
}
function denied(reason: WebLicenseDenial): WebLicenseResult { return { status: "denied", reason }; }
function service() {
  return { check: vi.fn<WebLicenseClient["check"]>(), getSnapshot: vi.fn<WebLicenseClient["getSnapshot"]>(() => denied("not-checked")) };
}
function controller(client: WebLicenseClient | null) {
  const value = createPwaAccessController(client);
  controllers.push(value);
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW * 1000); });
afterEach(() => { for (const value of controllers.splice(0)) value.stop(); vi.useRealTimers(); });

describe("identity-bound PWA access lifecycle", () => {
  it("separately verifies saved proof after rate limiting and keeps only its signed offline deadline", async () => {
    const client = service(); client.check.mockResolvedValueOnce(authorized()).mockResolvedValueOnce(denied("rate-limited"))
      .mockResolvedValueOnce({ ...authorized(), validUntil: NOW + 120 });
    const access = controller(client); await access.start(online); await access.refresh();
    expect(client.check.mock.calls.map(([request]) => request.mode)).toEqual(["online", "online", "offline"]);
    expect(access.getSnapshot()).toMatchObject({ grant: { validUntil: NOW + 120 }, verificationSource: "saved", reason: null });
    client.check.mockImplementation(() => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(120_000); expect(access.getSnapshot().grant).toBeNull();
  });
  it("shows accurate RU/EN wait copy without inventing proof when a rate-limited fallback has no cache", async () => {
    const client = service(); client.check.mockResolvedValueOnce(denied("rate-limited")).mockResolvedValueOnce(denied("no-cached-grant"));
    const access = controller(client); await access.start(online);
    expect(access.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, reason: "rate-limited", checking: false });
    for (const locale of ["ru", "en"] as const) expect(pwaAccessMessage(pwaCopy.locales[locale], "rate-limited")).toBe(pwaCopy.locales[locale].rateLimited);
  });
  it("keeps definitive offline denial dominant after a rate-limited server response", async () => {
    const client = service(); client.check.mockResolvedValueOnce(authorized()).mockResolvedValueOnce(denied("rate-limited")).mockResolvedValueOnce(denied("context-mismatch"));
    const access = controller(client); await access.start(online); await access.refresh();
    expect(access.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, reason: "context-mismatch" });
  });
  it("uses the same verified deadline for repair and never grants it before start or after stop", async () => {
    const client = service(); client.check.mockResolvedValue(authorized()); const access = controller(client);
    expect(access.getDeadline()).toBeNull(); await access.start(online);
    expect(access.getDeadline()).toBe((NOW + 600) * 1000);
    await access.updateEnvironment(offline); expect(access.getDeadline()).toBe((NOW + 120) * 1000);
    const listener = vi.fn(); access.subscribe(listener); access.stop();
    expect(access.getDeadline()).toBeNull(); expect(listener).toHaveBeenCalledOnce();
  });
  it.each(["revoked", "clock", "expired"])("denies the live repair capability when %s even without a render", async reason => {
    const client = service(); client.check.mockResolvedValue(authorized()); const access = controller(client); await access.start(online);
    if (reason === "revoked") { client.check.mockResolvedValue(denied("revoked")); await access.refresh(); }
    if (reason === "clock") vi.setSystemTime((NOW - 1) * 1000);
    if (reason === "expired") vi.setSystemTime((NOW + 601) * 1000);
    expect(access.getDeadline()).toBeNull();
  });
  it("denies without a client and has no constructor/render network side effects", async () => {
    const client = service();
    client.getSnapshot.mockReturnValue(authorized());
    const access = controller(client);
    expect(access.getSnapshot().grant).toBeNull();
    expect(client.check).not.toHaveBeenCalled();
    expect(client.getSnapshot).not.toHaveBeenCalled();
    const missing = controller(null);
    await missing.start(online);
    expect(missing.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, checking: false, reason: "unconfigured" });
  });
  it("opens only after the supplied client returns an authorized result", async () => {
    const pending = deferred<WebLicenseResult>();
    const client = service();
    client.check.mockReturnValue(pending.promise);
    const access = controller(client);
    const start = access.start(online);
    expect(access.getSnapshot()).toMatchObject({ grant: null, checking: true });
    pending.resolve(authorized());
    await start;
    expect(access.getSnapshot()).toMatchObject({ checking: false, verificationSource: "server", grant: { status: "authorized" } });
    expect(client.check).toHaveBeenCalledWith({ mode: "online", signal: expect.any(AbortSignal) });
  });
  it("retains the existing proof throughout a valid refresh without a closed intermediate state", async () => {
    const first = authorized();
    const pending = deferred<WebLicenseResult>();
    const client = service();
    client.check.mockResolvedValueOnce(first).mockReturnValueOnce(pending.promise);
    const access = controller(client);
    await access.start(online);
    const snapshots: unknown[] = [];
    const unsubscribe = access.subscribe(() => snapshots.push(access.getSnapshot().grant));
    const refresh = access.refresh();
    expect(access.getSnapshot().grant).toBe(first);
    expect(access.getSnapshot().verificationSource).toBe("server");
    expect(access.getSnapshot().checking).toBe(true);
    pending.resolve(authorized(NOW + 900));
    await refresh;
    expect(snapshots).not.toContain(null);
    expect(access.getSnapshot().grant?.validUntil).toBe(NOW + 900);
    unsubscribe();
  });
  it("closes at the signed offline boundary even while an offline refresh is pending", async () => {
    const client = service();
    client.check.mockResolvedValueOnce(authorized()).mockImplementation(() => new Promise(() => undefined));
    const access = controller(client);
    await access.start(online);
    void access.updateEnvironment(offline);
    expect(access.getSnapshot().grant).not.toBeNull();
    expect(pwaAccessDeadline(access.getSnapshot().grant, "offline", Date.now())).toBe(NOW + 120);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(access.getSnapshot().grant).toBeNull();
    expect(access.getSnapshot().verificationSource).toBeNull();
  });
  it("cannot retain an expired offline window during the connectivity render transition", async () => {
    const grant = authorized(NOW + 600, NOW - 1);
    const client = service();
    client.check.mockResolvedValueOnce(grant).mockImplementation(() => new Promise(() => undefined));
    const access = controller(client);
    await access.start(online);
    expect(access.getSnapshot().grant).toBe(grant);
    expect(pwaAccessDeadline(access.getSnapshot().grant, "offline", Date.now())).toBeNull();
    void access.updateEnvironment(offline);
    expect(access.getSnapshot().grant).toBeNull();
  });
  it("uses a separately verified offline check after a network failure, without dropping valid children", async () => {
    const client = service();
    client.check.mockResolvedValueOnce(authorized()).mockResolvedValueOnce(denied("network-unavailable"))
      .mockResolvedValueOnce({ ...authorized(), validUntil: NOW + 120 });
    const access = controller(client);
    await access.start(online);
    const grants: unknown[] = [];
    access.subscribe(() => grants.push(access.getSnapshot().grant));
    await access.refresh();
    expect(client.check.mock.calls.map(([request]) => request.mode)).toEqual(["online", "online", "offline"]);
    expect(grants).not.toContain(null);
    expect(access.getSnapshot().grant?.validUntil).toBe(NOW + 120);
    expect(access.getSnapshot().verificationSource).toBe("saved");
  });
  it("keeps only a signed in-memory offline window when durable cache is unavailable", async () => {
    const client = service();
    client.check.mockResolvedValueOnce(authorized()).mockResolvedValueOnce(denied("timeout")).mockResolvedValueOnce(denied("cache-unavailable"))
      .mockImplementation(() => new Promise(() => undefined));
    const access = controller(client);
    await access.start(online);
    await access.refresh();
    expect(access.getSnapshot().grant?.validUntil).toBe(NOW + 120);
    expect(access.getSnapshot().verificationSource).toBe("saved");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(access.getSnapshot().grant).toBeNull();
    expect(access.getSnapshot().verificationSource).toBeNull();
  });
  it.each(["revoked", "refunded", "session-denied", "invalid-signature", "unknown-key", "context-mismatch", "expired", "malformed"] as const)("immediately closes for %s instead of using prior proof", async (reason) => {
    const client = service();
    client.check.mockResolvedValueOnce(authorized()).mockResolvedValueOnce(denied(reason));
    const access = controller(client);
    await access.start(online);
    await access.refresh();
    expect(access.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, checking: false, reason });
    expect(client.check).toHaveBeenCalledTimes(2);
  });
  it("rechecks on visibility regain without requests for an unchanged environment", async () => {
    const client = service();
    client.check.mockResolvedValue(authorized());
    const access = controller(client);
    await access.start(online);
    await access.updateEnvironment(online);
    await access.updateEnvironment({ ...online, visibility: "background" });
    expect(client.check).toHaveBeenCalledTimes(1);
    await access.updateEnvironment(online);
    expect(client.check).toHaveBeenCalledTimes(2);
  });
  it("invalidates an expired grant in the background and checks again after returning", async () => {
    const client = service();
    client.check.mockResolvedValueOnce(authorized(NOW + 30, NOW + 20)).mockImplementation(() => new Promise(() => undefined));
    const access = controller(client);
    await access.start(online);
    await access.updateEnvironment({ ...online, visibility: "background" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(access.getSnapshot()).toMatchObject({ grant: null, checking: false, reason: "expired" });
    expect(client.check).toHaveBeenCalledTimes(1);
    void access.updateEnvironment(online);
    expect(client.check).toHaveBeenCalledTimes(2);
  });
  it("rejects a clock rollback even if the signed expiration has not passed", async () => {
    const client = service();
    client.check.mockResolvedValue(authorized());
    const access = controller(client);
    await access.start(online);
    vi.setSystemTime((NOW - 1) * 1000);
    await access.refresh();
    expect(access.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, reason: "clock-skew" });
  });
  it("a superseded response cannot reopen after a newer denial", async () => {
    const old = deferred<WebLicenseResult>();
    const client = service();
    client.check.mockReturnValueOnce(old.promise).mockResolvedValueOnce(denied("revoked"));
    const access = controller(client);
    const start = access.start(online);
    await access.refresh();
    old.resolve(authorized());
    await start;
    expect(access.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, reason: "revoked" });
    expect(client.check.mock.calls[0][0].signal?.aborted).toBe(true);
  });
  it("stop cancels pending work and timers, and a new identity starts closed", async () => {
    const old = deferred<WebLicenseResult>();
    const client = service();
    client.check.mockReturnValue(old.promise);
    const access = controller(client);
    const start = access.start(online);
    const listener = vi.fn();
    access.subscribe(listener);
    access.stop();
    old.resolve(authorized());
    await start;
    expect(listener).not.toHaveBeenCalled();
    expect(access.getSnapshot().grant).toBeNull();
    expect(controller(client).getSnapshot().grant).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("access verification provenance independent of the connectivity hint", () => {
  it("distinguishes server and saved checks even when both signed deadlines are equal", async () => {
    const grant = authorized(NOW + 120, NOW + 120);
    const client = service();
    client.check.mockResolvedValue(grant);
    const access = controller(client);
    await access.start(online);
    expect(access.getSnapshot()).toMatchObject({ grant, verificationSource: "server" });
    await access.updateEnvironment(offline);
    expect(access.getSnapshot()).toMatchObject({ grant, verificationSource: "saved" });
    expect(access.getSnapshot().grant).toBe(grant);
  });
  it.each(["network-unavailable", "timeout"] as const)("records saved proof after cold %s fallback while the hint stays online", async (reason) => {
    const grant = { ...authorized(), validUntil: NOW + 120 };
    const client = service();
    client.check.mockResolvedValueOnce(denied(reason)).mockResolvedValueOnce(grant);
    const access = controller(client);
    await access.start(online);
    expect(client.check.mock.calls.map(([request]) => request.mode)).toEqual(["online", "offline"]);
    expect(access.getSnapshot()).toMatchObject({ grant, checking: false, reason: null, verificationSource: "saved" });
    await access.updateEnvironment(online);
    expect(client.check).toHaveBeenCalledTimes(2);
    expect(access.getSnapshot().verificationSource).toBe("saved");
  });
  it("preserves saved provenance during a pending refresh and changes it only after server success", async () => {
    const pending = deferred<WebLicenseResult>();
    const client = service();
    client.check.mockResolvedValueOnce({ ...authorized(), validUntil: NOW + 120 }).mockReturnValueOnce(pending.promise);
    const access = controller(client);
    await access.start(offline);
    const original = access.getSnapshot().grant;
    const refresh = access.updateEnvironment(online);
    expect(access.getSnapshot()).toMatchObject({ grant: original, checking: true, verificationSource: "saved" });
    expect(access.getSnapshot().grant).toBe(original);
    pending.resolve(authorized());
    await refresh;
    expect(access.getSnapshot()).toMatchObject({ checking: false, verificationSource: "server" });
  });
  it("marks only a retained valid proof as saved after an unexpected service rejection", async () => {
    const client = service();
    client.check.mockResolvedValueOnce(authorized()).mockRejectedValueOnce(new Error("fixture transport failure"));
    const access = controller(client);
    await access.start(online);
    await access.refresh();
    expect(access.getSnapshot()).toMatchObject({ grant: { validUntil: NOW + 120 }, verificationSource: "saved", reason: "network-unavailable" });
    const empty = service();
    empty.check.mockRejectedValue(new Error("fixture transport failure"));
    const closed = controller(empty);
    await closed.start(online);
    expect(closed.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, reason: "network-unavailable" });
  });
  it("does not publish saved provenance when the fallback has no verified grant", async () => {
    const client = service();
    client.check.mockResolvedValueOnce(denied("timeout")).mockResolvedValueOnce(denied("no-cached-grant"));
    const access = controller(client);
    await access.start(online);
    expect(access.getSnapshot()).toMatchObject({ grant: null, verificationSource: null, reason: "no-cached-grant" });
  });
  it("a late saved response cannot replace a newer server proof or its provenance", async () => {
    const old = deferred<WebLicenseResult>();
    const client = service();
    client.check.mockReturnValueOnce(old.promise).mockResolvedValueOnce(authorized());
    const access = controller(client);
    const start = access.start(offline);
    await access.updateEnvironment(online);
    const fresh = access.getSnapshot().grant;
    old.resolve({ ...authorized(), validUntil: NOW + 120 });
    await start;
    expect(access.getSnapshot().grant).toBe(fresh);
    expect(access.getSnapshot().verificationSource).toBe("server");
  });
});

describe("accessible preparation copy and SSR", () => {
  it("marks every new RU/EN unit as draft without inventing review or production readiness", () => {
    expect(pwaCopy).toMatchObject({ source: "ai-draft", reviewStatus: "draft", releaseReady: false, productionReady: false });
    expect(Object.keys(pwaCopy.locales.ru).sort()).toEqual(Object.keys(pwaCopy.locales.en).sort());
    expect(Object.values(pwaCopy.locales.en).every((value) => !/[\u0400-\u052f]/u.test(value))).toBe(true);
    expect(pwaCopy.locales.ru.savedVerification).toBe("Используется сохранённое подтверждение доступа.");
    expect(pwaCopy.locales.en.savedVerification).toBe("Using saved access verification.");
    for (const copy of Object.values(pwaCopy.locales)) {
      for (const reason of ["unconfigured", "expired", "refunded", "clock-skew", "no-cached-grant", "network-unavailable", "invalid-signature"] as const) {
        expect(pwaAccessMessage(copy, reason)).toBeTruthy();
      }
    }
  });
  it("never renders protected children or fetches on the server, and exposes status and canonical journal escape", () => {
    const client = service();
    client.getSnapshot.mockReturnValue(authorized());
    const markup = renderToStaticMarkup(
      <PlatformServicesProvider services={createWebPlatformAdapter({ window: null })}>
        <InterfaceLanguageProvider>
          <PwaAccessBoundary client={client}><div>SECRET_PROTECTED_CHILD</div></PwaAccessBoundary>
        </InterfaceLanguageProvider>
      </PlatformServicesProvider>
    );
    expect(markup).not.toContain("SECRET_PROTECTED_CHILD");
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-labelledby=');
    expect(markup).toContain('href="https://probpera.ru/"');
    expect(markup.match(/class="interface-language-control"/gu)).toHaveLength(1);
    expect(markup).toContain('aria-pressed="true"');
    expect(client.check).not.toHaveBeenCalled();
    expect(client.getSnapshot).not.toHaveBeenCalled();
  });
  it("shows bootstrap progress and its storage failure with a retry while identity has no client", () => {
    const render = (checking: boolean) => renderToStaticMarkup(
      <PlatformServicesProvider services={createWebPlatformAdapter({ window: null })}>
        <InterfaceLanguageProvider>
          <PwaAccessBoundary client={null} bootstrapStatus={{ checking, reason: "cache-unavailable" }} onBootstrapRetry={() => undefined}>
            <div>PROTECTED_CHILD</div>
          </PwaAccessBoundary>
        </InterfaceLanguageProvider>
      </PlatformServicesProvider>
    );
    const busy = render(true);
    expect(busy).toContain(pwaCopy.locales.ru.checking);
    expect(busy).toContain('disabled=""');
    const failure = render(false);
    expect(failure).toContain(pwaCopy.locales.ru.storage);
    expect(failure).toContain(pwaCopy.locales.ru.retry);
    expect(failure).not.toContain("PROTECTED_CHILD");
  });
});
