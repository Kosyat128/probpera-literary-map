import { describe, expect, it, vi } from "vitest";
import { buildPublishedNewsFeed } from "./literary-news-publication.mjs";
import { pendingNewsSourceState } from "./literary-news-state.mjs";
import { dispatchNewsBatch, dispatchNewsJob, newsPostKey, reconcileNewsSnapshot } from "./literary-news-social.mjs";

const current = new Date("2026-09-26T12:00:00Z");
const destination = { platform: "telegram", id: "-100123", mode: "on" };
const controlKey = "destination:telegram:-100123";
const item = { id: "restore-scope-fixture", eventKey: "restore-scope-fixture", kind: "news", category: "releases",
  title: { ru: "Издатель объявил новую книгу", en: "Publisher announces a new book" },
  summary: { ru: "Проверенное сообщение о новой книге.", en: "A verified announcement about the new book." },
  source: { name: "Fixture publisher", url: "https://publisher.example/new-book", language: "en" },
  eventDate: "2026-09-25", publishedAt: null, verifiedAt: "2026-09-25T12:00:00Z", verification: "confirmed" };
const key = newsPostKey(item.id, destination);
const receipt = { kind: "accepted", remoteId: "17", remoteUrl: "https://t.me/c/123/17" };
const feed = (records = [item]) => buildPublishedNewsFeed({ records, state: pendingNewsSourceState(), current,
  release: "a".repeat(40), timeZone: "Europe/Moscow" });

// Snapshot/reload fixture only: production transitions remain the actual imported
// functions. SQL locking and staff authorization have their separate PGlite proof.
function memoryStore(snapshot = []) {
  const rows = new Map(structuredClone(snapshot));
  let sequence = Math.max(0, ...[...rows.values()].map((row) => row.id));
  return {
    async read(key) { return structuredClone(rows.get(key) || { id: null, state: null }); },
    async list(prefix) { return [...rows].filter(([key]) => key.startsWith(prefix)).map(([, row]) => structuredClone(row)); },
    async compareAppend(key, expectedId, state, guard) {
      const previous = await this.read(key);
      if (previous.id !== expectedId) return { applied: false, ...previous };
      if (guard) {
        const control = await this.read(guard.key);
        if (control.id !== guard.id || !control.state || control.state.paused
          || !["on", "canary"].includes(control.state.mode) || control.state.historyReconciled !== true)
          return { applied: false, ...previous };
      }
      const row = { id: ++sequence, state: structuredClone(state) };
      rows.set(key, row);
      return { applied: true, ...structuredClone(row) };
    },
    async seed(key, state) { return this.compareAppend(key, (await this.read(key)).id, state); },
    snapshot() { return JSON.parse(JSON.stringify([...rows])); },
  };
}

async function oldBackupAndNewerExternalPost() {
  const store = memoryStore();
  await reconcileNewsSnapshot(store, await feed(), [destination], current);
  await store.seed(controlKey, { mode: "on", paused: false, historyReconciled: true });
  const backup = store.snapshot(); // Backup predates the external create/receipt.
  const send = vi.fn(async () => receipt);
  await dispatchNewsJob({ store, key, transport: { preflight: async () => ({ ok: true }), send }, now: () => current });
  expect(send).toHaveBeenCalledTimes(1);
  expect((await store.read(key)).state.status).toBe("sent_current");
  return { backup, authoritativeReceipt: (await store.read(key)).state };
}

describe("S18 scoped restore policy (isolated; no real external writes)", () => {
  it.each([
    ["paused", { mode: "on", paused: true, historyReconciled: true }],
    ["shadow", { mode: "shadow", paused: false, historyReconciled: true }],
    ["unreconciled", { mode: "on", paused: false, historyReconciled: false }],
  ])("an old pre-receipt backup cannot resend with the required %s restore gate", async (_name, restoreControl) => {
    const { backup } = await oldBackupAndNewerExternalPost();
    const restored = memoryStore(backup);
    await restored.seed(controlKey, restoreControl); // Explicit operator restore policy; not an automatic detector.
    const reconciliation = await reconcileNewsSnapshot(restored, await feed(), [destination], current);
    expect(reconciliation.newAdmissions).toBe(0);
    expect(reconciliation.expectedThisSnapshot).toBe(1);
    const transport = { preflight: vi.fn(async () => ({ ok: true })), send: vi.fn(async () => receipt) };
    await dispatchNewsBatch({ store: restored, jobs: (await restored.list("post:")).map((row) => row.state), transport, now: () => current });
    const direct = await dispatchNewsJob({ store: restored, key, transport, now: () => current });
    expect(direct).toMatchObject({ status: "blocked", reason: "destination_not_enabled_or_history_gap" });
    expect(transport.preflight).not.toHaveBeenCalled();
    expect(transport.send).not.toHaveBeenCalled();
    expect((await restored.read(key)).state).toMatchObject({ status: "pending", originalAdmission: current.toISOString() });
    expect((await restored.read(key)).state.remoteId).toBeUndefined();
  });

  it("reconciled newer remote identity survives restored history and directs a later revision to edit", async () => {
    const { backup, authoritativeReceipt } = await oldBackupAndNewerExternalPost();
    const restored = memoryStore(backup);
    await restored.seed(controlKey, { mode: "shadow", paused: true, historyReconciled: false });
    // Simulate independently verified recovery of the later receipt. This is
    // not a claim that the runner can discover Telegram history by itself.
    await restored.seed(key, authoritativeReceipt);
    const changed = { ...item, summary: { ...item.summary, ru: "Уточнённое сообщение о новой книге." } };
    await reconcileNewsSnapshot(restored, await feed([changed]), [destination], current);
    expect((await restored.read(key)).state).toMatchObject({ remoteId: "17", status: "correction_pending" });
    await restored.seed(controlKey, { mode: "on", paused: false, historyReconciled: true });
    const send = vi.fn(async () => receipt);
    await dispatchNewsJob({ store: restored, key, transport: { preflight: async () => ({ ok: true }), send }, now: () => current });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].remoteId).toBe("17");
    expect((await restored.read(key)).state.originalAdmission).toBe(authoritativeReceipt.originalAdmission);
    const replacementTokenTransport = { preflight: vi.fn(async () => ({ ok: true })), send: vi.fn(async () => receipt) };
    await dispatchNewsJob({ store: restored, key, transport: replacementTokenTransport, now: () => current });
    expect(replacementTokenTransport.send).not.toHaveBeenCalled();
    expect(newsPostKey(item.id, destination)).toBe(key);
  });

  it("a restored dispatch-start marker remains ambiguous after its lease expires", async () => {
    const { backup } = await oldBackupAndNewerExternalPost();
    const restored = memoryStore(backup), job = (await restored.read(key)).state;
    await restored.seed(key, { ...job, status: "inflight", attemptId: "old-attempt",
      dispatchStartedAt: "2026-09-25T12:00:00Z", leaseUntil: "2026-09-25T12:02:00Z" });
    const transport = { preflight: vi.fn(async () => ({ ok: true })), send: vi.fn(async () => receipt) };
    expect((await dispatchNewsJob({ store: restored, key, transport, now: () => current })).status).toBe("ambiguous");
    expect(transport.send).not.toHaveBeenCalled();
    expect((await restored.read(key)).state.dispatchStartedAt).toBe("2026-09-25T12:00:00Z");
  });
});
