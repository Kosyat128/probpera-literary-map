import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  BLACK_SWAN_ARTICLE_CANONICAL_URL,
  BLACK_SWAN_ARTICLE_CATEGORY_SLUG,
  BLACK_SWAN_ARTICLE_CONTENT_SHA256,
  BLACK_SWAN_ARTICLE_FALLBACK_PUBLISHED_AT,
  BLACK_SWAN_ARTICLE_ID,
  BLACK_SWAN_ARTICLE_LEGACY_ID,
  BLACK_SWAN_ARTICLE_LEGACY_PATH,
  BLACK_SWAN_ARTICLE_SLUG,
  BLACK_SWAN_ARTICLE_TITLE,
  assertBlackSwanArticleIdentity,
  desiredBlackSwanArticlePatch,
  resolveBlackSwanProductionEnvironment,
  restoreBlackSwanArticlePublication,
  sha256Text,
} from "./restore-black-swan-article-publication.mjs";

const environment = Object.freeze({
  VITE_SUPABASE_URL: "https://sjqejjmwpzfsczxdghvw.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-never-log",
});
const sourceDocument = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "public/cms/articles/cms-7ad1ab89-8a77-407d-b59a-6147c0e2a7a6.json"
    ),
    "utf8"
  )
);
const identity = Object.freeze({
  id: BLACK_SWAN_ARTICLE_ID,
  legacy_id: BLACK_SWAN_ARTICLE_LEGACY_ID,
  title: BLACK_SWAN_ARTICLE_TITLE,
  content_html: sourceDocument.contentHtml,
  categories: { slug: BLACK_SWAN_ARTICLE_CATEGORY_SLUG },
});
const before = Object.freeze({
  ...identity,
  slug: "withdrawn-black-swan",
  legacy_path: null,
  canonical_url: null,
  status: "draft",
  published_at: null,
  deleted_at: "2026-08-27T09:00:00.000Z",
  updated_at: "2026-08-27T10:00:00.000Z",
});
const desiredPatch = Object.freeze({
  slug: BLACK_SWAN_ARTICLE_SLUG,
  legacy_path: BLACK_SWAN_ARTICLE_LEGACY_PATH,
  canonical_url: BLACK_SWAN_ARTICLE_CANONICAL_URL,
  status: "published",
  published_at: BLACK_SWAN_ARTICLE_FALLBACK_PUBLISHED_AT,
  deleted_at: null,
});
const after = Object.freeze({
  ...before,
  ...desiredPatch,
  updated_at: "2026-08-27T10:01:00.000Z",
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function queuedFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  };
  return { fetchImpl, calls };
}

