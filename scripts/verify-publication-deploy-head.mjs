import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { normalizeOutboxHighWater } from "./lib/cms-publication-state.mjs";

export function assertPublicationDeployHead({
  candidateOutboxHighWater,
  currentOutboxHighWater,
  expectedMainSha,
  currentMainSha,
  articleCount,
  contentSha256,
}) {
  const candidate = normalizeOutboxHighWater(
    candidateOutboxHighWater,
    "candidate outbox high-water mark"
  );
  const current = normalizeOutboxHighWater(
    currentOutboxHighWater,
    "current outbox high-water mark"
  );
  if (candidate !== current) {
    throw new Error(
      `CMS advanced after the build snapshot (${candidate} -> ${current}); refusing to overwrite production with an older publication set.`
    );
  }
  if (!/^[0-9a-f]{40}$/u.test(String(expectedMainSha || ""))) {
    throw new Error("Expected workflow SHA is missing or invalid.");
  }
  if (currentMainSha !== expectedMainSha) {
    throw new Error(
      `main advanced after this workflow started (${expectedMainSha} -> ${currentMainSha}); the newer run must publish the combined code/content state.`
    );
  }
  if (!/^\d+$/u.test(String(articleCount || ""))) {
    throw new Error("Candidate article count is missing or invalid.");
  }
  if (!/^[0-9a-f]{64}$/u.test(String(contentSha256 || ""))) {
    throw new Error("Candidate content fingerprint is missing or invalid.");
  }
  return { candidate, articleCount: Number(articleCount), contentSha256 };
}

async function json(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export async function verifyPublicationDeployHead(environment = process.env, fetchImpl = fetch) {
  const supabaseUrl = String(
    environment.SUPABASE_URL || environment.VITE_SUPABASE_URL || ""
  ).replace(/\/+$/u, "");
  const serviceKey = String(environment.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const githubRepository = String(environment.GITHUB_REPOSITORY || "").trim();
  const githubToken = String(environment.GITHUB_TOKEN || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Pre-deploy CMS head guard requires Supabase service credentials.");
  }
  if (!/^[^/]+\/[^/]+$/u.test(githubRepository) || !githubToken) {
    throw new Error("Pre-deploy code head guard requires GITHUB_REPOSITORY and GITHUB_TOKEN.");
  }

  const [outboxRows, mainRef] = await Promise.all([
    json(
      await fetchImpl(
        `${supabaseUrl}/rest/v1/public_build_outbox?select=id&order=id.desc&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      ),
      "Current CMS publication head"
    ),
    json(
      await fetchImpl(
        `https://api.github.com/repos/${githubRepository}/git/ref/heads/main`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      ),
      "Current GitHub main head"
    ),
  ]);
  if (!Array.isArray(outboxRows)) {
    throw new Error("Current CMS publication head returned a non-array body.");
  }

  const result = assertPublicationDeployHead({
    candidateOutboxHighWater: environment.CANDIDATE_OUTBOX_HIGH_WATER,
    currentOutboxHighWater: outboxRows[0]?.id ?? 0,
    expectedMainSha: environment.EXPECTED_MAIN_SHA,
    currentMainSha: mainRef?.object?.sha,
    articleCount: environment.CANDIDATE_ARTICLE_COUNT,
    contentSha256: environment.CANDIDATE_CONTENT_SHA256,
  });

  if (environment.GITHUB_STEP_SUMMARY) {
    await appendFile(
      environment.GITHUB_STEP_SUMMARY,
      [
        "## Publication head guard",
        "",
        `- Combined release SHA: \`${environment.EXPECTED_MAIN_SHA}\``,
        `- CMS outbox high-water: \`${result.candidate}\``,
        `- Published articles: **${result.articleCount}**`,
        `- Snapshot fingerprint: \`${result.contentSha256}\``,
        "- Result: current code and CMS heads exactly match the uploaded Pages artifact.",
        "",
      ].join("\n"),
      "utf8"
    );
  }
  console.log(
    `Publication head verified: main ${environment.EXPECTED_MAIN_SHA}, outbox ${result.candidate}, ${result.articleCount} articles, snapshot ${result.contentSha256.slice(0, 12)}.`
  );
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await verifyPublicationDeployHead();
}
