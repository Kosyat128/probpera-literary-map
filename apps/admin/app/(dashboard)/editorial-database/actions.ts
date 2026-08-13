"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import {
  countryProfileFields,
  parseEditorialProfileOverride,
  writerProfileFields,
} from "@/lib/editorial-profile-edit";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formValues(formData: FormData, fields: readonly string[]) {
  const values: Record<string, unknown> = Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) || "")])
  );
  values.coordinates = {
    lat: String(formData.get("coordinates_lat") || ""),
    lng: String(formData.get("coordinates_lng") || ""),
  };
  return values;
}

function targetUrl({
  countryId,
  writerId,
  result,
  message,
}: {
  countryId: string;
  writerId: string | null;
  result: "saved" | "removed" | "published" | "error";
  message?: string;
}) {
  const params = new URLSearchParams({ country_id: countryId });
  if (writerId) params.set("writer_id", writerId);
  params.set(result === "error" ? "error" : "result", result === "error" ? message || "Ошибка" : result);
  return `/editorial-database?${params.toString()}`;
}

export async function saveEditorialProfileAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");

  const entityType = String(formData.get("entity_type") || "");
  const countryId = String(formData.get("country_id") || "");
  const writerId = String(formData.get("writer_id") || "") || null;
  const expectedUpdatedAt = String(
    formData.get("expected_updated_at") || ""
  ).trim();
  let edit: ReturnType<typeof parseEditorialProfileOverride>;
  try {
    edit = parseEditorialProfileOverride({
      entityType,
      countryId,
      writerId,
      enabledFields: formData.getAll("enabled_fields"),
      values: formValues(
        formData,
        entityType === "country" ? countryProfileFields : writerProfileFields
      ),
    });
  } catch (error) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message: error instanceof Error ? error.message : "Проверьте поля профиля.",
      })
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(
      targetUrl({
        countryId: edit.countryId,
        writerId: edit.writerId,
        result: "error",
        message: "База данных не подключена.",
      })
    );
  }

  const isWriter = edit.entityType === "writer";
  const table = isWriter
    ? "writer_profile_overrides"
    : "country_profile_overrides";
  let databaseId = `${edit.countryId}${edit.writerId ? `:${edit.writerId}` : ""}`;
  let action = `${edit.entityType}_profile.updated`;
  let result: "saved" | "removed" = "saved";

  if (!Object.keys(edit.fields).length) {
    let deleteQuery = supabase.from(table).delete().eq("country_id", edit.countryId);
    if (isWriter) deleteQuery = deleteQuery.eq("writer_id", edit.writerId!);
    if (expectedUpdatedAt) {
      deleteQuery = deleteQuery.eq("updated_at", expectedUpdatedAt);
    }
    const { data: deleted, error } = await deleteQuery.select("id").maybeSingle();
    if (error) {
      redirect(
        targetUrl({
          countryId: edit.countryId,
          writerId: edit.writerId,
          result: "error",
          message: error.message,
        })
      );
    }
    if (expectedUpdatedAt && !deleted) {
      redirect(
        targetUrl({
          countryId: edit.countryId,
          writerId: edit.writerId,
          result: "error",
          message: "Запись уже изменена в другой вкладке. Обновите страницу и повторите правку.",
        })
      );
    }
    action = `${edit.entityType}_profile.override_removed`;
    result = "removed";
  } else {
    const payload = {
      country_id: edit.countryId,
      ...(isWriter ? { writer_id: edit.writerId } : {}),
      fields: edit.fields,
      is_enabled: true,
      updated_by: session.user.id,
    };
    let data: { id: string } | null = null;
    let error: { message: string } | null = null;
    if (expectedUpdatedAt) {
      let updateQuery = supabase
        .from(table)
        .update(payload)
        .eq("country_id", edit.countryId)
        .eq("updated_at", expectedUpdatedAt);
      if (isWriter) updateQuery = updateQuery.eq("writer_id", edit.writerId!);
      const response = await updateQuery.select("id").maybeSingle();
      data = response.data;
      error = response.error;
      if (!error && !data) {
        redirect(
          targetUrl({
            countryId: edit.countryId,
            writerId: edit.writerId,
            result: "error",
            message: "Запись уже изменена в другой вкладке. Обновите страницу и повторите правку.",
          })
        );
      }
    } else {
      const response = await supabase.from(table).insert(payload).select("id").single();
      data = response.data;
      error = response.error;
    }
    if (error || !data) {
      redirect(
        targetUrl({
          countryId: edit.countryId,
          writerId: edit.writerId,
          result: "error",
          message:
            error?.message ||
            "Профиль не сохранён. Возможно, запись уже создана в другой вкладке; обновите страницу.",
        })
      );
    }
    databaseId = data.id;
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: `${edit.entityType}_profile`,
    entity_id: databaseId,
    metadata: {
      countryId: edit.countryId,
      writerId: edit.writerId,
      fields: Object.keys(edit.fields),
      editor: "editorial-database",
    },
  });

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: `${edit.entityType}_profile`,
    entityId: databaseId,
    reason: action,
    metadata: {
      countryId: edit.countryId,
      writerId: edit.writerId,
      fields: Object.keys(edit.fields),
      auditError: auditError?.message || null,
    },
  });

  revalidatePath("/editorial-database");
  revalidatePath("/library");
  revalidatePath("/homepage");
  const params = new URLSearchParams({
    country_id: edit.countryId,
    result,
    publication: publication.state,
  });
  if (edit.writerId) params.set("writer_id", edit.writerId);
  if (auditError) params.set("warning", "audit");
  redirect(`/editorial-database?${params.toString()}`);
}

export async function publishEditorialDatabaseAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/editorial-database?error=База+данных+не+подключена");
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "editorial_database",
    entityId: "all",
    reason: "editorial_database.publish_all",
  });
  const params = new URLSearchParams({
    result: "published",
    publication: publication.state,
    country_id: String(formData.get("country_id") || ""),
  });
  const writerId = String(formData.get("writer_id") || "");
  if (writerId) params.set("writer_id", writerId);
  redirect(`/editorial-database?${params.toString()}`);
}
