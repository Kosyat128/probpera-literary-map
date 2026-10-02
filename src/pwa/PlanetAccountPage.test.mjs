import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePlanetAccountPages } from "../../scripts/mobile/account-pages.mjs";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import PlanetAccountPage, { bridgePlanetAccount, planetAccountRoute, readPlanetAccountDeletionStatus, requestPlanetAccountDeletion, syncPlanetAccountMetadata } from "./PlanetAccountPage";
import { createPlanetAccountClient } from "./accountAccess";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const identity = { subject: SUBJECT, token: "existing-canonical-supabase-session" };
const config = { v: 1, audience: "unit-test", product: "unit-test-base", deletionDisclosure: {
  version: "controlled-fixture-only", ru: "Тестовое описание; не юридический документ.", en: "Controlled fixture; not a legal document.",
} };
afterEach(() => vi.unstubAllGlobals());

describe("canonical identity bridge orchestration", () => {
  it("rechecks canonical subject/token around the readonly deletion lookup", async () => {
    let current = identity;
    const client = { deletionStatus: vi.fn(async () => { current = null; return { requestId: REQUEST, status: "requested" }; }) };
    await expect(readPlanetAccountDeletionStatus(client, config, identity, () => current, new AbortController().signal)).rejects.toMatchObject({ reason: "authentication" });
    expect(client.deletionStatus).toHaveBeenCalledWith(config, identity.token, expect.any(AbortSignal));
    await expect(readPlanetAccountDeletionStatus(client, config, identity, () => null, new AbortController().signal)).rejects.toMatchObject({ reason: "authentication" });
    expect(client.deletionStatus).toHaveBeenCalledTimes(1);
  });
  function port(bridgeSubject = SUBJECT) {
    const calls = [];
    const fetcher = vi.fn(async (url, request) => {
      calls.push({ url, request, body: JSON.parse(request.body) });
      const body = url.endsWith("license/bridge") ? { subject: bridgeSubject }
        : { requestId: JSON.parse(request.body).requestId, status: "requested" };
      return new Response(JSON.stringify(body), { status: url.endsWith("license/bridge") ? 200 : 202, headers: { "Content-Type": "application/json" } });
    });
    return { calls, fetcher, client: createPlanetAccountClient({ origin: "https://probpera.ru", fetch: fetcher }) };
  }
  it("uses the existing token for bridge and deletion proof, preserving one request identity", async () => {
    const { client, calls } = port();
    const receipt = await requestPlanetAccountDeletion(client, config, identity, () => identity, REQUEST, true, new AbortController().signal);
    expect(receipt).toEqual({ requestId: REQUEST, status: "requested" });
    expect(calls.map(call => call.url)).toEqual(["https://probpera.ru/planet/api/license/bridge", "https://probpera.ru/planet/api/account/deletion-request"]);
    expect(calls[0].body).toEqual({ v: 1, audience: config.audience, product: config.product });
    expect(calls[1].body).toEqual({ v: 1, audience: config.audience, product: config.product, requestId: REQUEST, reauthToken: identity.token });
    expect(calls[0].request.headers.Authorization).toBe("Bearer " + identity.token);
    expect(calls[1].request.headers.Authorization).toBeUndefined();
    expect(calls.every(call => call.request.credentials === "include" && call.request.redirect === "error")).toBe(true);
  });
  it("rejects a bridge for another subject before requesting deletion", async () => {
    const { client, calls } = port(OTHER);
    await expect(requestPlanetAccountDeletion(client, config, identity, () => identity, REQUEST, true, new AbortController().signal)).rejects.toMatchObject({ reason: "denied" });
    expect(calls).toHaveLength(1);
  });
  it.each([null, { subject: OTHER, token: identity.token }, { subject: SUBJECT, token: "refreshed-token" }])("rejects missing or changed canonical identity before any request (%j)", current => {
    const { client, fetcher } = port();
    return expect(bridgePlanetAccount(client, config, identity, () => current, new AbortController().signal)).rejects.toMatchObject({ reason: "authentication" })
      .then(() => expect(fetcher).not.toHaveBeenCalled());
  });
  it.each([null, { subject: OTHER, token: "new-account-token" }, { subject: SUBJECT, token: "refreshed-token" }])("rejects identity changes while bridge is in flight (%j)", async changed => {
    let current = identity;
    const client = { bridge: vi.fn(async () => { current = changed; return SUBJECT; }), requestDeletion: vi.fn() };
    await expect(requestPlanetAccountDeletion(client, config, identity, () => current, REQUEST, true, new AbortController().signal)).rejects.toMatchObject({ reason: "authentication" });
    expect(client.requestDeletion).not.toHaveBeenCalled();
  });
  it("does not present another account's receipt after an identity change during deletion", async () => {
    let current = identity;
    const client = { bridge: async () => SUBJECT, requestDeletion: async () => { current = null; return { requestId: REQUEST, status: "requested" }; } };
    await expect(requestPlanetAccountDeletion(client, config, identity, () => current, REQUEST, true, new AbortController().signal)).rejects.toMatchObject({ reason: "authentication" });
  });
  it.each([{ consent: false, disclosure: config.deletionDisclosure }, { consent: true, disclosure: null }])("requires both consent and actual configured disclosure (%j)", async value => {
    const { client, fetcher } = port();
    await expect(requestPlanetAccountDeletion(client, { ...config, deletionDisclosure: value.disclosure }, identity, () => identity, REQUEST, value.consent, new AbortController().signal)).rejects.toMatchObject({ reason: "denied" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("honors cancellation before bridge and after an uncooperative bridge port", async () => {
    const controller = new AbortController(); const { client, fetcher } = port(); controller.abort();
    await expect(bridgePlanetAccount(client, config, identity, () => identity, controller.signal)).rejects.toMatchObject({ reason: "authentication" });
    expect(fetcher).not.toHaveBeenCalled();
    const next = new AbortController(); const deletion = vi.fn();
    await expect(requestPlanetAccountDeletion({ bridge: async () => { next.abort(); return SUBJECT; }, requestDeletion: deletion }, config, identity, () => identity, REQUEST, true, next.signal)).rejects.toMatchObject({ reason: "authentication" });
    expect(deletion).not.toHaveBeenCalled();
  });
});

const generated = generatePlanetAccountPages({ builtHtml: '<!doctype html><html><head><script type="module" src="/assets/main.js"></script><link rel="manifest" href="/site.webmanifest"><meta property="og:image" content="/og-v3.webp"></head><body><div id="root"></div></body></html>' });
function fixture(pathname, file) {
  const $ = load(generated.files[file]);
  function wrap(node) { return { node, get parentNode() { return node.parent ? wrap(node.parent) : null; },
    get textContent() { return $(node).text(); }, set textContent(value) { $(node).text(value); },
    getAttribute: name => $(node).attr(name) ?? null, setAttribute: (name, value) => { $(node).attr(name, value); },
    querySelector: selector => { const child = $(node).find(selector)[0]; return child ? wrap(child) : null; },
    querySelectorAll: selector => $(node).find(selector).get().map(wrap), appendChild: child => { $(node).append(child.node); }, remove: () => { $(node).remove(); } }; }
  const document = { head: wrap($("head")[0]), body: wrap($("body")[0]), documentElement: wrap($("html")[0]), createElement: tag => wrap($(`<${tag}>`)[0]),
    get title() { return $("title").text(); }, set title(value) { $("title").text(value); } };
  const location = new URL("https://probpera.ru" + pathname);
  const state = Object.freeze({ navigation: "account", unrelated: { retained: true } });
  const history = { state, replaceState: vi.fn((next, _, url) => { history.state = next; location.href = new URL(url, location).href; }), pushState: vi.fn() };
  const target = { document, location, history, dispatchEvent: vi.fn() }; vi.stubGlobal("window", target);
  return { $, target, state };
}
describe("account route ownership and bilingual metadata", () => {
  it.each(generated.routes)("resolves only the canonical $pathname entry and documented aliases", route => {
    for (const pathname of [route.pathname, route.pathname.slice(0, -1), route.pathname + "index.html"]) expect(planetAccountRoute(pathname)).toBe(route.mode);
  });
  it.each(["/", "/ru/", "/en/", "/planet/en/", "/en/planet-account/fake/", "/en/delete-account/../", "/stati/", "/fr/planet-account/"])("retains existing route ownership at %s", pathname => {
    expect(planetAccountRoute(pathname)).toBeNull();
    const current = fixture(pathname, "ru/planet-account/index.html"); const before = current.$.html();
    syncPlanetAccountMetadata("en", "access"); expect(current.$.html()).toBe(before); expect(current.target.history.replaceState).not.toHaveBeenCalled();
  });
  it.each(generated.routes)("matches generated $pathname metadata, preserving query/hash/state and body", route => {
    const other = route.locale === "ru" ? "en" : "ru"; const name = route.mode === "access" ? "planet-account" : "delete-account";
    const current = fixture(`/${other}/${name}/?returnTo=%2Fplanet%2Fru%2F%3Fcountry%3Drussia%23atlas&recovery=1#state`, `${other}/${name}/index.html`);
    const beforeBody = current.$("body").html();
    syncPlanetAccountMetadata(route.locale, route.mode);
    const expected = load(generated.files[route.file]);
    function metadata($) { return $("head meta").get().map(node => [$(node).attr("name") ?? $(node).attr("property"), $(node).attr("content")]).sort(); }
    expect(metadata(current.$)).toEqual(metadata(expected));
    expect(current.$("body").html()).toBe(beforeBody);
    expect(current.$("html").attr("lang")).toBe(route.locale);
    expect(current.$("body").attr("lang")).toBe(route.locale);
    expect(current.$("title").text()).toBe(expected("title").text());
    expect(JSON.parse(current.$("script[data-planet-account-structured-data]").text())).toEqual(JSON.parse(expected("script[data-planet-account-structured-data]").text()));
    for (const selector of ['link[rel="canonical"]', 'link[hreflang="ru"]', 'link[hreflang="en"]', 'link[hreflang="x-default"]', 'link[rel="manifest"]']) expect(current.$(selector).attr("href")).toBe(expected(selector).attr("href"));
    expect(current.target.location.pathname).toBe(route.pathname);
    expect(current.target.location.search).toBe("?returnTo=%2Fplanet%2Fru%2F%3Fcountry%3Drussia%23atlas&recovery=1");
    expect(current.target.location.hash).toBe("#state"); expect(current.target.history.state).toBe(current.state);
    expect(current.target.dispatchEvent).not.toHaveBeenCalled(); expect(current.target.history.pushState).not.toHaveBeenCalled();
    const stable = current.$.html(); syncPlanetAccountMetadata(route.locale, route.mode); expect(current.$.html()).toBe(stable);
    expect(current.target.history.replaceState).toHaveBeenCalledTimes(1);
  });
  it("renders safely without browser/auth configuration, one global language control and no account actions", () => {
    const $ = load(renderToStaticMarkup(createElement(InterfaceLanguageProvider, null, createElement(PlanetAccountPage, { mode: "deletion" }))));
    expect($(".interface-language-control")).toHaveLength(1);
    expect($("canvas,iframe,form,input[type=password]")).toHaveLength(0);
    expect($('input[type="checkbox"]').attr("disabled")).toBeDefined();
    expect($('a[href="mailto:probperasite@yandex.ru"]')).toHaveLength(1);
    expect($("main").attr("data-copy-review")).toBe("draft");
    expect(() => syncPlanetAccountMetadata("en", "access")).not.toThrow();
  });
  it("isolates account rendering from App and excludes analytics/private CMS while retaining canonical sign-in protection", () => {
    const source = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(source).toContain("const accountMode = isControlledWebEdition ? null : planetAccountRoute(window.location.pathname)");
    expect(source).toContain("const publicContent = !isControlledWebEdition && !accountMode");
    expect(source).toContain("{accountMode ? <AccountEntry mode={accountMode} /> : pwaRuntime ?");
    expect(source).toContain("const PlanetAccountPage = React.lazy(() => import('./pwa/PlanetAccountPage'))");
    expect(source).not.toMatch(/import\s+PlanetAccountPage\s+from/u);
    expect(readFileSync(new URL("./accountRoutes.ts", import.meta.url), "utf8")).not.toMatch(/\bimport\b/u);
    for (const component of ["CmsDirectEditBridge", "ClientDiagnostics"]) expect(source).toContain(`{publicContent && <${component} />}`);
    for (const component of ["ConsentAwareActivityTracker", "AnalyticsConsent"]) expect(source).toContain(`{publicContent && !cmsEditMode && <${component} />}`);
    expect(source).toContain("{!isControlledWebEdition && !cmsEditMode && <AuthTurnstileGate />}");
    for (const component of ["SiteTypographyRuntime", "SiteDesignRuntime"]) expect(source).toContain(`{!accountMode && <${component} />}`);
  });
});


it("an equal-value A to B to A status read cannot borrow a new generation's receipt", async () => {
  const original = { ...identity, scope: {} }; let current = original;
  const client = { deletionStatus: vi.fn(async () => {
    current = { subject: OTHER, token: "other", scope: {} }; current = { ...identity, scope: {} };
    return { requestId: REQUEST, status: "requested" };
  }) };
  await expect(readPlanetAccountDeletionStatus(client, config, original, () => current, new AbortController().signal)).rejects.toMatchObject({ reason: "authentication" });
  expect(client.deletionStatus).toHaveBeenCalledTimes(1);
});
it("the dedicated status identity reads only an existing server receipt, without a license bridge or mutation", async () => {
  const statusOnly = Object.freeze({ ...identity, scope: Object.freeze({}) });
  const client = { deletionStatus: vi.fn(async () => ({ requestId: REQUEST, status: "requested" })), bridge: vi.fn(), requestDeletion: vi.fn() };
  expect(await readPlanetAccountDeletionStatus(client, config, statusOnly, () => statusOnly, new AbortController().signal)).toEqual({ requestId: REQUEST, status: "requested" });
  expect(client.bridge).not.toHaveBeenCalled(); expect(client.requestDeletion).not.toHaveBeenCalled();
});
