import { useCallback, useEffect, useState } from "react";
import type { BookDossierDocumentV2, BookDossierReadingMode, BookDossierSpoiler } from "./bookDossierDocument";
import { fetchPublishedBookDossier } from "./bookDossierPublicClient";

const noProgress: readonly string[] = [];

export function usePublishedBookDossier(bookKey: string | null, locale: "ru" | "en") {
  const identity = `${bookKey || ""}:${locale}`;
  const [choice, setChoice] = useState<{ identity: string; mode: BookDossierReadingMode; reveal: BookDossierSpoiler; reachedItemIds: readonly string[] } | null>(null);
  const mode = choice?.identity === identity ? choice.mode : "BEFORE_READING";
  const reveal = choice?.identity === identity ? choice.reveal : "NONE";
  const reachedItemIds = mode === "DURING_READING" && choice?.identity === identity ? choice.reachedItemIds : noProgress;
  const requestKey = `${identity}:${mode}:${reveal}:${JSON.stringify(reachedItemIds)}`;
  const [result, setResult] = useState<{ key: string; document: BookDossierDocumentV2 | null } | null>(null);
  const [safeBefore, setSafeBefore] = useState<{ identity: string; document: BookDossierDocumentV2 } | null>(null);
  const [leaseClock, setLeaseClock] = useState(Date.now);
  useEffect(() => {
    if (!bookKey) return;
    let disposed = false;
    let controller: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (disposed) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), 10_000);
      const document = await fetchPublishedBookDossier({ bookKey, locale, mode, revealSpoilers: reveal, reachedItemIds, signal: current.signal });
      clearTimeout(timeout);
      if (disposed || controller !== current) return;
      setResult({ key: requestKey, document });
      setLeaseClock(Date.now());
      if (!document) {
        setSafeBefore(null);
        // A newer reviewed edition may remove an old chapter checkpoint.
        // Drop that local selection and retry the safe beginning once.
        if (reachedItemIds.length) setChoice(previous => previous?.identity === identity
          ? { ...previous, reachedItemIds: noProgress } : previous);
      }
      else if (mode === "BEFORE_READING" && reveal === "NONE") setSafeBefore({ identity, document });
      const validUntil = document?.validUntil ? Date.parse(document.validUntil) : NaN;
      retry = setTimeout(refresh, Number.isFinite(validUntil)
        ? Math.max(1000, Math.min(55_000, validUntil - Date.now() - 1000)) : 60_000);
    };
    const foreground = () => {
      if (document.visibilityState !== "visible") return;
      if (retry) clearTimeout(retry);
      void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", foreground);
    return () => {
      disposed = true;
      controller?.abort();
      if (retry) clearTimeout(retry);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [bookKey, locale, mode, reveal, identity, requestKey, reachedItemIds]);
  useEffect(() => {
    const expiries = [result?.document?.validUntil, safeBefore?.document.validUntil]
      .map(value => value ? Date.parse(value) : NaN).filter(value => Number.isFinite(value) && value > Date.now());
    if (!expiries.length) return;
    const timer = setTimeout(() => setLeaseClock(Date.now()), Math.min(...expiries) - Date.now() + 1);
    return () => clearTimeout(timer);
  }, [result, safeBefore, leaseClock]);
  const current = result?.key === requestKey ? result : null;
  const live = (candidate: BookDossierDocumentV2 | null | undefined) => candidate?.validUntil &&
    Date.parse(candidate.validUntil) > Math.max(leaseClock, Date.now()) ? candidate : null;
  const published = live(current?.document) || (safeBefore?.identity === identity ? live(safeBefore.document) : null);
  const changeMode = useCallback((next: BookDossierReadingMode) => {
    setChoice(previous => ({ identity, mode: next, reveal: "NONE",
      reachedItemIds: previous?.identity === identity ? previous.reachedItemIds : noProgress }));
  }, [identity]);
  const changeSpoilers = useCallback((show: boolean) => {
    setChoice(previous => ({ identity, mode, reveal: show && mode !== "BEFORE_READING" ? "ENDING" : "NONE",
      reachedItemIds: previous?.identity === identity ? previous.reachedItemIds : noProgress }));
  }, [identity, mode]);
  const changeProgress = useCallback((count: number) => {
    const steps = published?.progressSteps || [];
    if (mode !== "DURING_READING" || !Number.isInteger(count) || count < 0 || count > steps.length) return;
    setChoice({ identity, mode, reveal, reachedItemIds: steps.slice(0, count).map(step => step.id) });
  }, [identity, mode, reveal, published]);
  return { document: published, busy: Boolean(bookKey && !current), changeMode, changeSpoilers, changeProgress,
    reachedCount: reachedItemIds.length,
    showingSpoilers: Boolean(live(current?.document) && reveal !== "NONE"),
    unavailable: Boolean(current && !current.document && mode !== "BEFORE_READING") };
}