describe("guarded Black Swan article publication restore", () => {
  it("pins the reviewed article identity and exported content digest", () => {
    expect(sourceDocument.id).toBe(`cms-${BLACK_SWAN_ARTICLE_ID}`);
    expect(sourceDocument.legacyId).toBe(BLACK_SWAN_ARTICLE_LEGACY_ID);
    expect(sourceDocument.title).toBe(BLACK_SWAN_ARTICLE_TITLE);
    expect(sha256Text(sourceDocument.contentHtml)).toBe(
      BLACK_SWAN_ARTICLE_CONTENT_SHA256
    );
    expect(() => assertBlackSwanArticleIdentity(before)).not.toThrow();
  });

  it("fails closed when immutable identity, category, content, or lock drifts", () => {
    expect(() =>
      assertBlackSwanArticleIdentity({ ...before, legacy_id: "other" })
    ).toThrow("legacy_id has drifted");
    expect(() =>
      assertBlackSwanArticleIdentity({ ...before, title: "Other" })
    ).toThrow("title has drifted");
    expect(() =>
      assertBlackSwanArticleIdentity({
        ...before,
        categories: { slug: "other" },
      })
    ).toThrow("category slug has drifted");
    expect(() =>
      assertBlackSwanArticleIdentity({ ...before, content_html: "changed" })
    ).toThrow("content_html SHA-256 has drifted");
    expect(() =>
      assertBlackSwanArticleIdentity({ ...before, updated_at: null })
    ).toThrow("optimistic-concurrency timestamp");
  });

  it("PATCHes only the six approved fields with id and updated_at guards", async () => {
    const { fetchImpl, calls } = queuedFetch([
      jsonResponse([before]),
      jsonResponse([after]),
      jsonResponse([after]),
    ]);

    await expect(
      restoreBlackSwanArticlePublication({ fetchImpl, environment })
    ).resolves.toEqual({
      status: "updated-and-verified",
      id: BLACK_SWAN_ARTICLE_ID,
    });
    expect(calls.map((call) => call.options.method)).toEqual([
      "GET",
      "PATCH",
      "GET",
    ]);
    expect(JSON.parse(calls[1].options.body)).toEqual(desiredPatch);
    expect(Object.keys(JSON.parse(calls[1].options.body)).sort()).toEqual([
      "canonical_url",
      "deleted_at",
      "legacy_path",
      "published_at",
      "slug",
      "status",
    ]);
    const patchUrl = new URL(calls[1].url);
    expect(patchUrl.searchParams.get("id")).toBe(
      `eq.${BLACK_SWAN_ARTICLE_ID}`
    );
    expect(patchUrl.searchParams.get("updated_at")).toBe(
      `eq.${before.updated_at}`
    );
    expect(calls[1].options.headers.Prefer).toBe("return=representation");
  });

  it("preserves an existing non-null published_at value", () => {
    const existingPublishedAt = "2025-12-12T09:00:00.000Z";
    expect(
      desiredBlackSwanArticlePatch({
        ...before,
        published_at: existingPublishedAt,
      }).published_at
    ).toBe(existingPublishedAt);
  });

  it("is idempotent for the exact desired published state", async () => {
    const { fetchImpl, calls } = queuedFetch([jsonResponse([after])]);
    await expect(
      restoreBlackSwanArticlePublication({ fetchImpl, environment })
    ).resolves.toEqual({
      status: "already-correct",
      id: BLACK_SWAN_ARTICLE_ID,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].options.method).toBe("GET");
  });

  it("fails on a missing row or an optimistic-concurrency conflict", async () => {
    const missing = queuedFetch([jsonResponse([])]);
    await expect(
      restoreBlackSwanArticlePublication({
        fetchImpl: missing.fetchImpl,
        environment,
      })
    ).rejects.toThrow("could not be resolved uniquely");

    const conflict = queuedFetch([jsonResponse([before]), jsonResponse([])]);
    await expect(
      restoreBlackSwanArticlePublication({
        fetchImpl: conflict.fetchImpl,
        environment,
      })
    ).rejects.toThrow("updated_at concurrency race");
    expect(conflict.calls).toHaveLength(2);
  });

  it("accepts only the pinned production Supabase project", () => {
    expect(resolveBlackSwanProductionEnvironment(environment)).toEqual({
      supabaseUrl: "https://sjqejjmwpzfsczxdghvw.supabase.co",
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
    });
    expect(() =>
      resolveBlackSwanProductionEnvironment({
        ...environment,
        VITE_SUPABASE_URL: "https://example.supabase.co/",
      })
    ).toThrow("pinned production project");
  });

  it("keeps the manual production workflow immutable and exact", () => {
    const workflowPath = path.join(
      process.cwd(),
      ".github/workflows/restore-black-swan-article-publication.yml"
    );
    const source = readFileSync(workflowPath, "utf8");
    const workflow = parse(source);
    expect(workflow.on).toEqual({
      workflow_dispatch: {
        inputs: expect.objectContaining({
          expected_main_sha: expect.objectContaining({ required: true }),
          confirmation: expect.objectContaining({ required: true }),
        }),
      },
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual({
      group: "production-black-swan-article-publication-restore",
      "cancel-in-progress": false,
    });
    expect(workflow.jobs.restore.environment).toEqual({ name: "production" });
    expect(workflow.jobs.restore.if).toBe("github.ref == 'refs/heads/main'");
    expect(source).toContain("RESTORE BLACK SWAN ARTICLE 7AD1AB89");
    expect(source).toContain("^[0-9a-f]{40}$");
    expect(source).toContain("ref: ${{ inputs.expected_main_sha }}");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("git ls-remote --exit-code origin refs/heads/main");
    expect(source).toContain("secrets.SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("node scripts/check-public-build-requests.mjs");
    expect(source).not.toContain("--finalize=");
    expect(source).toContain(
      "node scripts/database/restore-black-swan-article-publication.mjs --apply"
    );
    expect(source).not.toMatch(/^\s*(?:push|pull_request|schedule):/mu);
    expect(source).not.toMatch(
      /echo[^\n]*(?:VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=/u
    );
  });
});
