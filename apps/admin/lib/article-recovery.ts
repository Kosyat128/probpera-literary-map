export const PENDING_ARTICLE_SAVE_KEY = "probpera-editor-pending-save-key";
export const LATEST_ARTICLE_DRAFT_POINTER_PREFIX =
  "probpera-editor-draft-latest-";

type RecoveryStorage = Pick<Storage, "getItem" | "removeItem">;
type WritableRecoveryStorage = RecoveryStorage & Pick<Storage, "setItem">;

export function safeArticleDraftScope(scope: string) {
  return scope.replace(/[^a-z0-9_-]+/giu, "-").slice(0, 80) || "new";
}

export function articleDraftRecoveryKeyPrefix(scope: string) {
  return `probpera-editor-draft-${safeArticleDraftScope(scope)}-`;
}

export function latestArticleDraftPointerKey(scope: string) {
  return `${LATEST_ARTICLE_DRAFT_POINTER_PREFIX}${safeArticleDraftScope(scope)}`;
}

function isRecoverySnapshot(value: string | null) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

export function resolveArticleDraftRecoverySource(
  storage: RecoveryStorage,
  scope: string,
  currentRecoveryKey: string
) {
  if (isRecoverySnapshot(storage.getItem(currentRecoveryKey))) {
    return currentRecoveryKey;
  }

  const safeScope = safeArticleDraftScope(scope);
  const pointerKey = latestArticleDraftPointerKey(safeScope);
  const expectedRecoveryPrefix = articleDraftRecoveryKeyPrefix(safeScope);
  const pointerValue = storage.getItem(pointerKey);
  if (pointerValue) {
    try {
      const pointer = JSON.parse(pointerValue) as {
        version?: unknown;
        scope?: unknown;
        recoveryKey?: unknown;
      };
      if (
        pointer.version === 1 &&
        pointer.scope === safeScope &&
        typeof pointer.recoveryKey === "string" &&
        pointer.recoveryKey.startsWith(expectedRecoveryPrefix) &&
        isRecoverySnapshot(storage.getItem(pointer.recoveryKey))
      ) {
        return pointer.recoveryKey;
      }
    } catch {
      // Invalid pointers are removed below without touching any recovery copy.
    }
    storage.removeItem(pointerKey);
  }
  return currentRecoveryKey;
}

export function persistArticleRecoverySnapshot(
  storage: WritableRecoveryStorage,
  recoveryKey: string,
  serializedSnapshot: string,
  scope: string | null
) {
  storage.setItem(recoveryKey, serializedSnapshot);
  if (scope === null) return;

  const safeScope = safeArticleDraftScope(scope);
  const expectedRecoveryPrefix = articleDraftRecoveryKeyPrefix(safeScope);
  if (!recoveryKey.startsWith(expectedRecoveryPrefix)) return;
  storage.setItem(
    latestArticleDraftPointerKey(safeScope),
    JSON.stringify({ version: 1, scope: safeScope, recoveryKey })
  );
}

export function recoveryContentFingerprint(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return JSON.stringify(snapshot) ?? "null";
  }
  const normalized = {
    ...(snapshot as Record<string, unknown>),
    activeLocale: undefined,
    savedAt: undefined,
    reason: undefined,
  };
  return JSON.stringify(normalized);
}

export function pendingArticleSaveValue(
  recoveryKey: string,
  snapshot: unknown,
  draftScope: string | null = null
) {
  return JSON.stringify({
    version: 1,
    recoveryKey,
    fingerprint: recoveryContentFingerprint(snapshot),
    locatorKey:
      draftScope === null ? null : latestArticleDraftPointerKey(draftScope),
  });
}

export function clearConfirmedArticleRecovery(
  localStorage: RecoveryStorage,
  sessionStorage: RecoveryStorage,
  currentRecoveryKey: string
) {
  const pendingValue = sessionStorage.getItem(
    PENDING_ARTICLE_SAVE_KEY
  );
  if (!pendingValue) {
    return { clearedCurrent: false, pendingRecoveryKey: null } as const;
  }

  let pendingRecoveryKey: string | null = null;
  let pendingFingerprint: string | null = null;
  let pendingLocatorKey: string | null = null;
  try {
    const pending = JSON.parse(pendingValue) as {
      recoveryKey?: unknown;
      fingerprint?: unknown;
      locatorKey?: unknown;
    };
    if (
      typeof pending.recoveryKey === "string" &&
      typeof pending.fingerprint === "string"
    ) {
      pendingRecoveryKey = pending.recoveryKey;
      pendingFingerprint = pending.fingerprint;
      if (
        typeof pending.locatorKey === "string" &&
        pending.locatorKey.startsWith(LATEST_ARTICLE_DRAFT_POINTER_PREFIX)
      ) {
        pendingLocatorKey = pending.locatorKey;
      }
    }
  } catch {
    // Legacy or damaged markers are cleared without touching a recovery copy.
  }

  let clearedCurrent = false;
  if (pendingRecoveryKey && pendingFingerprint) {
    const currentRecovery = localStorage.getItem(pendingRecoveryKey);
    if (currentRecovery) {
      try {
        const currentFingerprint = recoveryContentFingerprint(
          JSON.parse(currentRecovery)
        );
        if (currentFingerprint === pendingFingerprint) {
          localStorage.removeItem(pendingRecoveryKey);
          if (pendingLocatorKey) {
            const locatorValue = localStorage.getItem(pendingLocatorKey);
            if (locatorValue) {
              try {
                const locator = JSON.parse(locatorValue) as {
                  version?: unknown;
                  recoveryKey?: unknown;
                };
                if (
                  locator.version === 1 &&
                  locator.recoveryKey === pendingRecoveryKey
                ) {
                  localStorage.removeItem(pendingLocatorKey);
                }
              } catch {
                // Leave damaged locator data for the resolver to quarantine.
              }
            }
          }
          clearedCurrent = pendingRecoveryKey === currentRecoveryKey;
        }
      } catch {
        // Keep unreadable data for manual recovery instead of deleting it.
      }
    }
  }
  sessionStorage.removeItem(PENDING_ARTICLE_SAVE_KEY);
  return {
    clearedCurrent,
    pendingRecoveryKey,
  } as const;
}
