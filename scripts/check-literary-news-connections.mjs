import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createNewsSocialTransport } from "./lib/literary-news-social-transport.mjs";

const names = Object.freeze({ telegram: "probbaperra", vk: "probperaru" });
const methods = Object.freeze({ telegram: new Set(["getMe", "getChat", "getChatMember"]),
  vk: new Set(["groups.getById", "users.get", "account.getAppPermissions"]) });
const validId = value => Number.isSafeInteger(value) && value > 0;

/** Only the existing provider's read methods can receive a credential here. */
export function readonlyConnectionFetch(fetchImpl = fetch) {
  return async (target, options = {}) => {
    const url = new URL(target);
    const platform = url.hostname === "api.telegram.org" ? "telegram" : url.hostname === "api.vk.com" ? "vk" : null;
    const method = url.pathname.split("/").at(-1);
    if (!platform || url.protocol !== "https:" || url.port || url.username || url.password || url.search
      || !methods[platform].has(method) || options.method !== "POST"
      || (platform === "vk" ? !url.pathname.startsWith("/method/") : !/^\/bot[^/]+\/[^/]+$/.test(url.pathname))) {
      throw new Error("connection_probe_readonly_violation");
    }
    return fetchImpl(url, { ...options, redirect: "error", signal: AbortSignal.timeout(20000) });
  };
}

async function json(response) {
  if (!response.ok || !response.body) throw new Error("provider_read_unavailable");
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length; if (length > 262144) throw new Error("provider_reply_too_large");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function checkLiteraryNewsConnections({ env = process.env, fetchImpl = fetch } = {}) {
  const read = readonlyConnectionFetch(fetchImpl);
  const transport = createNewsSocialTransport({ mode: "shadow", telegramToken: env.TELEGRAM_BOT_TOKEN,
    vkToken: env.VK_ACCESS_TOKEN, fetchImpl: read });
  const result = { checkedAt: new Date().toISOString(), release: /^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "") ? env.GITHUB_SHA : null,
    readonly: true, externalWrites: 0, delivered: 0, historyReconciled: false, destinations: [] };
  for (const platform of ["telegram", "vk"]) {
    const hint = names[platform];
    const token = env[platform === "telegram" ? "TELEGRAM_BOT_TOKEN" : "VK_ACCESS_TOKEN"];
    const entry = { platform, requestedHandle: hint, status: "blocked", destinationId: null };
    if (!token) { result.destinations.push({ ...entry, reason: "token_not_configured" }); continue; }
    try {
      const target = platform === "telegram" ? `https://api.telegram.org/bot${token}/getChat` : "https://api.vk.com/method/groups.getById";
      const response = await json(await read(target, { method: "POST", headers: {
        "Content-Type": platform === "telegram" ? "application/json" : "application/x-www-form-urlencoded",
      }, body: platform === "telegram" ? JSON.stringify({ chat_id: `@${hint}` })
        : new URLSearchParams({ group_id: hint, fields: "can_post", access_token: token, v: "5.199" }).toString() }));
      const targetIdentity = platform === "telegram" ? response.result : response.response?.groups?.[0] || response.response?.[0];
      const identityMatches = platform === "telegram"
        ? response.ok === true && /^-100\d+$/.test(String(targetIdentity?.id)) && Number.isSafeInteger(targetIdentity.id)
          && targetIdentity.type === "channel" && targetIdentity.username?.toLowerCase() === hint
        : validId(targetIdentity?.id) && targetIdentity.screen_name?.toLowerCase() === hint;
      if (!identityMatches) { result.destinations.push({ ...entry, reason: "handle_identity_unverified" }); continue; }
      entry.destinationId = platform === "telegram" ? String(targetIdentity.id) : `-${targetIdentity.id}`;
      if (platform === "vk" && env.VK_GROUP_ID && String(Math.abs(Number(env.VK_GROUP_ID))) !== String(targetIdentity.id)) {
        result.destinations.push({ ...entry, reason: "configured_vk_group_mismatch" }); continue;
      }
      const permissions = await transport.preflight({ platform, id: entry.destinationId, mode: "off" });
      const rightsVerified = platform === "telegram" ? permissions.ok === true : permissions.identityVerified === true && permissions.rightsVerified === true;
      result.destinations.push({ ...entry, status: rightsVerified ? "identity_and_rights_verified" : "blocked",
        providerAccountId: permissions.providerAccountId || null, rightsVerified,
        canaryStillRequired: true, reason: rightsVerified ? null : permissions.reason || "publication_rights_unverified" });
    } catch {
      // Provider errors can contain a URL with the bot token. Never serialize them.
      result.destinations.push({ ...entry, reason: "provider_read_failed" });
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkLiteraryNewsConnections();
  await mkdir("connection-check", { recursive: true });
  await writeFile("connection-check/result.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
