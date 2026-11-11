import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

export async function profileTranslationBudgetReadiness(supabase: SupabaseClient): Promise<
  "translation_migration_required" | "database_read_failed" | null
> {
  try {
    const response = await supabase.rpc("profile_translation_budget_ready");
    unstable_rethrow(response?.error);
    if (response?.error) {
      return response.error.code === "PGRST202" || response.error.code === "42883"
        ? "translation_migration_required" : "database_read_failed";
    }
    if (response?.data === true) return null;
    return response?.data === false ? "translation_migration_required" : "database_read_failed";
  } catch (error) {
    unstable_rethrow(error);
    return "database_read_failed";
  }
}
