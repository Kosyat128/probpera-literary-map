import { createContext, useContext, useEffect, useId, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useInterfaceLanguage } from "../planet/localization";
import { usePlatformSnapshot } from "../platform/PlatformServices";
import type { PlatformSnapshot } from "../platform/ports";
import { canonicalJournalOrigin } from "../platform/distribution";
import type { WebLicenseClient, WebLicenseDenial, WebLicenseResult } from "../platform/adapters/web/WebLicense";
import { pwaCopy, type PwaAccessCopy } from "./pwaCopy";
import InterfaceLanguageControl from "../components/InterfaceLanguageControl";
import { planetAccountCopy } from "./accountCopy";
import { RecentHistoryProvider } from "../planet/RecentHistory";
import { createWebRecentHistory } from "../platform/adapters/web/WebRecentHistory";
import { ProductNoticeHost, ProductNoticeSlot } from "../host/ProductNoticeHost";
import type { PwaOfflineRepairAccess } from "./registerPwaWorker";

const RepairAccess = createContext<PwaOfflineRepairAccess | null>(null);
export const usePwaOfflineRepairAccess = () => useContext(RepairAccess);

type AuthorizedGrant = Extract<WebLicenseResult, { status: "authorized" }>;
type AccessMode = "online" | "offline";
export interface PwaAccessSnapshot {
  readonly grant: AuthorizedGrant | null;
  /** Source of the current proof, never a claim about network reachability. */
  readonly verificationSource: "server" | "saved" | null;
  readonly checking: boolean;
  readonly reason: WebLicenseDenial | null;
  readonly observedAt: number;
}
const serverSnapshot: PwaAccessSnapshot = Object.freeze({ grant: null, verificationSource: null, checking: false, reason: "not-checked", observedAt: 0 });
const getServerSnapshot = () => serverSnapshot;
const environmentMode = (environment: PlatformSnapshot): AccessMode => environment.connectivity === "offline" ? "offline" : "online";
const transportFailure = (reason: WebLicenseDenial) => ["network-unavailable", "timeout"].includes(reason);
const missingOfflineProof = (reason: WebLicenseDenial) => ["no-cached-grant", "cache-unavailable", "network-unavailable", "timeout"].includes(reason);

/** Reuses a verified assertion; this function never verifies or invents one. */
export function pwaAccessDeadline(grant: AuthorizedGrant | null, mode: AccessMode, milliseconds: number): number | null {
  if (!grant || !Number.isFinite(milliseconds)) return null;
  const now = Math.floor(milliseconds / 1000);
  const deadline = Math.min(grant.validUntil, grant.claims.exp, mode === "offline" ? grant.claims.offlineUntil : Infinity);
  if (!Number.isSafeInteger(deadline) || !Number.isSafeInteger(grant.claims.iat) || !Number.isSafeInteger(grant.claims.nbf)
    || grant.claims.status !== "active" || now < grant.claims.iat || now < grant.claims.nbf || now >= deadline) return null;
  return deadline;
}

