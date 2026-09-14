import { contentPackageHash, CONTENT_PACKAGE_MAX_FILE_BYTES } from "../planet/contentPackageProtocol.mjs";
import type { ContentPackageLocks, ContentPackageStorage } from "../planet/contentPackageStorage";

/** Internal identifiers only. No native method accepts an arbitrary file path. */
export interface NativeContentStoreBridge {
  read(input: { name: string; key: string }): Promise<{ base64: string | null }>;
  write(input: { name: string; key: string; base64: string }): Promise<void>;
  list(): Promise<{ names: string[] }>;
  remove(input: { name: string }): Promise<{ removed: boolean }>;
  commit(input: { name: string; key: string; expectedSha256: string | null; json: string;
    candidate: { name: string; entries: { key: string; bytes: number; sha256: string }[] } }): Promise<{ committed: boolean }>;
}
export const NATIVE_CONTENT_ORIGIN = "https://localhost"; // Logical keys only, never a network/runtime URL.
const scope = /^literary-planet-content-qa-v1-[a-f0-9]{64}$/u;
const generation = /^literary-planet-content-qa-v1-[a-f0-9]{64}-[a-f0-9]{64}$/u;
const valid = (name: string) => { if (!scope.test(name) && !generation.test(name)) throw new Error("invalid-native-content-name"); return name; };
const key = (url: string) => {
  if (!url.startsWith(NATIVE_CONTENT_ORIGIN + "/__literary_content_qa__/")) throw new Error("invalid-native-content-url");
  return contentPackageHash(url);
};
function encode(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
function decode(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof base64 !== "string" || base64.length > Math.ceil(CONTENT_PACKAGE_MAX_FILE_BYTES / 3) * 4
    || base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(base64) || !/^[^=]*={0,2}$/u.test(base64)) throw new Error("native-content-byte-limit");
  const binary = atob(base64);
  if (!binary.length || binary.length > CONTENT_PACKAGE_MAX_FILE_BYTES) throw new Error("native-content-byte-limit");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createNativeContentStorage(bridge: NativeContentStoreBridge): ContentPackageStorage {
  return Object.freeze({
    async open(name: string) {
      valid(name);
      return { async put(url: string, response: Response) {
        if (!generation.test(name) || response.status !== 200) throw new Error("native-content-write-rejected");
        // Shared verifier has already bounded every body. Check again at the bridge.
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length || bytes.length > CONTENT_PACKAGE_MAX_FILE_BYTES) throw new Error("native-content-byte-limit");
        await bridge.write({ name, key: key(url), base64: encode(bytes) });
      } };
    },
    async match(url: string, { cacheName }: { cacheName: string }) {
      const value = await bridge.read({ name: valid(cacheName), key: key(url) });
      return value.base64 === null ? undefined : new Response(decode(value.base64), { headers: { "Content-Type": "application/json" } });
    },
    async keys() { const value = await bridge.list(); return value.names.map(valid); },
    async delete(name: string) {
      if (!generation.test(name)) throw new Error("native-content-delete-rejected");
      return (await bridge.remove({ name })).removed;
    },
    async commitSelection(input: Parameters<NonNullable<ContentPackageStorage["commitSelection"]>>[0]) {
      if (!scope.test(input.name) || !generation.test(input.candidate.name)) throw new Error("native-content-commit-rejected");
      return (await bridge.commit({ name: input.name, key: key(input.url), expectedSha256: input.expectedSha256, json: input.json,
        candidate: { name: input.candidate.name, entries: input.candidate.entries.map(entry => ({ key: key(entry.url), bytes: entry.bytes, sha256: entry.sha256 })) } })).committed;
    },
  });
}

/** One native JS host only. The native serial queue, protected pruning and atomic
 * CAS provide the final guard across host recreation; this is not a Web fallback. */
export function createNativeContentLocks(): ContentPackageLocks {
  const tails = new Map<string, Promise<void>>();
  return { request<T>(name: string, options: { mode: "exclusive"; signal?: AbortSignal }, operation: () => Promise<T>): Promise<T> {
    if (options.signal?.aborted) return Promise.reject(new Error("cancelled"));
    const before = tails.get(name) ?? Promise.resolve();
    let release!: () => void;
    const tail = before.then(() => new Promise<void>(resolve => { release = resolve; }));
    tails.set(name, tail);
    return new Promise<T>((resolve, reject) => {
      let started = false;
      const abort = () => { if (!started) reject(new Error("cancelled")); };
      options.signal?.addEventListener("abort", abort, { once: true });
      // The tail stays occupied until active IO settles, even after cancellation.
      void before.then(async () => {
        started = true;
        options.signal?.removeEventListener("abort", abort);
        try { if (options.signal?.aborted) throw new Error("cancelled"); resolve(await operation()); }
        catch (error) { reject(error); }
        finally { release(); if (tails.get(name) === tail) tails.delete(name); }
      });
    });
  } };
}
