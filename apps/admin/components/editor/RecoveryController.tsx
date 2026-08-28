"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteExactEditorAutosaveAction,
  loadLatestEditorAutosaveAction,
  saveEditorAutosaveAction,
} from "@/app/(dashboard)/editor-autosave/actions";
import EditorRecoveryPanel from "@/components/editor/EditorRecoveryPanel";
import {
  advanceEditorAutosaveSequence,
  EDITOR_AUTOSAVE_INTERVAL_MS,
  editorAutosaveSessionStorageKey,
  editorAutosaveStatusLabel,
  normalizeEditorDraftScope,
  normalizeEditorLocaleScope,
  parseEditorAutosaveSnapshot,
  resolveEditorAutosaveSession,
  type EditorAutosaveLocator,
  type EditorAutosaveReceipt,
  type EditorAutosaveRecovery,
  type EditorAutosaveUiState,
} from "@/lib/editor-autosave";

type AutosaveSession = {
  storageKey: string;
  id: string;
  sequence: number;
};

export default function RecoveryController({
  locator: rawLocator,
  snapshot,
  isDirty,
  savedAfterSubmit = false,
  onRestore,
  onLocalFallback,
}: {
  locator: EditorAutosaveLocator;
  snapshot: Record<string, unknown>;
  isDirty: boolean;
  savedAfterSubmit?: boolean;
  onRestore: (snapshot: Record<string, unknown>) => void;
  onLocalFallback?: () => boolean | void;
}) {
  const locator = useMemo<EditorAutosaveLocator>(
    () => ({
      ...rawLocator,
      draftScope: normalizeEditorDraftScope(rawLocator.draftScope),
      localeScope: normalizeEditorLocaleScope(rawLocator.localeScope),
    }),
    [
      rawLocator.baseUpdatedAt,
      rawLocator.draftScope,
      rawLocator.entityId,
      rawLocator.entityType,
      rawLocator.localeScope,
    ]
  );
  const locatorIdentity = useMemo(() => JSON.stringify(locator), [locator]);
  const snapshotText = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const [autosaveSession, setAutosaveSession] = useState<AutosaveSession | null>(
    null
  );
  const [status, setStatus] = useState<EditorAutosaveUiState>("idle");
  const [recovery, setRecovery] = useState<EditorAutosaveRecovery | null>(null);
  const [statusDetail, setStatusDetail] = useState("");
  const lastSavedSnapshotRef = useRef("");
  const activeRequestRef = useRef(0);
  const requestPendingRef = useRef(false);

  const pendingCleanupKey = useMemo(
    () => `${editorAutosaveSessionStorageKey(locator)}:pending-canonical-save`,
    [locator]
  );

  useEffect(() => {
    activeRequestRef.current += 1;
    requestPendingRef.current = false;
    const current = resolveEditorAutosaveSession(
      window.sessionStorage,
      locator,
      () => window.crypto.randomUUID()
    );
    setAutosaveSession(current);
    setStatus("idle");
    setStatusDetail("");
    setRecovery(null);

    let cancelled = false;
    void loadLatestEditorAutosaveAction(locator)
      .then((result) => {
        if (cancelled || !result.ok || !result.recovery) return;
        if (JSON.stringify(result.recovery.snapshot) === snapshotText) {
          lastSavedSnapshotRef.current = snapshotText;
          return;
        }
        setRecovery(result.recovery);
        setStatus(result.recovery.state === "conflict" ? "conflict" : "saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [locatorIdentity]); // The current editor snapshot is intentionally not a reload trigger.

  useEffect(() => {
    if (!savedAfterSubmit) return;
    const rawReceipt = window.sessionStorage.getItem(pendingCleanupKey);
    if (!rawReceipt) return;
    try {
      const pending = JSON.parse(rawReceipt) as EditorAutosaveReceipt & {
        clientSessionId?: unknown;
      };
      if (typeof pending.clientSessionId !== "string") return;
      void deleteExactEditorAutosaveAction({
        id: pending.id,
        clientSessionId: pending.clientSessionId,
        sequence: pending.sequence,
        snapshotHash: pending.snapshotHash,
      }).then((result) => {
        if (!result.ok) return;
        window.sessionStorage.removeItem(pendingCleanupKey);
        setRecovery(null);
        setStatus("idle");
      });
    } catch {
      window.sessionStorage.removeItem(pendingCleanupKey);
    }
  }, [pendingCleanupKey, savedAfterSubmit]);

  useEffect(() => {
    if (
      !isDirty ||
      !autosaveSession ||
      requestPendingRef.current ||
      snapshotText === lastSavedSnapshotRef.current
    ) {
      return;
    }

    const requestNumber = activeRequestRef.current + 1;
    activeRequestRef.current = requestNumber;
    const timer = window.setTimeout(() => {
      let parsedSnapshot: Record<string, unknown>;
      try {
        parsedSnapshot = parseEditorAutosaveSnapshot(snapshotText);
      } catch (error) {
        setStatus("error");
        setStatusDetail(
          error instanceof Error ? error.message : "Автокопия слишком велика."
        );
        return;
      }

      const nextSession = advanceEditorAutosaveSequence(
        window.sessionStorage,
        autosaveSession
      );
      requestPendingRef.current = true;
      setStatus("saving");
      setStatusDetail("");
      void saveEditorAutosaveAction({
        ...locator,
        clientSessionId: nextSession.id,
        clientSequence: nextSession.sequence,
        snapshotText: JSON.stringify(parsedSnapshot),
      }).then((result) => {
        if (activeRequestRef.current !== requestNumber) return;
        requestPendingRef.current = false;
        setAutosaveSession(nextSession);
        if (!result.ok) {
          try {
            const localResult = onLocalFallback?.();
            setStatus(localResult === false ? "error" : "local");
          } catch {
            setStatus("error");
          }
          setStatusDetail(result.error);
          return;
        }

        lastSavedSnapshotRef.current = snapshotText;
        setStatus(result.receipt.state === "conflict" ? "conflict" : "saved");
        window.sessionStorage.setItem(
          pendingCleanupKey,
          JSON.stringify({
            ...result.receipt,
            clientSessionId: nextSession.id,
          })
        );
      }).catch(() => {
        if (activeRequestRef.current !== requestNumber) return;
        requestPendingRef.current = false;
        setAutosaveSession(nextSession);
        try {
          const localResult = onLocalFallback?.();
          setStatus(localResult === false ? "error" : "local");
        } catch {
          setStatus("error");
        }
        setStatusDetail("Сервер автокопии временно недоступен.");
      });
    }, EDITOR_AUTOSAVE_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [
    autosaveSession,
    isDirty,
    locator,
    onLocalFallback,
    pendingCleanupKey,
    snapshotText,
  ]);

  const discardRecovery = useCallback(() => {
    if (!recovery) return;
    void deleteExactEditorAutosaveAction({
      id: recovery.id,
      clientSessionId: recovery.clientSessionId,
      sequence: recovery.sequence,
      snapshotHash: recovery.snapshotHash,
    }).then((result) => {
      if (!result.ok) {
        setStatus("error");
        setStatusDetail(result.error);
        return;
      }
      setRecovery(null);
      setStatus("idle");
      setStatusDetail("");
    });
  }, [recovery]);

  return (
    <div className="editor-recovery-controller">
      <p className={`editor-autosave-status is-${status}`} aria-live="polite">
        {editorAutosaveStatusLabel(status)}
        {statusDetail ? ` - ${statusDetail}` : ""}
      </p>
      {recovery ? (
        <EditorRecoveryPanel
          recovery={recovery}
          onRestore={() => {
            onRestore(recovery.snapshot);
            setRecovery(null);
            setStatus("local");
            setStatusDetail("Автокопия загружена в редактор; проверьте и сохраните её.");
          }}
          onDiscard={discardRecovery}
        />
      ) : null}
    </div>
  );
}
