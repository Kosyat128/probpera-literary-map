import type { SupabaseClient } from "@supabase/supabase-js";

import { isCommunityConfigured } from "./supabaseConfig";

let clientPromise: Promise<SupabaseClient | null> | undefined;

export function loadSupabaseClient() {
  if (!isCommunityConfigured) return Promise.resolve(null);
  clientPromise ??= import("./supabase")
    .then(({ supabase }) => supabase)
    .catch(() => {
      clientPromise = undefined;
      return null;
    });
  return clientPromise;
}
