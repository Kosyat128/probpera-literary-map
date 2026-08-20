import { describe, expect, it, vi } from "vitest";

import { fetchCmsPublicationHead } from "./cms-publication-head.mjs";

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const options = {
  supabaseUrl: "https://example.supabase.co",
  serviceKey: "service-secret",
};

describe("CMS publication head probe", () => {
  it("reads both outbox and compatibility audit components", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 17 }]))
      .mockResolvedValueOnce(response([{ id: 91 }]));

    await expect(
      fetchCmsPublicationHead({ ...options, fetchImpl })
    ).resolves.toEqual({
      source: "outbox",
      outboxHighWater: "17",
      legacyAuditHighWater: "91",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain("admin_audit_log");
    expect(fetchImpl.mock.calls[1][0]).toContain("public_build.requested");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer service-secret"
    );
  });

  it("uses legacy audit only for the exact missing-outbox response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          {
            code: "PGRST205",
            message:
              "Could not find the table 'public.public_build_outbox' in the schema cache",
          },
          404
        )
      )
      .mockResolvedValueOnce(response([{ id: 91 }]));

    await expect(
      fetchCmsPublicationHead({ ...options, fetchImpl })
    ).resolves.toEqual({
      source: "legacy-audit",
      outboxHighWater: "0",
      legacyAuditHighWater: "91",
    });
  });

  it.each([
    [403, { code: "42501", message: "permission denied" }],
    [500, { code: "XX000", message: "public_build_outbox unavailable" }],
    [404, { code: "PGRST205", message: "another relation is missing" }],
    [404, { code: "PGRST204", message: "public_build_outbox is missing" }],
    [404, "PGRST205 public_build_outbox"],
  ])("fails closed for non-fallback outbox error %s", async (status, body) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(body, status))
      .mockResolvedValueOnce(response([]));
    await expect(
      fetchCmsPublicationHead({ ...options, fetchImpl })
    ).rejects.toThrow("CMS publication outbox head failed");
  });

  it("fails closed when the legacy component cannot be verified", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 17 }]))
      .mockResolvedValueOnce(response({ message: "forbidden" }, 403));
    await expect(
      fetchCmsPublicationHead({ ...options, fetchImpl })
    ).rejects.toThrow("Legacy CMS publication audit head failed: 403");
  });
});
