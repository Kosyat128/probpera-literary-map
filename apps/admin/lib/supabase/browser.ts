"use client";

import { createBrowserClient } from "@supabase/ssr";

import { adminEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    adminEnv.supabaseUrl,
    adminEnv.supabasePublishableKey
  );
}
