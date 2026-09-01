"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import {
  premiumTranslationRuntimeReadiness,
  premiumTranslationSelfTest,
} from "@/lib/premium-english-translation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function runPremiumTranslationSelfTestAction() {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/translations?errorCode=database_unavailable");

  const readiness = premiumTranslationRuntimeReadiness();
  const model = readiness.provider === "cloudflare"
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel;
  const reservation = await supabase.rpc("begin_translation_provider_self_test", {
    p_provider: readiness.provider,
    p_configured: readiness.configured,
    p_binding_found: readiness.bindingFound,
    p_model: model,
    p_cooldown_seconds: 300,
  });
  if (reservation.error || typeof reservation.data !== "string") {
    redirect(
      `/translations?errorCode=${
        reservation.error?.code === "55000"
          ? "self_test_cooldown"
          : "translation_migration_required"
      }`
    );
  }

  const result = await premiumTranslationSelfTest();
  const saved = await supabase.rpc("finish_translation_provider_self_test", {
    p_provider: result.provider,
    p_lease_token: reservation.data,
    p_configured: result.configured,
    p_binding_found: result.bindingFound,
    p_test_passed: result.testPassed,
    p_model: result.model,
    p_latency_ms: result.latencyMs,
    p_error_code: result.errorCode,
  });
  if (saved.error) redirect("/translations?errorCode=database_write_failed");

  revalidatePath("/translations");
  redirect(
    `/translations?selfTest=${result.testPassed ? "passed" : "failed"}`
  );
}
