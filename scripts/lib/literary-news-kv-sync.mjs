export const NEWS_STATE_KEY = "literary-news:v1:source-state";
export const NEWS_QUEUE_KEY = "literary-news:v1:held-queue";
const NAMESPACE_ID = "f3ae59fd55ee4c0cac8ff1613db81680";
const MAX_BYTES = 16 * 1024 * 1024;

async function boundedText(response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("News storage response exceeds its limit");
  if (!response.body) throw new Error("News storage returned an empty response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) throw new Error("News storage response exceeds its limit");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/** CLI-only account API client. The reader Worker uses its native KV binding. */
export function createNewsStorageClient({ accountId, apiToken, fetchImpl = fetch }) {
  if (!/^[a-f0-9]{32}$/i.test(accountId || "") || !apiToken?.trim()) {
    throw new Error("News storage credentials are not configured");
  }
  async function request(path, options = {}) {
    // Credentials are sent only to the literal Cloudflare host. Account and key
    // values can change the path, never the destination, scheme or authority.
    const endpoint = new URL("https://api.cloudflare.com");
    endpoint.pathname = `/client/v4/accounts/${accountId}/storage/kv/namespaces/${NAMESPACE_ID}${path}`;
    const response = await fetchImpl(endpoint, {
      ...options, redirect: "manual", signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${apiToken}`, ...options.headers },
    });
    return { response, text: await boundedText(response) };
  }
  return {
    async read(key) {
      if (![NEWS_STATE_KEY, NEWS_QUEUE_KEY].includes(key)) throw new Error("Unexpected news storage key");
      const { response, text } = await request(`/values/${encodeURIComponent(key)}`);
      if (response.status === 404) {
        let payload;
        try { payload = JSON.parse(text); } catch { /* Invalid errors must fail closed. */ }
        if (payload?.errors?.some(error => error.code === 10009)) return null;
      }
      if (!response.ok) throw new Error(`News storage read failed (HTTP ${response.status})`);
      return text;
    },
    async write(entries) {
      validateNewsBulk(entries);
      const body = JSON.stringify(entries);
      // KV bulk writes can report partial success. Retry the same immutable
      // snapshot, never a new collection with different timestamps or contents.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { response, text } = await request("/bulk", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body,
        });
        if (!response.ok) throw new Error(`News storage write failed (HTTP ${response.status})`);
        const result = JSON.parse(text);
        const unsuccessful = result.result?.unsuccessful_keys;
        const successful = result.result?.successful_key_count;
        if (result.success === true
          && (unsuccessful === undefined || (Array.isArray(unsuccessful) && unsuccessful.length === 0))
          && (successful === undefined || successful === entries.length)) return;
      }
      throw new Error("News storage did not confirm both updated keys after three attempts");
    },
  };
}

export function validateNewsBulk(entries) {
  if (!Array.isArray(entries) || entries.length !== 2
    || entries.some(entry => ![NEWS_STATE_KEY, NEWS_QUEUE_KEY].includes(entry?.key)
      || typeof entry.value !== "string" || Object.keys(entry).some(key => !["key", "value"].includes(key)))
    || new Set(entries.map(entry => entry.key)).size !== 2) {
    throw new Error("The collector may update only the two literary news keys");
  }
  const state = JSON.parse(entries.find(entry => entry.key === NEWS_STATE_KEY).value);
  const queue = JSON.parse(entries.find(entry => entry.key === NEWS_QUEUE_KEY).value);
  if (state.schemaVersion !== 1 || queue.schemaVersion !== 1 || queue.verification !== "held"
    || !Array.isArray(state.sources) || !Array.isArray(queue.items)
    || queue.items.some(item => item.verification !== "held")
    || state.pendingCount !== queue.items.length
    || !Number.isFinite(Date.parse(state.lastCheckedAt)) || state.lastCheckedAt !== queue.lastCheckedAt) {
    throw new Error("The collector returned an invalid source state or editorial queue");
  }
  return state;
}

export async function syncNewsStorage({ storage, collect }) {
  // A failed read never becomes an empty snapshot. Only a genuine missing-key
  // response for both keys permits the first bootstrap.
  const [previousState, previousQueue] = await Promise.all([
    storage.read(NEWS_STATE_KEY), storage.read(NEWS_QUEUE_KEY),
  ]);
  if ((previousState === null) !== (previousQueue === null)) {
    throw new Error("News storage contains an incomplete snapshot; refusing to overwrite it");
  }
  const entries = await collect({ previousState, previousQueue });
  const state = validateNewsBulk(entries);
  await storage.write(entries);
  return state;
}
