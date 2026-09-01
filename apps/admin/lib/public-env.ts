const publicEnvValue = (keys: string[]) =>
  keys
    .map((key) => process.env[key]?.trim())
    .find((value) => Boolean(value)) || "";

// This module is the only environment boundary allowed in Client Components.
// Every identifier here is explicitly publishable by contract.
export const adminPublicEnv = {
  supabaseUrl: publicEnvValue([
    "NEXT_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
  ]),
  supabasePublishableKey: publicEnvValue([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]),
};
