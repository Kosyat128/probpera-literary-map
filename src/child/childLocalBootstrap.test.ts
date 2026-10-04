import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CHILD_LOCAL_SEED_V2_MAX_BYTES, childLocalUnenrolledSeedV2Bytes, createChildLocalUnenrolledSeedV2,
  decodeChildLocalUnenrolledSeedV2, verifyChildLocalUnenrolledSeedV2Bytes } from "./childLocalBootstrap";

// Mathematical/codec checks only: no installed OS, setup permission or storage.
const vectors = [
  { version: "synthetic-local-v2", checksum: "a".repeat(64), registryChecksum: "3bcb6774320bf9e7732200baf02422037aa055377d427a6b4d272ac78f462420",
    seedChecksum: "bcf1edf94a54e3e55eca07c78fb820dd33ac9943e219959d6d4309145cdc92cf" },
  { version: "shared-policy.2026-10", checksum: "b".repeat(64), registryChecksum: "43731657467908109f159c6a5aa77929ede7bf339f3322eb57e060fc78961336",
    seedChecksum: "8938bfcd08cbeb669d7216ed47f71704bb16249b06e47cd8847a1f580f91e03d" },
];
const digest = { async sha256(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256", new Uint8Array(bytes))))
    .map(value => value.toString(16).padStart(2, "0")).join("");
} };
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const policy = () => ({ version: vectors[0].version, checksum: vectors[0].checksum });
const plain = async () => JSON.parse(new TextDecoder().decode(childLocalUnenrolledSeedV2Bytes((await createChildLocalUnenrolledSeedV2(policy(), digest))!)));

