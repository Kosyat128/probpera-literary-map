import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "../community/AuthContext";
import { readerPrivacy } from "../community/readerPrivacy";
import { authActionCopy } from "../community/authAction";
import InterfaceLanguageControl from "../components/InterfaceLanguageControl";
import { useInterfaceLanguage, type InterfaceLanguage } from "../i18n/InterfaceLanguage";
import { setHeadMetadataValue, setMetadataAttribute } from "../i18n/headMetadata";
import { loadSupabaseClient } from "../lib/loadSupabaseClient";
import { canonicalJournalOrigin } from "../platform/distribution";
import SupportIntake from "../support/SupportIntake";
import { createPlanetAccountClient, PlanetAccountError, safePwaReturnPath, type PlanetAccountConfiguration, type PlanetAccountDeletionStatus } from "./accountAccess";
import { planetAccountCopy } from "./accountCopy";
import { planetAccountRoute, type PlanetAccountMode } from "./accountRoutes";
import { PlanetPasswordRecovery } from "./PlanetPasswordRecovery";
import { SandboxPaymentPanel } from "./SandboxPaymentPanel";
import "./account.css";

const CommunityHub = lazy(() => import("../community/CommunityHub"));
export { planetAccountRoute } from "./accountRoutes";
export type { PlanetAccountMode } from "./accountRoutes";
type AccountIdentity = { subject: string; token: string; scope?: object };
type AccountClient = ReturnType<typeof createPlanetAccountClient>;
type IdentityReader = () => AccountIdentity | null;
type DeletionView = { identity: AccountIdentity; phase: "loading" | "ready" | "error"; request: PlanetAccountDeletionStatus | null };

function routeName(mode: PlanetAccountMode) { return mode === "access" ? "planet-account" : "delete-account"; }
function assertCurrent(identity: AccountIdentity, current: IdentityReader, signal: AbortSignal) {
  const latest = current();
  if (signal.aborted || !latest || latest.subject !== identity.subject || latest.token !== identity.token || latest.scope !== identity.scope) {
    throw new PlanetAccountError("authentication");
  }
}

/** Reads the existing provider identity; never owns, decodes or persists auth. */
export async function bridgePlanetAccount(client: AccountClient, config: PlanetAccountConfiguration,
  identity: AccountIdentity, current: IdentityReader, signal: AbortSignal) {
  assertCurrent(identity, current, signal);
  const subject = await client.bridge(config, identity.token, signal);
  assertCurrent(identity, current, signal);
  if (subject !== identity.subject) throw new PlanetAccountError("denied");
}

export async function requestPlanetAccountDeletion(client: AccountClient, config: PlanetAccountConfiguration,
  identity: AccountIdentity, current: IdentityReader, requestId: string, consent: boolean, signal: AbortSignal) {
  if (!consent || !config.deletionDisclosure) throw new PlanetAccountError("denied");
  await bridgePlanetAccount(client, config, identity, current, signal);
  const receipt = await client.requestDeletion(config, identity.token, requestId, signal);
  assertCurrent(identity, current, signal);
  return receipt;
}

export async function readPlanetAccountDeletionStatus(client: AccountClient, config: PlanetAccountConfiguration,
  identity: AccountIdentity, current: IdentityReader, signal: AbortSignal) {
  assertCurrent(identity, current, signal);
  const status = await client.deletionStatus(config, identity.token, signal);
  assertCurrent(identity, current, signal);
  return status;
}

