import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { adminEnv, isSupabaseConfigured } from "@/lib/env";

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();
  return createServerClient(
    adminEnv.supabaseUrl,
    adminEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components are read-only. Middleware refreshes the session.
          }
        },
      },
    }
  );
}
