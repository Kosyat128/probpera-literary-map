import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeOutboxHighWater } from "./lib/cms-publication-state.mjs";

const workflowFile = "deploy-pages.yml";

function validSha(value, label) {
  const sha = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error(`${label} is missing or invalid.`);
  return sha;
}

function nonterminalWorkflowRuns(
  value,
  currentRunId,
  requiredHeadSha,
  { excludeSchedule = false } = {}
) {
  if (!Array.isArray(value?.workflow_runs)) {
    throw new Error("GitHub workflow-run query returned an invalid body.");
  }
  return value.workflow_runs.filter(
    (run) =>
      String(run?.id || "") !== currentRunId &&
      String(run?.status || "") !== "completed" &&
      String(run?.head_sha || "").toLowerCase() === requiredHeadSha &&
      (!excludeSchedule || String(run?.event || "") !== "schedule")
  );
}

export function classifyPublicationFollowUp({
  candidateOutboxHighWater,
  currentOutboxHighWater,
  expectedMainSha,
  currentMainSha,
}) {
  const candidate = normalizeOutboxHighWater(
    candidateOutboxHighWater,
    "candidate outbox high-water mark"
  );
  const current = normalizeOutboxHighWater(
    currentOutboxHighWater,
    "current outbox high-water mark"
  );
  const expectedSha = validSha(expectedMainSha, "Expected workflow SHA");
  const mainSha = validSha(currentMainSha, "Current main SHA");
  if (BigInt(current) < BigInt(candidate)) {
    throw new Error(
      `CMS outbox moved backwards after deployment (${candidate} -> ${current}).`
    );
  }
  if (mainSha !== expectedSha) {
    return {
      state: "main-advanced",
      candidate,
      current,
      mainSha,
      cmsMatchesCandidate: current === candidate,
      // A main advance is not safe to acknowledge until a matching run is
      // proven or a full replacement run is successfully queued.
      safeToFinalize: false,
      shouldDispatch: true,
      dispatchMode: "full",
    };
  }
  if (current === candidate) {
    return {
      state: "current",
      candidate,
      current,
      mainSha,
      safeToFinalize: true,
      shouldDispatch: false,
    };
  }
  return {
    state: "cms-advanced",
    candidate,
    current,
    mainSha,
    safeToFinalize: false,
    shouldDispatch: true,
    dispatchMode: "cms",
  };
}

