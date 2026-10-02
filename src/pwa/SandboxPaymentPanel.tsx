import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { readerPrivacy } from "../community/readerPrivacy";
import type { PlanetAccountConfiguration } from "./accountAccess";
import { createSandboxPaymentClient, createSandboxPurchaseSession, safeSandboxConfirmationUrl, sandboxAmountLabel,
  SandboxPaymentError, type SandboxCatalog, type SandboxOrder } from "./sandboxPaymentClient";
import { sandboxPaymentCopy } from "./sandboxPaymentCopy";

type Props = { language: "ru" | "en"; config: PlanetAccountConfiguration; subject: string; token: string; isCurrent(): boolean };
type PurchaseSession = ReturnType<typeof createSandboxPurchaseSession>;

/** Optional candidate-only web panel. The host binds isCurrent to the exact
 * canonical session object/generation. A catalog is display data, never a grant.
 * No reader HTTP refund or native billing capability is exposed here. */
export function SandboxPaymentPanel({ language, config, subject, token, isCurrent }: Props) {
  useSyncExternalStore(readerPrivacy.subscribe, readerPrivacy.getSnapshot, readerPrivacy.getSnapshot);
  const blocked = readerPrivacy.isBlocked(subject), copy = sandboxPaymentCopy[language], headingId = useId();
  const scope = useMemo(() => ({ config, subject, token, isCurrent }), [config, subject, token, isCurrent]);
  const currentScope = useRef(scope), purchaseSession = useRef<PurchaseSession | null>(null);
  const pendingAction = useRef<PurchaseSession | null>(null);
  const reviewPending = useRef<AbortController | null>(null);
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return createSandboxPaymentClient({ origin: window.location.origin,
      allowLocalQa: __LITERARY_PLANET_LOCAL_QA__ && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) }); }
    catch { return null; }
  }, []);
  const [view, setView] = useState<{ scope: typeof scope; catalog: SandboxCatalog; order: SandboxOrder | null;
    busy: boolean; error: SandboxPaymentError["reason"] | null; attempted: boolean; restored: boolean;
    needsPriceReview: boolean; reviewedPrice: boolean } | null>(null);
  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => { purchaseSession.current?.dispose(); purchaseSession.current = null; pendingAction.current = null;
      reviewPending.current?.abort(); reviewPending.current = null; };
  }, [scope, blocked]);
  function current(captured: typeof scope) {
    try { return currentScope.current === captured && captured.isCurrent() === true && !readerPrivacy.isBlocked(captured.subject); }
    catch { return false; }
  }
  useEffect(() => {
    if (!client || blocked || !current(scope)) return;
    const controller = new AbortController();
    void client.catalog(config, controller.signal).then(catalog => {
      if (!catalog || controller.signal.aborted || !current(scope)) return;
      purchaseSession.current = createSandboxPurchaseSession({ client, config, catalog, subject, token, isCurrent: () => current(scope) });
      setView({ scope, catalog, order: null, busy: false, error: null, attempted: false, restored: false, needsPriceReview: false, reviewedPrice: false });
    }).catch(() => { /* Missing/unavailable catalog quietly leaves the existing account page intact. */ });
    return () => controller.abort();
  }, [client, scope, blocked]);
  const visible = view?.scope === scope && !blocked && current(scope) ? view : null;
  async function act(action: "purchase" | "status" | "restore") {
    const session = purchaseSession.current, captured = scope;
    if (!session || !visible || visible.busy || pendingAction.current === session || !current(captured)) return;
    pendingAction.current = session;
    setView(value => value?.scope === captured ? { ...value, busy: true, error: null, attempted: value.attempted || action === "purchase" } : value);
    try {
      const order = await session[action]();
      if (current(captured) && purchaseSession.current === session)
        setView(value => value?.scope === captured ? { ...value, order, busy: false, error: null, restored: action === "restore" } : value);
    } catch (error) {
      if (current(captured) && purchaseSession.current === session)
        setView(value => value?.scope === captured ? { ...value, busy: false, error: error instanceof SandboxPaymentError ? error.reason : "unavailable",
          needsPriceReview: value.needsPriceReview || (error instanceof SandboxPaymentError && error.reason === "catalog-changed") } : value);
    } finally { if (pendingAction.current === session) pendingAction.current = null; }
  }
  async function reviewPrice() {
    const session = purchaseSession.current, captured = scope;
    if (!client || !session || !visible || visible.busy || pendingAction.current === session || !current(captured)) return;
    pendingAction.current = session;
    const controller = new AbortController(); reviewPending.current = controller;
    setView(value => value?.scope === captured ? { ...value, busy: true, error: null } : value);
    try {
      const catalog = await client.catalog(config, controller.signal);
      if (!current(captured) || purchaseSession.current !== session) return;
      if (!catalog) throw new SandboxPaymentError("unavailable");
      session.reviewCatalog(catalog);
      setView(value => value?.scope === captured ? { ...value, catalog, busy: false, error: null, needsPriceReview: false, reviewedPrice: true } : value);
    } catch (error) {
      if (current(captured) && purchaseSession.current === session)
        setView(value => value?.scope === captured ? { ...value, busy: false, error: error instanceof SandboxPaymentError ? error.reason : "unavailable" } : value);
    } finally { if (pendingAction.current === session) pendingAction.current = null;
      if (reviewPending.current === controller) reviewPending.current = null; }
  }
  if (!visible) return null;
  const order = visible.order, terminal = !!order && ["canceled", "refunded"].includes(order.status);
  const message = visible.busy ? copy.busy : visible.error === "authentication" ? copy.authentication : visible.error === "denied" ? copy.denied
    : visible.needsPriceReview ? copy.catalogChanged
    : visible.error ? visible.attempted && !order ? copy.uncertain : copy.unavailable : order ? copy[order.status] : visible.restored ? copy.empty : "";
  const confirmation = order?.status === "pending" ? safeSandboxConfirmationUrl(order.confirmationUrl) : null;
  const oldOrder = !!order && order.catalogVersion !== visible.catalog.catalogVersion;
  return <section aria-labelledby={headingId} data-sandbox-payment="web-direct" data-copy-review={sandboxPaymentCopy.reviewStatus}>
    <h2 id={headingId}>{copy.title}</h2><p>{copy.intro}</p>
    <p>{copy.amount}: <strong>{sandboxAmountLabel(order && !terminal ? order.amountMinor : visible.catalog.amountMinor, language)}</strong></p>
    {oldOrder ? <p>{copy.previousOrder} {copy.previousAmount}: <strong>{sandboxAmountLabel(order!.amountMinor, language)}</strong></p> : null}
    {visible.reviewedPrice ? <p>{copy.priceReviewed} <strong>{sandboxAmountLabel(visible.catalog.amountMinor, language)}</strong></p> : null}
    <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
    <div className="pwa-access__actions">
      {!order || terminal ? <button type="button" disabled={visible.busy || visible.needsPriceReview} onClick={() => void act("purchase")}>{visible.reviewedPrice ? copy.confirmPrice : visible.attempted && !order ? copy.retry : copy.purchase}</button> : null}
      {visible.needsPriceReview ? <button type="button" disabled={visible.busy} onClick={() => void reviewPrice()}>{copy.reviewPrice}</button> : null}
      {confirmation ? <button type="button" disabled={visible.busy} onClick={() => {
        if (current(scope) && safeSandboxConfirmationUrl(confirmation)) window.location.assign(confirmation);
      }}>{copy.confirmation}</button> : null}
      {order ? <button type="button" disabled={visible.busy} onClick={() => void act("status")}>{copy.check}</button> : null}
      <button type="button" disabled={visible.busy} onClick={() => void act("restore")}>{copy.restore}</button>
    </div>
  </section>;
}
