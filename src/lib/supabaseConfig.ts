const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export const isCommunityConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);
export const isAuthTurnstileConfigured = Boolean(turnstileSiteKey);

export const supabaseConnection = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
} as const;