async function json(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function queryWorkflowRuns(fetchImpl, baseUrl, headers) {
  const workflowRuns = [];
  // queue:max permits 100 pending owners in addition to the current run. Two
  // API pages cover the whole concurrency group even at the documented limit.
  for (let pageNumber = 1; pageNumber <= 2; pageNumber += 1) {
    const pageUrl = new URL(baseUrl);
    pageUrl.searchParams.set("page", String(pageNumber));
    const page = await json(
      await fetchImpl(pageUrl, { headers }),
      `Existing Pages workflow-run query page ${pageNumber}`
    );
    if (!Array.isArray(page?.workflow_runs)) {
      throw new Error("GitHub workflow-run query returned an invalid body.");
    }
    workflowRuns.push(...page.workflow_runs);
    if (page.workflow_runs.length < 100) break;
  }
  return { workflow_runs: workflowRuns };
}

async function writeResult(environment, result) {
  if (environment.GITHUB_OUTPUT) {
    await appendFile(
      environment.GITHUB_OUTPUT,
      [
        `state=${result.state}`,
        `safe_to_finalize=${result.safeToFinalize ? "true" : "false"}`,
        `dispatched=${result.dispatched ? "true" : "false"}`,
        "",
      ].join("\n"),
      "utf8"
    );
  }
  if (environment.GITHUB_STEP_SUMMARY) {
    const detail = {
      current: "No newer code or CMS head appeared during Pages promotion.",
      "main-followup-existing":
        "main advanced and a nonterminal Pages run on that exact SHA already owns the follow-up.",
      "main-followup-dispatched":
        "main advanced without a matching run; one full workflow_dispatch was queued.",
      "cms-followup-existing":
        "CMS advanced and an existing nonterminal Pages run already owns the follow-up.",
      "cms-followup-dispatched":
        "CMS advanced; one immediate CMS workflow_dispatch was queued behind this release.",
    }[result.state];
    await appendFile(
      environment.GITHUB_STEP_SUMMARY,
      [
        "## Post-deploy publication coalescing",
        "",
        `- State: \`${result.state}\``,
        `- Outbox: \`${result.candidate}\` → \`${result.current}\``,
        `- Candidate marker may be finalized: **${result.safeToFinalize ? "yes" : "no"}**`,
        `- ${detail}`,
        "",
      ].join("\n"),
      "utf8"
    );
  }
}

export async function coalescePublicationFollowUp(
  environment = process.env,
  fetchImpl = fetch
) {
  const supabaseUrl = String(
    environment.SUPABASE_URL || environment.VITE_SUPABASE_URL || ""
  ).replace(/\/+$/u, "");
  const serviceKey = String(environment.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const repository = String(environment.GITHUB_REPOSITORY || "").trim();
  const token = String(environment.GITHUB_TOKEN || "").trim();
  const currentRunId = String(environment.GITHUB_RUN_ID || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Post-deploy coalescing requires Supabase service credentials.");
  }
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository) ||
    !token ||
    !/^\d+$/u.test(currentRunId)
  ) {
    throw new Error(
      "Post-deploy coalescing requires GITHUB_REPOSITORY, GITHUB_TOKEN and GITHUB_RUN_ID."
    );
  }
  const githubHeaders = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

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
      await fetchImpl(`https://api.github.com/repos/${repository}/git/ref/heads/main`, {
        headers: githubHeaders,
      }),
      "Current GitHub main head"
    ),
  ]);
  if (!Array.isArray(outboxRows)) {
    throw new Error("Current CMS publication head returned a non-array body.");
  }

  const classification = classifyPublicationFollowUp({
    candidateOutboxHighWater: environment.CANDIDATE_OUTBOX_HIGH_WATER,
    currentOutboxHighWater: outboxRows[0]?.id ?? 0,
    expectedMainSha: environment.EXPECTED_MAIN_SHA,
    currentMainSha: mainRef?.object?.sha,
  });
  if (!classification.shouldDispatch) {
    const result = { ...classification, dispatched: false };
    await writeResult(environment, result);
    return result;
  }

  const runsUrl = new URL(
    `https://api.github.com/repos/${repository}/actions/workflows/${workflowFile}/runs`
  );
  runsUrl.searchParams.set("branch", "main");
  // queue:max supports up to 100 pending runs; inspect the complete supported
  // queue so an existing owner is never missed merely due to pagination.
  runsUrl.searchParams.set("per_page", "100");
  const runs = await queryWorkflowRuns(fetchImpl, runsUrl, githubHeaders);
  const existing = nonterminalWorkflowRuns(
    runs,
    currentRunId,
    classification.mainSha,
    // A code-only schedule run can pass the queue gate without deploying, so
    // it cannot own a main advance. Push/manual/CMS runs always enter release.
    { excludeSchedule: classification.state === "main-advanced" }
  );
  if (existing.length) {
    const result = {
      ...classification,
      state:
        classification.state === "main-advanced"
          ? "main-followup-existing"
          : "cms-followup-existing",
      // A queued run is not durable ownership: GitHub concurrency may replace
      // a pending run. Keep the marker pending until the newer SHA deploys.
      safeToFinalize: classification.safeToFinalize,
      dispatched: false,
    };
    await writeResult(environment, result);
    return result;
  }

  const dispatchResponse = await fetchImpl(
    `https://api.github.com/repos/${repository}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        ...githubHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          mode: classification.dispatchMode,
          reason:
            classification.state === "main-advanced"
              ? `postdeploy-main-${classification.mainSha.slice(0, 12)}-outbox-${classification.candidate}-to-${classification.current}`
              : `postdeploy-outbox-${classification.candidate}-to-${classification.current}`,
        },
      }),
    }
  );
  if (!dispatchResponse.ok) {
    throw new Error(
      `Immediate CMS follow-up dispatch failed: ${dispatchResponse.status} ${await dispatchResponse.text()}`
    );
  }
  const result = {
    ...classification,
    state:
      classification.state === "main-advanced"
        ? "main-followup-dispatched"
        : "cms-followup-dispatched",
    // Do not acknowledge the marker for an older code SHA merely because the
    // replacement was queued; the replacement deployment must acknowledge it.
    safeToFinalize: classification.safeToFinalize,
    dispatched: true,
  };
  await writeResult(environment, result);
  return result;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await coalescePublicationFollowUp();
}
