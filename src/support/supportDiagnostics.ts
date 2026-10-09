/** Closed local support projection. No ambient reads, persistence, telemetry or raw text. */
export type DiagnosticSource = "platform-services" | "adult-canonical-selection" | "adult-graphics-policy"
  | "canonical-globe-lifecycle" | "pwa-worker" | "pwa-device-observation" | "adult-download-storage";
export type DiagnosticUnknownReason = "not-exposed" | "not-observed";
export type DiagnosticValue<T> = Readonly<{ status: "observed"; source: DiagnosticSource; value: T }>
  | Readonly<{ status: "unknown"; reason: DiagnosticUnknownReason }>;
export type DiagnosticStorageBucket = "under-100-mib" | "100-mib-to-1-gib" | "1-to-5-gib" | "at-least-5-gib";
export type DiagnosticStorage = Readonly<{ bucket: DiagnosticStorageBucket; scope: "browser-origin" | "device" }>;
export type DiagnosticItems = Readonly<{
  scope: "globe-selection" | "settled-reader" | "none";
  countryId: string | null; writerId: string | null; workId: string | null;
}>;
export type DiagnosticWebgl = Readonly<{ lossCount: number; restorationCount: number }>;
export const SUPPORT_DIAGNOSTIC_CATEGORIES = [
  "unsupported", "invalid-configuration", "registration-failed", "update-failed", "message-failed",
  "timeout", "cancelled", "disposed", "not-ready", "busy", "worker-changed", "rejected",
  "reload-failed", "multiple-clients", "access-required", "missing-manifest",
  "network-or-integrity", "storage", "verification-failed",
] as const;
export type DiagnosticCategory = typeof SUPPORT_DIAGNOSTIC_CATEGORIES[number];
export type DiagnosticOperation = Readonly<{
  status: "complete" | "incomplete" | "unavailable"; category: DiagnosticCategory | null;
}>;
export type PwaDiagnosticObservation = Readonly<{
  engineBuildId: string | null; activeBuildId: string | null;
  integrity: DiagnosticOperation | null; repair: DiagnosticOperation | null;
  storage: DiagnosticStorage | null;
}>;
export type SupportDiagnosticInput = Readonly<{
  platform: "web" | "android" | "ios"; graphicsTier: "high" | "balanced" | "economy" | null;
  activeItems: DiagnosticItems | null; webgl: DiagnosticWebgl | null;
  pwa: PwaDiagnosticObservation | null; nativeStorage: DiagnosticStorage | null;
}>;
/** Trusted current application catalog, never storage, a URL, a child DTO or an import candidate. */
export type DiagnosticCatalog = Readonly<{
  countries: readonly Readonly<{ id: string; writers: readonly Readonly<{ id: string }>[] }>[];
  books: readonly Readonly<{ id: string; countryId: string; writerId: string }>[];
}>;
export type SupportDiagnosticReport = Readonly<{
  versions: Readonly<{ app: DiagnosticValue<never>; build: DiagnosticValue<string>;
    content: DiagnosticValue<Readonly<{ scope: "pwa-base-build"; buildId: string }>> }>;
  environment: Readonly<{ platform: DiagnosticValue<"web" | "android" | "ios">;
    os: DiagnosticValue<never>; deviceClass: DiagnosticValue<never> }>;
  graphicsTier: DiagnosticValue<"high" | "balanced" | "economy">;
  activeItems: DiagnosticValue<DiagnosticItems>;
  lastTransfer: Readonly<{ update: DiagnosticValue<never>;
    baseRepair: DiagnosticValue<DiagnosticOperation>; otherDownloads: DiagnosticValue<never> }>;
  webglRecovery: DiagnosticValue<DiagnosticWebgl>;
  store: Readonly<{ provider: DiagnosticValue<never>; errorCategory: DiagnosticValue<never> }>;
  availableStorage: DiagnosticValue<DiagnosticStorage>;
  integrity: DiagnosticValue<Readonly<{ scope: "last-observed-pwa-base-check"; result: DiagnosticOperation }>>;
  correlationIds: DiagnosticValue<never>;
}>;

