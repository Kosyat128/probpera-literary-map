"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { isValidIsbn, normalizeIsbn } from "@/lib/isbn";
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

export async function saveBookEditionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");

  const rawIsbn10 = optionalText(formData.get("isbn_10"));
  const rawIsbn13 = optionalText(formData.get("isbn_13"));
  const isbn10 = rawIsbn10 ? normalizeIsbn(rawIsbn10) : null;
  const isbn13 = rawIsbn13 ? normalizeIsbn(rawIsbn13) : null;

  if (
    (!isbn10 && !isbn13) ||
    (isbn10 && !isValidIsbn(isbn10)) ||
    (isbn13 && !isValidIsbn(isbn13))
  ) {
    redirect("/library?error=ISBN не прошёл контрольную проверку");
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
    redirect(
      `/library?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "Проверьте данные издания"
      )}`
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/library?error=База данных не подключена");

  if (parsed.data.primary) {
    const { error } = await supabase
      .from("book_editions")
      .update({ is_primary: false })
      .eq("work_id", parsed.data.workId);
    if (error) {
      redirect(`/library?error=${encodeURIComponent(error.message)}`);
    }
  }

  const checkedAt = new Date().toISOString().slice(0, 10);
  const primaryIsbn = parsed.data.isbn13 || parsed.data.isbn10!;
  const hasCover = Boolean(
    parsed.data.coverUrl && parsed.data.coverSourceUrl
  );
  const payload = {
    legacy_id: `isbn:${primaryIsbn}`,
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
  const { data, error } = await supabase
    .from("book_editions")
    .upsert(payload, { onConflict: "legacy_id" })
    .select("id")
    .single();
  if (error || !data) {
    redirect(
      `/library?error=${encodeURIComponent(
        error?.message || "Издание не сохранено"
      )}`
    );
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "book_edition.upserted",
    entity_type: "book_edition",
    entity_id: data.id,
    metadata: {
      isbn10: parsed.data.isbn10,
      isbn13: parsed.data.isbn13,
      workId: parsed.data.workId,
    },
  });

  revalidatePath("/library");
  redirect("/library?saved=1");
}
