"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureSiteCopyEnglishTranslation } from "@/lib/auto-translate-site-copy-private";
import { translationErrorCodes } from "@/lib/translation-errors";

/** Explicit retained-result recovery never carries a fresh expense intent. */
export async function recoverSiteCopyTranslationOperationAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const returnTo = formData.get("return_to") === "site-copy" ? "/site-copy" : "/translations";
  const operationId = String(formData.get("operation_id") ?? "").trim();
  if (!z.string().uuid().safeParse(operationId).success) redirect(`${returnTo}?errorCode=invalid_input`);
  const search = new URLSearchParams({ [returnTo === "/site-copy" ? "translation_operation" : "siteCopyOperation"]: operationId });
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    search.set("errorCode", "database_unavailable");
    redirect(`${returnTo}?${search}`);
  }
  const result = await ensureSiteCopyEnglishTranslation({ supabase, actorId: session.user.id, operationId });
  const error = z.enum(translationErrorCodes).safeParse(result.errorCode);
  if (error.success) search.set("errorCode", error.data);
  else if (result.state === "translated" || result.state === "review-pending") search.set("translation", "review-pending");
  else if (result.operation?.receipt?.phase === "finished") search.set("translation", "finished");
  else search.set("errorCode", result.state === "cancelled" ? "translation_operation_stopped" : "translation_retry_pending");
  // Keep the requested operation selected even when another active scope holds it.
  redirect(`${returnTo}?${search}`);
}
