import { z } from "zod";

const uuid = z.string().uuid();

export type RecoveryCopyOwnerState = "legacy" | "own" | "foreign" | "invalid";

/** Local ownership metadata is neither a server receipt nor an Auth proof. */
export function recoveryCopyOwnerState(value: unknown, actorId?: string): RecoveryCopyOwnerState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "invalid";
  if (!Object.hasOwn(value, "recoveryActorId")) return "legacy";
  try {
    const owner = uuid.safeParse((value as Record<string, unknown>).recoveryActorId);
    if (!owner.success) return "invalid";
    const actor = uuid.safeParse(actorId);
    return actor.success && owner.data.toLowerCase() === actor.data.toLowerCase() ? "own" : "foreign";
  } catch {
    return "invalid";
  }
}

/** Legacy full copies remain usable without assigning them a current owner. */
export function canUseRecoveryCopy(value: unknown, actorId?: string): boolean {
  const state = recoveryCopyOwnerState(value, actorId);
  return state === "own" || state === "legacy";
}

/** Call only for new writes after full-copy validation and destination checks. */
export function withRecoveryCopyOwner<T extends object>(snapshot: T, actorId?: string): T & { recoveryActorId?: string } {
  if (actorId === undefined) return { ...snapshot };
  const actor = uuid.safeParse(actorId);
  if (!actor.success) throw new TypeError("Invalid recovery copy actor");
  return { ...snapshot, recoveryActorId: actor.data };
}

/** Keep each actor's new copy separate while retaining the legacy base key. */
export function recoveryCopyStorageKey(baseKey: string, actorId?: string): string {
  if (actorId === undefined) return baseKey;
  const actor = uuid.safeParse(actorId);
  if (!actor.success) throw new TypeError("Invalid recovery copy actor");
  return `${baseKey}:actor:${actor.data.toLowerCase()}`;
}

function usableSerializedCopy(value: string, actorId?: string): boolean {
  try { return canUseRecoveryCopy(JSON.parse(value), actorId); }
  catch { return false; }
}

/** A present primary wins, including a damaged copy that must be preserved. */
export function readRecoveryCopy(storage: Pick<Storage, "getItem">, baseKey: string, actorId?: string): string | null {
  const key = recoveryCopyStorageKey(baseKey, actorId);
  const primary = storage.getItem(key);
  return primary !== null || key === baseKey ? primary : storage.getItem(baseKey);
}

/** Caller validates the full DTO; this boundary guards ownership and durability. */
export function persistRecoveryCopy(
  storage: Pick<Storage, "getItem" | "setItem">,
  baseKey: string,
  snapshot: object,
  actorId?: string
): void {
  const key = recoveryCopyStorageKey(baseKey, actorId);
  const existing = storage.getItem(key);
  if (existing !== null && !usableSerializedCopy(existing, actorId)) {
    throw new Error("Preserved original recovery copy");
  }
  const serialized = JSON.stringify(withRecoveryCopyOwner(snapshot, actorId));
  storage.setItem(key, serialized);
  if (storage.getItem(key) !== serialized) throw new Error("Unconfirmed recovery copy");
  if (key === baseKey) return;
  try {
    const mirror = storage.getItem(baseKey);
    if (mirror !== null && !usableSerializedCopy(mirror, actorId)) return;
    storage.setItem(baseKey, serialized);
    if (storage.getItem(baseKey) !== serialized) throw new Error("Unconfirmed recovery mirror");
  } catch {
    // The actor's primary was confirmed. Its optional legacy mirror may fail.
  }
}

/** Refuse foreign/damaged copies and never delete another actor's mirror. */
export function discardRecoveryCopy(
  storage: Pick<Storage, "getItem" | "removeItem">,
  baseKey: string,
  actorId?: string
): boolean {
  const primaryKey = recoveryCopyStorageKey(baseKey, actorId);
  const primary = storage.getItem(primaryKey);
  const key = primary !== null || primaryKey === baseKey ? primaryKey : baseKey;
  const existing = key === primaryKey ? primary : storage.getItem(baseKey);
  if (existing === null || !usableSerializedCopy(existing, actorId)) return false;
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error("Unconfirmed recovery discard");
  if (key !== baseKey) {
    const mirror = storage.getItem(baseKey);
    // A later distinct copy is not the copy the user just discarded.
    if (mirror === existing && usableSerializedCopy(mirror, actorId)) {
      storage.removeItem(baseKey);
      if (storage.getItem(baseKey) !== null) throw new Error("Unconfirmed recovery mirror discard");
    }
  }
  return true;
}
