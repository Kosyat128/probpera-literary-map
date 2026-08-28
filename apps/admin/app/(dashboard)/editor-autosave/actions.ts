"use server";

import { createHash } from "node:crypto";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import {
  EDITOR_AUTOSAVE_MAX_SNAPSHOT_BYTES,
  EDITOR_AUTOSAVE_RETENTION_DAYS,
  type EditorAutosaveReceipt,
  type EditorAutosaveRecovery,
} from "@/lib/editor-autosave";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const locatorSchema = z.object({
  entityType: z.enum(["article", "page"]),
  entityId: z.string().uuid().nullable(),
  draftScope: z.string().trim().min(1).max(160),
  localeScope: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[a-z][a-z0-9_-]*$/u),
  baseUpdatedAt: z.string().datetime({ offset: true }).nullable(),
});

const saveSchema = locatorSchema.extend({
  clientSessionId: z.string().uuid(),
  clientSequence: z.number().int().positive().safe(),
  snapshotText: z.string().min(2).max(EDITOR_AUTOSAVE_MAX_SNAPSHOT_BYTES),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  clientSessionId: z.string().uuid(),
  sequence: z.number().int().positive().safe(),
  snapshotHash: z.string().regex(/^[0-9a-f]{64}$/u),
});

const receiptSchema = z.object({
  id: z.string().uuid(),
  state: z.enum(["saved", "conflict"]),
  sequence: z.number().int().positive(),
  snapshotHash: z.string().regex(/^[0-9a-f]{64}$/u),
  baseUpdatedAt: z.string().nullable(),
  updatedAt: z.string(),
  expiresAt: z.string(),
});

function requireSnapshotObject(snapshotText: string) {
  if (Buffer.byteLength(snapshotText, "utf8") > EDITOR_AUTOSAVE_MAX_SNAPSHOT_BYTES) {
    throw new Error("Автокопия превышает безопасный размер 3,2 МБ.");
  }
  const snapshot = JSON.parse(snapshotText) as unknown;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Некорректный снимок редактора.");
  }
  return snapshot as Record<string, unknown>;
}

export async function saveEditorAutosaveAction(
  rawInput: unknown
): Promise<
  | { ok: true; receipt: EditorAutosaveReceipt }
  | { ok: false; error: string }
> {
  const session = await requireStaff();
  if (!session?.user) return { ok: false, error: "Требуется редакторская сессия." };

  const parsed = saveSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте параметры серверной автокопии." };
  }

  let snapshot: Record<string, unknown>;
  try {
    snapshot = requireSnapshotObject(parsed.data.snapshotText);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Некорректная автокопия.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, error: "База данных не подключена." };

  const snapshotHash = createHash("sha256")
    .update(parsed.data.snapshotText, "utf8")
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + EDITOR_AUTOSAVE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase.rpc("save_editor_autosave", {
    p_entity_type: parsed.data.entityType,
    p_entity_id: parsed.data.entityId,
    p_draft_scope: parsed.data.draftScope,
    p_locale_scope: parsed.data.localeScope,
    p_base_updated_at: parsed.data.baseUpdatedAt,
    p_client_session_id: parsed.data.clientSessionId,
    p_client_sequence: parsed.data.clientSequence,
    p_snapshot_hash: snapshotHash,
    p_snapshot: snapshot,
    p_expires_at: expiresAt,
  });
  if (error) {
    console.error("Editor autosave failed", error);
    return { ok: false, error: "Не удалось сохранить серверную автокопию." };
  }

  const receipt = receiptSchema.safeParse(data);
  if (!receipt.success) {
    console.error("Editor autosave returned an invalid receipt", receipt.error);
    return { ok: false, error: "Сервер вернул некорректное подтверждение." };
  }
  return { ok: true, receipt: receipt.data };
}

export async function loadLatestEditorAutosaveAction(
  rawInput: unknown
): Promise<
  | { ok: true; recovery: EditorAutosaveRecovery | null }
  | { ok: false; error: string }
> {
  const session = await requireStaff();
  if (!session?.user) return { ok: false, error: "Требуется редакторская сессия." };
  const parsed = locatorSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Некорректный адрес автокопии." };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, error: "База данных не подключена." };

  let query = supabase
    .from("editor_autosaves")
    .select(
      "id, client_session_id, client_sequence, snapshot_hash, snapshot, recovery_state, base_updated_at, updated_at, expires_at"
    )
    .eq("actor_id", session.user.id)
    .eq("entity_type", parsed.data.entityType)
    .eq("draft_scope", parsed.data.draftScope)
    .eq("locale_scope", parsed.data.localeScope)
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(1);
  query = parsed.data.entityId
    ? query.eq("entity_id", parsed.data.entityId)
    : query.is("entity_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Editor autosave recovery lookup failed", error);
    return { ok: false, error: "Не удалось проверить серверную автокопию." };
  }
  if (!data) return { ok: true, recovery: null };

  const recovery = {
    id: data.id,
    state: data.recovery_state,
    sequence: data.client_sequence,
    snapshotHash: data.snapshot_hash,
    baseUpdatedAt: data.base_updated_at,
    updatedAt: data.updated_at,
    expiresAt: data.expires_at,
    clientSessionId: data.client_session_id,
    snapshot: data.snapshot,
  };
  const validated = receiptSchema
    .extend({
      clientSessionId: z.string().uuid(),
      snapshot: z.record(z.string(), z.unknown()),
    })
    .safeParse(recovery);
  if (!validated.success) {
    console.error("Editor autosave recovery row is invalid", validated.error);
    return { ok: false, error: "Серверная автокопия повреждена." };
  }
  return { ok: true, recovery: validated.data };
}

export async function deleteExactEditorAutosaveAction(
  rawInput: unknown
): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
  const session = await requireStaff();
  if (!session?.user) return { ok: false, error: "Требуется редакторская сессия." };
  const parsed = deleteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Некорректное подтверждение автокопии." };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, error: "База данных не подключена." };
  const { data, error } = await supabase
    .from("editor_autosaves")
    .delete()
    .eq("actor_id", session.user.id)
    .eq("id", parsed.data.id)
    .eq("client_session_id", parsed.data.clientSessionId)
    .eq("client_sequence", parsed.data.sequence)
    .eq("snapshot_hash", parsed.data.snapshotHash)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Editor autosave exact cleanup failed", error);
    return { ok: false, error: "Не удалось удалить подтверждённую автокопию." };
  }
  return { ok: true, deleted: Boolean(data?.id) };
}
