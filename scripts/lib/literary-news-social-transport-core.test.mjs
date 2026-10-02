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
