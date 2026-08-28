export const EDITOR_AUTOSAVE_INTERVAL_MS = 15_000;
export const EDITOR_AUTOSAVE_MAX_SNAPSHOT_BYTES = 3_200_000;
export const EDITOR_AUTOSAVE_RETENTION_DAYS = 30;

export type EditorAutosaveEntityType = "article" | "page";
export type EditorAutosaveRecoveryState = "saved" | "conflict";
export type EditorAutosaveUiState =
  | "idle"
  | "saving"
  | "saved"
  | "local"
  | "error"
  | "conflict";

export type EditorAutosaveLocator = {
  entityType: EditorAutosaveEntityType;
  entityId: string | null;
  draftScope: string;
  localeScope: string;
  baseUpdatedAt: string | null;
};

export type EditorAutosaveSaveInput = EditorAutosaveLocator & {
  clientSessionId: string;
  clientSequence: number;
  snapshotText: string;
};

export type EditorAutosaveReceipt = {
  id: string;
  state: EditorAutosaveRecoveryState;
  sequence: number;
  snapshotHash: string;
  baseUpdatedAt: string | null;
  updatedAt: string;
  expiresAt: string;
};

export type EditorAutosaveRecovery = EditorAutosaveReceipt & {
  clientSessionId: string;
  snapshot: Record<string, unknown>;
};

type RecoveryStorage = Pick<Storage, "getItem" | "setItem">;

function normalizeScopePart(
  value: string,
  fallback: string,
  maxLength: number,
  disallowed: RegExp
) {
  const normalized = value
    .trim()
    .replace(disallowed, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, maxLength);
  return normalized || fallback;
}

export function normalizeEditorDraftScope(value: string) {
  return normalizeScopePart(value, "new", 160, /[^\p{L}\p{N}:_-]+/gu);
}

export function normalizeEditorLocaleScope(value: string) {
  return (
    normalizeScopePart(
      value.toLowerCase(),
      "default",
      32,
      /[^a-z0-9_-]+/gu
    ).replace(/^[^a-z]+/u, "") || "default"
  );
}

export function editorAutosaveSessionStorageKey(locator: EditorAutosaveLocator) {
  return [
    "probpera-editor-autosave",
    locator.entityType,
    normalizeEditorDraftScope(locator.draftScope),
    normalizeEditorLocaleScope(locator.localeScope),
  ].join(":");
}

export function resolveEditorAutosaveSession(
  storage: RecoveryStorage,
  locator: EditorAutosaveLocator,
  randomUuid: () => string
) {
  const storageKey = editorAutosaveSessionStorageKey(locator);
  const raw = storage.getItem(storageKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        id?: unknown;
        sequence?: unknown;
      };
      if (
        typeof parsed.id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          parsed.id
        ) &&
        Number.isSafeInteger(parsed.sequence) &&
        Number(parsed.sequence) >= 0
      ) {
        return {
          storageKey,
          id: parsed.id,
          sequence: Number(parsed.sequence),
        };
      }
    } catch {
      // Replace damaged per-tab metadata; recovery rows themselves stay intact.
    }
  }

  const created = { storageKey, id: randomUuid(), sequence: 0 };
  storage.setItem(
    storageKey,
    JSON.stringify({ id: created.id, sequence: created.sequence })
  );
  return created;
}

export function advanceEditorAutosaveSequence(
  storage: RecoveryStorage,
  session: { storageKey: string; id: string; sequence: number }
) {
  const next = {
    ...session,
    sequence: Math.max(0, Math.trunc(session.sequence)) + 1,
  };
  storage.setItem(
    next.storageKey,
    JSON.stringify({ id: next.id, sequence: next.sequence })
  );
  return next;
}

export function parseEditorAutosaveSnapshot(value: string) {
  if (new TextEncoder().encode(value).byteLength > EDITOR_AUTOSAVE_MAX_SNAPSHOT_BYTES) {
    throw new Error("Автокопия превышает безопасный размер 3,2 МБ.");
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Автокопия редактора должна быть объектом.");
  }
  return parsed as Record<string, unknown>;
}

export function editorAutosaveStatusLabel(state: EditorAutosaveUiState) {
  switch (state) {
    case "saving":
      return "Сохраняем автокопию…";
    case "saved":
      return "Автокопия сохранена";
    case "local":
      return "Сохранена локальная копия";
    case "error":
      return "Ошибка серверной автокопии";
    case "conflict":
      return "Обнаружена более новая версия";
    default:
      return "Автокопия готова";
  }
}
