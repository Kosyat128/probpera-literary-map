/** Byte persistence only; never owns catalog facts, locale or entitlements. */
export interface ContentPackageStorage {
  open(name: string): Promise<{ put(url: string, response: Response): Promise<void> }>;
  match(url: string, options: { cacheName: string }): Promise<Response | undefined>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
  /** Native stores additionally compare the old pointer and recheck the entire
   * candidate in their serial IO queue before atomically replacing selection. */
  commitSelection?(input: {
    name: string; url: string; expectedSha256: string | null; json: string;
    candidate: { name: string; entries: readonly { url: string; bytes: number; sha256: string }[] };
  }): Promise<boolean>;
}
export interface ContentPackageLocks {
  request<T>(name: string, options: { mode: "exclusive"; signal?: AbortSignal }, operation: () => Promise<T>): Promise<T>;
}
