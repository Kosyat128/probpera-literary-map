import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  checkDeployedReleaseCodeHead,
  writeReleaseCodeHead,
} from "./check-deployed-release-head.mjs";
import { classifyLiveReleaseCodeHead } from "./lib/release-code-head.mjs";

const sha = "a".repeat(40);
const olderSha = "b".repeat(40);

describe("durable deployed code head", () => {
  it("distinguishes the current release from a code-only main advance", () => {
    expect(
      classifyLiveReleaseCodeHead({
        expectedCommitSha: sha,
        status: 200,
        payload: { schemaVersion: 1, commitSha: sha },
      })
    ).toMatchObject({ codePending: false, reason: "release-head-current" });
    expect(
      classifyLiveReleaseCodeHead({
        expectedCommitSha: sha,
        status: 200,
        payload: { schemaVersion: 1, commitSha: olderSha },
      })
    ).toMatchObject({ codePending: true, reason: "release-head-behind" });
  });

  it("fails open to a safe rebuild when the live marker is missing or invalid", () => {
    expect(
      classifyLiveReleaseCodeHead({ expectedCommitSha: sha, status: 404, payload: null })
    ).toMatchObject({ codePending: true, reason: "release-head-missing" });
    expect(
      classifyLiveReleaseCodeHead({
        expectedCommitSha: sha,
        status: 200,
        payload: { commitSha: "invalid" },
      })
    ).toMatchObject({ codePending: true, reason: "release-head-invalid" });
  });

  it("makes the next schedule recover after an immediate dispatch failure", async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), "release-head-output-"));
    const outputFile = path.join(output, "github-output.txt");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ schemaVersion: 1, commitSha: olderSha }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await expect(
      checkDeployedReleaseCodeHead(
        {
          EXPECTED_MAIN_SHA: sha,
          PUBLIC_SITE_URL: "https://probpera.ru",
          GITHUB_OUTPUT: outputFile,
        },
        fetchImpl
      )
    ).resolves.toMatchObject({ codePending: true });
    expect(await readFile(outputFile, "utf8")).toContain("code_pending=1");
    expect(fetchImpl.mock.calls[0][0]).not.toContain(olderSha);
  });

  it("writes the exact build SHA into the deployable hidden marker", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "release-head-dist-"));
    await writeReleaseCodeHead({
      outputRoot,
      environment: { RELEASE_COMMIT_SHA: sha },
    });
    const document = JSON.parse(
      await readFile(
        path.join(outputRoot, ".well-known", "probpera-release-head.json"),
        "utf8"
      )
    );
    expect(document).toMatchObject({ schemaVersion: 1, commitSha: sha });
  });
});
