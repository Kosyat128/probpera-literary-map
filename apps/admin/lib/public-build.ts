import { adminEnv } from "@/lib/env";

export type PublicBuildResult =
  | {
      configured: false;
      ok: false;
      provider: "none";
      error: "not-configured";
    }
  | {
      configured: true;
      ok: true;
      provider: "deploy-hook" | "github-actions";
    }
  | {
      configured: true;
      ok: false;
      provider: "deploy-hook" | "github-actions";
      error: string;
    };

async function dispatchGitHubWorkflow(reason: string): Promise<PublicBuildResult> {
  const repository = adminEnv.githubRepository.replace(/^\/+|\/+$/gu, "");
  if (!adminEnv.githubDeployToken || !/^[^/\s]+\/[^/\s]+$/u.test(repository)) {
    return {
      configured: false,
      ok: false,
      provider: "none",
      error: "not-configured",
    };
  }

  try {
    const workflow = encodeURIComponent(adminEnv.githubDeployWorkflow);
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${adminEnv.githubDeployToken}`,
          "content-type": "application/json",
          "user-agent": "probpera-admin",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: adminEnv.githubDeployRef,
          inputs: {
            mode: "cms",
            reason: reason.slice(0, 100),
          },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!response.ok) {
      return {
        configured: true,
        ok: false,
        provider: "github-actions",
        error: `HTTP ${response.status}`,
      };
    }
    return { configured: true, ok: true, provider: "github-actions" };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      provider: "github-actions",
      error: error instanceof Error ? error.message : "unknown-error",
    };
  }
}

export async function triggerPublicBuild(
  reason: string
): Promise<PublicBuildResult> {
  if (!adminEnv.deployHookUrl) {
    return dispatchGitHubWorkflow(reason);
  }

  try {
    const response = await fetch(adminEnv.deployHookUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(adminEnv.deployHookToken
          ? { authorization: `Bearer ${adminEnv.deployHookToken}` }
          : {}),
      },
      body: JSON.stringify({
        reason,
        source: "probpera-admin",
        requestedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return {
        configured: true,
        ok: false,
        provider: "deploy-hook",
        error: `HTTP ${response.status}`,
      };
    }
    return { configured: true, ok: true, provider: "deploy-hook" };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      provider: "deploy-hook",
      error: error instanceof Error ? error.message : "unknown-error",
    };
  }
}
