import type { SupabaseClient } from "@supabase/supabase-js";
import type { TranslationOperationBudget } from "./translation-operation-budget";
import { unstable_rethrow } from "next/navigation";
import type { CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";

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
  operationBudget?: TranslationOperationBudget;
  operationCursor?: { current: Record<string, unknown>; next: Record<string, unknown> };
  operationAdmission?: (receipt: CatalogTranslationOperationReceipt) => Promise<void>;
}): Promise<LiteraryWorkAutoTranslationResult> {
  try {
    const readiness = await input.supabase.rpc("premium_machine_translation_ready");
    unstable_rethrow(readiness.error);
    if (readiness.error || readiness.data !== true) {
      return {
        state: "not-ready",
        error: readiness.error?.message || "premium machine translation migration is pending",
      };
    }
  } catch (error) {
    unstable_rethrow(error);
    return {
      state: "not-ready",
      error: "Private translation readiness could not be confirmed",
    };
  }
  return translateReadyWork(input);
}
