const getEnvValue = (keys: string[]) =>
  keys
    .map((key) => process.env[key]?.trim())
    .find((value) => Boolean(value)) || "";

const supabaseUrl =
  getEnvValue(["NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]);
const supabasePublishableKey =
  getEnvValue([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]);

export const adminEnv = {
  supabaseUrl,
  supabasePublishableKey,
  publicSiteUrl:
    getEnvValue([
      "NEXT_PUBLIC_SITE_URL",
      "VITE_PUBLIC_SITE_URL",
      "PUBLIC_SITE_ORIGIN",
    ]).replace(/\/+$/, "") || "https://probpera.ru",
  adminSiteUrl:
    getEnvValue([
      "NEXT_PUBLIC_ADMIN_URL",
      "VITE_PUBLIC_ADMIN_URL",
      "PUBLIC_ADMIN_URL",
    ]).replace(/\/+$/, "") ||
    "https://probpera.ru/admin",
  deployHookUrl:
    getEnvValue([
      "PUBLIC_SITE_DEPLOY_HOOK_URL",
      "VITE_PUBLIC_SITE_DEPLOY_HOOK_URL",
      "PUBLIC_DEPLOY_HOOK_URL",
    ]) || "",
  deployHookToken:
    getEnvValue([
      "PUBLIC_SITE_DEPLOY_HOOK_TOKEN",
      "VITE_PUBLIC_SITE_DEPLOY_HOOK_TOKEN",
      "PUBLIC_DEPLOY_HOOK_TOKEN",
    ]) || "",
  metrikaCounterId:
    getEnvValue([
      "YANDEX_METRIKA_COUNTER_ID",
      "VITE_YANDEX_METRIKA_COUNTER_ID",
      "PUBLIC_YANDEX_METRIKA_COUNTER_ID",
    ]) || "",
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);
