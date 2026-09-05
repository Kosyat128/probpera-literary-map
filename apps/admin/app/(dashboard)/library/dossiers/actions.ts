"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { compileBookDossierReviewPreview } from "../../../../../../src/books/bookDossierCompiler";
import { compileBookDossierReviewVariantBank, compileBookDossierVariantBank } from "../../../../../../src/books/bookDossierDelivery";
import { bookDossierVariantId } from "../../../../../../src/books/bookDossierDesign";
import type { BookDossierDesignProof, BookDossierDocumentV2, BookDossierIssue, BookDossierRecord, BookDossierReviewStage } from "../../../../../../src/books/bookDossierDocument";
import { publishBookDossier, reviewBookDossier, saveBookDossierDraft, withdrawBookDossier } from "../../../../../../src/books/bookDossierWorkflow";

export type BookDossierActionResult = { record: BookDossierRecord | null; preview?: BookDossierDocumentV2 | null; designVariants?: readonly { id: string; document: BookDossierDocumentV2 }[]; issues: readonly BookDossierIssue[] };
const failure = (code: string): BookDossierActionResult => ({ record: null, issues: [{ code, path: "cms" }] });

/** Server Actions retain Next's origin/CSRF checks and the existing staff/MFA gate. */
export async function bookDossierAction(input: {
  action: "SAVE" | "REVIEW" | "PREVIEW" | "PUBLISH" | "REVOKE" | "ARCHIVE";
  bookKey: string; locale: "ru" | "en"; expectedRevision: number;
  draft?: unknown; stage?: BookDossierReviewStage; decision?: "APPROVED" | "CHANGES_REQUIRED";
  confirmedHumanReview?: boolean; reason?: string;
  designProof?: BookDossierDesignProof;
}): Promise<BookDossierActionResult> {
  const session = await requireStaff();
  if (!session?.user || !session.role) return failure("staff-required");
  if (!input || typeof input.bookKey !== "string" || input.bookKey.length > 240 || !["ru", "en"].includes(input.locale) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return failure("invalid-request");
  const supabase = await createServerSupabaseClient();
  if (!supabase) return failure("database-unavailable");
  const parts = input.bookKey.split(":");
  if (parts.length !== 3 || parts.some(part => !part)) return failure("invalid-book-key");
  const work = await supabase.from("literary_works").select("id").eq("country_id", parts[0]).eq("writer_id", parts[1]).eq("legacy_id", parts[2]).maybeSingle();
  if (work.error || !work.data) return failure("canonical-work-required");
  const { data, error } = await supabase.from("book_dossiers").select("record").eq("book_key", input.bookKey).eq("locale", input.locale).maybeSingle();
  if (error) return failure("dossier-storage-unavailable");
  const previous = (data?.record || null) as BookDossierRecord | null;
  const currentArticleVersions: Record<string, string> = {};
  const reuseIds = previous?.draft.blocks.flatMap(block => block.articleReuse ? [block.articleReuse.articleId] : []) || [];
  if (reuseIds.length) {
    const articles = await supabase.from("articles").select("id,updated_at").in("id", [...new Set(reuseIds)]).eq("status", "published").is("deleted_at", null);
    if (articles.error) return failure("article-versions-unavailable");
    for (const article of articles.data || []) currentArticleVersions[article.id] = article.updated_at;
  }
  const context = { actor: { id: session.user.id, role: session.role }, now: Date.now(), expectedRevision: input.expectedRevision, currentArticleVersions, designProof: input.designProof };
  if (input.action !== "SAVE" && !previous) return failure("dossier-not-found");
  if (input.action === "PREVIEW") {
    const result = await compileBookDossierReviewPreview(previous!, { ...context, themeVersion: "cms-review" });
    if (!result.document) return { record: previous, preview: null, issues: result.issues };
    const variants = await compileBookDossierReviewVariantBank(previous!, context);
    return { record: previous, preview: result.document, issues: variants.issues,
      designVariants: variants.bank?.variants.map(variant => ({ id: bookDossierVariantId(variant.mode, variant.revealSpoilers, variant.reachedItemIds), document: variant.document })) };
  }
  let result;
  if (input.action === "SAVE") {
    result = await saveBookDossierDraft(input.draft, previous, context);
    if (result.record && (result.record.draft.bookKey !== input.bookKey || result.record.draft.locale !== input.locale)) return failure("document-identity-mismatch");
  } else if (input.action === "REVIEW") result = await reviewBookDossier(previous!, input.stage!, input.decision!, input.confirmedHumanReview === true, context);
  else if (input.action === "PUBLISH") {
    if (input.confirmedHumanReview !== true) return failure("explicit-publication-required");
    result = await publishBookDossier(previous!, context);
  } else if (input.action === "REVOKE" || input.action === "ARCHIVE") result = await withdrawBookDossier(previous!, input.action, input.reason || "", context);
  else return failure("invalid-action");
  if (!result.record) return result;
  const variants = result.record.status === "PUBLISHED" ? await compileBookDossierVariantBank(result.record, context) : { bank: null, issues: [] };
  if (variants.issues.length) return { record: null, issues: variants.issues };
  const saved = await supabase.rpc("save_book_dossier", { p_record: result.record, p_variant_bank: variants.bank, p_expected_revision: input.expectedRevision });
  if (saved.error) return failure(saved.error.code === "40001" || saved.error.code === "23505" ? "revision-conflict" : "dossier-write-rejected");
  revalidatePath("/library/dossiers");
  // Delivery is a live no-store RPC. No public build or raw draft export is needed.
  return result;
}
