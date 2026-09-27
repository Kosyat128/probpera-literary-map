import limits from "../../data/news/contract.json";
import { parseNewsFeed } from "./feed";

/** Read all bytes before publishing a generation to the existing reducer. */
export async function readNewsFeedResponse(response: Response) {
  if (!response.ok || !response.body) throw new Error("News response unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limits.maxFeedBytes) throw new Error("News response too large");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const feed = parseNewsFeed(JSON.parse(text));
  if (feed.contractVersion === 2 && feed.snapshot) {
    const payload = { release: feed.snapshot.release, policy: feed.snapshot.policy,
      timeZone: feed.timeZone, items: feed.items, withdrawals: feed.withdrawals };
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (actual !== feed.snapshot.id) throw new Error("News snapshot digest mismatch");
  }
  return feed;
}
