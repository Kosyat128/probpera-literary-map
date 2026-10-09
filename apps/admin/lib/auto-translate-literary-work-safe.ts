import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ensureLiteraryWorkEnglishTranslation as translateReadyWork,
  type LiteraryWorkAutoTranslationState,
  type LiteraryWorkAutoTranslationResult,
} from "./auto-translate-literary-work";

export type SafeLiteraryWorkAutoTranslationState =
  | LiteraryWorkAutoTranslationState
  | "not-ready";

export async function ensureLiteraryWorkEnglishTranslation(input: {
  supabase: SupabaseClient;
  actorId: string;
  workId: string;
  runtimeApproved?: boolean;
}): Promise<LiteraryWorkAutoTranslationResult> {
  const readiness = await input.supabase.rpc("premium_machine_translation_ready");
  if (readiness.error || readiness.data !== true) {
    return {
      state: "not-ready",
      error: readiness.error?.message || "premium machine translation migration is pending",
    };
  }
  return translateReadyWork(input);
}
