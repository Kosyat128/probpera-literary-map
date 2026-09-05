import { open } from "node:fs/promises";
import { createReaderDeletionProcessor, deletionUuid, validateReaderDeletionPolicy, type ReaderDeletionServices, type ReaderDeletionResult } from "./deletionProcessor";
import { createSupabaseReaderDeletionServices } from "./deletionProcessorSupabase";

export type DeletionCommandResult = { mode: "dry-run" | "execute"; status: ReaderDeletionResult["status"] | "dry-run" | "invalid-command";
  codes: string[]; requestId: string | null; policyVersion: string | null };

/** Flat string-only JSON rejects duplicate (including escaped) policy keys. */
export function parseReaderDeletionPolicyFile(source: string) {
  if (new TextEncoder().encode(source).byteLength > 4096) throw new Error("Invalid policy file");
  let cursor = 0;
  const skip = () => { while (/[\t\r\n ]/u.test(source[cursor] ?? "x")) cursor++; };
  const string = () => {
    skip(); const match = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/u.exec(source.slice(cursor));
    if (!match) throw new Error("Invalid policy file"); cursor += match[0].length; return JSON.parse(match[0]) as string;
  };
  const value: Record<string, string> = Object.create(null);
  skip(); if (source[cursor++] !== "{") throw new Error("Invalid policy file"); skip();
  if (source[cursor] !== "}") while (true) {
    const key = string(); skip(); if (Object.hasOwn(value, key) || source[cursor++] !== ":") throw new Error("Invalid policy file");
    value[key] = string(); skip(); if (source[cursor] !== ",") break; cursor++;
  }
  if (source[cursor++] !== "}") throw new Error("Invalid policy file"); skip();
  if (cursor !== source.length) throw new Error("Invalid policy file");
  return validateReaderDeletionPolicy(value);
}
async function readPolicy(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 4096) throw new Error("Invalid policy file");
    const bytes = Buffer.alloc(4097);
    let read = 0;
    while (read < bytes.length) {
      const result = await handle.read(bytes, read, bytes.length - read, read);
      if (!result.bytesRead) break; read += result.bytesRead;
    }
    if (read > 4096) throw new Error("Invalid policy file");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, read));
  } finally { await handle.close(); }
}

/** No public route/scheduler. Caller must separately authorize any real execution. */
export async function runReaderDeletionCommand(args: string[], environment: Record<string, string | undefined>, ports?: {
  readPolicyFile?: (path: string) => Promise<string>;
  createServices?: (config: { canonicalProjectUrl: string; serviceRoleKey: string }) => ReaderDeletionServices;
}): Promise<DeletionCommandResult> {
  let execute = false;
  let requestId: string | null = null;
  let policyVersion: string | null = null;
  try {
    let policyPath: string | null = null;
    let timeoutSeconds = 120;
    const seen = new Set<string>();
    for (let index = 0; index < args.length; index++) {
      const key = args[index];
      if (!["--execute", "--request-id", "--policy", "--timeout-seconds"].includes(key) || seen.has(key)) throw new Error("Invalid arguments");
      seen.add(key);
      if (key === "--execute") { execute = true; continue; }
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error("Missing argument");
      if (key === "--request-id") { if (!deletionUuid.test(value)) throw new Error("Invalid request"); requestId = value; }
      if (key === "--policy") { if (value.length > 4096 || /[\u0000-\u001f]/u.test(value)) throw new Error("Invalid policy path"); policyPath = value; }
      if (key === "--timeout-seconds") { if (!/^[1-9][0-9]{0,2}$/u.test(value) || +value > 300) throw new Error("Invalid timeout"); timeoutSeconds = +value; }
    }
    const policy = policyPath ? parseReaderDeletionPolicyFile(await (ports?.readPolicyFile ?? readPolicy)(policyPath)) : null;
    policyVersion = policy?.version ?? null;
    if (!execute) return { mode: "dry-run", status: "dry-run", codes: ["no-transport-or-mutations"], requestId, policyVersion };
    if (!requestId || !policy || !environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Execution configuration required");
    // The SDK factory validates the canonical HTTPS origin before any transport.
    const services = (ports?.createServices ?? createSupabaseReaderDeletionServices)({ canonicalProjectUrl: environment.SUPABASE_URL, serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY });
    const processor = createReaderDeletionProcessor({ services, policy,
      leaseSeconds: Math.min(600, timeoutSeconds + 30), maxStorageBatches: 3 });
    const result = await processor.process(requestId, AbortSignal.timeout(timeoutSeconds * 1000));
    return { mode: "execute", ...result, requestId, policyVersion };
  } catch {
    // Never reflect parser paths, credentials, server errors or account data.
    return { mode: execute ? "execute" : "dry-run", status: "invalid-command", codes: ["invalid-command-or-configuration"], requestId: null, policyVersion: null };
  }
}
