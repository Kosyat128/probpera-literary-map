import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "tests/e2e/**",
      "tests/pwa/**/*.spec.mjs",
      "tests/host/**/*.spec.mjs",
      "**/node_modules/**",
      "dist/**",
      "dist-pwa/**",
      "dist-native/**",
      ".review/**",
      ".tmp/**",
      "apps/**/.next/**",
      "coverage/**",
    ],
  },
});