describe("explicit local v2 empty seed codec without first-install authority", () => {
  it.each(vectors)("matches independent OpenSSL registry/full-byte vectors for $version", async vector => {
    const seed = await createChildLocalUnenrolledSeedV2({ version: vector.version, checksum: vector.checksum }, digest);
    expect(seed?.registryChecksum).toBe(vector.registryChecksum);
    const bytes = childLocalUnenrolledSeedV2Bytes(seed!);
    expect(await digest.sha256(bytes)).toBe(vector.seedChecksum);
    expect(await verifyChildLocalUnenrolledSeedV2Bytes(bytes, { version: vector.version, checksum: vector.checksum }, digest)).toEqual(seed);
    expect(seed).toMatchObject({ schemaVersion: 2, revision: 1, mode: "adult", pin: null, clock: { schemaVersion: 2, logicalMs: 0 } });
  });
  it("copies the empty draft deeply without creating child selection or native/time permissions", async () => {
    const input = await plain(), decoded = decodeChildLocalUnenrolledSeedV2(input, policy())!;
    input.registry.policyVersion = "changed"; input.clock.logicalMs = 99;
    expect(decoded.registry.policyVersion).toBe(vectors[0].version);
    expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded.registry)).toBe(true);
    expect(Object.isFrozen(decoded.registry.profiles)).toBe(true); expect(Object.isFrozen(decoded.clock)).toBe(true);
    expect(decoded.registry.activeProfileId).toBeNull(); expect(decoded.registry.profiles).toHaveLength(0);
    expect(Reflect.ownKeys(decoded.clock)).toEqual(["schemaVersion", "logicalMs"]);
  });
  it.each(["v1", "child", "enrolled", "profile", "later-revision", "boot", "epoch", "negative-zero", "policy"])(
    "refuses to reinterpret existing/unknown $0 state as an empty first install", async kind => {
      const value = await plain();
      if (kind === "v1") value.schemaVersion = 1;
      if (kind === "child") value.mode = "child";
      if (kind === "enrolled") value.pin = { schemaVersion: 1 };
      if (kind === "profile") { value.registry.profiles.push({ id: "prior-child" }); value.registry.activeProfileId = "prior-child"; }
      if (kind === "later-revision") value.revision = 2;
      if (kind === "boot") value.clock.bootId = "00000000-0000-0000-0000-000000000000";
      if (kind === "epoch") value.clock.epochAnchorMs = 1;
      if (kind === "negative-zero") value.clock.logicalMs = -0;
      if (kind === "policy") value.registry.policyVersion = "other";
      expect(decodeChildLocalUnenrolledSeedV2(value, policy())).toBeNull();
    });
  it("denies root/policy accessors, extra fields and inherited data before any digest callback", async () => {
    const value = await plain(), getter = vi.fn(() => "unsafe"), sha256 = vi.fn(digest.sha256);
    Object.defineProperty(value, "pin", { enumerable: true, get: getter });
    expect(decodeChildLocalUnenrolledSeedV2(value, policy())).toBeNull(); expect(getter).not.toHaveBeenCalled();
    const p = policy(); Object.defineProperty(p, "version", { enumerable: true, get: getter });
    expect(await createChildLocalUnenrolledSeedV2(p, { sha256 })).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(sha256).not.toHaveBeenCalled();
    expect(decodeChildLocalUnenrolledSeedV2({ ...await plain(), approved: true }, policy())).toBeNull();
    expect(decodeChildLocalUnenrolledSeedV2(Object.create(await plain()), policy())).toBeNull();
  });
  it("captures original policy before a delayed real digest and does not echo later changes", async () => {
    const p = policy(); let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const pending = createChildLocalUnenrolledSeedV2(p, { async sha256(bytes) { await barrier; return digest.sha256(bytes); } });
    p.version = "changed"; p.checksum = "f".repeat(64); release();
    const seed = await pending; expect(seed?.registry.policyVersion).toBe(vectors[0].version);
    expect(seed?.policyChecksum).toBe(vectors[0].checksum); expect(seed?.registryChecksum).toBe(vectors[0].registryChecksum);
  });
  it("reads empty-array descriptors without invoking an ordinary caller get trap", async () => {
    const value = await plain(), get = vi.fn(() => { throw new Error("caller-get"); });
    value.registry.profiles = new Proxy([], { get });
    expect(decodeChildLocalUnenrolledSeedV2(value, policy())?.registry.profiles).toEqual([]);
    expect(() => childLocalUnenrolledSeedV2Bytes(value)).not.toThrow();
    expect(get).not.toHaveBeenCalled();
    const extended: unknown[] = []; Object.defineProperty(extended, "approved", { value: true });
    value.registry.profiles = extended;
    expect(decodeChildLocalUnenrolledSeedV2(value, policy())).toBeNull();
  });
  it("checks the real registry digest instead of trusting a structurally valid checksum", async () => {
    const value = await plain(); value.registryChecksum = "f".repeat(64);
    expect(decodeChildLocalUnenrolledSeedV2(value, policy())).not.toBeNull();
    expect(await verifyChildLocalUnenrolledSeedV2Bytes(encode(value), policy(), digest)).toBeNull();
  });
  it.each(["padding", "bom", "duplicate", "order", "escape", "utf8", "oversize"])(
    "rejects noncanonical $0 wire bytes before a digest can manufacture validity", async kind => {
      const value = await plain(), text = JSON.stringify(value); let bytes = new TextEncoder().encode(text);
      if (kind === "padding") bytes = new TextEncoder().encode(" " + text);
      if (kind === "bom") bytes = new TextEncoder().encode("\ufeff" + text);
      if (kind === "duplicate") bytes = new TextEncoder().encode(text.replace('"revision":1', '"revision":1,"revision":1'));
      if (kind === "order") bytes = new TextEncoder().encode(text.replace('"schemaVersion":2,"revision":1', '"revision":1,"schemaVersion":2'));
      if (kind === "escape") bytes = new TextEncoder().encode(text.replace("synthetic-local-v2", "synthetic-\\u006cocal-v2"));
      if (kind === "utf8") bytes = new Uint8Array([255]);
      if (kind === "oversize") bytes = new Uint8Array(CHILD_LOCAL_SEED_V2_MAX_BYTES + 1);
      const sha256 = vi.fn(digest.sha256);
      expect(await verifyChildLocalUnenrolledSeedV2Bytes(bytes, policy(), { sha256 })).toBeNull(); expect(sha256).not.toHaveBeenCalled();
    });
  it("detaches byte/ policy inputs before async work and refuses shared or extended buffers", async () => {
    const value = await plain(), bytes = encode(value), p = policy(); let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const pending = verifyChildLocalUnenrolledSeedV2Bytes(bytes, p, { async sha256(input) { await barrier; return digest.sha256(input); } });
    bytes.fill(0); p.version = "changed"; release(); expect((await pending)?.registry.policyVersion).toBe(vectors[0].version);
    const extended = encode(value); Object.defineProperty(extended, "approved", { value: true });
    expect(await verifyChildLocalUnenrolledSeedV2Bytes(extended, policy(), digest)).toBeNull();
    expect(await verifyChildLocalUnenrolledSeedV2Bytes(new Uint8Array(new SharedArrayBuffer(32)), policy(), digest)).toBeNull();
  });
  it("denies failed/uncertain digests and serialization of an unchecked projection", async () => {
    expect(await createChildLocalUnenrolledSeedV2(policy(), { async sha256() { throw new Error("unavailable"); } })).toBeNull();
    expect(await createChildLocalUnenrolledSeedV2(policy(), { async sha256() { return "approved"; } })).toBeNull();
    const unchecked = { ...await plain(), pin: {} };
    expect(() => childLocalUnenrolledSeedV2Bytes(unchecked)).toThrow();
  });
});
