import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "tests/e2e/**",
      "**/node_modules/**",
      "dist/**",
      ".review/**",
      ".tmp/**",
      "apps/**/.next/**",
      "coverage/**",
      "scripts/network/audit-connectivity.test.mjs",
      "scripts/network/audit-russian-probes.test.mjs",
      "scripts/cloudflare/protect-ru-snapshot.test.mjs",
      "scripts/dns/validate-ru-connectivity-plan.test.mjs",
      "scripts/dns/verify-parent-ds-absence.test.mjs",
      "scripts/dns/connectivity-workflows.test.mjs",
    ],
  },
});
