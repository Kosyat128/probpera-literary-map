import { defineConfig, mergeConfig } from "vite";
import canonicalSiteConfig from "./vite.config";

export default defineConfig(async environment => {
  const platform = process.env.LITERARY_PLANET_NATIVE_PLATFORM;
  const channel = process.env.LITERARY_PLANET_NATIVE_CHANNEL;
  if (platform !== "android" && platform !== "ios") throw new Error("Select an explicit native platform.");
  const permitted = platform === "android" ? ["dev", "googlePlay", "ruStore"] : ["dev", "appStore"];
  if (!channel || !permitted.includes(channel)) throw new Error("Select a compatible native distribution channel.");
  const site = await (typeof canonicalSiteConfig === "function" ? canonicalSiteConfig(environment) : canonicalSiteConfig);
  return mergeConfig(site, {
    base: "/", publicDir: false,
    plugins: [{
      name: "literary-planet-native-entry",
      transformIndexHtml: { order: "pre", handler: (html: string) => html.replace(
        "/src/platform/adapters/android/entry.ts", `/src/platform/adapters/${platform}/entry.ts`
      ) },
    }],
    define: {
      __LITERARY_PLANET_EDITION__: JSON.stringify("native"),
      __LITERARY_PLANET_ANDROID_CHANNEL__: JSON.stringify(platform === "android" ? channel : "dev"),
      __LITERARY_PLANET_IOS_CHANNEL__: JSON.stringify(platform === "ios" ? channel : "dev"),
      __LITERARY_PLANET_LOCAL_QA__: "false",
      __LITERARY_PLANET_LICENSE_AUTHORITY__: "null",
      __YANDEX_METRIKA_COUNTER_ID__: JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
      "import.meta.env.VITE_TURNSTILE_SITE_KEY": JSON.stringify(""),
    },
    build: { outDir: "dist-native", emptyOutDir: false, manifest: true, rollupOptions: { input: "native.html" } },
  });
});