const buckets: readonly string[] = ["under-100-mib", "100-mib-to-1-gib", "1-to-5-gib", "at-least-5-gib"];
const categories: readonly string[] = SUPPORT_DIAGNOSTIC_CATEGORIES;
const unknown = (reason: DiagnosticUnknownReason = "not-exposed"): DiagnosticValue<never> => ({ status: "unknown", reason });
const observed = <T>(source: DiagnosticSource, value: T): DiagnosticValue<T> => ({ status: "observed", source, value });
const oneOf = (value: unknown, choices: readonly string[]): value is string => typeof value === "string" && choices.includes(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[\p{L}\p{N}][\p{L}\p{N}_.:-]{0,159}$/u.test(value);
const counter = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && value <= 1_000_000_000 && !Object.is(value, -0);
/** Reject extra/symbol keys and accessors without invoking them. Throwing proxies fail closed.
 * JavaScript cannot identify every transparent Proxy; only copied validated data leaves this function. */
function record(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) return null;
  const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const field = descriptors[key];
    if (!field || !Object.prototype.hasOwnProperty.call(field, "value")) return null;
    copy[key] = field.value;
  }
  return copy;
}
function operation(value: unknown): DiagnosticOperation | null {
  const row = record(value, ["status", "category"]);
  if (!row || !oneOf(row.status, ["complete", "incomplete", "unavailable"])
    || !(row.category === null || oneOf(row.category, categories))
    || row.status === "complete" && row.category !== null) return null;
  return { status: row.status as DiagnosticOperation["status"], category: row.category as DiagnosticCategory | null };
}
function storage(value: unknown): DiagnosticStorage | null {
  const row = record(value, ["bucket", "scope"]);
  return row && oneOf(row.bucket, buckets) && oneOf(row.scope, ["device", "browser-origin"])
    ? { bucket: row.bucket as DiagnosticStorageBucket, scope: row.scope as DiagnosticStorage["scope"] } : null;
}
function items(value: unknown, catalog: DiagnosticCatalog): DiagnosticItems | null {
  const row = record(value, ["scope", "countryId", "writerId", "workId"]);
  if (!row || !oneOf(row.scope, ["globe-selection", "settled-reader", "none"])
    || ![row.countryId, row.writerId, row.workId].every(value => value === null || id(value))) return null;
  if (row.scope === "none") return row.countryId === null && row.writerId === null && row.workId === null
    ? { scope: "none", countryId: null, writerId: null, workId: null } : null;
  const country = catalog.countries.find(entry => entry.id === row.countryId);
  if (!country || row.writerId !== null && !country.writers.some(entry => entry.id === row.writerId)) return null;
  if (row.scope === "globe-selection" && row.workId !== null) return null;
  if (row.scope === "settled-reader" && (row.writerId === null || row.workId === null
    || !catalog.books.some(entry => entry.id === row.workId && entry.countryId === country.id && entry.writerId === row.writerId))) return null;
  return { scope: row.scope as DiagnosticItems["scope"], countryId: country.id,
    writerId: row.writerId as string | null, workId: row.workId as string | null };
}

/** Exact ten field groups. Sources are assigned here, never accepted from input. */
export function projectSupportDiagnostics(raw: unknown, catalog: DiagnosticCatalog): SupportDiagnosticReport | null {
  try {
    const input = record(raw, ["platform", "graphicsTier", "activeItems", "webgl", "pwa", "nativeStorage"]);
    if (!input || !oneOf(input.platform, ["web", "android", "ios"])
      || !(input.graphicsTier === null || oneOf(input.graphicsTier, ["high", "balanced", "economy"]))) return null;
    const activeItems = input.activeItems === null ? null : items(input.activeItems, catalog);
    if (input.activeItems !== null && !activeItems) return null;
    let webgl: DiagnosticWebgl | null = null;
    if (input.webgl !== null) {
      const row = record(input.webgl, ["lossCount", "restorationCount"]);
      if (!row || !counter(row.lossCount) || !counter(row.restorationCount)) return null;
      webgl = { lossCount: row.lossCount, restorationCount: row.restorationCount };
    }
    const nativeStorage = input.nativeStorage === null ? null : storage(input.nativeStorage);
    if (input.nativeStorage !== null && !nativeStorage || input.platform === "web" && nativeStorage) return null;
    let pwa: PwaDiagnosticObservation | null = null;
    if (input.pwa !== null) {
      const row = record(input.pwa, ["engineBuildId", "activeBuildId", "integrity", "repair", "storage"]);
      if (!row || input.platform !== "web" || !(row.engineBuildId === null || hash(row.engineBuildId))
        || !(row.activeBuildId === null || hash(row.activeBuildId))) return null;
      const integrity = row.integrity === null ? null : operation(row.integrity);
      const repair = row.repair === null ? null : operation(row.repair);
      const space = row.storage === null ? null : storage(row.storage);
      if (row.integrity !== null && !integrity || row.repair !== null && !repair || row.storage !== null && !space
        || space && space.scope !== "browser-origin") return null;
      pwa = { engineBuildId: row.engineBuildId as string | null, activeBuildId: row.activeBuildId as string | null,
        integrity, repair, storage: space };
    }
    const availableStorage = pwa?.storage ?? nativeStorage;
    return {
      versions: { app: unknown(), build: pwa?.engineBuildId ? observed("pwa-worker", pwa.engineBuildId) : unknown("not-observed"),
        content: pwa?.activeBuildId ? observed("pwa-worker", { scope: "pwa-base-build", buildId: pwa.activeBuildId }) : unknown("not-observed") },
      environment: { platform: observed("platform-services", input.platform as SupportDiagnosticInput["platform"]),
        os: unknown(), deviceClass: unknown() },
      graphicsTier: input.graphicsTier === null ? unknown("not-observed")
        : observed("adult-graphics-policy", input.graphicsTier as NonNullable<SupportDiagnosticInput["graphicsTier"]>),
      activeItems: activeItems ? observed("adult-canonical-selection", activeItems) : unknown("not-observed"),
      lastTransfer: { update: unknown("not-observed"),
        baseRepair: pwa?.repair ? observed("pwa-device-observation", pwa.repair) : unknown("not-observed"),
        otherDownloads: unknown("not-observed") },
      webglRecovery: webgl ? observed("canonical-globe-lifecycle", webgl) : unknown("not-observed"),
      store: { provider: unknown(), errorCategory: unknown() },
      availableStorage: availableStorage ? observed(pwa?.storage ? "pwa-device-observation" : "adult-download-storage", availableStorage) : unknown("not-observed"),
      integrity: pwa?.integrity ? observed("pwa-device-observation", { scope: "last-observed-pwa-base-check", result: pwa.integrity }) : unknown("not-observed"),
      correlationIds: unknown(),
    };
  } catch { return null; }
}
