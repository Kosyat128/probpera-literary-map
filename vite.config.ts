import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const configuredBase = environment.PUBLIC_SITE_BASE_PATH || "/probpera-literary-map/";
  const base = configuredBase === "/" ? "/" : `/${configuredBase.replace(/^\/+|\/+$/g, "")}/`;

  return {
    base,
    plugins: [react()],
    test: {
      exclude: ["**/node_modules/**", "**/.git/**", ".tmp/**"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll("\\\\", "/");
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
