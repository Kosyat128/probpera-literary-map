import { describe, expect, it } from "vitest";

import {
  requirePublicCmsExportKey,
  resolveCmsExportKeys,
} from "./cms-export-keys.mjs";

describe("CMS export credentials", () => {
  it("never treats a service-role secret as the public snapshot key", () => {
    expect(
      resolveCmsExportKeys({ SUPABASE_SERVICE_ROLE_KEY: "service-secret" })
    ).toEqual({ apiKey: "service-secret", publicKey: "" });
    expect(() => requirePublicCmsExportKey("")).toThrow(
      "publication RLS cannot be bypassed"
    );
  });

  it("uses the publishable key for RLS-gated public records", () => {
    const keys = resolveCmsExportKeys({
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
    });
    expect(keys.apiKey).toBe("service-secret");
    expect(requirePublicCmsExportKey(keys.publicKey)).toBe("public-key");
  });
});
