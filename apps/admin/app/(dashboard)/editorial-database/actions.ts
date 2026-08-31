"use server";

import { revalidatePath } from "next/cache";

import { ensureCountryEnglishProfile } from "@/lib/auto-translate-country-profile";
import { ensureWriterEnglishBiography } from "@/lib/auto-translate-writer-biography";
import { requireStaff } from "@/lib/auth";
import {
  loadEditorialCatalog,
  type EditorialCatalog,
} from "@/lib/editorial-catalog";
import {
  countryProfileFields,
  parseEditorialProfileOverride,
  preserveProtectedEditorialField,
  preserveUneditedEditorialFields,
  resolveEditorialSourceFields,
  writerProfileFields,
} from "@/lib/editorial-profile-edit";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildWriterBiographySaveModel,
  type WriterBiographyLocale,
  type WriterBiographyLocaleEditorInput,
} from "@/lib/writer-biography-edit";

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

function biographyLocaleFormValues(
  formData: FormData,
  locale: WriterBiographyLocale
): WriterBiographyLocaleEditorInput {
  return {
    enabled: formData.get(`${locale}_enabled`) === "1",
    text: formData.get(`${locale}_text`),
    sourceLanguage: formData.get(`${locale}_source_language`),
    status: formData.get(`${locale}_status`),
    method: formData.get(`${locale}_method`),
    reviewedAt: formData.get(`${locale}_reviewed_at`),
    reviewer: formData.get(`${locale}_reviewer`),
    translatedFromLocale: formData.get(`${locale}_translated_from_locale`),
    sourceTextRights: formData.get(`${locale}_source_text_rights`),
    sourcesJson: formData.get(`${locale}_sources_json`),
  };
}

