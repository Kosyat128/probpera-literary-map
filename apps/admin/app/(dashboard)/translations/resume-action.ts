"use server";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  if (response.error || !response.data) {
    redirect("/translations?errorCode=database_read_failed");
  }

  const job = objectValue(response.data);
  const cursor = objectValue(job.resumeCursor);
  const next = new FormData();
  next.set("articleCursor", String(cursor.articleCursor || 0));
  next.set("libraryCursor", String(cursor.libraryCursor || 0));
  next.set("writerCursor", String(cursor.writerCursor || 0));
  next.set("countryCursor", String(cursor.countryCursor || 0));
  if (job.kind === "article") return translatePremiumArticleBatchAction(next);
  if (job.kind === "literary_work") return translatePremiumLibraryBatchAction(next);
  if (job.kind === "writer") return translatePremiumWriterBatchAction(next);
  if (job.kind === "country") return translatePremiumCountryBatchAction(next);
  if (job.kind === "site_copy") return translatePremiumSiteCopyBatchAction(next);
  redirect("/translations?errorCode=invalid_input");
}
