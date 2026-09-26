"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NewsOperatorInputError, parseNewsOperatorForm } from "@/lib/literary-news-operator-input";

export async function updateLiteraryNewsRuntimeAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user || session.mfa.checkError) redirect("/login");
  let input;
  try { input = parseNewsOperatorForm(formData); }
  catch (error) { redirect(`/literary-news?delivery_error=${error instanceof NewsOperatorInputError ? error.message : "invalid_input"}#news-delivery`); }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/literary-news?delivery_error=unavailable#news-delivery");
  const { data, error } = await supabase.rpc("operate_literary_news_runtime", {
    p_key: input.key, p_expected_id: input.expectedVersion, p_operation: input.action,
    p_reason: input.reason, p_remote_id: input.remoteId, p_proof_url: input.proofUrl, p_verified: input.verified,
  });
  if (error) redirect(`/literary-news?delivery_error=${error.code === "42501" ? "access" : "unavailable"}#news-delivery`);
  if (!data?.applied) redirect(`/literary-news?delivery_error=${data?.reason === "version_conflict" ? "conflict" : "state_changed"}#news-delivery`);
  revalidatePath("/literary-news");
  redirect("/literary-news?delivery_saved=1#news-delivery");
}
