import { adminEnv } from "@/lib/env";
import { trustedAdminOutboundUrl } from "@/lib/trusted-server-url";

export type PublicBuildResult =
  | {
      configured: false;
      ok: false;
      provider: "none";
      error: "not-configured" | "durable-queue-unavailable";
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
    const [owner, name] = repository.split("/").map(encodeURIComponent);
    const dispatchUrl = trustedAdminOutboundUrl(
      `https://api.github.com/repos/${owner}/${name}/actions/workflows/${workflow}/dispatches`,
      "GitHub dispatch URL"
    );
    const response = await fetch(
      dispatchUrl,
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
    const deployHookUrl = trustedAdminOutboundUrl(adminEnv.deployHookUrl, "Deploy hook URL");
    if (deployHookUrl.hostname !== "api.cloudflare.com") {
      throw new Error("Deploy hook URL must use api.cloudflare.com.");
    }
    const response = await fetch(deployHookUrl, {
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