function editorialSourceFields(
  editorialCatalog: EditorialCatalog,
  countryId: string,
  writerId: string | null
) {
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
  try {
    edit = parseEditorialProfileOverride({
      entityType,
      countryId,
      writerId,
      enabledFields: formData.getAll("enabled_fields"),
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
    (existing && expectedUpdatedAt !== existing.updated_at) ||
    (!existing && Boolean(expectedUpdatedAt))
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
  const protectedFields = preserveProtectedEditorialField(
    edit.fields,
    existingFields,
    protectedField
  );
  // The structured biography editor owns biographyTranslations. Legacy text
  // overrides remain readable by the public exporter during migration, but
  // they are intentionally hidden from this generic form. Preserve them on
  // unrelated profile edits so an ordinary name/works change cannot erase
  // the currently published biography.
  const persistedFields = isWriter
    ? preserveUneditedEditorialFields(protectedFields, existingFields, [
        "bio",
        "biography",
      ])
    : protectedFields;

  const willRemove = !Object.keys(persistedFields).length;
  const sourceFields = willRemove
    ? null
    : resolveEditorialSourceFields(
        editorialSourceFields(
          await loadEditorialCatalog(),
          edit.countryId,
          edit.writerId
        ),
        edit.fields
      );
  let databaseId =
    existing?.id ||
    `${edit.countryId}${edit.writerId ? `:${edit.writerId}` : ""}`;
  let action = `${edit.entityType}_profile.updated`;
  let result: "saved" | "removed" = "saved";

  if (willRemove) {
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

  let translation: {
    state: string;
    model?: string;
    reviewerModel?: string | null;
    error?: string;
  } = { state: "skipped" };
  if (sourceFields) {
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
        protectedLocaleMapPreserved: Object.hasOwn(
          existingFields,
          protectedField
        ),
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

export async function saveWriterBiographyAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");

  const countryId = String(formData.get("country_id") || "");
  const writerId = String(formData.get("writer_id") || "");
  const expectedUpdatedAt = String(
    formData.get("expected_updated_at") || ""
  ).trim();
  try {
    parseEditorialProfileOverride({
      entityType: "writer",
      countryId,
      writerId,
      enabledFields: [],
      values: {},
    });
  } catch (error) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message:
          error instanceof Error
            ? error.message
            : "Некорректная карточка писателя.",
      })
    );
  }

  const editorialCatalog = await loadEditorialCatalog();
  const sourceFields = editorialSourceFields(editorialCatalog, countryId, writerId);
  if (!Object.keys(sourceFields).length) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message: "Писатель отсутствует в закрытом редакционном каталоге.",
      })
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message: "База данных не подключена.",
      })
    );
  }

  const existingResponse = await supabase
    .from("writer_profile_overrides")
    .select("id,fields,updated_at")
    .eq("country_id", countryId)
    .eq("writer_id", writerId)
    .maybeSingle();
  if (existingResponse.error) {
    redirect(
      targetUrl({
        countryId,
        writerId,
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
    (existing && expectedUpdatedAt !== existing.updated_at) ||
    (!existing && Boolean(expectedUpdatedAt))
  ) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message:
          "Запись уже изменена в другой вкладке. Обновите страницу и повторите правку.",
      })
    );
  }

  const existingFields = objectValue(existing?.fields);
  let model: ReturnType<typeof buildWriterBiographySaveModel>;
  try {
    model = buildWriterBiographySaveModel({
      sourceTranslations: sourceFields.biographyTranslations,
      overrideTranslations: existingFields.biographyTranslations,
      ru: biographyLocaleFormValues(formData, "ru"),
      en: biographyLocaleFormValues(formData, "en"),
      confirmManualEnglishAgainstRussianChange:
        formData.get("confirm_manual_en_against_ru") === "1",
      manualEnglishConfirmationDate: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message:
          error instanceof Error
            ? error.message
            : "Проверьте структурированную биографию.",
      })
    );
  }

  const fields = { ...existingFields };
  if (Object.keys(model.biographyTranslations).length) {
    fields.biographyTranslations = model.biographyTranslations;
  } else {
    delete fields.biographyTranslations;
  }
  const payload = {
    country_id: countryId,
    writer_id: writerId,
    fields,
    is_enabled: true,
    updated_by: session.user.id,
  };
  const saved = existing
    ? await supabase
        .from("writer_profile_overrides")
        .update(payload)
        .eq("id", existing.id)
        .eq("updated_at", existing.updated_at)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("writer_profile_overrides")
        .insert(payload)
        .select("id")
        .maybeSingle();
  if (saved.error || !saved.data) {
    redirect(
      targetUrl({
        countryId,
        writerId,
        result: "error",
        message:
          saved.error?.message ||
          "Биография изменилась параллельно. Обновите страницу и повторите правку.",
      })
    );
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "writer_profile.biography.saved",
    entity_type: "writer_profile",
    entity_id: saved.data.id,
    metadata: {
      countryId,
      writerId,
      locales: Object.keys(model.biographyTranslations),
      russianSourceChanged: model.russianSourceChanged,
      machineEnglishInvalidated: model.invalidatedMachineEnglish,
      manualEnglishConfirmedAgainstRussianChange:
        model.manualEnglishConfirmedAgainstRussianChange,
      editor: "structured-writer-biography",
    },
  });
  let publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "writer_profile",
    entityId: saved.data.id,
    reason: "writer_profile.biography.saved",
    metadata: {
      countryId,
      writerId,
      locales: Object.keys(model.biographyTranslations),
      russianSourceChanged: model.russianSourceChanged,
      machineEnglishInvalidated: model.invalidatedMachineEnglish,
      manualEnglishConfirmedAgainstRussianChange:
        model.manualEnglishConfirmedAgainstRussianChange,
      auditError: auditError?.message || null,
    },
  });

  // The accepted RU edit and its public-build request are durable before any
  // external AI work begins. A slow or interrupted translation therefore
  // cannot strand the Russian biography without an audit trail or release.
  const translation = await ensureWriterEnglishBiography({
    supabase,
    actorId: session.user.id,
    countryId,
    writerId,
    sourceFields,
    replaceEnglishTombstone: model.invalidatedMachineEnglish,
  });
  if (translation.state === "translated") {
    publication = await requestPublicBuild({
      supabase,
      actorId: session.user.id,
      entityType: "writer_profile",
      entityId: translation.overrideId || saved.data.id,
      reason: "writer_profile.biography.english_generated",
      metadata: {
        countryId,
        writerId,
        locale: "en",
        translationModel: translation.model || null,
        translationReviewerModel: translation.reviewerModel || null,
        source: "structured-writer-biography",
      },
    });
  }

  revalidatePath("/editorial-database");
  revalidatePath("/translations");
  const params = new URLSearchParams({
    country_id: countryId,
    writer_id: writerId,
    result: "biography-saved",
    publication: publication.state,
    translation: translation.state,
  });
  if (auditError) params.set("warning", "audit");
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