export function syncPlanetAccountMetadata(language: InterfaceLanguage, mode: PlanetAccountMode) {
  if (typeof window === "undefined" || planetAccountRoute(window.location.pathname) !== mode) return;
  const { document, history, location } = window;
  const copy = planetAccountCopy.locales[language];
  const name = routeName(mode); const route = `/${language}/${name}/`;
  const title = mode === "access" ? copy.access : copy.deletion;
  const description = mode === "access" ? copy.intro : copy.deletionIntro;
  const canonical = canonicalJournalOrigin + route;
  if (location.pathname !== route) history.replaceState(history.state, "", route + location.search + location.hash);
  setMetadataAttribute(document.documentElement, "lang", language);
  setMetadataAttribute(document.documentElement, "data-route-language", language);
  setMetadataAttribute(document.body, "lang", language);
  document.title = title;
  setHeadMetadataValue(document, "link", "rel", "canonical", "href", canonical);
  for (const locale of ["ru", "en"] as const) setHeadMetadataValue(document, "link", "hreflang", locale, "href", `${canonicalJournalOrigin}/${locale}/${name}/`);
  setHeadMetadataValue(document, "link", "hreflang", "x-default", "href", `${canonicalJournalOrigin}/`);
  for (const [key, value] of Object.entries({ description, robots: "noindex,nofollow", "twitter:card": "summary", "twitter:title": title, "twitter:description": description })) {
    setHeadMetadataValue(document, "meta", "name", key, "content", value);
  }
  for (const [key, value] of Object.entries({ "og:type": "website", "og:title": title, "og:description": description, "og:url": canonical,
    "og:locale": language === "ru" ? "ru_RU" : "en_US", "og:locale:alternate": language === "ru" ? "en_US" : "ru_RU",
    "og:site_name": language === "ru" ? "Проба Пера" : "Proba Pera" })) setHeadMetadataValue(document, "meta", "property", key, "content", value);
  const brand = language === "ru" ? "Проба Пера" : "Proba Pera";
  if (document.head.querySelector('meta[property="og:image"]')) setHeadMetadataValue(document, "meta", "property", "og:image:alt", "content", brand);
  if (document.head.querySelector('meta[name="twitter:image"]')) setHeadMetadataValue(document, "meta", "name", "twitter:image:alt", "content", brand);
  const nodes = [...document.head.querySelectorAll("script[data-planet-account-structured-data]")];
  const node = nodes.shift() ?? document.createElement("script"); nodes.forEach(value => value.remove());
  setMetadataAttribute(node, "type", "application/ld+json"); setMetadataAttribute(node, "data-planet-account-structured-data", "");
  node.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", "@id": canonical + "#webpage",
    url: canonical, name: title, description, inLanguage: language, isPartOf: { "@id": canonicalJournalOrigin + "/#website" } }).replace(/</gu, "\\u003c");
  if (!node.parentNode) document.head.appendChild(node);
}

