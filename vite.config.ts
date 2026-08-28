import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const configuredBase = environment.PUBLIC_SITE_BASE_PATH || "/probpera-literary-map/";
  const base = configuredBase === "/" ? "/" : `/${configuredBase.replace(/^\/+|\/+$/g, "")}/`;
  const rawMetrikaCounterId = (
    process.env.YANDEX_METRIKA_COUNTER_ID ||
    environment.YANDEX_METRIKA_COUNTER_ID ||
    ""
  ).trim();
  if (rawMetrikaCounterId && !/^[1-9]\d{0,14}$/u.test(rawMetrikaCounterId)) {
    throw new Error(
      "YANDEX_METRIKA_COUNTER_ID must be a positive numeric counter identifier"
    );
  }
  return {
    base,
    resolve: {
      alias: [
        {
          find: /^@\//u,
          replacement: fileURLToPath(new URL("./apps/admin/", import.meta.url)),
        },
      ],
    },
    define: {
      __YANDEX_METRIKA_COUNTER_ID__: JSON.stringify(rawMetrikaCounterId),
    },
    plugins: [react()],
    test: {
      exclude: ["**/node_modules/**", "**/.git/**", ".tmp/**"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll("\\\\", "/");
            // Keep Vite's tiny dynamic-import helper out of heavy lazy vendor
            // chunks; otherwise Rollup makes the entry preload Three.js merely
            // to obtain the helper that starts the later dynamic import.
            if (moduleId.includes("vite/preload-helper")) {
              return "vite-preload-helper";
            }
            if (moduleId.includes("/books.generated.json")) return "book-catalog";
            if (moduleId.includes("/writerPortraits.generated.json")) {
              return "writer-portraits-data";
            }
            if (
              moduleId.includes(
                "/writerBiographyFactReviewCorrections.generated.json"
              )
            ) {
              return "writer-biography-reviews";
            }
            if (
              moduleId.includes("/node_modules/three/") ||
              moduleId.includes("/node_modules/@react-three/")
            ) {
              return "three-vendor";
            }
            if (moduleId.includes("/node_modules/@supabase/")) {
              return "supabase-vendor";
            }
            if (moduleId.includes("/node_modules/gsap/")) return "motion-vendor";
            if (
              moduleId.includes("/node_modules/react/") ||
              moduleId.includes("/node_modules/react-dom/") ||
              moduleId.includes("/node_modules/scheduler/")
            ) {
              return "react-vendor";
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      open: true
    }
  };
});
