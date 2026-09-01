"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { parseBookEditionEdit } from "@/lib/book-edition-edit";
import { isValidIsbn, normalizeIsbn } from "@/lib/isbn";
import { libraryCatalogFormHref } from "@/lib/library-catalog-query";
import {
  parseWorkspaceDelete,
  parseWorkExternalId,
  parseWorkImportCandidateReview,
  parseWorkSourceEdit,
  parseWorkTranslationEdit,
} from "@/lib/literary-work-workspace";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const editionSchema = z.object({
  workId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  isbn10: z.string().trim().max(32).nullable(),
  isbn13: z.string().trim().max(32).nullable(),
  publisher: z.string().trim().max(240),
  publicationYear: z.number().int().min(1400).max(2100).nullable(),
  language: z.string().trim().max(120),
  pageCount: z.number().int().positive().nullable(),
  coverUrl: z.string().url().nullable(),
  coverSourceUrl: z.string().url().nullable(),
  sourceUrl: z.string().url().nullable(),
  primary: z.boolean(),
});

function optionalText(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function optionalInteger(value: FormDataEntryValue | null) {
  const normalized = optionalText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

function databaseError(error: { message?: string } | null, fallback: string) {
  return new Error(error?.message || fallback);
}

function editionRpcError(error: { code?: string; message?: string } | null) {
  if (error?.code === "40001" || error?.message === "edition-version-conflict") {
    return "Издание уже изменили в другой вкладке. Обновите страницу.";
  }
  if (error?.code === "23505") return "Издание с этим ISBN уже существует.";
  if (error?.message === "edition-not-found") return "Издание не найдено.";
  if (error?.message === "edition-work-is-immutable") {
    return "Перенос издания между произведениями запрещён.";
  }
  return "Издание не сохранено. Проверьте поля и повторите.";
}

function editionEditInput(formData: FormData) {
  return {
    editionId: formData.get("edition_id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
    workId: formData.get("work_id"),
    title: formData.get("title"),
    isbn10: formData.get("isbn_10"),
    isbn13: formData.get("isbn_13"),
    publisher: formData.get("publisher"),
    publicationYear: formData.get("publication_year"),
    language: formData.get("language"),
    format: formData.get("format"),
    pageCount: formData.get("page_count"),
    coverUrl: formData.get("cover_url"),
    coverSourceUrl: formData.get("cover_source_url"),
    coverRightsStatus: formData.get("cover_rights_status"),
    licenseName: formData.get("license_name"),
    licenseUrl: formData.get("license_url"),
    creator: formData.get("creator"),
    rightsHolder: formData.get("rights_holder"),
    rightsCheckedAt: formData.get("rights_checked_at"),
    sourceUrl: formData.get("source_url"),
    primary: formData.get("is_primary"),
  };
}

export async function updateBookEditionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const target = (options: Parameters<typeof libraryCatalogFormHref>[1] = {}) =>
    libraryCatalogFormHref(formData, options);

  let edit: ReturnType<typeof parseBookEditionEdit>;
  try {
    edit = parseBookEditionEdit(editionEditInput(formData));
  } catch (error) {
    redirect(target({
      editionId: formData.get("edition_id"),
      error: error instanceof Error ? error.message : "Проверьте данные издания.",
    }));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(target({ editionId: edit.editionId, error: "База данных не подключена" }));
  }

  const { data: existing, error: existingError } = await supabase
    .from("book_editions")
    .select("id,work_id,is_primary")
    .eq("id", edit.editionId)
    .maybeSingle();
  if (existingError || !existing) {
    redirect(target({
      editionId: edit.editionId,
      error: existingError?.message || "Издание не найдено.",
    }));
  }

  const { error: saveError } = await supabase.rpc("update_book_edition_atomic", {
    p_edition_id: edit.editionId,
    p_expected_updated_at: edit.expectedUpdatedAt,
    p_payload: edit.patch,
  });
  if (saveError) {
    redirect(target({
      editionId: edit.editionId,
      error: editionRpcError(saveError),
    }));
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "book_edition",
    entityId: edit.editionId,
    reason: "book_edition.updated",
  });

  revalidatePath("/library");
  revalidatePath("/history");
  redirect(target({
    editionId: edit.editionId,
    saved: "edition",
    published: publication.state,
  }));
}

export async function saveBookEditionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const target = (options: Parameters<typeof libraryCatalogFormHref>[1] = {}) =>
    libraryCatalogFormHref(formData, options);

  const rawIsbn10 = optionalText(formData.get("isbn_10"));
  const rawIsbn13 = optionalText(formData.get("isbn_13"));
  const isbn10 = rawIsbn10 ? normalizeIsbn(rawIsbn10) : null;
  const isbn13 = rawIsbn13 ? normalizeIsbn(rawIsbn13) : null;

  if (
    (!isbn10 && !isbn13) ||
    (isbn10 && !isValidIsbn(isbn10)) ||
    (isbn13 && !isValidIsbn(isbn13))
  ) {
    redirect(target({ error: "ISBN не прошёл контрольную проверку" }));
  }

  const parsed = editionSchema.safeParse({
    workId: formData.get("work_id"),
    title: formData.get("title"),
    isbn10,
    isbn13,
    publisher: String(formData.get("publisher") || ""),
    publicationYear: optionalInteger(formData.get("publication_year")),
    language: String(formData.get("language") || ""),
    pageCount: optionalInteger(formData.get("page_count")),
    coverUrl: optionalText(formData.get("cover_url")),
    coverSourceUrl: optionalText(formData.get("cover_source_url")),
    sourceUrl: optionalText(formData.get("source_url")),
    primary: formData.get("is_primary") === "on",
  });
  if (!parsed.success) {
    redirect(target({
      error: parsed.error.issues[0]?.message || "Проверьте данные издания",
    }));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена" }));

  const checkedAt = new Date().toISOString().slice(0, 10);
  const primaryIsbn = parsed.data.isbn13 || parsed.data.isbn10!;
  const legacyId = `isbn:${primaryIsbn}`;
  const { data: existingByLegacyId, error: existingByLegacyIdError } = await supabase
    .from("book_editions")
    .select("id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  if (existingByLegacyIdError) {
    redirect(target({
      error: existingByLegacyIdError.message || "Не удалось проверить существующее издание.",
    }));
  }
  if (existingByLegacyId?.id) {
    redirect(`${target({
      editionId: existingByLegacyId.id,
      notice: "edition-exists",
    })}#edition-editor`);
  }
  const hasCover = Boolean(
    parsed.data.coverUrl && parsed.data.coverSourceUrl
  );
  const payload = {
    legacy_id: legacyId,
    work_id: parsed.data.workId,
    title: parsed.data.title,
    isbn_10: parsed.data.isbn10,
    isbn_13: parsed.data.isbn13,
    publisher: parsed.data.publisher,
    publication_year: parsed.data.publicationYear,
    language: parsed.data.language,
    format: String(formData.get("format") || "").trim(),
    page_count: parsed.data.pageCount,
    cover_url: hasCover ? parsed.data.coverUrl : null,
    cover_source_url: hasCover ? parsed.data.coverSourceUrl : null,
    cover_rights_status: hasCover ? "external-preview" : "unverified",
    license_name: "",
    license_url: null,
    creator: "",
    rights_holder: "",
    rights_checked_at: hasCover ? checkedAt : null,
    source_url: parsed.data.sourceUrl,
    is_primary: parsed.data.primary,
    metadata: {
      importedBy: "exact-isbn",
      importedAt: new Date().toISOString(),
    },
  };
  const { data, error: saveError } = await supabase.rpc(
    "create_book_edition_atomic",
    { p_payload: payload }
  );
  const savedId =
    data && typeof data === "object" && !Array.isArray(data) &&
    typeof (data as { id?: unknown }).id === "string"
      ? (data as { id: string }).id
      : null;
  if (saveError || !savedId) {
    if (saveError?.code === "23505") {
      const { data: collidedEdition } = await supabase
        .from("book_editions")
        .select("id")
        .eq("legacy_id", legacyId)
        .maybeSingle();
      if (collidedEdition?.id) {
        redirect(`${target({
          editionId: collidedEdition.id,
          notice: "edition-exists",
        })}#edition-editor`);
      }
    }
    redirect(target({ error: editionRpcError(saveError) }));
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "book_edition",
    entityId: savedId,
    reason: "book_edition.created",
  });

  revalidatePath("/library");
  redirect(target({
    editionId: savedId,
    saved: "edition",
    published: publication.state,
  }));
}

