"use client";

import { createBrowserClient } from "@supabase/ssr";

import { adminPublicEnv } from "@/lib/public-env";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    adminPublicEnv.supabaseUrl,
    adminPublicEnv.supabasePublishableKey
  );
}
