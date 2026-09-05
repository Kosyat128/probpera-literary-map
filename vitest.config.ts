import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "tests/e2e/**",
      "tests/pwa/**/*.spec.mjs",
      "**/node_modules/**",
      "dist/**",
      "dist-pwa/**",
      ".review/**",
      ".tmp/**",
      "apps/**/.next/**",
      "coverage/**",
    ],
  },
});
