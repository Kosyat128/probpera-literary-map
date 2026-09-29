import { describe, expect, it, vi, afterEach } from "vitest";
import { createDailyWorkersAiClient, createDailyNewsStorageClient } from "./literary-news-daily-automation.mjs";
import { createDeliveryMediaStorage } from "../sync-literary-news-delivery-media.mjs";
import { DAILY_NEWS_MODELS, DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LEDGER_KEY, DAILY_NEWS_OWNER_KEY } from "./literary-news-daily-profile.mjs";
import { DELIVERY_MEDIA_INDEX_KEY, DELIVERY_MEDIA_BYTES_PREFIX } from "./literary-news-delivery-media-profile.mjs";

const accountId = "a".repeat(32), apiToken = "isolated-fixture-token", NativeURL = URL;
const namespacePath = "/client/v4/accounts/" + accountId + "/storage/kv/namespaces/f3ae59fd55ee4c0cac8ff1613db81680/values/";
afterEach(() => vi.unstubAllGlobals());

describe("Fixed Cloudflare origin and final request URL boundary", () => {
  it("keeps both AI models on the fixed HTTPS API origin with no alternate URL authority", async () => {
    const fetchImpl = vi.fn(async () => Response.json({success:true,result:{response:{status:"held"}}}));
    const client = createDailyWorkersAiClient({accountId,apiToken,fetchImpl});
    for (const phase of ["draft","review"]) await client.request({phase,messages:[]});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [index,phase] of ["draft","review"].entries()) {
      const [input,options] = fetchImpl.mock.calls[index], target = new NativeURL(input);
      expect(target.origin).toBe("https://api.cloudflare.com");
      expect(target.protocol).toBe("https:"); expect(target.hostname).toBe("api.cloudflare.com");
      expect(target.pathname).toBe("/client/v4/accounts/" + accountId + "/ai/run/" + DAILY_NEWS_MODELS[phase]);
      expect(target.username + target.password + target.search + target.hash).toBe("");
      expect(options.redirect).toBe("error"); expect(options.method).toBe("POST");
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("encodes only fixed permitted KV keys in the pathname, leaving authority and query unchanged", async () => {
    const fetchImpl = vi.fn(async () => Response.json({success:true}));
    const client = createDailyNewsStorageClient({accountId,apiToken,fetchImpl});
    for (const key of [DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_OWNER_KEY]) await client.read(key);
    for (const [index,key] of [DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_OWNER_KEY].entries()) {
      const [input,options] = fetchImpl.mock.calls[index], target = new NativeURL(input);
      expect(target.origin).toBe("https://api.cloudflare.com");
      expect(target.pathname).toBe(namespacePath + encodeURIComponent(key));
      expect(target.username + target.password + target.search + target.hash).toBe("");
      expect(options.redirect).toBe("error");
    }
    for (const key of ["//evil.example/path","../escape",DAILY_NEWS_PROFILE_KEY + "?host=evil.example",
      {toString:() => DAILY_NEWS_PROFILE_KEY}]) await expect(client.read(key)).rejects.toThrow("daily_storage_key_invalid");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("preserves JPEG TTL and the fixed namespace while rejecting injected media hashes", async () => {
    const fetchImpl = vi.fn(async () => Response.json({success:true}));
    const client = createDeliveryMediaStorage({accountId,apiToken,fetchImpl});
    await client.readIndex(); await client.writeIndex({schemaVersion:1});
    await client.writeJpeg("b".repeat(64),new Uint8Array([255,216,255]));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [index,[target,options]] of fetchImpl.mock.calls.entries()) {
      expect(target.origin).toBe("https://api.cloudflare.com");
      expect(target.protocol).toBe("https:"); expect(target.hostname).toBe("api.cloudflare.com");
      expect(target.pathname).toBe(namespacePath + encodeURIComponent(index < 2 ? DELIVERY_MEDIA_INDEX_KEY : DELIVERY_MEDIA_BYTES_PREFIX + "b".repeat(64)));
      expect(target.username + target.password + target.hash).toBe("");
      expect(target.search).toBe(index === 2 ? "?expiration_ttl=3888000" : "");
      expect(options.redirect).toBe("error");
    }
    for (const hash of ["../escape","b".repeat(64) + "/../../escape","b".repeat(64) + "?host=evil.example",
      "//evil.example", "b".repeat(64) + "\\escape"]) await expect(client.writeJpeg(hash,new Uint8Array()))
      .rejects.toThrow("delivery_media_storage_key_invalid");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("rejects non-string or malformed account IDs before reading an alternate authority or issuing any network request", () => {
    const fetchImpl = vi.fn(), coercion = vi.fn(() => accountId);
    for (const candidate of ["https://127.0.0.1",accountId + "@evil.example",accountId + "/../other",
      accountId + "?query",accountId + "#fragment",accountId + "\n", {toString:coercion},null,undefined]) {
      expect(() => createDailyWorkersAiClient({accountId:candidate,apiToken,fetchImpl})).toThrow("daily_ai_credentials_missing");
      expect(() => createDailyNewsStorageClient({accountId:candidate,apiToken,fetchImpl})).toThrow("daily_storage_credentials_missing");
      expect(() => createDeliveryMediaStorage({accountId:candidate,apiToken,fetchImpl})).toThrow("delivery_media_storage_unconfigured");
    }
    expect(fetchImpl).not.toHaveBeenCalled(); expect(coercion).not.toHaveBeenCalled();
  });

  it.each(["hostname","protocol","port","username","password","search","hash","pathname"])(
    "rejects final URL %s drift before forwarding credentials to fetch", async field => {
      class ChangedURL extends NativeURL {
        constructor(...args) {
          super(...args);
          if (field !== "pathname") this[field] = {hostname:"evil.example",protocol:"http:",port:"8443",
            username:"injected",password:"injected",search:"?injected=1",hash:"#injected"}[field];
        }
        set pathname(value) { super.pathname = field === "pathname" ? value + "/../escape" : value; }
        get pathname() { return super.pathname; }
      }
      vi.stubGlobal("URL",ChangedURL);
      const fetchImpl = vi.fn(), ai = createDailyWorkersAiClient({accountId,apiToken,fetchImpl}),
        storage = createDailyNewsStorageClient({accountId,apiToken,fetchImpl}),
        media = createDeliveryMediaStorage({accountId,apiToken,fetchImpl});
      await expect(ai.request({phase:"draft",messages:[]})).rejects.toThrow("daily_ai_endpoint_invalid");
      await expect(storage.read(DAILY_NEWS_PROFILE_KEY)).rejects.toThrow("daily_storage_endpoint_invalid");
      await expect(media.readIndex()).rejects.toThrow("delivery_media_storage_endpoint_invalid");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it("does not follow a provider redirect, retry the failure or mask quota behavior", async () => {
    const fetchImpl = vi.fn(async (_target,options) => {
      expect(options.redirect).toBe("error");
      throw new TypeError("fixture redirect refused");
    });
    const client = createDailyWorkersAiClient({accountId,apiToken,fetchImpl});
    await expect(client.request({phase:"draft",messages:[]})).rejects.toThrow("ai_request_unavailable");
    await expect(client.request({phase:"review",messages:[]})).rejects.toThrow("ai_request_unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
