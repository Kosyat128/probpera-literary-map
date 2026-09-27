import { describe, expect, it } from "vitest";
import { checkLiteraryNewsConnections, readonlyConnectionFetch } from "./check-literary-news-connections.mjs";

const reply = value => new Response(JSON.stringify(value), { status: 200 });
describe("literary news connection preflight", () => {
  it("never contacts providers when credentials are absent", async () => {
    const result = await checkLiteraryNewsConnections({ env: {}, fetchImpl: () => { throw Error("unexpected request"); } });
    expect(result.destinations.map(row => row.reason)).toEqual(["token_not_configured", "token_not_configured"]);
    expect(result.externalWrites).toBe(0);
  });
  it("rejects post/upload endpoints and foreign origins before sending secrets", async () => {
    let calls = 0;
    const fetcher = readonlyConnectionFetch(async () => { calls++; return reply({}); });
    for (const url of ["https://api.vk.com/method/wall.post", "https://api.telegram.org/botfake/sendMessage",
      "https://example.org/getChat", "https://api.vk.com/method/groups.getById?access_token=secret",
      "https://api.vk.com/method/other/groups.getById", "https://api.telegram.org/botfake%2FsendMessage/getChat",
      "https://api.telegram.org/botfake/getChat#hidden", "https://api.telegram.org.evil.example/botfake/getChat",
      "https://api.vk.com@evil.example/method/groups.getById"]) {
      await expect(fetcher(url, { method: "POST" })).rejects.toThrow("connection_probe_readonly_violation");
    }
    expect(calls).toBe(0);
  });
  it("rejects credential path delimiters without making a network request or logging the token",async()=>{
    let calls=0;
    const result=await checkLiteraryNewsConnections({env:{TELEGRAM_BOT_TOKEN:"private/../sendMessage?x=1"},
      fetchImpl:async()=>{calls++;return reply({});}});
    expect(calls).toBe(0);expect(result.destinations[0].reason).toBe("provider_read_failed");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("verifies channel identity and actual existing transport permissions without enabling delivery", async () => {
    const calls = [];
    const result = await checkLiteraryNewsConnections({ env: { VK_ACCESS_TOKEN: "vk-private", VK_GROUP_ID: "321", TELEGRAM_BOT_TOKEN: "tg-private" },
      fetchImpl: async url => {
        calls.push(url.pathname.split("/").at(-1));
        if (url.pathname.endsWith("getChat")) return reply({ ok: true, result: { id: -10012345, type: "channel", username: "probbaperra" } });
        if (url.pathname.endsWith("getMe")) return reply({ ok: true, result: { id: 500, is_bot: true } });
        if (url.pathname.endsWith("getChatMember")) return reply({ ok: true, result: { status: "administrator", can_post_messages: true, can_edit_messages: true } });
        if (url.pathname.endsWith("groups.getById")) return reply({ response: { groups: [{ id: 321, screen_name: "probperaru", can_post: 1, is_admin: 1, admin_level: 3 }] } });
        if (url.pathname.endsWith("users.get")) return reply({ response: [{ id: 123 }] });
        if (url.pathname.endsWith("account.getAppPermissions")) return reply({ response: 8192 });
        if (url.pathname.endsWith("groups.getTokenPermissions")) return reply({ error: { error_code: 27, error_msg: "vk-private" } });
        throw Error("unexpected method");
      } });
    expect(result.destinations.map(row => [row.destinationId, row.rightsVerified])).toEqual([["-10012345", true], ["-321", true]]);
    expect(result.historyReconciled).toBe(false);
    expect(result.destinations.every(row => row.canaryStillRequired)).toBe(true);
    expect(calls).not.toContain("wall.post");
    expect(JSON.stringify(result)).not.toMatch(/vk-private|tg-private/);
    expect(result.vkDiagnostics.at(-1)).toMatchObject({ errorCode: 27, groupTokenRecognized: false });
  });
  it("does not accept the wrong group and never exposes a provider exception containing a token", async () => {
    const result = await checkLiteraryNewsConnections({ env: { VK_ACCESS_TOKEN: "vk-private", TELEGRAM_BOT_TOKEN: "tg-private" },
      fetchImpl: async url => {
        if (url.hostname === "api.telegram.org") throw Error(`network error: ${url.href}`);
        return reply({ response: [{ id: 1, screen_name: "some-other-group" }] });
      } });
    expect(result.destinations.map(row => row.reason)).toEqual(["provider_read_failed", "handle_identity_unverified"]);
    expect(JSON.stringify(result)).not.toMatch(/tg-private|vk-private|bot.*getChat/);
  });
});