/** Independent of React and locale; one controller belongs to one client identity. */
export function createPwaAccessController(client: WebLicenseClient | null) {
  let snapshot = serverSnapshot;
  let environment: PlatformSnapshot = { connectivity: "unknown", visibility: "active" };
  let running = false;
  let generation = 0;
  let pending: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let highWater = 0;
  const listeners = new Set<() => void>();
  function now() {
    const value = Date.now();
    if (!Number.isFinite(value) || value < highWater) return NaN;
    highWater = value;
    return value;
  }
  function schedule() {
    clearTimeout(timer);
    timer = undefined;
    if (!running || !snapshot.grant) return;
    const time = now();
    const deadline = pwaAccessDeadline(snapshot.grant, environmentMode(environment), time);
    const delay = deadline === null ? 0 : Math.min(2_147_000_000, Math.max(0, deadline * 1000 - time));
    timer = setTimeout(() => {
      const time = now();
      if (pwaAccessDeadline(snapshot.grant, environmentMode(environment), time) !== null) { schedule(); return; }
      publish(null, false, Number.isFinite(time) ? (environmentMode(environment) === "offline" ? "offline-expired" : "expired") : "clock-skew");
      if (environment.visibility === "active") void refresh();
    }, delay);
  }
  function publish(grant: AuthorizedGrant | null, checking: boolean, reason: WebLicenseDenial | null,
    verificationSource: PwaAccessSnapshot["verificationSource"] = snapshot.verificationSource) {
    const time = now();
    if (!Number.isFinite(time)) { grant = null; reason = "clock-skew"; }
    if (grant && pwaAccessDeadline(grant, environmentMode(environment), time) === null) {
      grant = null;
      reason = environmentMode(environment) === "offline" ? "offline-expired" : "expired";
    }
    snapshot = Object.freeze({ grant, verificationSource: grant ? verificationSource : null, checking, reason, observedAt: highWater });
    schedule();
    for (const listener of [...listeners]) listener();
  }
  function retainedOfflineGrant(grant: AuthorizedGrant | null): AuthorizedGrant | null {
    const deadline = pwaAccessDeadline(grant, "offline", now());
    return grant && deadline !== null ? Object.freeze({ ...grant, validUntil: deadline }) : null;
  }
  async function refresh(): Promise<void> {
    if (!running) return;
    const id = ++generation;
    pending?.abort();
    pending = new AbortController();
    const signal = pending.signal;
    const active = () => running && id === generation && !signal.aborted;
    if (!client) { publish(null, false, "unconfigured"); return; }
    const mode = environmentMode(environment);
    let verificationSource: PwaAccessSnapshot["verificationSource"] = mode === "online" ? "server" : "saved";
    let prior = snapshot.grant;
    publish(prior, true, null);
    prior = snapshot.grant;
    try {
      let result = await client.check({ mode, signal });
      if (!active()) return;
      if (mode === "online" && result.status === "denied" && transportFailure(result.reason)) {
        // A failed network check narrows an existing assertion to its signed
        // offline window before a separately verified offline cache attempt.
        prior = retainedOfflineGrant(prior);
        publish(prior, true, result.reason, "saved");
        verificationSource = "saved";
        result = await client.check({ mode: "offline", signal });
        if (!active()) return;
      }
      if (result.status === "authorized") publish(result, false, null, verificationSource);
      else if (missingOfflineProof(result.reason)) publish(retainedOfflineGrant(prior), false, result.reason, "saved");
      else publish(null, false, result.reason);
    } catch {
      if (active()) publish(retainedOfflineGrant(prior), false, "network-unavailable", "saved");
    } finally {
      if (id === generation) pending = null;
    }
  }
  return Object.freeze({
    // Reuse the same clock high-water and verified-grant policy as rendering.
    // This capability controls an explicit public-cache operation, not access.
    getDeadline() {
      if (!running) return null;
      const deadline = pwaAccessDeadline(snapshot.grant, environmentMode(environment), now());
      return deadline === null ? null : deadline * 1000;
    },
    getSnapshot: () => snapshot,
    getServerSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(next: PlatformSnapshot) { running = true; environment = next; return refresh(); },
    updateEnvironment(next: PlatformSnapshot) {
      const changedMode = environmentMode(next) !== environmentMode(environment);
      const becameVisible = next.visibility === "active" && environment.visibility !== "active";
      environment = next;
      if (!running) return Promise.resolve();
      if (changedMode || becameVisible) return refresh();
      return Promise.resolve();
    },
    refresh,
    stop() { running = false; ++generation; pending?.abort(); pending = null; clearTimeout(timer); timer = undefined;
      if (snapshot.grant) for (const listener of [...listeners]) listener(); },
  });
}

export function pwaAccessMessage(copy: PwaAccessCopy, reason: WebLicenseDenial | null): string {
  if (reason === "unconfigured" || reason === "invalid-context" || reason === "crypto-unavailable") return copy.preparing;
  if (reason === "expired" || reason === "offline-expired") return copy.expired;
  if (reason === "revoked" || reason === "refunded") return copy.revoked;
  if (reason === "clock-skew" || reason === "not-yet-valid") return copy.clock;
  if (reason === "no-cached-grant") return copy.offline;
  if (reason === "cache-unavailable") return copy.storage;
  if (reason === "network-unavailable" || reason === "timeout") return copy.network;
  return copy.denied;
}

export interface PwaAccessVerificationNotice {
  readonly checking: boolean;
  readonly source: PwaAccessSnapshot["verificationSource"];
  readonly text: string;
}

export interface PwaAccessBoundaryProps {
  readonly client: WebLicenseClient | null;
  readonly children: ReactNode;
  readonly closedHelp?: ReactNode;
  readonly connectivityNotice?: (notice: PwaAccessVerificationNotice | null) => ReactNode;
  readonly bootstrapStatus?: { readonly checking: boolean; readonly reason: WebLicenseDenial | null };
  readonly onBootstrapRetry?: () => void;
}

