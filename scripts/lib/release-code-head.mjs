const commitShaPattern = /^[0-9a-f]{40}$/u;

export const releaseCodeHeadPath = "/.well-known/probpera-release-head.json";

export function normalizeReleaseCommitSha(value, label = "release commit SHA") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!commitShaPattern.test(normalized)) {
    throw new Error(`${label} must be a lowercase 40-character Git commit SHA.`);
  }
  return normalized;
}

export function createReleaseCodeHead({ commitSha, generatedAt = new Date().toISOString() }) {
  return {
    schemaVersion: 1,
    commitSha: normalizeReleaseCommitSha(commitSha),
    generatedAt: new Date(generatedAt).toISOString(),
  };
}

export function classifyLiveReleaseCodeHead({ expectedCommitSha, status, payload }) {
  const expected = normalizeReleaseCommitSha(expectedCommitSha, "expected main SHA");
  if (status !== 200 || !payload || typeof payload !== "object") {
    return {
      codePending: true,
      liveCommitSha: null,
      reason: status === 404 ? "release-head-missing" : "release-head-unavailable",
    };
  }

  let liveCommitSha;
  try {
    liveCommitSha = normalizeReleaseCommitSha(payload.commitSha, "live release SHA");
  } catch {
    return {
      codePending: true,
      liveCommitSha: null,
      reason: "release-head-invalid",
    };
  }

  return liveCommitSha === expected
    ? { codePending: false, liveCommitSha, reason: "release-head-current" }
    : { codePending: true, liveCommitSha, reason: "release-head-behind" };
}
