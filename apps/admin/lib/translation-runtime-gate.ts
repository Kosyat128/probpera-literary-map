import type { SupabaseClient } from "@supabase/supabase-js";

import { unstable_rethrow } from "next/navigation";
import {
  premiumTranslationRuntimeReadiness,
} from "./premium-english-translation";
import {
  PREMIUM_TRANSLATION_PROBE_COLUMNS, isPremiumTranslationProbe,
  premiumTranslationConfigurationIdentity, premiumTranslationProbeStatus,
  type PremiumTranslationConfigurationOptions,
} from "./premium-translation-probe";

export { PREMIUM_TRANSLATION_SELF_TEST_MAX_AGE_MS, premiumTranslationSelfTestFresh } from "./premium-translation-probe";

export async function premiumTranslationRuntimeGate(
  supabase: SupabaseClient,
  options: PremiumTranslationConfigurationOptions & { now?: number } = {}
) {
  const runtime = premiumTranslationRuntimeReadiness(options);
  if (!runtime.configured || !runtime.bindingFound) return false;
  try {
    const identity = await premiumTranslationConfigurationIdentity(options);
    const probe = await supabase.from("translation_provider_self_tests")
      .select(PREMIUM_TRANSLATION_PROBE_COLUMNS).eq("provider", runtime.provider).maybeSingle();
    unstable_rethrow(probe.error);
    return probe.error == null && isPremiumTranslationProbe(probe.data) &&
      premiumTranslationProbeStatus(probe.data, runtime, identity, options.now) === "ready";
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}
