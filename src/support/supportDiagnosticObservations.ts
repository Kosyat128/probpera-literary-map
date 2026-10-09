import type { ContentStorageSpace } from "../planet/ContentDownloads";
import type { PwaStorageStatusSnapshot } from "../pwa/PwaStorageStatus";
import type { PwaOfflineReadinessResult, PwaOfflineRepairResult, PwaWorkerSnapshot } from "../pwa/registerPwaWorker";
import type { DiagnosticCategory, DiagnosticOperation, DiagnosticStorage, DiagnosticStorageBucket,
  PwaDiagnosticObservation } from "./supportDiagnostics";
import { SUPPORT_DIAGNOSTIC_CATEGORIES } from "./supportDiagnostics";

const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
export function supportStorageBucket(bytes: unknown): DiagnosticStorageBucket | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0 || bytes > Number.MAX_SAFE_INTEGER) return null;
  return bytes < 100 * 1024 ** 2 ? "under-100-mib" : bytes < 1024 ** 3 ? "100-mib-to-1-gib"
    : bytes < 5 * 1024 ** 3 ? "1-to-5-gib" : "at-least-5-gib";
}
export function observeNativeDiagnosticStorage(space: ContentStorageSpace): DiagnosticStorage | null {
  const bucket = space.phase === "ready" ? supportStorageBucket(space.availableBytes) : null;
  return bucket && (space.kind === "device" || space.kind === "browser-estimate")
    ? { bucket, scope: space.kind === "device" ? "device" : "browser-origin" } : null;
}
function operation(result: PwaOfflineReadinessResult | PwaOfflineRepairResult | null): DiagnosticOperation | null {
  if (!result) return null;
  if (result.status === "complete") return { status: "complete", category: null };
  const reason = "reason" in result ? result.reason : null;
  if (reason !== null && (typeof reason !== "string" || !(SUPPORT_DIAGNOSTIC_CATEGORIES as readonly string[]).includes(reason))) return null;
  const category = reason as DiagnosticCategory | null;
  return { status: result.status, category };
}
/** Reads observations already owned by the device panel. Never starts a check, repair or estimate. */
export function observePwaDiagnostics(worker: PwaWorkerSnapshot, check: PwaOfflineReadinessResult | null,
  repair: PwaOfflineRepairResult | null, storage: PwaStorageStatusSnapshot): PwaDiagnosticObservation {
  const engineBuildId = hash(worker.engineBuildId) ? worker.engineBuildId : null;
  const activeBuildId = hash(worker.activeBuildId) ? worker.activeBuildId : null;
  const current = (result: PwaOfflineReadinessResult | PwaOfflineRepairResult | null) => {
    if (!result) return null;
    if (result.status === "unavailable") return result;
    return engineBuildId !== null && activeBuildId !== null
      && result.engineBuildId === engineBuildId && result.activeBuildId === activeBuildId ? result : null;
  };
  const bucket = storage.busy === null && !storage.error && typeof storage.quota === "number"
    && typeof storage.usage === "number" && Number.isFinite(storage.quota) && Number.isFinite(storage.usage)
    && storage.quota >= storage.usage && storage.usage >= 0
    ? supportStorageBucket(storage.quota - storage.usage) : null;
  return { engineBuildId, activeBuildId, integrity: operation(current(check)), repair: operation(current(repair)),
    storage: bucket ? { bucket, scope: "browser-origin" } : null };
}
