import { describe, expect, it, vi } from "vitest";
import { createNewsSocialTransport } from "./literary-news-social-transport-core.mjs";
import { prepareNewsPost } from "./literary-news-social.mjs";

const destination = { platform: "telegram", id: "-100123", mode: "on" };
const notModified = "Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message";
const item = { id: "unchanged-edit-fixture", verification: "confirmed", category: "releases", kind: "news",
  eventKey: "unchanged-edit-fixture", eventDate: "2026-10-01", publishedAt: "2026-10-01T12:00:00Z",
  verifiedAt: "2026-10-01T12:00:00Z", title: { ru: "Новая книга", en: "New book" },
  summary: { ru: "Издатель объявил о выходе новой книги.", en: "The publisher announced a new book." },
  source: { name: "Fixture publisher", url: "https://publisher.example/news/book", language: "en" } };
const preparedPost = () => prepareNewsPost(item, { id: "fixture", release: "a".repeat(40) }, "telegram", {
  destination, mediaOptions: { registry: { assets: [], downloadHosts: [] } } });
function nativeReply({ status = 400, body = { ok: false, error_code: 400, description: notModified } } = {}) {
  const fetchImpl = vi.fn(async () => Response.json(body, { status }));
  return { fetchImpl, transport: createNewsSocialTransport({ mode: "live", telegramToken: "fixture-token", fetchImpl }) };
}

