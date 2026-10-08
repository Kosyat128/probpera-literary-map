import { childRecord } from "./childPackage";

export const CHILD_NATIVE_EXPORT_MAX_BYTES = 4 * 1024 * 1024;
export interface ChildNativeExportReceipt {
  readonly requestId: string; readonly profileId: string; readonly schemaVersion: 1;
  readonly sha256: string | null; readonly bytes: number;
  readonly outcome: "saved" | "cancelled" | "error";
}
/** Local presentation observation only. A save receipt never admits a child
 * context, content, rights, clock or reusable Parent Gate capability. */
export interface ChildNativeExportState {
  readonly phase: "idle" | "saving" | "complete" | "unavailable";
  readonly receipt: ChildNativeExportReceipt | null;
}
export const CHILD_NATIVE_EXPORT_IDLE: ChildNativeExportState = Object.freeze({ phase: "idle", receipt: null });
const requestId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{32}$/u.test(v);
export const childNativeExportProfileId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);

/** Exact native-owned result; no filename, URI, data bytes, secret or context
 * token crosses the presentation boundary. Reject accessors and extra fields. */
export function decodeChildNativeExportReceipt(value: unknown, expectedRequestId: string, expectedProfileId: string): ChildNativeExportReceipt | null {
  try {
    if (!requestId(expectedRequestId) || !childNativeExportProfileId(expectedProfileId)) return null;
    const row = childRecord(value, ["requestId", "profileId", "schemaVersion", "sha256", "bytes", "outcome"]);
    if (!row || row.requestId !== expectedRequestId || row.profileId !== expectedProfileId || row.schemaVersion !== 1
      || !["saved", "cancelled", "error"].includes(row.outcome as string)
      || typeof row.bytes !== "number" || !Number.isSafeInteger(row.bytes) || Object.is(row.bytes, -0)
      || row.bytes < 0 || row.bytes > CHILD_NATIVE_EXPORT_MAX_BYTES) return null;
    const captured = row.bytes > 0 && hash(row.sha256), absent = row.bytes === 0 && row.sha256 === null;
    if (!captured && !absent || row.outcome === "saved" && !captured) return null;
    return Object.freeze({ requestId: expectedRequestId, profileId: expectedProfileId, schemaVersion: 1,
      sha256: row.sha256 as string | null, bytes: row.bytes, outcome: row.outcome as ChildNativeExportReceipt["outcome"] });
  } catch { return null; }
}
export function decodeChildNativeExportReply(value: unknown, expectedRequestId: string, expectedProfileId: string): ChildNativeExportReceipt | null {
  try {
    const row = childRecord(value, ["version", "requestId", "status", "receipt"]);
    return row && row.version === 2 && row.requestId === expectedRequestId && row.status === "export"
      ? decodeChildNativeExportReceipt(row.receipt, expectedRequestId, expectedProfileId) : null;
  } catch { return null; }
}
