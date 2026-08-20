import { describe, expect, it, vi } from "vitest";

import {
  classifyPublicationFollowUp,
  coalescePublicationFollowUp,
} from "./coalesce-publication-followup.mjs";

const sha = "a".repeat(40);
const newerSha = "b".repeat(40);

function environment(overrides = {}) {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-secret",
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_TOKEN: "github-secret",
    GITHUB_RUN_ID: "9001",
    EXPECTED_MAIN_SHA: sha,
    CANDIDATE_OUTBOX_HIGH_WATER: "165",
    ...overrides,
  };
}

function response(value, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: status === 204 ? undefined : { "content-type": "application/json" },
  });
}

describe("post-deploy publication follow-up coalescing", () => {
  it("does nothing when the promoted artifact still matches both heads", () => {
    expect(
      classifyPublicationFollowUp({
        candidateOutboxHighWater: "165",
        currentOutboxHighWater: 165,
        expectedMainSha: sha,
        currentMainSha: sha,
      })
    ).toMatchObject({ state: "current", safeToFinalize: true, shouldDispatch: false });
  });

  it("requires a full follow-up for a main advance until a matching run is proven", () => {
    expect(
      classifyPublicationFollowUp({
        candidateOutboxHighWater: "165",
        currentOutboxHighWater: "166",
        expectedMainSha: sha,
        currentMainSha: newerSha,
      })
    ).toMatchObject({
      state: "main-advanced",
      safeToFinalize: false,
      shouldDispatch: true,
      dispatchMode: "full",
    });
  });

  it("does not mark an unchanged CMS marker safe before main follow-up ownership", () => {
    expect(
      classifyPublicationFollowUp({
        candidateOutboxHighWater: "165",
        currentOutboxHighWater: "165",
        expectedMainSha: sha,
        currentMainSha: newerSha,
      })
    ).toMatchObject({
      state: "main-advanced",
      cmsMatchesCandidate: true,
      safeToFinalize: false,
      shouldDispatch: true,
    });
  });

  it("refuses an impossible backwards outbox instead of dispatching", () => {
    expect(() =>
      classifyPublicationFollowUp({
        candidateOutboxHighWater: "165",
        currentOutboxHighWater: "164",
        expectedMainSha: sha,
        currentMainSha: sha,
      })
    ).toThrow("moved backwards");
  });

  it("dispatches exactly one immediate CMS run when only outbox advanced", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 166 }]))
      .mockResolvedValueOnce(response({ object: { sha } }))
      .mockResolvedValueOnce(
        response({ workflow_runs: [{ id: 9001, status: "in_progress", head_sha: sha }] })
      )
      .mockResolvedValueOnce(response(null, 204));

    await expect(
      coalescePublicationFollowUp(environment(), fetchImpl)
    ).resolves.toMatchObject({
      state: "cms-followup-dispatched",
      safeToFinalize: false,
      dispatched: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const [runsUrl] = fetchImpl.mock.calls[2];
    expect(runsUrl.searchParams.get("branch")).toBe("main");
    expect(runsUrl.searchParams.get("per_page")).toBe("100");
    expect(runsUrl.searchParams.get("page")).toBe("1");
    const [dispatchUrl, dispatchOptions] = fetchImpl.mock.calls[3];
    expect(dispatchUrl).toContain("/actions/workflows/deploy-pages.yml/dispatches");
    expect(dispatchOptions.method).toBe("POST");
    expect(dispatchOptions.headers.Authorization).toBe("Bearer github-secret");
    expect(JSON.parse(dispatchOptions.body)).toEqual({
      ref: "main",
      inputs: {
        mode: "cms",
        reason: "postdeploy-outbox-165-to-166",
      },
    });
  });

  it("reuses an existing nonterminal run and cannot create a recursive storm", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 166 }]))
      .mockResolvedValueOnce(response({ object: { sha } }))
      .mockResolvedValueOnce(
        response({
          workflow_runs: [
            { id: 9001, status: "in_progress" },
            { id: 9002, status: "queued", head_sha: sha },
          ],
        })
      );

    await expect(
      coalescePublicationFollowUp(environment(), fetchImpl)
    ).resolves.toMatchObject({
      state: "cms-followup-existing",
      safeToFinalize: false,
      dispatched: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("checks the second API page at a full queue before creating a duplicate", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: 10_000 + index,
      status: "completed",
      head_sha: sha,
    }));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 166 }]))
      .mockResolvedValueOnce(response({ object: { sha } }))
      .mockResolvedValueOnce(response({ workflow_runs: firstPage }))
      .mockResolvedValueOnce(
        response({
          workflow_runs: [{ id: 9002, status: "queued", head_sha: sha }],
        })
      );

    await expect(
      coalescePublicationFollowUp(environment(), fetchImpl)
    ).resolves.toMatchObject({ state: "cms-followup-existing", dispatched: false });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[3][0].searchParams.get("page")).toBe("2");
  });

  it("reuses a nonterminal push run on the advanced main SHA", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 165 }]))
      .mockResolvedValueOnce(response({ object: { sha: newerSha } }))
      .mockResolvedValueOnce(
        response({
          workflow_runs: [
            { id: 9001, status: "in_progress", head_sha: sha },
            { id: 9002, status: "queued", head_sha: newerSha, event: "push" },
          ],
        })
      );

    await expect(
      coalescePublicationFollowUp(environment(), fetchImpl)
    ).resolves.toMatchObject({
      state: "main-followup-existing",
      safeToFinalize: false,
      dispatched: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("queues one full run for a code-only skip-ci or token-suppressed main advance", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 165 }]))
      .mockResolvedValueOnce(response({ object: { sha: newerSha } }))
      .mockResolvedValueOnce(
        response({
          workflow_runs: [{ id: 9002, status: "queued", head_sha: sha }],
        })
      )
      .mockResolvedValueOnce(response(null, 204));

    await expect(
      coalescePublicationFollowUp(environment(), fetchImpl)
    ).resolves.toMatchObject({
      state: "main-followup-dispatched",
      safeToFinalize: false,
      dispatched: true,
    });
    const [, dispatchOptions] = fetchImpl.mock.calls[3];
    expect(JSON.parse(dispatchOptions.body)).toEqual({
      ref: "main",
      inputs: {
        mode: "full",
        reason: `postdeploy-main-${newerSha.slice(0, 12)}-outbox-165-to-165`,
      },
    });
  });

  it("does not mistake a same-SHA no-op schedule for a code release owner", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 165 }]))
      .mockResolvedValueOnce(response({ object: { sha: newerSha } }))
      .mockResolvedValueOnce(
        response({
          workflow_runs: [
            { id: 9001, status: "in_progress", head_sha: sha, event: "push" },
            { id: 9002, status: "queued", head_sha: newerSha, event: "schedule" },
          ],
        })
      )
      .mockResolvedValueOnce(response(null, 204));

    await expect(
      coalescePublicationFollowUp(environment(), fetchImpl)
    ).resolves.toMatchObject({
      state: "main-followup-dispatched",
      safeToFinalize: false,
      dispatched: true,
    });
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body).inputs.mode).toBe("full");
  });

  it("fails closed when GitHub refuses the immediate dispatch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 166 }]))
      .mockResolvedValueOnce(response({ object: { sha } }))
      .mockResolvedValueOnce(response({ workflow_runs: [] }))
      .mockResolvedValueOnce(response({ message: "forbidden" }, 403));

    await expect(coalescePublicationFollowUp(environment(), fetchImpl)).rejects.toThrow(
      "Immediate CMS follow-up dispatch failed: 403"
    );
  });
});