describe("Telegram read-only preflight recovery", () => {
  const healthy = {
    getMe: { ok: true, result: { id: 42 } },
    getChat: { ok: true, result: { id: -100123, type: "channel" } },
    getChatMember: { ok: true, result: { status: "administrator", can_post_messages: true, can_edit_messages: true } },
  };
  function fixture(method, response) {
    const fetchImpl = vi.fn(async url => {
      const called = new URL(url).pathname.split("/").at(-1);
      return called === method ? response() : Response.json(healthy[called]);
    });
    return { fetchImpl, transport: createNewsSocialTransport({ mode: "live", telegramToken: "fixture-token", fetchImpl }) };
  }
  for (const method of Object.keys(healthy)) {
    it.each([
      ["network timeout", () => { throw new DOMException("Timeout", "TimeoutError"); }, "preflight_unavailable", 60],
      ["HTTP503 JSON", () => Response.json({ ok: false, error_code: 503 }, { status: 503 }), "preflight_unavailable", 60],
      ["HTTP502 HTML", () => new Response("upstream unavailable", { status: 502 }), "preflight_unavailable", 60],
      ["HTTP408", () => Response.json({}, { status: 408 }), "preflight_unavailable", 60],
      ["malformed JSON", () => new Response("{broken"), "preflight_response_invalid", 60],
      ["incomplete success", () => Response.json({ ok: true, result: {} }), "preflight_response_invalid", 60],
      ["incomplete error", () => Response.json({ ok: false }), "preflight_response_invalid", 60],
      ["rate limit", () => Response.json({ ok: false, error_code: 429, parameters: { retry_after: 120 } }, { status: 429 }), "provider_rate_limited", 120],
      ["rate limit header", () => new Response("busy", { status: 429, headers: { "retry-after": "90" } }), "provider_rate_limited", 90],
      ["bounded rate limit", () => Response.json({ ok: false, error_code: 429, parameters: { retry_after: 1000000 } }, { status: 429 }), "provider_rate_limited", 86400],
    ])(`${method} retries %s without issuing any write`, async (_name, response, reason, seconds) => {
      const { transport, fetchImpl } = fixture(method, response);
      expect(await transport.preflight(destination)).toEqual({ ok: false, retryable: true, reason, retryAfterSeconds: seconds });
      expect(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname.split("/").at(-1)))
        .toEqual(Object.keys(healthy).slice(0, Object.keys(healthy).indexOf(method) + 1));
    });
    it.each([401, 403])(`${method} permanently blocks HTTP%d even with a malformed body`, async status => {
      const { transport } = fixture(method, () => new Response("denied", { status }));
      expect(await transport.preflight(destination)).toEqual({ ok: false, reason: "telegram_permission_denied" });
    });
  }
  it.each([
    ["wrong channel", "getChat", { id: -100999, type: "channel" }, "destination_identity_unverified"],
    ["wrong destination type", "getChat", { id: -100123, type: "group" }, "destination_identity_unverified"],
    ["revoked membership", "getChatMember", { status: "kicked" }, "telegram_permission_denied"],
    ["revoked publication right", "getChatMember", { status: "administrator", can_edit_messages: true }, "telegram_permission_denied"],
  ])("does not retry confirmed %s", async (_name, method, result, reason) => {
    const { transport } = fixture(method, () => Response.json({ ok: true, result }));
    const failure = await transport.preflight(destination);
    expect(failure).toMatchObject({ ok: false, reason }); expect(failure.retryable).not.toBe(true);
  });
  it("requires all three fresh reads before declaring rights verified", async () => {
    const { transport, fetchImpl } = fixture("unused", () => { throw Error("not expected"); });
    expect(await transport.preflight(destination)).toEqual({ ok: true, destinationId: destination.id, providerAccountId: "42" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("treats an unknown membership shape as unavailable, not a verified revocation", async () => {
    const { transport } = fixture("getChatMember", () => Response.json({ ok: true, result: { status: "unknown" } }));
    expect(await transport.preflight(destination)).toEqual({ ok: false, retryable: true,
      reason: "preflight_response_invalid", retryAfterSeconds: 60 });
  });
  it("does not treat invalid credentials as a temporary read failure", async () => {
    const transport = createNewsSocialTransport({ mode: "live", telegramToken: "invalid/token", fetchImpl: vi.fn() });
    expect(await transport.preflight(destination)).toEqual({ ok: false, reason: "provider_endpoint_invalid" });
  });
  it("retains ambiguity for malformed post-write responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("{broken"));
    const transport = createNewsSocialTransport({ mode: "live", telegramToken: "fixture-token", fetchImpl });
    expect((await transport.send({ destination, prepared: await preparedPost(), remoteId: null })).kind).toBe("ambiguous");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Telegram unchanged-edit acknowledgements", () => {
  it("accepts the exact official HTTP400 response only for an existing message and keeps its identity", async () => {
    const { transport, fetchImpl } = nativeReply();
    const outcome = await transport.send({ destination, prepared: await preparedPost(), remoteId: "17", remoteMediaKind: "text" });
    expect(outcome).toEqual({ kind: "accepted", unchanged: true, remoteId: "17", remoteMediaKind: "text",
      remoteUrl: "https://t.me/c/123/17" });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(new URL(url).origin).toBe("https://api.telegram.org");
    expect(new URL(url).pathname).toBe("/botfixture-token/editMessageText");
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body)).toMatchObject({ chat_id: destination.id, message_id: 17 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome).not.toHaveProperty("date");
    expect(outcome).not.toHaveProperty("firstAcknowledgedAt");
  });

  it.each([
    ["different request rejection", 400, { ok: false, error_code: 400, description: "Bad Request: message to edit not found" }],
    ["shortened error", 400, { ok: false, error_code: 400, description: "Bad Request: message is not modified" }],
    ["extra diagnostic suffix", 400, { ok: false, error_code: 400, description: `${notModified}; try again` }],
    ["wrong HTTP status", 200, { ok: false, error_code: 400, description: notModified }],
    ["string error code", 400, { ok: false, error_code: "400", description: notModified }],
    ["missing failure flag", 400, { error_code: 400, description: notModified }],
    ["permission failure", 403, { ok: false, error_code: 403, description: notModified }],
    ["provider server failure", 500, { ok: false, error_code: 400, description: notModified }],
  ])("does not acknowledge %s", async (_name, status, body) => {
    const { transport } = nativeReply({ status, body });
    const outcome = await transport.send({ destination, prepared: await preparedPost(), remoteId: "17" });
    expect(outcome.kind).not.toBe("accepted");
    expect(outcome).not.toHaveProperty("unchanged");
  });

  it("keeps a new-create rejection blocked even when its description is the exact unchanged error", async () => {
    const { transport, fetchImpl } = nativeReply();
    expect(await transport.send({ destination, prepared: await preparedPost(), remoteId: null }))
      .toEqual({ kind: "blocked", code: "telegram_request_rejected" });
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe("/botfixture-token/sendMessage");
  });

  it.each(["literary-news-withdrawal-v1", "unknown-profile"])("keeps the %s response fail-closed", async profile => {
    const { transport } = nativeReply();
    expect(await transport.send({ destination, prepared: { ...await preparedPost(), profile }, remoteId: "17" }))
      .toEqual({ kind: "blocked", code: "telegram_request_rejected" });
  });

  it("rejects an invalid remote ID before sending any request", async () => {
    const { transport, fetchImpl } = nativeReply();
    expect(await transport.send({ destination, prepared: await preparedPost(), remoteId: "0" }))
      .toEqual({ kind: "blocked", code: "remote_id_invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