type AdminSupabase = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;

function workspaceHref(
  formData: FormData,
  options: Parameters<typeof libraryCatalogFormHref>[1] = {}
) {
  return `${libraryCatalogFormHref(formData, options)}#work-workspace`;
}

function workspaceInput(formData: FormData) {
  return {
    workId: formData.get("work_id"),
    translationId: formData.get("translation_id"),
    sourceId: formData.get("source_id"),
    externalIdRowId: formData.get("external_id_row_id"),
    candidateId: formData.get("candidate_id"),
    expectedUpdatedAt: formData.get("expected_updated_at"),
    locale: formData.get("locale"),
    title: formData.get("title"),
    description: formData.get("description"),
    sourceLanguage: formData.get("source_language"),
    translationMethod: formData.get("translation_method"),
    editorialStatus: formData.get("editorial_status"),
    sourceUrls: formData.get("source_urls"),
    reviewedAt: formData.get("reviewed_at"),
    provider: formData.get("provider"),
    sourceUrl: formData.get("source_url"),
    fieldNames: formData.get("field_names"),
    licenseName: formData.get("license_name"),
    usage: formData.get("usage"),
    retrievedAt: formData.get("retrieved_at"),
    scheme: formData.get("scheme"),
    externalId: formData.get("external_id"),
    qualityScore: formData.get("quality_score"),
    status: formData.get("status"),
    rejectionReasons: formData.get("rejection_reasons"),
  };
}

