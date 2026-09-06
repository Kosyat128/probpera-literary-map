import type { SupabaseClient } from "@supabase/supabase-js";

import { isCommunityConfigured } from "./supabaseConfig";

let clientPromise: Promise<SupabaseClient | null> | undefined;

export function loadSupabaseClient() {
  // The current bundled native reader has no account session or backend client.
  // A direct build constant also removes the unused SDK from the native graph.
  if (typeof __LITERARY_PLANET_EDITION__ !== "undefined" && __LITERARY_PLANET_EDITION__ === "native") {
    return Promise.resolve(null);
  }
  if (!isCommunityConfigured) return Promise.resolve(null);
  clientPromise ??= import("./supabase")
    .then(({ supabase }) => supabase)
    .catch(() => {
      clientPromise = undefined;
      return null;
    });
  return clientPromise;
}
