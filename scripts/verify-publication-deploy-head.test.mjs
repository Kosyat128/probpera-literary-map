import { describe, expect, it, vi } from "vitest";

import {
  assertPublicationDeployHead,
  verifyPublicationDeployHead,
} from "./verify-publication-deploy-head.mjs";

const sha = "a".repeat(40);
const fingerprint = "b".repeat(64);

describe("publication deploy head guard", () => {
  it("accepts only an artifact matching both current heads", () => {
    expect(
      assertPublicationDeployHead({
        candidateOutboxHighWater: "165",
        currentOutboxHighWater: 165,
        expectedMainSha: sha,
        currentMainSha: sha,
        articleCount: "165",
        contentSha256: fingerprint,
      })
    ).toEqual({ candidate: "165", articleCount: 165, contentSha256: fingerprint });
  });

  it("rejects a CMS edit accepted after the candidate was built", () => {
    expect(() =>
      assertPublicationDeployHead({
        candidateOutboxHighWater: "164",
        currentOutboxHighWater: "165",
        expectedMainSha: sha,
        currentMainSha: sha,
        articleCount: "164",
        contentSha256: fingerprint,
      })
    ).toThrow("refusing to overwrite production");
  });

  it("rejects an older code run after main advances", () => {
    expect(() =>
      assertPublicationDeployHead({
        candidateOutboxHighWater: "165",
        currentOutboxHighWater: "165",
        expectedMainSha: sha,
        currentMainSha: "c".repeat(40),
        articleCount: "165",
        contentSha256: fingerprint,
      })
    ).toThrow("main advanced");
  });

  it("reads both authoritative heads with private credentials kept in headers", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 165 }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ object: { sha } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    await expect(
      verifyPublicationDeployHead(
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-secret",
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_TOKEN: "github-secret",
          EXPECTED_MAIN_SHA: sha,
          CANDIDATE_OUTBOX_HIGH_WATER: "165",
          CANDIDATE_ARTICLE_COUNT: "165",
          CANDIDATE_CONTENT_SHA256: fingerprint,
        },
        fetchImpl
      )
    ).resolves.toMatchObject({ candidate: "165", articleCount: 165 });
    expect(fetchImpl.mock.calls[0][0]).not.toContain("service-secret");
    expect(fetchImpl.mock.calls[1][0]).not.toContain("github-secret");
  });
});
