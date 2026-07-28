import { adminEnv } from "@/lib/env";

export type PublicBuildResult =
  | { configured: false; ok: false; error: "not-configured" }
  | { configured: true; ok: true }
  | { configured: true; ok: false; error: string };

export async function triggerPublicBuild(
  reason: string
): Promise<PublicBuildResult> {
  if (!adminEnv.deployHookUrl) {
    return { configured: false, ok: false, error: "not-configured" };
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
        error: `HTTP ${response.status}`,
      };
    }
    return { configured: true, ok: true };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : "unknown-error",
    };
  }
}
