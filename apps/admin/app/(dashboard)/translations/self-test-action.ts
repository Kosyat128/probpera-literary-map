"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import {
  premiumTranslationRuntimeReadiness,
  premiumTranslationSelfTest,
} from "@/lib/premium-english-translation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  premiumTranslationConfigurationIdentity,
  parsePremiumTranslationProbeReservation,
  parsePremiumTranslationProbeCompletion,
} from "@/lib/premium-translation-probe";

export async function runPremiumTranslationSelfTestAction() {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/translations?errorCode=database_unavailable");

  const readiness = premiumTranslationRuntimeReadiness();
  let identity;
  try {
    identity = await premiumTranslationConfigurationIdentity();
  } catch (error) {
    unstable_rethrow(error);
    redirect("/translations?errorCode=translation_not_configured");
  }
  let reservation;
  try {
    const response = await supabase.rpc("begin_translation_provider_config_self_test", {
      p_configuration: identity.configuration,
      p_configured: readiness.configured,
      p_binding_found: readiness.bindingFound,
      p_cooldown_seconds: 300,
    });
    unstable_rethrow(response.error);
    if (response.error != null) redirect(`/translations?errorCode=${response.error.code === "55000"
      ? "self_test_cooldown" : ["42883", "0A000", "PGRST202"].includes(response.error.code)
        ? "translation_migration_required" : "database_write_failed"}`);
    reservation = parsePremiumTranslationProbeReservation(response.data, identity, readiness);
    if (!reservation) redirect("/translations?errorCode=database_write_failed");
  } catch (error) {
    unstable_rethrow(error);
    redirect("/translations?errorCode=database_write_failed");
  }
  const result = await premiumTranslationSelfTest();
  if (result.provider !== readiness.provider || result.configured !== readiness.configured ||
    result.bindingFound !== readiness.bindingFound || result.model !== identity.configuration.model ||
    result.testPassed && result.reviewerModel !== identity.configuration.reviewerModel) {
    redirect("/translations?errorCode=provider_invalid_response");
  }
  try {
    const saved = await supabase.rpc("finish_translation_provider_config_self_test", {
      p_configuration: identity.configuration,
      p_lease_token: reservation.leaseToken,
      p_configured: result.configured,
      p_binding_found: result.bindingFound,
      p_test_passed: result.testPassed,
      p_model: result.model,
      p_reviewer_model: result.reviewerModel,
      p_latency_ms: result.latencyMs,
      p_error_code: result.errorCode,
    });
    unstable_rethrow(saved.error);
    if (saved.error != null || !parsePremiumTranslationProbeCompletion(saved.data, reservation, result)) {
      redirect("/translations?errorCode=database_write_failed");
    }
  } catch (error) {
    unstable_rethrow(error);
    redirect("/translations?errorCode=database_write_failed");
  }
  revalidatePath("/translations");
  revalidatePath("/health");
  redirect(
    `/translations?selfTest=${result.testPassed ? "passed" : "failed"}`
  );
}
