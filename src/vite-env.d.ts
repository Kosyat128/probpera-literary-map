/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_BOOSTY_URL?: string;
  readonly BASE_URL?: string;
  readonly PROD?: string | boolean;
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __YANDEX_METRIKA_COUNTER_ID__: string;
declare const __LITERARY_PLANET_EDITION__: "site" | "pwa" | "native";
declare const __LITERARY_PLANET_LICENSE_AUTHORITY__: {
  issuer: string;
  audience: string;
  product: string;
  trustedKeys: readonly {kid: string; jwk: JsonWebKey}[];
} | null;
declare const __LITERARY_PLANET_LOCAL_QA__: boolean;
declare const __LITERARY_PLANET_ANDROID_CHANNEL__: "dev" | "googlePlay" | "ruStore";
declare const __LITERARY_PLANET_IOS_CHANNEL__: "dev" | "appStore";

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}
