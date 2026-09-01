import type { SupabaseClient } from "@supabase/supabase-js";

import { adminEnv } from "./env";
import {
  premiumTranslationRuntimeReadiness,
  type WorkersAiBinding,
} from "./premium-english-translation";

export const PREMIUM_TRANSLATION_SELF_TEST_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export function premiumTranslationSelfTestFresh(lastTestAt: unknown, now = Date.now()) {
  if (typeof lastTestAt !== "string") return false;
  const testedAt = Date.parse(lastTestAt);
  return Number.isFinite(testedAt) && testedAt <= now &&
    now - testedAt <= PREMIUM_TRANSLATION_SELF_TEST_MAX_AGE_MS;
}

export async function premiumTranslationRuntimeGate(
  supabase: SupabaseClient,
  options: {
    provider?: "cloudflare" | "openai";
    aiBinding?: WorkersAiBinding | null;
    apiKey?: string;
    model?: string;
    now?: number;
  } = {}
) {
  const runtime = premiumTranslationRuntimeReadiness(options);
  const model = options.model ?? (runtime.provider === "cloudflare"
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel);
  if (!runtime.configured || !runtime.bindingFound) return false;

  const probe = await supabase
    .from("translation_provider_self_tests")
    .select("test_passed,model,last_test_at")
    .eq("provider", runtime.provider)
    .maybeSingle();
  return Boolean(
    !probe.error &&
      probe.data?.test_passed === true &&
      probe.data?.model === model &&
      premiumTranslationSelfTestFresh(probe.data?.last_test_at, options.now)
  );
}
