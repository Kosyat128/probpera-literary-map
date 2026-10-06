import { useLayoutEffect, useRef, useState } from "react";
import { ChildNativeMediaView } from "./ChildNativeMediaView";
import type { ChildNativeAppController, ChildNativeEntity } from "./childNativeAppBridge";
import type { ChildNativeJourneyResult, ChildNativeJourneySummary, ChildNativeProfileJourney } from "./childNativeJourney";
import type { ChildNativeRouteMediaDownload } from "./childNativePassportProgram";
import { continueChildNativeRouteDownload, type ChildNativeRouteDownload } from "./childNativeOfflinePackages";
import { childNativeRouteAudioStatus } from "./ChildNativeDiscoveryPassportView";

export const childJourneyLabels = {
  ru: { travel: "Путешествовать", continue: "Продолжить", title: "Литературные путешествия", loading: "Проверяем путешествия…",
    empty: "Путешествия пока недоступны. Можно исследовать планету.", unavailable: "Это путешествие сейчас недоступно. Ваши пройденные шаги сохранены.",
    error: "Не удалось проверить путешествие.", retry: "Проверить путешествия снова", next: "Готово · дальше", home: "К путешествиям",
    restart: "Пройти ещё раз", completed: "Путешествие завершено!", retained: "Пройденные шаги сохранены.", step: "Шаг", of: "из", done: "Пройдено",
    savedUnavailable: "Сохранённое путешествие сейчас недоступно. Прогресс остаётся на устройстве.",
    saveRoute: "Скачать маршрут", savingRoute: "Сохраняем маршрут…", routeSaved: "Маршрут сохранён на устройстве.",
    routeSaveFailed: "Не удалось подтвердить сохранение маршрута.",
    resumeDownload: "Продолжить загрузку", cancelDownload: "Отменить загрузку", stagedDownload: "Загрузка приостановлена. Проверенные файлы сохранены.",
    cancelledDownload: "Загрузка отменена. Ранее сохранённые маршруты остаются на устройстве.", checkedFiles: "Проверено файлов" },
  en: { travel: "Travel", continue: "Continue", title: "Literary journeys", loading: "Checking journeys…",
    empty: "Journeys are currently unavailable. You can explore the planet.", unavailable: "This journey is currently unavailable. Your completed steps are saved.",
    error: "The journey could not be checked.", retry: "Check journeys again", next: "Done · next", home: "Back to journeys",
    restart: "Travel again", completed: "Journey complete!", retained: "Your completed steps are saved.", step: "Step", of: "of", done: "Completed",
    savedUnavailable: "The saved journey is currently unavailable. Its progress stays on this device.",
    saveRoute: "Download route", savingRoute: "Saving route…", routeSaved: "The route is saved on this device.",
    routeSaveFailed: "The route save could not be confirmed.",
    resumeDownload: "Resume download", cancelDownload: "Cancel download", stagedDownload: "Download paused. Checked files are saved.",
    cancelledDownload: "Download cancelled. Previously saved routes stay on this device.", checkedFiles: "Files checked" },
} as const;
export interface ChildNativeJourneyViewProps {
  controller: ChildNativeAppController; contextToken: string; profileId: string; language: "ru" | "en";
  navigationEpoch: number; homeVisible: boolean; initialJourneyId?: string | null;
  onActiveChange(active: boolean): void; onIntentChange(journeyId: string | null): void;
  onNode(node: ChildNativeEntity | null): void;
}
/** Child Continue uses only fresh native content. A stable logical intent may
 * survive a same-profile locale/context transition, but retired node text,
 * checksums, resource URLs and native capabilities never survive it. */
