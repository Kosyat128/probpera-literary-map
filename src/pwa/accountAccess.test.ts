import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanetAccountClient, safePwaReturnPath, type PlanetAccountConfiguration } from "./accountAccess";

const origin = "https://probpera.ru";
const subject = "bcae5297-58da-473d-9c03-5206279a4a47";
const requestId = "1c7d6f6a-6e1f-472a-87e7-7d17137eae45";
const config: PlanetAccountConfiguration = { v: 1, audience: "planet-web", product: "base-v1",
  deletionDisclosure: { version: "test-only", ru: "Тестовый текст.", en: "Test text." } };
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
afterEach(() => { vi.useRealTimers(); });

describe("same-origin account bridge client", () => {
  it("reads its deletion status with an explicit canonical Bearer and no caller subject or cookie bridge", async () => {
    const fetch = vi.fn(async () => json({ request: { requestId, status: "processing" } }));
    expect(await createPlanetAccountClient({ origin, fetch }).deletionStatus(config, "qa.current.token")).toEqual({ requestId, status: "processing" });
    expect(fetch).toHaveBeenCalledWith(origin + "/planet/api/account/deletion-status", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer qa.current.token" }), body: JSON.stringify({ v: 1, audience: config.audience, product: config.product }),
    }));
  });
  it("accepts all exact status values and a verified null while separating HTTP failure", async () => {
    for (const status of ["requested", "processing", "blocked", "completed"]) {
      expect(await createPlanetAccountClient({ origin, fetch: async () => json({ request: { requestId, status } }) }).deletionStatus(config, "qa.token")).toEqual({ requestId, status });
    }
    expect(await createPlanetAccountClient({ origin, fetch: async () => json({ request: null }) }).deletionStatus(config, "qa.token")).toBeNull();
    for (const status of [401, 403, 503]) await expect(createPlanetAccountClient({ origin, fetch: async () => json({ request: null }, status) }).deletionStatus(config, "qa.token")).rejects.toThrow();
    await expect(createPlanetAccountClient({ origin, fetch: async () => json({ request: null }, 202) }).deletionStatus(config, "qa.token")).rejects.toMatchObject({ reason: "invalid-response" });
  });
  it.each([{}, { request: undefined }, { request: false }, { request: [] }, { request: { requestId, status: "unknown" } },
    { request: { requestId: "invalid", status: "completed" } }, { request: { requestId, status: "requested", subject } }, { request: null, paid: true }])("rejects ambiguous status body %j", async value => {
    await expect(createPlanetAccountClient({ origin, fetch: async () => json(value) }).deletionStatus(config, "qa.token")).rejects.toMatchObject({ reason: "invalid-response" });
  });
  it("uses the exact public configuration request without credentials in body", async () => {
    const fetch = vi.fn(async () => json(config));
    expect(await createPlanetAccountClient({ origin, fetch }).configuration()).toEqual(config);
    expect(fetch).toHaveBeenCalledWith(origin + "/planet/api/configuration", expect.objectContaining({
      method: "POST", credentials: "include", mode: "same-origin", cache: "no-store", redirect: "error", body: '{"v":1}',
    }));
  });
  it("bridges an existing token only in Authorization, never as a paid flag or subject", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ subject }));
    expect(await createPlanetAccountClient({ origin, fetch }).bridge(config, "qa.existing.token")).toBe(subject);
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "Bearer qa.existing.token" });
    expect(JSON.parse(String(init.body))).toEqual({ v: 1, audience: config.audience, product: config.product });
  });
  it("returns only an acknowledged deletion request with the same identifier", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ requestId, status: "requested" }, 202));
    expect(await createPlanetAccountClient({ origin, fetch }).requestDeletion(config, "qa.reauth.token", requestId)).toEqual({ requestId, status: "requested" });
    expect(JSON.parse(String((fetch.mock.calls[0][1] as RequestInit).body))).toEqual({ v: 1, audience: config.audience, product: config.product, requestId, reauthToken: "qa.reauth.token" });
  });
  it("cannot request deletion without both configured disclosures", async () => {
    const fetch = vi.fn();
    await expect(createPlanetAccountClient({ origin, fetch }).requestDeletion({ ...config, deletionDisclosure: null }, "qa.token", requestId)).rejects.toMatchObject({ reason: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...config, v: 2 }, { ...config, paid: true }, { ...config, audience: "" }, { ...config, product: "foreign/product" },
    { ...config, deletionDisclosure: { version: "test", ru: "есть", en: "" } },
    { ...config, deletionDisclosure: { version: "test", ru: "есть" } },
  ])("rejects malformed configuration %j", async value => {
    await expect(createPlanetAccountClient({ origin, fetch: async () => json(value) }).configuration()).rejects.toMatchObject({ reason: "invalid-response" });
  });
  it.each([{ subject: "not-a-uuid" }, { subject, paid: true }, { grant: "not-identity" }])("rejects an ambiguous identity response %j", async value => {
    await expect(createPlanetAccountClient({ origin, fetch: async () => json(value) }).bridge(config, "qa.token")).rejects.toMatchObject({ reason: "invalid-response" });
  });
  it.each([{ requestId, status: "completed" }, { requestId: subject, status: "requested" }, { requestId, status: "requested", deleted: true }])("does not invent deletion completion from %j", async value => {
    await expect(createPlanetAccountClient({ origin, fetch: async () => json(value, 202) }).requestDeletion(config, "qa.token", requestId)).rejects.toMatchObject({ reason: "invalid-response" });
  });
  it.each([[401, "authentication-required", "authentication"], [403, "reauthentication-required", "reauthentication"], [403, "access-denied", "denied"], [503, "upstream-secret-detail", "unavailable"]])("maps HTTP %s without displaying upstream details", async (status, code, reason) => {
    await expect(createPlanetAccountClient({ origin, fetch: async () => json({ error: code }, Number(status)) }).configuration()).rejects.toMatchObject({ reason, message: reason });
  });
  it("rejects HTML, redirected output and oversized bodies", async () => {
    const redirected = json(config);
    Object.defineProperty(redirected, "redirected", { value: true });
    for (const response of [new Response("<html>private details</html>", { headers: { "Content-Type": "text/html" } }), redirected, json("x".repeat(70_000))]) {
      await expect(createPlanetAccountClient({ origin, fetch: async () => response }).configuration()).rejects.toMatchObject({ reason: "invalid-response" });
    }
  });
  it("cancels a stalled response stream and never accepts its partial JSON", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(config))); }, cancel() { cancelled = true; } });
    const client = createPlanetAccountClient({ origin, fetch: async () => new Response(stream, { headers: { "Content-Type": "application/json" } }) });
    const pending = expect(client.configuration()).rejects.toMatchObject({ reason: "unavailable" });
    await vi.advanceTimersByTimeAsync(10_001);
    await pending;
    expect(cancelled).toBe(true);
  });
  it("rejects unsafe origins and malformed tokens before network", async () => {
    for (const unsafe of ["http://probpera.ru", "https://probpera.ru/path", "https://user:password@probpera.ru"]) expect(() => createPlanetAccountClient({ origin: unsafe })).toThrow();
    const fetch = vi.fn();
    await expect(createPlanetAccountClient({ origin, fetch }).bridge(config, "bad\r\nheader")).rejects.toMatchObject({ reason: "authentication" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("canonical PWA return state", () => {
  it("keeps semantic country, writer and immersive hash in the selected locale", () => {
    expect(safePwaReturnPath("/planet/ru/?country=russia&writer=dostoevsky#atlas", "en")).toBe("/planet/en/?country=russia&writer=dostoevsky#atlas");
  });
  it.each([null, "https://foreign.invalid/planet/ru/", "//foreign.invalid", "/planet/api/license/session", "/planet/ru/../api/", "/planet\\ru/", "/planet/ru/\n", "/en/", "javascript:alert(1)"])("rejects unsafe return target %s", value => {
    expect(safePwaReturnPath(value, "ru")).toBe("/planet/ru/");
  });
});