async function finishWorkspaceMutation({
  supabase,
  actorId,
  action,
  entityType,
  entityId,
  workId,
  metadata = {},
}: {
  supabase: AdminSupabase;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  workId: string;
  metadata?: Record<string, unknown>;
}) {
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    // Group subrecord events under the work in the history catalog while
    // retaining the exact changed row for forensic inspection.
    entity_id: workId,
    metadata: { ...metadata, workId, recordId: entityId },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId,
    entityType,
    entityId,
    reason: action,
    metadata: { ...metadata, workId },
  });
  revalidatePath("/library");
  revalidatePath("/history");
  return { publication: publication.state, auditError };
}

function workspaceMutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function saveWorkTranslationAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let edit: ReturnType<typeof parseWorkTranslationEdit>;
  try {
    edit = parseWorkTranslationEdit(workspaceInput(formData));
  } catch (error) {
    redirect(workspaceHref(formData, {
      error: workspaceMutationError(error, "Проверьте перевод произведения."),
    }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));

  const query = edit.translationId
    ? supabase
        .from("literary_work_translations")
        .update(edit.patch)
        .eq("id", edit.translationId)
        .eq("work_id", edit.workId)
        .eq("updated_at", edit.expectedUpdatedAt!)
    : supabase.from("literary_work_translations").insert({
        work_id: edit.workId,
        locale: edit.locale,
        ...edit.patch,
      });
  const { data: saved, error } = await query.select("id").maybeSingle();
  if (error || !saved) {
    redirect(workspaceHref(formData, {
      error:
        error?.message ||
        "Перевод уже изменён в другой вкладке. Обновите страницу и повторите правку.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: edit.translationId
      ? "literary_work_translation.updated"
      : "literary_work_translation.created",
    entityType: "literary_work_translation",
    entityId: saved.id,
    workId: edit.workId,
    metadata: { locale: edit.locale, status: edit.patch.editorial_status },
  });
  redirect(workspaceHref(formData, {
    saved: "workspace",
    published: outcome.publication,
    error: outcome.auditError
      ? `Перевод сохранён, но журнал аудита недоступен: ${outcome.auditError.message}`
      : undefined,
  }));
}

export async function deleteWorkTranslationAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let identity: ReturnType<typeof parseWorkspaceDelete>;
  try {
    identity = parseWorkspaceDelete({
      workId: formData.get("work_id"),
      rowId: formData.get("translation_id"),
      expectedUpdatedAt: formData.get("expected_updated_at"),
    });
    if (!identity.expectedUpdatedAt) throw new Error("Версия перевода не указана.");
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Некорректный перевод.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  const { data: deleted, error } = await supabase
    .from("literary_work_translations")
    .delete()
    .eq("id", identity.rowId)
    .eq("work_id", identity.workId)
    .eq("updated_at", identity.expectedUpdatedAt!)
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    redirect(workspaceHref(formData, {
      error: error?.message || "Перевод уже изменён. Обновите страницу перед удалением.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "literary_work_translation.deleted",
    entityType: "literary_work_translation",
    entityId: deleted.id,
    workId: identity.workId,
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

export async function saveWorkSourceAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let edit: ReturnType<typeof parseWorkSourceEdit>;
  try {
    edit = parseWorkSourceEdit(workspaceInput(formData));
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Проверьте источник.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  const query = edit.sourceId
    ? supabase
        .from("literary_work_sources")
        .update(edit.patch)
        .eq("id", edit.sourceId)
        .eq("work_id", edit.workId)
        .eq("updated_at", edit.expectedUpdatedAt!)
    : supabase.from("literary_work_sources").insert({
        work_id: edit.workId,
        ...edit.patch,
      });
  const { data: saved, error } = await query.select("id").maybeSingle();
  if (error || !saved) {
    redirect(workspaceHref(formData, {
      error: error?.message || "Источник уже изменён. Обновите страницу и повторите правку.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: edit.sourceId ? "literary_work_source.updated" : "literary_work_source.created",
    entityType: "literary_work_source",
    entityId: saved.id,
    workId: edit.workId,
    metadata: { provider: edit.patch.provider, usage: edit.patch.usage },
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

export async function deleteWorkSourceAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let identity: ReturnType<typeof parseWorkspaceDelete>;
  try {
    identity = parseWorkspaceDelete({
      workId: formData.get("work_id"),
      rowId: formData.get("source_id"),
      expectedUpdatedAt: formData.get("expected_updated_at"),
    });
    if (!identity.expectedUpdatedAt) throw new Error("Версия источника не указана.");
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Некорректный источник.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  const { data: deleted, error } = await supabase
    .from("literary_work_sources")
    .delete()
    .eq("id", identity.rowId)
    .eq("work_id", identity.workId)
    .eq("updated_at", identity.expectedUpdatedAt!)
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    redirect(workspaceHref(formData, {
      error: error?.message || "Источник уже изменён. Обновите страницу перед удалением.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "literary_work_source.deleted",
    entityType: "literary_work_source",
    entityId: deleted.id,
    workId: identity.workId,
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

export async function addWorkExternalIdAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let edit: ReturnType<typeof parseWorkExternalId>;
  try {
    edit = parseWorkExternalId(workspaceInput(formData));
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Проверьте идентификатор.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  const { data: saved, error } = await supabase
    .from("literary_work_external_ids")
    .insert({
      work_id: edit.workId,
      scheme: edit.scheme,
      external_id: edit.externalId,
      source_url: edit.sourceUrl,
    })
    .select("id")
    .maybeSingle();
  if (error || !saved) {
    redirect(workspaceHref(formData, { error: error?.message || "Идентификатор не сохранён." }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "literary_work_external_id.created",
    entityType: "literary_work_external_id",
    entityId: saved.id,
    workId: edit.workId,
    metadata: { scheme: edit.scheme },
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

export async function updateWorkExternalIdAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let edit: ReturnType<typeof parseWorkExternalId>;
  let expected: ReturnType<typeof parseWorkExternalId>;
  try {
    edit = parseWorkExternalId(workspaceInput(formData));
    expected = parseWorkExternalId({
      workId: formData.get("work_id"),
      externalIdRowId: formData.get("external_id_row_id"),
      scheme: formData.get("expected_scheme"),
      externalId: formData.get("expected_external_id"),
      sourceUrl: formData.get("expected_source_url"),
    });
    if (!edit.externalIdRowId || !expected.externalIdRowId) {
      throw new Error("Запись идентификатора не указана.");
    }
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Проверьте идентификатор.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  const { data: saved, error } = await supabase
    .from("literary_work_external_ids")
    .update({
      scheme: edit.scheme,
      external_id: edit.externalId,
      source_url: edit.sourceUrl,
    })
    .eq("id", edit.externalIdRowId!)
    .eq("work_id", edit.workId)
    .eq("scheme", expected.scheme)
    .eq("external_id", expected.externalId)
    .eq("source_url", expected.sourceUrl)
    .select("id")
    .maybeSingle();
  if (error || !saved) {
    redirect(workspaceHref(formData, {
      error: error?.message || "Идентификатор уже изменён. Обновите страницу и повторите правку.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "literary_work_external_id.updated",
    entityType: "literary_work_external_id",
    entityId: saved.id,
    workId: edit.workId,
    metadata: { scheme: edit.scheme, previousScheme: expected.scheme },
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

export async function deleteWorkExternalIdAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let edit: ReturnType<typeof parseWorkExternalId>;
  try {
    edit = parseWorkExternalId({
      ...workspaceInput(formData),
      externalIdRowId: formData.get("external_id_row_id"),
    });
    if (!edit.externalIdRowId) throw new Error("Запись идентификатора не указана.");
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Некорректный идентификатор.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  const { data: deleted, error } = await supabase
    .from("literary_work_external_ids")
    .delete()
    .eq("id", edit.externalIdRowId!)
    .eq("work_id", edit.workId)
    .eq("scheme", edit.scheme)
    .eq("external_id", edit.externalId)
    .eq("source_url", edit.sourceUrl)
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    redirect(workspaceHref(formData, {
      error: error?.message || "Идентификатор уже изменён или удалён. Обновите страницу.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "literary_work_external_id.deleted",
    entityType: "literary_work_external_id",
    entityId: deleted.id,
    workId: edit.workId,
    metadata: { scheme: edit.scheme },
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

async function candidateScope(supabase: AdminSupabase, workId: string) {
  const { data, error } = await supabase
    .from("literary_works")
    .select("country_id,writer_id")
    .eq("id", workId)
    .maybeSingle();
  if (error || !data) throw databaseError(error, "Произведение не найдено.");
  return data;
}

export async function reviewWorkImportCandidateAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let edit: ReturnType<typeof parseWorkImportCandidateReview>;
  try {
    edit = parseWorkImportCandidateReview(workspaceInput(formData));
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Проверьте импорт-кандидата.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  let scope: Awaited<ReturnType<typeof candidateScope>>;
  try {
    scope = await candidateScope(supabase, edit.workId);
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Произведение не найдено.") }));
  }
  const reviewed = edit.status === "reviewed" || edit.status === "promoted";
  const { data: saved, error } = await supabase
    .from("book_import_candidates")
    .update({
      quality_score: edit.qualityScore,
      status: edit.status,
      rejection_reasons: edit.rejectionReasons,
      reviewed_by: reviewed ? session.user.id : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      promoted_work_id: edit.status === "promoted" ? edit.workId : null,
    })
    .eq("id", edit.candidateId)
    .eq("country_id", scope.country_id)
    .eq("writer_id", scope.writer_id)
    .eq("updated_at", edit.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error || !saved) {
    redirect(workspaceHref(formData, {
      error: error?.message || "Импорт-кандидат уже изменён. Обновите страницу и повторите правку.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "book_import_candidate.reviewed",
    entityType: "book_import_candidate",
    entityId: saved.id,
    workId: edit.workId,
    metadata: { status: edit.status, qualityScore: edit.qualityScore },
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}

export async function deleteWorkImportCandidateAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  let identity: ReturnType<typeof parseWorkspaceDelete>;
  try {
    identity = parseWorkspaceDelete({
      workId: formData.get("work_id"),
      rowId: formData.get("candidate_id"),
      expectedUpdatedAt: formData.get("expected_updated_at"),
    });
    if (!identity.expectedUpdatedAt) throw new Error("Версия импорт-кандидата не указана.");
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Некорректный импорт-кандидат.") }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(workspaceHref(formData, { error: "База данных не подключена." }));
  let scope: Awaited<ReturnType<typeof candidateScope>>;
  try {
    scope = await candidateScope(supabase, identity.workId);
  } catch (error) {
    redirect(workspaceHref(formData, { error: workspaceMutationError(error, "Произведение не найдено.") }));
  }
  const { data: deleted, error } = await supabase
    .from("book_import_candidates")
    .delete()
    .eq("id", identity.rowId)
    .eq("country_id", scope.country_id)
    .eq("writer_id", scope.writer_id)
    .eq("updated_at", identity.expectedUpdatedAt!)
    .in("status", ["candidate", "rejected"])
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    redirect(workspaceHref(formData, {
      error:
        error?.message ||
        "Удалять можно только необработанные или отклонённые записи. Обновите страницу.",
    }));
  }
  const outcome = await finishWorkspaceMutation({
    supabase,
    actorId: session.user.id,
    action: "book_import_candidate.deleted",
    entityType: "book_import_candidate",
    entityId: deleted.id,
    workId: identity.workId,
  });
  redirect(workspaceHref(formData, { saved: "workspace", published: outcome.publication }));
}
