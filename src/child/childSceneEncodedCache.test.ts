import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { createChildSceneEncodedCache } from "./childSceneEncodedCache";
import type { Common3dResource } from "./childCommon3d";
function fixture(limit = 16) {
  let time = 0; vi.stubGlobal("crypto", webcrypto);
  const cache = createChildSceneEncodedCache("synthetic-context", () => time); cache.setLimit(limit);
  const bytes = Uint8Array.of(1, 2, 3, 4), hash = createHash("sha256").update(bytes).digest("hex");
  const r: Common3dResource = { assetId: "synthetic-buffer", entity: { kind: "stand", id: "synthetic-buffer", contentChecksum: "a".repeat(64) },
    mime: "application/octet-stream", checksum: hash, encodedBytes: 4, alias: "vertices.bin", kind: "buffer" };
  return { cache, bytes, r, at: (at: number) => { time = at; } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("bounded independent encoded cache after fresh native acquisition", () => {
  it("never shares caller buffers, never renews expiry, and refuses a missing fresh native gate", async () => {
    const f = fixture(); await f.cache.store(f.r, f.bytes, "A", 1000, () => true); f.bytes.fill(0);
    expect(await f.cache.read(f.r, "B", 5000, () => false)).toBeNull();
    const hit = await f.cache.read(f.r, "B", 5000, () => true);
    expect(hit?.absoluteDeadline).toBe(1000); expect([...hit!.bytes]).toEqual([1, 2, 3, 4]); hit!.bytes.fill(9);
    const again = await f.cache.read(f.r, "B", 5000, () => true); expect([...again!.bytes]).toEqual([1, 2, 3, 4]); again!.bytes.fill(0);
    f.at(1000); expect(await f.cache.read(f.r, "C", 5000, () => true)).toBeNull(); expect(f.cache.getSnapshot().bytes).toBe(0); f.cache.clear(); await f.cache.join();
  });
  it("keeps exact entity/hash/alias scope, limits LRU bytes and joins pending copies on context retirement", async () => {
    const f = fixture(8); await f.cache.store(f.r, f.bytes, "A", 1000, () => true);
    expect(await f.cache.read({ ...f.r, entity: { ...f.r.entity, contentChecksum: "b".repeat(64) } }, "A", 1000, () => true)).toBeNull();
    const other = { ...f.r, assetId: "other-buffer", alias: "other.bin" }; await f.cache.store(other, f.bytes, "A", 1000, () => true);
    expect(f.cache.getSnapshot().bytes).toBeLessThanOrEqual(8); expect(await f.cache.read(f.r, "A", 1000, () => true)).toBeNull();
    const before = f.bytes.slice(); f.cache.retireScene("A"); expect(f.cache.getSnapshot().bytes).toBe(0); expect(f.bytes).toEqual(before); await f.cache.join();
  });
  it("reserves pending digest copies before allocation and cannot resurrect them after clear or limit reduction", async () => {
    const f = fixture(8), waits: Array<() => void> = [];
    vi.stubGlobal("crypto", { subtle: { digest: (_algorithm: unknown, input: Uint8Array) => new Promise<ArrayBuffer>(resolve => {
      const value = Uint8Array.from(Buffer.from(createHash("sha256").update(input).digest()));
      waits.push(() => resolve(value.buffer));
    }) } });
    const first = f.cache.store(f.r, f.bytes, "A", 1000, () => true);
    expect(f.cache.getSnapshot()).toMatchObject({ bytes: 8, pendingBytes: 8 });
    const second = f.cache.store({ ...f.r, assetId: "other" }, f.bytes, "A", 1000, () => true);
    expect(f.cache.getSnapshot().bytes).toBe(8); expect(waits).toHaveLength(1);
    f.cache.setLimit(0); expect(f.cache.getSnapshot().bytes).toBe(8); waits.shift()!(); await Promise.all([first, second]); await f.cache.join();
    expect(f.cache.getSnapshot()).toMatchObject({ entries: 0, bytes: 0, pendingBytes: 0 });
  });
  it("does not reuse arbitrary URIs, images or mutated bytes and fences async scene retirement", async () => {
    const f = fixture(); await f.cache.store({ ...f.r, kind: "texture", mime: "image/png", alias: "image.png" }, f.bytes, "A", 1000, () => true);
    await f.cache.store(f.r, Uint8Array.of(1, 2, 3, 9), "A", 1000, () => true); expect(f.cache.getSnapshot().entries).toBe(0);
    await f.cache.store(f.r, f.bytes, "A", 1000, () => true); const work = f.cache.read(f.r, "B", 1000, () => true); f.cache.clear();
    expect(await work).toBeNull(); await f.cache.join(); expect(f.cache.getSnapshot().entries).toBe(0);
  });
  it("keeps in-flight read copies charged and zeroes their owned input until the actual digest joins", async () => {
    const f = fixture(16); await f.cache.store(f.r, f.bytes, "A", 1000, () => true);
    let finish!: () => void, input!: Uint8Array;
    vi.stubGlobal("crypto", { subtle: { digest: (_algorithm: unknown, bytes: Uint8Array) => new Promise<ArrayBuffer>(resolve => {
      input = bytes; const hash = Uint8Array.from(Buffer.from(createHash("sha256").update(bytes).digest())); finish = () => resolve(hash.buffer);
    }) } });
    const read = f.cache.read(f.r, "B", 5000, () => true); expect(f.cache.getSnapshot()).toMatchObject({ bytes: 12, pendingBytes: 8 });
    f.cache.clear(); expect([...input]).toEqual([0, 0, 0, 0]); expect(f.cache.getSnapshot()).toMatchObject({ bytes: 8, pendingBytes: 8, entries: 0 });
    let joined = false; const join = f.cache.join().then(() => { joined = true; }); await Promise.resolve(); expect(joined).toBe(false);
    finish(); expect(await read).toBeNull(); await join; expect(f.cache.getSnapshot()).toMatchObject({ bytes: 0, pendingBytes: 0, entries: 0 });
  });
});