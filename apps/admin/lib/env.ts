const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

export const adminEnv = {
  supabaseUrl,
  supabasePublishableKey,
  publicSiteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
    "https://probpera.ru",
  adminSiteUrl:
    process.env.NEXT_PUBLIC_ADMIN_URL?.trim().replace(/\/+$/, "") ||
    "https://probpera.ru/admin",
  deployHookUrl: process.env.PUBLIC_SITE_DEPLOY_HOOK_URL?.trim() || "",
  deployHookToken: process.env.PUBLIC_SITE_DEPLOY_HOOK_TOKEN?.trim() || "",
  metrikaCounterId: process.env.YANDEX_METRIKA_COUNTER_ID?.trim() || "",
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);
