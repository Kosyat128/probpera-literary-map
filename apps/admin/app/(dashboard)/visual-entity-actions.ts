"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { libraryCatalogFormHref } from "@/lib/library-catalog-query";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild, type PublicationState } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  literaryWorkPatch,
  mergeWriterOverrideFields,
  parseBookEntityId,
  parseVisualEntityEdit,
  parseWriterEntityId,
  type VisualEntityEditInput,
} from "@/lib/visual-entity-edit";

export type VisualEntityEditResult =
  | { ok: true; publication: PublicationState; updatedAt: string }
  | { ok: false; error: string };

export type VisualEntityVersionResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

function normalizedExpectedUpdatedAt(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return ISO_TIMESTAMP_PATTERN.test(normalized) && !Number.isNaN(Date.parse(normalized))
    ? normalized
    : "";
}

export async function getVisualEntityVersionAction(input: {
  entityType: "writer" | "book";
  entityId: string;
}): Promise<VisualEntityVersionResult> {
  const session = await requireStaff();
  if (!session?.user) return { ok: false, error: "Требуется вход в редакцию." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, error: "База данных не подключена." };
  try {
    if (input.entityType === "writer") {
      const identity = parseWriterEntityId(input.entityId);
      const { data, error } = await supabase
        .from("writer_profile_overrides")
        .select("updated_at")
        .eq("country_id", identity.countryId)
        .eq("writer_id", identity.writerId)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, updatedAt: data?.updated_at || "" };
    }
    const identity = parseBookEntityId(input.entityId);
    const { data, error } = await supabase
      .from("literary_works")
      .select("updated_at")
      .eq("legacy_id", identity.entityId)
      .eq("country_id", identity.countryId)
      .eq("writer_id", identity.writerId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Произведение не найдено." };
    return { ok: true, updatedAt: data.updated_at };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Некорректная запись.",
    };
  }
}

export async function saveVisualEntityFieldAction(
  input: VisualEntityEditInput
): Promise<VisualEntityEditResult> {
  const session = await requireStaff();
  if (!session?.user) {
    return { ok: false, error: "Требуется вход в редакцию." };
  }

  let edit: ReturnType<typeof parseVisualEntityEdit>;
  try {
    edit = parseVisualEntityEdit(input);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Некорректное изменение.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "База данных не подключена." };
  }

  const expectedUpdatedAt = normalizedExpectedUpdatedAt(input.expectedUpdatedAt);
  let databaseId = edit.entityId;
  let updatedAt = "";
  if (edit.entityType === "writer") {
    const identity = parseWriterEntityId(edit.entityId);
    const { data: existing, error: readError } = await supabase
      .from("writer_profile_overrides")
      .select("id,fields,updated_at")
      .eq("country_id", identity.countryId)
      .eq("writer_id", identity.writerId)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    if (
      (existing && (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt)) ||
      (!existing && expectedUpdatedAt)
    ) {
      return {
        ok: false,
        error: "Карточку уже изменили в другой вкладке. Выберите поле заново и повторите правку.",
      };
    }

    const payload = {
      country_id: identity.countryId,
      writer_id: identity.writerId,
      fields: {
        ...mergeWriterOverrideFields(existing?.fields, edit.field, edit.value),
      },
      is_enabled: true,
      updated_by: session.user.id,
    };
    const writeQuery = existing
      ? supabase
          .from("writer_profile_overrides")
          .update({
            fields: payload.fields,
            is_enabled: true,
            updated_by: session.user.id,
          })
          .eq("id", existing.id)
          .eq("updated_at", expectedUpdatedAt)
      : supabase.from("writer_profile_overrides").insert(payload);
    const { data, error } = await writeQuery.select("id,updated_at").maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        error:
          error?.message ||
          "Карточку уже изменили в другой вкладке. Обновите страницу и повторите правку.",
      };
    }
    databaseId = data.id;
    updatedAt = data.updated_at;
  } else {
    if (!expectedUpdatedAt) {
      return {
        ok: false,
        error: "Версия произведения не загружена. Выберите поле заново и повторите правку.",
      };
    }
    const identity = parseBookEntityId(edit.entityId);
    const { data, error } = await supabase
      .from("literary_works")
      .update({
        ...literaryWorkPatch(edit.field, edit.value),
        is_cms_locked: true,
        updated_by: session.user.id,
      })
      .eq("legacy_id", edit.entityId)
      .eq("country_id", identity.countryId)
      .eq("writer_id", identity.writerId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id,updated_at")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) {
      return {
        ok: false,
        error: "Произведение не найдено по постоянному идентификатору.",
      };
    }
    databaseId = data.id;
    updatedAt = data.updated_at;
  }

  const action =
    edit.entityType === "writer"
      ? "writer_profile.visual_field_updated"
      : "literary_work.visual_field_updated";
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: edit.entityType === "writer" ? "writer_profile" : "literary_work",
    entity_id: databaseId,
    metadata: {
      stableId: edit.entityId,
      field: edit.field,
      editor: "visual",
    },
  });
  if (auditError) {
    return {
      ok: false,
      error: `Изменение сохранено, но не записано в журнал: ${auditError.message}`,
    };
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: edit.entityType === "writer" ? "writer_profile" : "literary_work",
    entityId: databaseId,
    reason: action,
    metadata: { stableId: edit.entityId, field: edit.field },
  });

  revalidatePath("/homepage");
  revalidatePath("/library");
  return { ok: true, publication: publication.state, updatedAt };
}

export async function saveVisualEntityFieldFormAction(formData: FormData) {
  const entityType = String(formData.get("entity_type") || "");
  const entityId = String(formData.get("entity_id") || "");
  const field = String(formData.get("field") || "");
  const value = String(formData.get("value") || "");
  const result = await saveVisualEntityFieldAction({
    entityType: entityType as VisualEntityEditInput["entityType"],
    entityId,
    field,
    value,
    expectedUpdatedAt: String(formData.get("expected_updated_at") || ""),
  });

  const context: {
    countryId?: string;
    writerId?: string;
    workId?: string;
  } = {};
  try {
    const identity =
      entityType === "writer"
        ? parseWriterEntityId(entityId)
        : parseBookEntityId(entityId);
    context.countryId = identity.countryId;
    context.writerId = identity.writerId;
    if (entityType === "book") context.workId = identity.entityId;
  } catch {
    // The action result already carries the validation error.
  }
  if (result.ok) {
    redirect(
      libraryCatalogFormHref(formData, {
        ...context,
        saved: "entity",
        published: result.publication,
      })
    );
  } else {
    redirect(libraryCatalogFormHref(formData, { ...context, error: result.error }));
  }
}