/** Preparation/QA boundary. Identity/client creation and release copy review are external. */
export default function PwaAccessBoundary({ client, children, bootstrapStatus, onBootstrapRetry, closedHelp, connectivityNotice }: PwaAccessBoundaryProps) {
  const { language, t } = useInterfaceLanguage();
  const { connectivity, visibility } = usePlatformSnapshot();
  const controller = useMemo(() => createPwaAccessController(client), [client]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const claims = snapshot.grant?.claims;
  const recentStore = useMemo(() => claims ? createWebRecentHistory({ issuer: claims.iss, audience: claims.aud, product: claims.product, subject: claims.sub }) : null,
    [claims?.iss, claims?.aud, claims?.product, claims?.sub]);
  useEffect(() => {
    void controller.start({ connectivity, visibility });
    return () => controller.stop();
    // Locale and platform changes must not recreate the identity-bound controller.
    // The effect below delivers subsequent platform events to that same instance.
  }, [controller]);
  useEffect(() => { void controller.updateEnvironment({ connectivity, visibility }); }, [controller, connectivity, visibility]);
  const mode = environmentMode({ connectivity, visibility });
  const time = Date.now();
  // Background tabs can throttle timers. Render never uses a stale authorization
  // merely because the expiry callback has not run yet.
  const authorized = time >= snapshot.observedAt && pwaAccessDeadline(snapshot.grant, mode, time) !== null;
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const wasAuthorized = useRef(false);
  useEffect(() => {
    if (!authorized && wasAuthorized.current) heading.current?.focus();
    wasAuthorized.current = authorized;
  }, [authorized]);
  const copy = pwaCopy.locales[language];
  const accountCopy = planetAccountCopy.locales[language];
  const returnTo = typeof window === "undefined" ? `/planet/${language}/` : window.location.pathname + window.location.search + window.location.hash;
  const accountQuery = "?returnTo=" + encodeURIComponent(returnTo);
  const reason = client ? snapshot.reason : bootstrapStatus?.reason ?? "unconfigured";
  const checking = client ? snapshot.checking || snapshot.reason === "not-checked" : bootstrapStatus?.checking === true;
  const verificationNotice: PwaAccessVerificationNotice | null = authorized && (snapshot.checking || snapshot.verificationSource === "saved")
    ? { checking: snapshot.checking, source: snapshot.verificationSource, text: snapshot.checking ? copy.checking : copy.savedVerification } : null;
  return (
    <ProductNoticeHost notices={
      <div className="pwa-notices">
        {connectivityNotice ? connectivityNotice(verificationNotice) : verificationNotice ? (
          <div key="refresh" className="pwa-access__refresh" role="status" aria-live="polite" aria-atomic="true"
            data-pwa-access-verification={verificationNotice.source ?? undefined}>
            {verificationNotice.text}
          </div>
        ) : null}
      </div>
    }>
      {authorized && recentStore ? <RepairAccess.Provider key="experience" value={controller}><RecentHistoryProvider store={recentStore}><div className="pwa-access__content" data-pwa-authorized="">{children}</div></RecentHistoryProvider></RepairAccess.Provider> : null}
      {!authorized ? (
        <main key="access" className="pwa-access app-error" aria-labelledby={headingId} data-pwa-access-state={checking ? "checking" : "closed"}>
          <InterfaceLanguageControl />
          <span>{t("Литературная планета")}</span>
          <h1 ref={heading} id={headingId} tabIndex={-1}>{copy.heading}</h1>
          <p className="pwa-access__status" role="status" aria-live="polite" aria-atomic="true">
            {checking ? copy.checking : pwaAccessMessage(copy, reason)}
          </p>
          <div className="pwa-access__actions">
            {client || onBootstrapRetry ? <button type="button" disabled={checking} onClick={() => {
              if (client) void controller.refresh();
              else onBootstrapRetry?.();
            }}>{copy.retry}</button> : null}
            <a href={canonicalJournalOrigin + "/"}>{copy.journal}</a>
            <a href={`${canonicalJournalOrigin}/${language}/planet-account/${accountQuery}`}>{accountCopy.accessLink}</a>
            <a href={`${canonicalJournalOrigin}/${language}/delete-account/${accountQuery}`}>{accountCopy.deleteLink}</a>
          </div>
        </main>
      ) : null}
      {!authorized ? closedHelp : null}
      <ProductNoticeSlot placement="fallback" />
    </ProductNoticeHost>
  );
}
