"use server";

import { requireStaff } from "@/lib/auth";
import { unstable_rethrow } from "next/navigation";
import { decodeArticleTranslationResumeCursor } from "@/lib/article-translation-scan";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { catalogTranslationOperationMarker } from "@/lib/catalog-translation-operation-marker";
import { writerTranslationOperationMarker } from "@/lib/writer-translation-operation-marker";
import { siteCopyTranslationOperationMarker, siteCopyTranslationMarkerMatchesReceipt } from "@/lib/site-copy-translation-operation-marker";
import { reconcileSiteCopyTranslationOperation, SiteCopyTranslationOperationRpcError } from "@/lib/site-copy-translation-operation-rpc";
import { getLibraryTranslationScan, LibraryTranslationScanRpcError } from "@/lib/library-translation-scan-rpc";
import { getProfileTranslationScan, ProfileTranslationScanRpcError, profileTranslationScanOrdinal } from "@/lib/profile-translation-scan-rpc";

import { translatePremiumArticleBatchAction } from "./article-actions";
import {
  translatePremiumLibraryBatchAction,
  translatePremiumSiteCopyBatchAction,
  translatePremiumWriterBatchAction,
} from "./actions";
import { translatePremiumCountryBatchAction } from "./country-actions";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function resumeTranslationJobAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const jobId = String(formData.get("job_id") || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(jobId)) {
    redirect("/translations?errorCode=invalid_input");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/translations?errorCode=database_unavailable");
  const response = await supabase.rpc("get_translation_job_resume", {
    p_job_id: jobId,
  });
  unstable_rethrow(response.error);
  if (response.error || !response.data) {
    redirect("/translations?errorCode=database_read_failed");
  }

  const job = objectValue(response.data);
  if (typeof job.id !== "string" || job.id.toLowerCase() !== jobId.toLowerCase()) {
    redirect("/translations?errorCode=invalid_input");
  }
  const cursor = objectValue(job.resumeCursor);
  const siteCopyOperation = siteCopyTranslationOperationMarker(job.resumeCursor);
  if (job.kind === "site_copy" || siteCopyOperation.kind !== "none") {
    if (job.kind !== "site_copy" || siteCopyOperation.kind !== "operation") {
      redirect("/translations?errorCode=translation_resume_stale");
    }
    try {
      const receipt = await reconcileSiteCopyTranslationOperation(supabase, siteCopyOperation.operationId);
      if (!receipt || !siteCopyTranslationMarkerMatchesReceipt(siteCopyOperation, receipt, jobId)) {
        redirect("/translations?errorCode=translation_retry_unconfirmed");
      }
      if (receipt.actorId.toLowerCase() !== session.user.id.toLowerCase()) {
        redirect("/translations?errorCode=translation_retry_pending");
      }
    } catch (error) {
      unstable_rethrow(error);
      redirect(`/translations?errorCode=${error instanceof SiteCopyTranslationOperationRpcError
        ? error.errorCode : "translation_retry_unconfirmed"}`);
    }
    const next = new FormData();
    next.set("siteCopyOperation", siteCopyOperation.operationId);
    return translatePremiumSiteCopyBatchAction(next);
  }
  if (Object.hasOwn(cursor, "libraryScan") && Object.hasOwn(cursor, "profileScan")) {
    redirect("/translations?errorCode=translation_resume_stale");
  }
  // Only the durable library window may select library members. An old ordinal,
  // malformed marker or a marker borrowed by another kind cannot restart it.
  if (Object.hasOwn(cursor, "libraryScan")) {
    if (job.kind !== "literary_work" || catalogTranslationOperationMarker(job.resumeCursor).kind !== "none") {
      redirect("/translations?errorCode=translation_resume_stale");
    }
    let scan;
    try {
      scan = await getLibraryTranslationScan(supabase, jobId);
    } catch (error) {
      unstable_rethrow(error);
      redirect(`/translations?errorCode=${error instanceof LibraryTranslationScanRpcError
        ? error.errorCode : "translation_scan_unconfirmed"}`);
    }
    if ((scan.status === "cancelled" || scan.status === "cancelling") && scan.child === null) {
      redirect("/translations?errorCode=translation_operation_stopped");
    }
    if (scan.exhausted) redirect("/translations?errorCode=translation_scan_complete");
    const next = new FormData();
    next.set("libraryJob", scan.jobId);
    next.set("libraryCursor", String(scan.windowIndex * 500 + scan.nextPosition));
    // A stopped window with an existing child may still reconcile its saved
    // response. The actual action guards that path against a new dispatch.
    return translatePremiumLibraryBatchAction(next);
  }
  if (Object.hasOwn(cursor, "profileScan")) {
    if ((job.kind !== "writer" && job.kind !== "country") ||
      writerTranslationOperationMarker(job.resumeCursor).kind !== "none" ||
      catalogTranslationOperationMarker(job.resumeCursor).kind !== "none") {
      redirect("/translations?errorCode=translation_resume_stale");
    }
    let scan;
    try {
      scan = await getProfileTranslationScan(supabase, jobId, job.kind);
    } catch (error) {
      unstable_rethrow(error);
      redirect(`/translations?errorCode=${error instanceof ProfileTranslationScanRpcError
        ? error.errorCode : "translation_scan_unconfirmed"}`);
    }
    if ((scan.status === "cancelled" || scan.status === "cancelling") && scan.child === null) {
      redirect("/translations?errorCode=translation_operation_stopped");
    }
    if (scan.exhausted) redirect("/translations?errorCode=translation_scan_complete");
    const next = new FormData();
    next.set(scan.kind === "writer" ? "writerJob" : "countryJob", scan.jobId);
    next.set(scan.kind === "writer" ? "writerCursor" : "countryCursor", String(profileTranslationScanOrdinal(scan)));
    // Eager successors exist before this window is complete. Continue always
    // submits the requested window; the native transition decides when to move.
    return scan.kind === "writer" ? translatePremiumWriterBatchAction(next) : translatePremiumCountryBatchAction(next);
  }
  if (job.kind === "writer") {
    const operation = writerTranslationOperationMarker(job.resumeCursor);
    if (operation.kind === "invalid") redirect("/translations?errorCode=translation_resume_stale");
    if (operation.kind === "operation") redirect(`/translations?errorCode=${
      job.status === "cancelled" || job.status === "cancelling" ? "translation_operation_stopped"
        : job.status === "reviewing" ? "translation_retry_pending" : "translation_retry_blocked"
    }`);
  }
  if (job.kind === "literary_work" || job.kind === "country") {
    const operation = catalogTranslationOperationMarker(job.resumeCursor);
    if (operation.kind === "invalid" || (operation.kind === "operation" && operation.entityType !== job.kind)) {
      redirect("/translations?errorCode=translation_resume_stale");
    }
    if (operation.kind === "operation") redirect(`/translations?errorCode=${
      job.status === "cancelled" || job.status === "cancelling" ? "translation_operation_stopped"
        : job.status === "reviewing" ? "translation_retry_pending" : "translation_retry_blocked"
    }`);
  }
  const next = new FormData();
  if (job.kind === "literary_work" || job.kind === "writer" || job.kind === "country") {
    redirect("/translations?errorCode=translation_resume_stale");
  }
  if (job.kind === "article") {
    if (job.status === "cancelled" || job.status === "cancelling") {
      redirect("/translations?errorCode=translation_operation_stopped");
    }
    if (job.status === "reviewing") {
      redirect("/translations?errorCode=translation_retry_pending");
    }
    const resume = decodeArticleTranslationResumeCursor(job.resumeCursor);
    if (resume.kind !== "scan") redirect("/translations?errorCode=translation_resume_stale");
    if (resume.state.exhausted) redirect("/translations?errorCode=translation_scan_complete");
    next.set("articleJob", jobId);
    return translatePremiumArticleBatchAction(next);
  }
  next.set("articleCursor", String(cursor.articleCursor || 0));
  next.set("libraryCursor", String(cursor.libraryCursor || 0));
  next.set("writerCursor", String(cursor.writerCursor || 0));
  next.set("countryCursor", String(cursor.countryCursor || 0));
  redirect("/translations?errorCode=invalid_input");
}
