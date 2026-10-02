import { defineConfig, mergeConfig } from "vite";
import { createCanonicalSiteConfig } from "./vite.config";
import { scopeCanonicalCssUrls } from "./scripts/mobile/pwa-artifact.mjs";

/** The same product entry and chunk ownership, with a separate local artifact. */
export default defineConfig(async (environment) => {
  const site = createCanonicalSiteConfig(environment, true);
  return mergeConfig(site, {
    // Local mobile preparation never reads .env files or exposes ambient VITE_* values.
    envDir: false, envPrefix: [],
    base: "/planet/",
    // The artifact builder copies explicitly selected canonical public assets.
    publicDir: false,
    plugins: [{
      name: "literary-planet-canonical-public-css-scope",
      enforce: "pre",
      transform(source: string, id: string) {
        if (!/\.css(?:\?|$)/u.test(id)) return null;
        const scoped = scopeCanonicalCssUrls(source);
        return scoped.css === source ? null : { code: scoped.css, map: null };
      },
    }],
    define: {
      __LITERARY_PLANET_EDITION__: JSON.stringify("pwa"),
      __YANDEX_METRIKA_COUNTER_ID__: JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
      "import.meta.env.VITE_TURNSTILE_SITE_KEY": JSON.stringify(""),
    },
    build: {
      outDir: "dist-pwa",
      // Output containment/cleanup belongs to the controlled artifact builder.
      emptyOutDir: false,
      manifest: true,
    },
  });
});
