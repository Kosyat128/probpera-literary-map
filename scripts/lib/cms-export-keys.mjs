function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

export function resolveCmsExportKeys(environment) {
  const publicKey = firstValue(
    environment.SUPABASE_PUBLISHABLE_KEY,
    environment.VITE_SUPABASE_PUBLISHABLE_KEY,
    environment.VITE_SUPABASE_ANON_KEY
  );
  const serviceRoleKey = firstValue(environment.SUPABASE_SERVICE_ROLE_KEY);
  return {
    apiKey: serviceRoleKey || publicKey,
    publicKey,
  };
}

export function requirePublicCmsExportKey(publicKey) {
  if (publicKey) return publicKey;
  throw new Error(
    "CMS literary-work export requires a Supabase publishable/anon key so public publication RLS cannot be bypassed."
  );
}
