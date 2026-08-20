import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyLiveReleaseCodeHead,
  createReleaseCodeHead,
  normalizeReleaseCommitSha,
  releaseCodeHeadPath,
} from "./lib/release-code-head.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function currentCommitSha(environment = process.env) {
  if (environment.RELEASE_COMMIT_SHA) {
    return normalizeReleaseCommitSha(environment.RELEASE_COMMIT_SHA);
  }
  return normalizeReleaseCommitSha(
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  );
}

async function appendOutput(name, value, environment) {
  if (!environment.GITHUB_OUTPUT) return;
  await appendFile(environment.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}

export async function writeReleaseCodeHead({
  outputRoot = path.join(projectRoot, "dist"),
  environment = process.env,
} = {}) {
  const document = createReleaseCodeHead({ commitSha: currentCommitSha(environment) });
  const target = path.join(outputRoot, ...releaseCodeHeadPath.split("/").filter(Boolean));
  const temporary = `${target}.tmp-${process.pid}`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  console.log(`Release code head written: ${document.commitSha} -> ${target}`);
  return document;
}

export async function checkDeployedReleaseCodeHead(
  environment = process.env,
  fetchImpl = fetch
) {
  const expectedCommitSha = normalizeReleaseCommitSha(
    environment.EXPECTED_MAIN_SHA,
    "expected main SHA"
  );
  const publicSiteUrl = String(environment.PUBLIC_SITE_URL || "https://probpera.ru")
    .trim()
    .replace(/\/+$/u, "");
  if (!/^https:\/\//u.test(publicSiteUrl)) {
    throw new Error("PUBLIC_SITE_URL must be an HTTPS origin.");
  }

  const url = `${publicSiteUrl}${releaseCodeHeadPath}?expected=${expectedCommitSha}&ts=${Date.now()}`;
  let result;
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    let payload = null;
    if (response.ok) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }
    result = classifyLiveReleaseCodeHead({
      expectedCommitSha,
      status: response.status,
      payload,
    });
  } catch {
    result = {
      codePending: true,
      liveCommitSha: null,
      reason: "release-head-unreachable",
    };
  }

  await appendOutput("code_pending", result.codePending ? "1" : "0", environment);
  await appendOutput("live_commit_sha", result.liveCommitSha || "", environment);
  await appendOutput("reason", result.reason, environment);
  console.log(
    result.codePending
      ? `Code release is pending (${result.reason}); expected ${expectedCommitSha}, live ${result.liveCommitSha || "unknown"}.`
      : `Live code release already matches ${expectedCommitSha}.`
  );
  return result;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  if (process.argv.includes("--write")) await writeReleaseCodeHead();
  else await checkDeployedReleaseCodeHead();
}
