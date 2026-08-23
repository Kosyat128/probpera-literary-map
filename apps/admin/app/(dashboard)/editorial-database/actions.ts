"use server";

import { revalidatePath } from "next/cache";

import { ensureCountryEnglishProfile } from "@/lib/auto-translate-country-profile";
import { ensureWriterEnglishBiography } from "@/lib/auto-translate-writer-biography";
import { requireStaff } from "@/lib/auth";
import { editorialCatalog } from "@/lib/editorial-catalog";
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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function editorialSourceFields(countryId: string, writerId: string | null) {
  const country = editorialCatalog.countries.find(
    (candidate) => candidate.id === countryId
  );
  if (!country) return {};
  if (!writerId) return objectValue(country.fields);
  return objectValue(
    country.writers.find((candidate) => candidate.id === writerId)?.fields
  );
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
  params.set(
    result === "error" ? "error" : "result",
    result === "error" ? message || "Ошибка" : result
  );
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
  const profileFields =
    entityType === "country" ? countryProfileFields : writerProfileFields;
  const submittedValues = formValues(formData, profileFields);
  let edit: ReturnType<typeof parseEditorialProfileOverride>;
  let completeSource: ReturnType<typeof parseEditorialProfileOverride>;
  try {
    edit = parseEditorialProfileOverride({
      entityType,
      countryId,
      writerId,
      enabledFields: formData.getAll("enabled_fields"),
      values: submittedValues,
    });
    completeSource = parseEditorialProfileOverride({
      entityType,
      countryId,
      writerId,
      enabledFields: profileFields,
      values: submittedValues,
    });
  } catch (error) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message:
          error instanceof Error ? error.message : "Проверьте поля профиля.",
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
  let existingQuery = supabase
    .from(table)
    .select("id,fields,updated_at")
    .eq("country_id", edit.countryId);
  if (isWriter) existingQuery = existingQuery.eq("writer_id", edit.writerId!);
  const existingResponse = await existingQuery.maybeSingle();
  if (existingResponse.error) {
    redirect(
      targetUrl({
        countryId: edit.countryId,
        writerId: edit.writerId,
        result: "error",
        message: existingResponse.error.message,
      })
    );
  }
  const existing = existingResponse.data as {
    id: string;
    fields: unknown;
    updated_at: string;
  } | null;
  if (
    expectedUpdatedAt &&
    (!existing || existing.updated_at !== expectedUpdatedAt)
  ) {
    redirect(
      targetUrl({
        countryId: edit.countryId,
        writerId: edit.writerId,
        result: "error",
        message:
          "Запись уже изменена в другой вкладке. Обновите страницу и повторите правку.",
      })
    );
  }

  const protectedField = isWriter
    ? "biographyTranslations"
    : "translations";
  const existingFields = objectValue(existing?.fields);
  const protectedValue = objectValue(existingFields[protectedField]);
  const persistedFields = {
    ...edit.fields,
    ...(Object.keys(protectedValue).length
      ? { [protectedField]: protectedValue }
      : {}),
  };

  let databaseId =
    existing?.id ||
    `${edit.countryId}${edit.writerId ? `:${edit.writerId}` : ""}`;
  let action = `${edit.entityType}_profile.updated`;
  let result: "saved" | "removed" = "saved";

  if (!Object.keys(persistedFields).length) {
    let deleteQuery = supabase
      .from(table)
      .delete()
      .eq("country_id", edit.countryId);
    if (isWriter) deleteQuery = deleteQuery.eq("writer_id", edit.writerId!);
    if (existing?.updated_at) {
      deleteQuery = deleteQuery.eq("updated_at", existing.updated_at);
    }
    const { data: deleted, error } = await deleteQuery
      .select("id")
      .maybeSingle();
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
    if (existing && !deleted) {
      redirect(
        targetUrl({
          countryId: edit.countryId,
          writerId: edit.writerId,
          result: "error",
          message:
            "Запись уже изменена в другой вкладке. Обновите страницу и повторите правку.",
        })
      );
    }
    action = `${edit.entityType}_profile.override_removed`;
    result = "removed";
  } else {
    const payload = {
      country_id: edit.countryId,
      ...(isWriter ? { writer_id: edit.writerId } : {}),
      fields: persistedFields,
      is_enabled: true,
      updated_by: session.user.id,
    };
    let data: { id: string } | null = null;
    let error: { message: string } | null = null;
    if (existing) {
      let updateQuery = supabase
        .from(table)
        .update(payload)
        .eq("id", existing.id)
        .eq("updated_at", existing.updated_at);
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
            message:
              "Запись уже изменена в другой вкладке. Обновите страницу и повторите правку.",
          })
        );
      }
    } else {
      const response = await supabase
        .from(table)
        .insert(payload)
        .select("id")
        .single();
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

  const sourceFields = {
    ...editorialSourceFields(edit.countryId, edit.writerId),
    ...completeSource.fields,
  };
  let translation: {
    state: string;
    model?: string;
    reviewerModel?: string | null;
    error?: string;
  } = { state: "skipped" };
  if (result !== "removed") {
    translation = isWriter
      ? await ensureWriterEnglishBiography({
          supabase,
          actorId: session.user.id,
          countryId: edit.countryId,
          writerId: edit.writerId!,
          sourceFields,
        })
      : await ensureCountryEnglishProfile({
          supabase,
          actorId: session.user.id,
          countryId: edit.countryId,
          sourceFields,
        });
  }

  const { error: auditError } = await supabase
    .from("admin_audit_log")
    .insert({
      actor_id: session.user.id,
      action,
      entity_type: `${edit.entityType}_profile`,
      entity_id: databaseId,
      metadata: {
        countryId: edit.countryId,
        writerId: edit.writerId,
        fields: Object.keys(edit.fields),
        protectedEnglishStatePreserved: Object.keys(protectedValue).length > 0,
        autoTranslationState: translation.state,
        autoTranslationModel: translation.model || null,
        autoTranslationReviewerModel: translation.reviewerModel || null,
        autoTranslationError: translation.error?.slice(0, 500) || null,
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
      translationState: translation.state,
      translationModel: translation.model || null,
      translationReviewerModel: translation.reviewerModel || null,
      translationError: translation.error?.slice(0, 500) || null,
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
    translation: translation.state,
  });
  if (edit.writerId) params.set("writer_id", edit.writerId);
  if (auditError) params.set("warning", "audit");
  if (
    translation.state === "failed" ||
    translation.state === "conflict" ||
    translation.state === "not-configured"
  ) {
    params.set("warning", `translation-${translation.state}`);
  }
  redirect(`/editorial-database?${params.toString()}`);
}

export async function publishEditorialDatabaseAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect("/editorial-database?error=База+данных+не+подключена");
  }
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
