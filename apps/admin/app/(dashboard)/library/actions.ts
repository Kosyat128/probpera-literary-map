"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { parseBookEditionEdit } from "@/lib/book-edition-edit";
import { persistWithPrimaryEditionCompensation } from "@/lib/book-edition-primary";
import { isValidIsbn, normalizeIsbn } from "@/lib/isbn";
import { libraryCatalogFormHref } from "@/lib/library-catalog-query";
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

class ExistingBookEditionError extends Error {
  constructor(readonly editionId: string) {
    super("Издание с этим ISBN уже существует.");
    this.name = "ExistingBookEditionError";
  }
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

  try {
    await persistWithPrimaryEditionCompensation({
      enabled: edit.patch.is_primary,
      readPreviousPrimaryIds: async () => {
        const { data, error } = await supabase
          .from("book_editions")
          .select("id")
          .eq("work_id", edit.workId)
          .eq("is_primary", true)
          .neq("id", edit.editionId);
        if (error) throw databaseError(error, "Не удалось проверить основное издание.");
        return (data || []).map((edition) => edition.id);
      },
      demotePreviousPrimaries: async (ids) => {
        const { error } = await supabase
          .from("book_editions")
          .update({ is_primary: false })
          .in("id", [...ids]);
        if (error) throw databaseError(error, "Не удалось сменить основное издание.");
      },
      persist: async () => {
        const { data, error } = await supabase
          .from("book_editions")
          .update(edit.patch)
          .eq("id", edit.editionId)
          .eq("updated_at", edit.expectedUpdatedAt)
          .select("id")
          .maybeSingle();
        if (error || !data) {
          throw databaseError(
            error,
            "Издание уже изменили в другой вкладке. Обновите страницу и повторите правку."
          );
        }
        return data;
      },
      restorePreviousPrimaries: async (ids) => {
        const { error } = await supabase
          .from("book_editions")
          .update({ is_primary: true })
          .in("id", [...ids]);
        if (error) {
          throw databaseError(error, "Не удалось вернуть прежнее основное издание.");
        }
      },
    });
  } catch (error) {
    redirect(target({
      editionId: edit.editionId,
      error: error instanceof Error ? error.message : "Издание не сохранено.",
    }));
  }

  // The 20260813 trigger captures the previous complete row before this
  // update. The audit entry records the user-facing operation separately.
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "book_edition.updated",
    entity_type: "book_edition",
    entity_id: edit.editionId,
    metadata: {
      workId: edit.workId,
      isbn10: edit.patch.isbn_10,
      isbn13: edit.patch.isbn_13,
      primary: edit.patch.is_primary,
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "book_edition",
    entityId: edit.editionId,
    reason: "book_edition.updated",
  });

  revalidatePath("/library");
  revalidatePath("/history");
  if (auditError) {
    redirect(target({
      editionId: edit.editionId,
      saved: "edition",
      published: publication.state,
      error: `Издание сохранено, но журнал аудита недоступен: ${auditError.message}`,
    }));
  }
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
    page_count: parsed.data.pageCount,
    cover_url: hasCover ? parsed.data.coverUrl : null,
    cover_source_url: hasCover ? parsed.data.coverSourceUrl : null,
    cover_rights_status: hasCover ? "external-preview" : "unverified",
    rights_checked_at: hasCover ? checkedAt : null,
    source_url: parsed.data.sourceUrl,
    is_primary: parsed.data.primary,
    metadata: {
      importedBy: "exact-isbn",
      importedAt: new Date().toISOString(),
    },
  };
  let data: { id: string };
  try {
    data = await persistWithPrimaryEditionCompensation({
      enabled: parsed.data.primary,
      readPreviousPrimaryIds: async () => {
        const { data: previous, error } = await supabase
          .from("book_editions")
          .select("id")
          .eq("work_id", parsed.data.workId)
          .eq("is_primary", true);
        if (error) throw databaseError(error, "Не удалось проверить основное издание.");
        return (previous || []).map((edition) => edition.id);
      },
      demotePreviousPrimaries: async (ids) => {
        const { error } = await supabase
          .from("book_editions")
          .update({ is_primary: false })
          .in("id", [...ids]);
        if (error) throw databaseError(error, "Не удалось сменить основное издание.");
      },
      persist: async () => {
        const { data: saved, error } = await supabase
          .from("book_editions")
          .insert(payload)
          .select("id")
          .single();
        if (error?.code === "23505") {
          const { data: collidedEdition, error: collisionLookupError } = await supabase
            .from("book_editions")
            .select("id")
            .eq("legacy_id", legacyId)
            .maybeSingle();
          if (collisionLookupError) {
            throw databaseError(
              collisionLookupError,
              "Не удалось открыть существующее издание после конфликта ISBN."
            );
          }
          if (collidedEdition?.id) {
            throw new ExistingBookEditionError(collidedEdition.id);
          }
        }
        if (error || !saved) {
          throw databaseError(error, "Издание не сохранено.");
        }
        return saved;
      },
      restorePreviousPrimaries: async (ids) => {
        const { error } = await supabase
          .from("book_editions")
          .update({ is_primary: true })
          .in("id", [...ids]);
        if (error) {
          throw databaseError(error, "Не удалось вернуть прежнее основное издание.");
        }
      },
    });
  } catch (error) {
    if (error instanceof ExistingBookEditionError) {
      redirect(`${target({
        editionId: error.editionId,
        notice: "edition-exists",
      })}#edition-editor`);
    }
    redirect(target({
      error: error instanceof Error ? error.message : "Издание не сохранено.",
    }));
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "book_edition.created",
    entity_type: "book_edition",
    entity_id: data.id,
    metadata: {
      isbn10: parsed.data.isbn10,
      isbn13: parsed.data.isbn13,
      workId: parsed.data.workId,
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "book_edition",
    entityId: data.id,
    reason: "book_edition.created",
  });

  revalidatePath("/library");
  redirect(target({
    editionId: data.id,
    saved: "edition",
    published: publication.state,
  }));
}