export function ChildNativeJourneyView(props: ChildNativeJourneyViewProps) {
  const { controller, contextToken, profileId, language, navigationEpoch, homeVisible } = props, copy = childJourneyLabels[language];
  const port = controller.journeys;
  const [routes, setRoutes] = useState<readonly ChildNativeJourneySummary[]>([]), [saved, setSaved] = useState<ChildNativeProfileJourney | null>(null);
  const [result, setResult] = useState<ChildNativeJourneyResult | null>(null), [busy, setBusy] = useState(true);
  const [error, setError] = useState<"read" | "unavailable" | null>(null), [renderEpoch, setRenderEpoch] = useState(navigationEpoch);
  const [routeSave, setRouteSave] = useState<{ key: string; phase: "saving" | "saved" | "paused" | "cancelled" | "failed"; media?: ChildNativeRouteMediaDownload; acquisition?: ChildNativeRouteDownload["acquisition"] } | null>(null);
  const mounted = useRef(false), sequence = useRef(0), initial = useRef(props.initialJourneyId ?? null), previousNavigation = useRef(navigationEpoch);
  const savingKey = useRef<string | null>(null), cancelDownload = useRef(false);
  const [downloadFacts, setDownloadFacts] = useState<Readonly<Record<string, ChildNativeRouteDownload>>>({});
  const latest = useRef(props); latest.current = props;
  const heading = useRef<HTMLHeadingElement>(null), continueButton = useRef<HTMLButtonElement>(null);
  const alive = (attempt: number) => mounted.current && sequence.current === attempt
    && latest.current.contextToken === contextToken && latest.current.profileId === profileId && latest.current.language === language
    && controller.getSnapshot().phase === "ready" && controller.getSnapshot().status === "child"
    && controller.getSnapshot().context?.token === contextToken && controller.getSnapshot().context?.locale === language;
  async function admit(journeyId: string, revision: number, attempt: number, focus = true) {
    const next = await port?.open(journeyId, revision);
    if (!alive(attempt)) return;
    setBusy(false);
    if (!next || next.status === "unavailable" || next.status === "absent" || !next.journey) {
      setResult(null); setError(next ? "unavailable" : "read"); latest.current.onActiveChange(false); return;
    }
    setSaved({ profileId: next.profileId, revision: next.revision, progress: next.progress }); setResult(next); setError(null);
    setRenderEpoch(latest.current.navigationEpoch); latest.current.onActiveChange(true); latest.current.onIntentChange(journeyId); latest.current.onNode(next.node);
    if (focus) queueMicrotask(() => { if (alive(attempt)) heading.current?.focus(); });
  }
  async function load(resume: string | null = null) {
    const attempt = ++sequence.current; setBusy(true); setError(null); setResult(null); latest.current.onActiveChange(false);
    const values = await Promise.all([port?.list() ?? null, port?.readProgress() ?? null]);
    if (!alive(attempt)) return;
    const [available, progress] = values;
    if (!available || !progress) { setRoutes([]); setSaved(null); setError("read"); setBusy(false); return; }
    setRoutes(available); setSaved(progress);
    if (controller.passport?.readJourneyRouteDownload) {
      const facts: Record<string, ChildNativeRouteDownload> = {};
      for (const route of available) {
        if (!alive(attempt)) return;
        const value = await controller.passport.readJourneyRouteDownload(route.journeyId);
        if (!alive(attempt)) return;
        if (value) facts[route.journeyId] = value;
      }
      setDownloadFacts(Object.freeze(facts));
    }
    if (resume) { await admit(resume, progress.revision, attempt, false); return; }
    setBusy(false);
  }
  useLayoutEffect(() => {
    mounted.current = true; setRoutes([]); setSaved(null); setResult(null); setBusy(true); setError(null); setRouteSave(null); setDownloadFacts({});
    // Initial/native publication can still be joining its control request.
    void Promise.resolve().then(() => { if (mounted.current) void load(initial.current); });
    return () => { mounted.current = false; ++sequence.current; };
  }, [controller, contextToken, profileId, language, port]);
  useLayoutEffect(() => {
    if (previousNavigation.current === navigationEpoch) return;
    previousNavigation.current = navigationEpoch; const attempt = ++sequence.current, requested = latest.current.initialJourneyId ?? null;
    setResult(null); setSaved(null); setError(null); setBusy(true);
    latest.current.onActiveChange(false); latest.current.onIntentChange(requested); initial.current = requested; setRouteSave(null);
    // A dispatched completion may commit after navigation has hidden its node.
    // Join retirement, then read the current revision before offering Continue.
    void (async () => {
      const closed = await port?.close();
      if (!alive(attempt)) return;
      if (!closed) { setBusy(false); setError("read"); return; }
      await load(requested);
    })();
  }, [navigationEpoch, port]);
  async function begin(journeyId: string) {
    if (busy || !saved) return; const attempt = ++sequence.current; setBusy(true); setResult(null); setError(null);
    await admit(journeyId, saved.revision, attempt);
  }
  async function advance(action: "complete" | "restart") {
    if (busy || !result?.progress || !result.journey) return;
    const original = result, p = original.progress!, attempt = ++sequence.current; setBusy(true); setError(null);
    const next = await port?.advance(original.revision, p.journeyId, p.currentNodeId, action);
    if (!alive(attempt)) return;
    setBusy(false);
    if (!next || !next.journey || next.status === "unavailable" || next.status === "absent") {
      setResult(null); setError(next ? "unavailable" : "read"); latest.current.onActiveChange(false); return;
    }
    setSaved({ profileId: next.profileId, revision: next.revision, progress: next.progress }); setResult(next);
    latest.current.onNode(next.node); queueMicrotask(() => { if (alive(attempt)) heading.current?.focus(); });
  }
  async function home() {
    if (busy) return; const attempt = ++sequence.current; setResult(null); setBusy(true); setError(null);
    latest.current.onActiveChange(false); latest.current.onIntentChange(null); initial.current = null;
    const ok = await port?.close(); if (!alive(attempt)) return;
    if (!ok) { setBusy(false); setError("read"); return; }
    await load(); queueMicrotask(() => { if (mounted.current) continueButton.current?.focus(); });
  }
  async function saveRoute(journeyId: string) {
    if (busy || savingKey.current !== null || !controller.passport?.saveJourneyRoute || !mounted.current) return;
    const key = [contextToken, profileId, language, navigationEpoch, journeyId].join("/"), attempt = sequence.current;
    savingKey.current = key; cancelDownload.current = false; setRouteSave({ key, phase: "saving" });
    try {
      const passport = await controller.passport.read();
      if (!alive(attempt)) return;
      if (!passport) { setRouteSave({ key, phase: "failed" }); return; }
      const pending = await controller.passport.readJourneyRouteDownload?.(journeyId) ?? null;
      if (!alive(attempt)) return;
      const receipt = await continueChildNativeRouteDownload(controller.passport, journeyId, pending?.revision ?? passport.revision, {
        resume: pending?.acquisition.status === "staging", alive: () => alive(attempt), cancelled: () => cancelDownload.current,
        progress: value => {
          if (!alive(attempt)) return;
          setDownloadFacts(prior => Object.freeze({ ...prior, [journeyId]: value }));
          setRouteSave({ key, phase: "saving", acquisition: value.acquisition });
        },
      });
      if (!alive(attempt)) return;
      const value = receipt.value;
      if (value && "acquisition" in value) setDownloadFacts(prior => Object.freeze({ ...prior, [journeyId]: value }));
      setRouteSave({ key, phase: receipt.status === "saved" ? "saved" : receipt.status === "paused" ? "paused"
        : receipt.status === "cancelled" ? "cancelled" : "failed", ...(value?.route ? { media: value.route.media } : {}),
        ...(value && "acquisition" in value ? { acquisition: value.acquisition } : {}) });
    } catch { if (alive(attempt)) setRouteSave({ key, phase: "failed" }); }
    finally { if (savingKey.current === key) savingKey.current = null; }
  }
  async function cancelStagedRoute(journeyId: string) {
    const key = [contextToken, profileId, language, navigationEpoch, journeyId].join("/");
    if (savingKey.current === key) { cancelDownload.current = true; return; }
    if (busy || savingKey.current !== null || !controller.passport?.cancelJourneyRoute) return;
    const attempt = sequence.current; savingKey.current = key; setRouteSave({ key, phase: "saving" });
    try {
      const pending = await controller.passport.readJourneyRouteDownload?.(journeyId) ?? null;
      if (!alive(attempt)) return;
      const value = pending ? await controller.passport.cancelJourneyRoute(journeyId, pending.revision) : null;
      if (!alive(attempt)) return;
      if (value) setDownloadFacts(prior => Object.freeze({ ...prior, [journeyId]: value }));
      setRouteSave({ key, phase: value?.acquisition.status === "ready" && value.route ? "saved"
        : value?.acquisition.status === "cancelled" ? "cancelled" : "failed", ...(value?.route ? { media: value.route.media } : {}) });
    } catch { if (alive(attempt)) setRouteSave({ key, phase: "failed" }); }
    finally { if (savingKey.current === key) savingKey.current = null; }
  }
  function routeSaveButton(journeyId: string) {
    const key = [contextToken, profileId, language, navigationEpoch, journeyId].join("/"), state = routeSave?.key === key ? routeSave : null;
    const stored = downloadFacts[journeyId], pending = state?.acquisition ?? stored?.acquisition, staged = pending?.status === "staging";
    const ready = state?.phase === "saved" || !state && stored?.acquisition.status === "ready", media = state?.media ?? stored?.route?.media;
    return controller.passport?.saveJourneyRoute ? <span className="child-native-route-save">
      <button type="button" disabled={busy || savingKey.current !== null} onClick={() => { void saveRoute(journeyId); }}>
        {state?.phase === "saving" ? copy.savingRoute : staged ? copy.resumeDownload : copy.saveRoute}</button>
      {(state?.phase === "saving" || staged) && controller.passport?.cancelJourneyRoute
        && <button type="button" disabled={busy} onClick={() => { void cancelStagedRoute(journeyId); }}>{copy.cancelDownload}</button>}
      {pending && (staged || state?.phase === "saving") && <span role="status">{copy.checkedFiles}: {pending.completedItems} / {pending.totalItems}</span>}
      {staged && state?.phase !== "saving" && <span role="status">{copy.stagedDownload}</span>}
      {ready && <span role="status">{copy.routeSaved} {media && childNativeRouteAudioStatus(language, media)}</span>}
      {state?.phase === "cancelled" && <span role="status">{copy.cancelledDownload}</span>}
      {state?.phase === "failed" && <span role="alert">{copy.routeSaveFailed}</span>}
    </span> : null;
  }
  if (!port || !homeVisible && !result || renderEpoch !== navigationEpoch && result) return null;
  const visible = result?.journey && result.progress ? result : null;
  const offered = saved?.progress && routes.find(route => route.journeyId === saved.progress!.journeyId);
  return <section className="child-native-journeys" aria-label={copy.title} aria-busy={busy} data-child-journey-phase={busy ? "loading" : error ? "unavailable" : visible ? "active" : "home"}>
    {busy && <p role="status">{copy.loading}</p>}
    {error && <div role="alert"><p>{error === "unavailable" ? copy.unavailable : copy.error}</p>
      <button type="button" disabled={busy} onClick={() => { void load(); }}>{copy.retry}</button></div>}
    {visible ? <>
      <h2 ref={heading} tabIndex={-1}>{visible.journey!.title}</h2>
      {routeSaveButton(visible.journey!.journeyId)}
      <p role="status">{copy.done}: {visible.journey!.nodeIds.filter(id => visible.progress!.completedNodeIds.includes(id)).length} {copy.of} {visible.journey!.nodeCount}</p>
      {visible.node ? <article data-child-journey-node={visible.node.reference.id}>
        <p>{copy.step} {visible.journey!.nodeIds.indexOf(visible.node.reference.id) + 1} {copy.of} {visible.journey!.nodeCount}</p>
        <h3>{visible.node.payload.title}</h3><p className="child-native-text">{visible.node.payload.text}</p>
        <ChildNativeMediaView key={contextToken + "/journey/" + visible.node.reference.id} controller={controller}
          owner={visible.node.reference} contextToken={contextToken} language={language} />
        <button type="button" disabled={busy} onClick={() => { void advance("complete"); }}>{copy.next}</button>
      </article> : <p role="status">{copy.completed} {copy.retained}</p>}
      <button type="button" disabled={busy} onClick={() => { void advance("restart"); }}>{copy.restart}</button>
      <button type="button" disabled={busy} onClick={() => { void home(); }}>{copy.home}</button>
    </> : !busy && !error && <>
      <h2>{copy.title}</h2>
      {offered && <button ref={continueButton} type="button" onClick={() => { void begin(offered.journeyId); }}>{copy.continue} · {offered.title}</button>}
      {saved?.progress && !offered && <p role="status">{copy.savedUnavailable}</p>}
      {!routes.length && <p>{copy.empty}</p>}
      <ul>{routes.map(route => <li key={route.journeyId}><button type="button" onClick={() => { void begin(route.journeyId); }}>{copy.travel} · {route.title}</button>
        {routeSaveButton(route.journeyId)}<p>{route.description}</p></li>)}</ul>
    </>}
  </section>;
}
