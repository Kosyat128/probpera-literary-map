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
  | { ok: true; publication: PublicationState }
  | { ok: false; error: string };

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

  let databaseId = edit.entityId;
  if (edit.entityType === "writer") {
    const identity = parseWriterEntityId(edit.entityId);
    const { data: existing, error: readError } = await supabase
      .from("writer_profile_overrides")
      .select("id,fields,updated_at")
      .eq("country_id", identity.countryId)
      .eq("writer_id", identity.writerId)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };

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
          .eq("updated_at", existing.updated_at)
      : supabase.from("writer_profile_overrides").insert(payload);
    const { data, error } = await writeQuery.select("id").maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        error:
          error?.message ||
          "Карточку уже изменили в другой вкладке. Обновите страницу и повторите правку.",
      };
    }
    databaseId = data.id;
  } else {
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
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) {
      return {
        ok: false,
        error: "Произведение не найдено по постоянному идентификатору.",
      };
    }
    databaseId = data.id;
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
  return { ok: true, publication: publication.state };
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