export default function PlanetAccountPage({ mode }: { mode: PlanetAccountMode }) {
  const auth = useAuth(); const { language, t } = useInterfaceLanguage(); const copy = planetAccountCopy.locales[language];
  const authRef = useRef(auth); authRef.current = auth;
  const sandboxSession = auth.session;
  const sandboxCurrent = useCallback(() => authRef.current.session === sandboxSession, [sandboxSession]);
  const languageRef = useRef(language); languageRef.current = language;
  const currentIdentity: IdentityReader = () => {
    const { user, session } = authRef.current;
    return user && session?.access_token && session.user.id === user.id ? { subject: user.id, token: session.access_token, scope: session } : null;
  };
  const currentStatusIdentity: IdentityReader = () => currentIdentity() ?? authRef.current.deletionStatusIdentity;
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return createPlanetAccountClient({ origin: window.location.origin,
      allowLocalQa: __LITERARY_PLANET_LOCAL_QA__ && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) }); }
    catch { return null; }
  }, []);
  const [config, setConfig] = useState<PlanetAccountConfiguration | null>(null);
  const [loading, setLoading] = useState(true); const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<PlanetAccountError["reason"] | null>(null);
  const [consent, setConsent] = useState(false); const [modalOpen, setModalOpen] = useState(false);
  const [deletionView, setDeletionView] = useState<DeletionView | null>(null);
  const [statusReload, setStatusReload] = useState(0);
  const statusPending = useRef<AbortController | null>(null);
  const pending = useRef<AbortController | null>(null); const requestId = useRef<string | null>(null);
  const mounted = useRef(true);
  const modalPreviousToken = useRef<string | null>(null); const headingId = useId(); const disclosureId = useId();
  useEffect(() => { syncPlanetAccountMetadata(language, mode); }, [language, mode]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null); setConfig(null);
    if (!client) { setLoading(false); setError("unavailable"); return () => controller.abort(); }
    void client.configuration(controller.signal).then(value => {
      if (!controller.signal.aborted) setConfig(value);
    }).catch(() => { if (!controller.signal.aborted) setError("unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, reload]);
  useEffect(() => { setConsent(false); }, [config?.deletionDisclosure?.version]);
  useEffect(() => {
    pending.current?.abort(); pending.current = null; setBusy(false); setConsent(false); requestId.current = null;
  }, [auth.user?.id]);
  useEffect(() => {
    const identity = currentStatusIdentity(); const controller = new AbortController(); statusPending.current = controller;
    if (mode !== "deletion" || !client || !config || !identity) { setDeletionView(null); return () => controller.abort(); }
    setDeletionView({ identity, phase: "loading", request: null });
    void readPlanetAccountDeletionStatus(client, config, identity, currentStatusIdentity, controller.signal).then(request => {
      if (!controller.signal.aborted) { setDeletionView({ identity, phase: "ready", request }); if (request) void readerPrivacy.clear(identity.subject, true); }
    }).catch(() => {
      if (!controller.signal.aborted) setDeletionView({ identity, phase: "error", request: null });
    });
    return () => controller.abort();
    // A refreshed token is rechecked by the same canonical AuthProvider.
  }, [client, config, mode, auth.session, auth.deletionStatusIdentity, statusReload]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.abort(); }; }, []);
  useEffect(() => {
    if (modalOpen && auth.session?.access_token && auth.session.access_token !== modalPreviousToken.current) setModalOpen(false);
  }, [modalOpen, auth.session?.access_token]);
  const visibleIdentity = currentStatusIdentity();
  const matchingStatus = visibleIdentity && deletionView?.identity.subject === visibleIdentity.subject
    && deletionView.identity.token === visibleIdentity.token && deletionView.identity.scope === visibleIdentity.scope ? deletionView : null;
  const receipt = matchingStatus?.phase === "ready" ? matchingStatus.request : null;
  const statusReady = matchingStatus?.phase === "ready";
  const statusChecking = mode === "deletion" && !!visibleIdentity && (!matchingStatus || matchingStatus.phase === "loading");
  const statusUnknown = mode === "deletion" && matchingStatus?.phase === "error";

  function showSignIn() {
    modalPreviousToken.current = authRef.current.session?.access_token ?? null; setModalOpen(true); setError(null);
  }
  async function signInAgain() {
    if (pending.current) return;
    const identity = currentIdentity();
    if (!identity) { showSignIn(); return; }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null);
    const previousToken = authRef.current.session?.access_token ?? null;
    try {
      const supabase = await loadSupabaseClient();
      if (!supabase) throw new PlanetAccountError("unavailable");
      assertCurrent(identity, currentIdentity, controller.signal);
      const result = await supabase.auth.signOut({ scope: "local" });
      if (result.error) throw new PlanetAccountError("unavailable");
      // AuthProvider may publish signed-out state before this promise resolves.
      if (mounted.current) { modalPreviousToken.current = previousToken; setModalOpen(true); }
    } catch (failure) { if (mounted.current && !controller.signal.aborted) setError(failure instanceof PlanetAccountError ? failure.reason : "unavailable"); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }
  async function submit() {
    if (pending.current || receipt) return;
    const identity = currentIdentity();
    if (!identity) { setError("authentication"); return; }
    if (!client || !config) { setError("unavailable"); return; }
    if (mode === "deletion" && !statusReady) { setError("status-unknown"); return; }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null);
    statusPending.current?.abort();
    try {
      if (mode === "deletion") {
        requestId.current ??= crypto.randomUUID();
        const result = await requestPlanetAccountDeletion(client, config, identity, currentIdentity, requestId.current, consent, controller.signal);
        if (!controller.signal.aborted) { setDeletionView({ identity, phase: "ready", request: result }); void readerPrivacy.clear(identity.subject, true); }
      } else {
        await bridgePlanetAccount(client, config, identity, currentIdentity, controller.signal);
        const target = safePwaReturnPath(new URLSearchParams(window.location.search).get("returnTo"), languageRef.current);
        window.location.assign(target);
      }
    } catch (failure) {
      if (!controller.signal.aborted && mode === "deletion") {
        // A network failure can follow a committed deletion RPC. Recover its
        // receipt without trying to re-establish now-blocked paid access.
        try {
          const request = await readPlanetAccountDeletionStatus(client, config, identity, currentIdentity, controller.signal);
          if (!controller.signal.aborted) {
            setDeletionView({ identity, phase: "ready", request }); if (request) void readerPrivacy.clear(identity.subject, true);
            if (!request) setError(failure instanceof PlanetAccountError ? failure.reason : "unavailable");
          }
        } catch {
          if (!controller.signal.aborted) { setDeletionView({ identity, phase: "error", request: null }); setError("status-unknown"); }
        }
      } else if (!controller.signal.aborted) setError(failure instanceof PlanetAccountError ? failure.reason : "unavailable");
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }
  const status = auth.error && !(mode === "deletion" && auth.deletionStatusIdentity) ? copy.unavailable : statusUnknown || error === "status-unknown" ? copy.statusUnknown : error === "authentication" ? copy.authentication : error === "reauthentication" ? copy.reauthentication
    : error === "denied" ? copy.denied : error ? copy.unavailable : loading || auth.loading || statusChecking ? copy.busy : !auth.configured ? copy.unavailable : "";
  const disclosure = config?.deletionDisclosure;
  const returnQuery = typeof window === "undefined" ? "" : window.location.search;
  return <main className="planet-account pwa-access" aria-labelledby={headingId} data-planet-account={mode} data-copy-review={planetAccountCopy.reviewStatus}>
    <header className="planet-account__header">
      <a href={`/${language}/`}><img src="/brand/probpera-logo.png" width="44" height="44" alt={t("Проба Пера")} /></a>
      <InterfaceLanguageControl presentation="flags" />
    </header>
    <section className="planet-account__panel">
      <h1 id={headingId}>{mode === "access" ? copy.access : copy.deletion}</h1>
      <p>{mode === "access" ? copy.intro : copy.deletionIntro}</p>
      <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
      {auth.privacyError ? <div role="alert"><p>{authActionCopy[language].privacyFailed}</p><button type="button" onClick={auth.retryPrivacy}>{authActionCopy[language].privacyRetry}</button></div> : null}
      {mode === "deletion" && !receipt ? <>
        <p id={disclosureId} className="planet-account__disclosure">{disclosure ? disclosure[language] : copy.disclosureUnavailable}</p>
        <label className="planet-account__consent"><input type="checkbox" checked={consent} disabled={!disclosure || busy || loading || !statusReady}
          aria-describedby={disclosureId} onChange={event => setConsent(event.target.checked)} />{copy.consent}</label>
      </> : null}
      {receipt ? <div role="status" aria-live="polite" className="planet-account__receipt" data-deletion-status={receipt.status}><p>{copy[receipt.status]}</p><p>{copy.requestNumber}: <strong>{receipt.requestId}</strong></p></div> :
        <div className="pwa-access__actions">
          {!auth.user ? <button type="button" disabled={!auth.configured || auth.loading || busy} onClick={showSignIn}>{copy.signIn}</button> : <>
            <button type="button" disabled={busy || loading || !config || (mode === "deletion" && (!disclosure || !consent || !statusReady))} onClick={() => void submit()}>
              {busy ? copy.busy : mode === "access" ? copy.restore : copy.submitDeletion}</button>
            {mode === "deletion" ? <button type="button" disabled={busy} onClick={() => void signInAgain()}>{copy.signInAgain}</button> : null}
          </>}
          {auth.error ? <button type="button" disabled={auth.loading || busy} onClick={auth.retry}>{copy.retry}</button> : null}
          {!config && !loading ? <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>{copy.retry}</button> : null}
        </div>}
      {mode === "deletion" ? <>
        <p>{copy.statusInfo}</p>
        {visibleIdentity && config ? <button type="button" disabled={busy || statusChecking} onClick={() => { setError(null); setStatusReload(value => value + 1); }}>{copy.checkStatus}</button> : null}
      </> : null}
      {mode === "access" && !modalOpen && !receipt ? <PlanetPasswordRecovery onSignIn={() => void signInAgain()} /> : null}
      {mode === "access" && config && sandboxSession && !receipt ? <SandboxPaymentPanel language={language} config={config}
        subject={sandboxSession.user.id} token={sandboxSession.access_token} isCurrent={sandboxCurrent} /> : null}
      <SupportIntake />
      <nav className="planet-account__links" aria-label={t("Основная навигация")}>
        <a href={`/${language}/${mode === "access" ? "delete-account" : "planet-account"}/${returnQuery}`}>{mode === "access" ? copy.deleteLink : copy.accessLink}</a>
        <a href="/stati/">{copy.journal}</a><a href="mailto:probperasite@yandex.ru">{copy.support}</a>
      </nav>
    </section>
    {modalOpen ? <Suspense fallback={<p role="status">{copy.loadingAccount}</p>}><CommunityHub open initialView="account" onClose={() => setModalOpen(false)} /></Suspense> : null}
  </main>;
}
