import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  normalizePublicationHead,
  publicationHeadProgress,
  publicationHeadMarker,
} from "./lib/cms-publication-state.mjs";
import { fetchCmsPublicationHead } from "./lib/cms-publication-head.mjs";
import { trustedHttpsUrl } from "./lib/trusted-server-url.mjs";

export function assertPublicationDeployHead({
  candidateHeadSource = "outbox",
  candidateOutboxHighWater,
  candidateLegacyAuditHighWater = "0",
  currentHeadSource = "outbox",
  currentOutboxHighWater,
  currentLegacyAuditHighWater = "0",
  expectedMainSha,
  currentMainSha,
  articleCount,
  contentSha256,
}) {
  const candidateHead = normalizePublicationHead(
    {
      source: candidateHeadSource,
      outboxHighWater: candidateOutboxHighWater,
      legacyAuditHighWater: candidateLegacyAuditHighWater,
    },
    "candidate publication head"
  );
  const currentHead = normalizePublicationHead(
    {
      source: currentHeadSource,
      outboxHighWater: currentOutboxHighWater,
      legacyAuditHighWater: currentLegacyAuditHighWater,
    },
    "current publication head"
  );
  let cmsHeadMatches = false;
  try {
    cmsHeadMatches =
      publicationHeadProgress(candidateHead, currentHead).state === "current";
  } catch {
    cmsHeadMatches = false;
  }
  if (!cmsHeadMatches) {
    throw new Error(
      `CMS advanced after the build snapshot (${publicationHeadMarker(candidateHead) || `${candidateHead.source}:0`} -> ${publicationHeadMarker(currentHead) || `${currentHead.source}:0`}); refusing to overwrite production with an older publication set.`
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
  return {
    candidate: candidateHead.outboxHighWater,
    candidateHead,
    articleCount: Number(articleCount),
    contentSha256,
  };
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

  const [currentHead, mainRef] = await Promise.all([
    fetchCmsPublicationHead({ supabaseUrl, serviceKey, fetchImpl }),
    json(
      await fetchImpl(
        trustedHttpsUrl(
          `https://api.github.com/repos/${githubRepository.split("/").map(encodeURIComponent).join("/")}/git/ref/heads/main`,
          ["api.github.com"],
          "GitHub main-ref URL"
        ),
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
  const result = assertPublicationDeployHead({
    candidateHeadSource: environment.CANDIDATE_PUBLICATION_HEAD_SOURCE,
    candidateOutboxHighWater: environment.CANDIDATE_OUTBOX_HIGH_WATER,
    candidateLegacyAuditHighWater:
      environment.CANDIDATE_LEGACY_AUDIT_HIGH_WATER,
    currentHeadSource: currentHead.source,
    currentOutboxHighWater: currentHead.outboxHighWater,
    currentLegacyAuditHighWater: currentHead.legacyAuditHighWater,
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
        `- CMS publication head: \`${publicationHeadMarker(result.candidateHead) || `${result.candidateHead.source}:0`}\``,
        `- Published articles: **${result.articleCount}**`,
        `- Snapshot fingerprint: \`${result.contentSha256}\``,
        "- Result: current code and CMS heads exactly match the uploaded Pages artifact.",
        "",
      ].join("\n"),
      "utf8"
    );
  }
  console.log(
    `Publication head verified: main ${environment.EXPECTED_MAIN_SHA}, CMS ${publicationHeadMarker(result.candidateHead) || `${result.candidateHead.source}:0`}, ${result.articleCount} articles, snapshot ${result.contentSha256.slice(0, 12)}.`
  );
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await verifyPublicationDeployHead();
}
