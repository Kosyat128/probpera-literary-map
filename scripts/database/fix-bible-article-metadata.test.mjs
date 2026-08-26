import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  BIBLE_ARTICLE_AFTER,
  BIBLE_ARTICLE_BEFORE,
  BIBLE_ARTICLE_ID,
  BIBLE_ARTICLE_PATCH,
  applyBibleArticleMetadataFix,
  classifyBibleArticleMetadata,
  resolveBibleArticleProductionEnvironment,
} from "./fix-bible-article-metadata.mjs";

const environment = Object.freeze({
  VITE_SUPABASE_URL: "https://sjqejjmwpzfsczxdghvw.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-never-log",
});
const before = Object.freeze({
  ...BIBLE_ARTICLE_BEFORE,
  updated_at: "2026-08-24T10:00:00.000Z",
});
const after = Object.freeze({
  ...BIBLE_ARTICLE_AFTER,
  updated_at: "2026-08-24T10:01:00.000Z",
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

describe("guarded Bible article metadata fix", () => {
  it("pins the exact reviewed before, patch, and after contracts", () => {
    expect(BIBLE_ARTICLE_ID).toBe("50978dc4-c80f-4bc6-aed0-7e9fd693193a");
    expect(classifyBibleArticleMetadata(before)).toBe("before");
    expect(classifyBibleArticleMetadata(after)).toBe("after");
    expect(Object.keys(BIBLE_ARTICLE_PATCH).sort()).toEqual([
      "og_title",
      "seo_title",
      "title",
    ]);
    expect(BIBLE_ARTICLE_AFTER.slug).toBe(BIBLE_ARTICLE_BEFORE.slug);
    expect(BIBLE_ARTICLE_AFTER.status).toBe("published");
    expect(Object.values(BIBLE_ARTICLE_PATCH)).toEqual([
      "15 крылатых выражений, пришедших к нам из Библии",
      "15 крылатых выражений, пришедших к нам из Библии",
      "15 крылатых выражений, пришедших к нам из Библии",
    ]);
  });

  it("fails closed for drift from both exact states", () => {
    expect(() =>
      classifyBibleArticleMetadata({ ...before, status: "draft" })
    ).toThrow("exact reviewed before or after state");
    expect(() =>
      classifyBibleArticleMetadata({ ...before, updated_at: null })
    ).toThrow("optimistic-concurrency timestamp");
  });

  it("PATCHes only three fields with id and updated_at guards, then re-reads", async () => {
    const { fetchImpl, calls } = queuedFetch([
      jsonResponse([before]),
      jsonResponse([after]),
      jsonResponse([after]),
    ]);

    await expect(
      applyBibleArticleMetadataFix({ fetchImpl, environment })
    ).resolves.toEqual({
      status: "updated-and-verified",
      id: BIBLE_ARTICLE_ID,
    });
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.options.method)).toEqual([
      "GET",
      "PATCH",
      "GET",
    ]);
    expect(JSON.parse(calls[1].options.body)).toEqual(BIBLE_ARTICLE_PATCH);
    expect(Object.keys(JSON.parse(calls[1].options.body)).sort()).toEqual([
      "og_title",
      "seo_title",
      "title",
    ]);
    const patchUrl = new URL(calls[1].url);
    expect(patchUrl.searchParams.get("id")).toBe(`eq.${BIBLE_ARTICLE_ID}`);
    expect(patchUrl.searchParams.get("updated_at")).toBe(
      `eq.${before.updated_at}`
    );
    expect(calls[1].options.headers.Prefer).toBe("return=representation");
  });

  it("is idempotent and makes no PATCH for the exact after state", async () => {
    const { fetchImpl, calls } = queuedFetch([jsonResponse([after])]);
    await expect(
      applyBibleArticleMetadataFix({ fetchImpl, environment })
    ).resolves.toEqual({ status: "already-correct", id: BIBLE_ARTICLE_ID });
    expect(calls).toHaveLength(1);
    expect(calls[0].options.method).toBe("GET");
  });

  it("fails on an optimistic-concurrency conflict before verification", async () => {
    const { fetchImpl, calls } = queuedFetch([
      jsonResponse([before]),
      jsonResponse([]),
    ]);
    await expect(
      applyBibleArticleMetadataFix({ fetchImpl, environment })
    ).rejects.toThrow("updated_at concurrency race");
    expect(calls).toHaveLength(2);
  });

  it("accepts only the pinned production Supabase project", () => {
    expect(resolveBibleArticleProductionEnvironment(environment)).toEqual({
      supabaseUrl: "https://sjqejjmwpzfsczxdghvw.supabase.co",
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
    });
    expect(() =>
      resolveBibleArticleProductionEnvironment({
        ...environment,
        VITE_SUPABASE_URL: "https://example.supabase.co/",
      })
    ).toThrow("pinned production project");
  });

  it("keeps the manual production workflow immutable and exact", () => {
    const workflowPath = path.join(
      process.cwd(),
      ".github/workflows/fix-bible-article-metadata.yml"
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
      group: "production-bible-article-metadata-fix",
      "cancel-in-progress": false,
    });
    expect(workflow.jobs.fix.environment).toEqual({ name: "production" });
    expect(workflow.jobs.fix.if).toBe("github.ref == 'refs/heads/main'");
    expect(source).toContain("FIX BIBLE ARTICLE METADATA 50978DC4");
    expect(source).toContain("^[0-9a-f]{40}$");
    expect(source).toContain("ref: ${{ inputs.expected_main_sha }}");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("git ls-remote --exit-code origin refs/heads/main");
    expect(source).toContain("secrets.SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain(
      "node scripts/database/fix-bible-article-metadata.mjs --apply"
    );
    expect(source).not.toMatch(/^\s*(?:push|pull_request|schedule):/mu);
    expect(source).not.toMatch(
      /echo[^\n]*(?:VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=/u
    );
  });
});
