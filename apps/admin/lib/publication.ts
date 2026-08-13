import { triggerPublicBuild, type PublicBuildResult } from "@/lib/public-build";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;

export type PublicationState = "started" | "queued" | "queue-error";

type RequestPublicBuildOptions = {
  supabase: SupabaseServerClient;
  actorId: string;
  entityType: string;
  entityId: string;
  reason: string;
  metadata?: Record<string, unknown>;
};

export async function requestPublicBuild({
  supabase,
  actorId,
  entityType,
  entityId,
  reason,
  metadata = {},
}: RequestPublicBuildOptions): Promise<{
  state: PublicationState;
  build: PublicBuildResult;
}> {
  // Persist the rebuild request before attempting the fast dispatch. The
  // scheduled workflow consumes this durable marker if the hook is down or
  // if an accepted workflow later fails before deployment.
  const { error: queueError } = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action: "public_build.requested",
    entity_type: entityType,
    entity_id: entityId,
    metadata: {
      ...metadata,
      reason,
      requested_at: new Date().toISOString(),
    },
  });
  if (queueError) {
    return {
      state: "queue-error",
      build: {
        configured: false,
        ok: false,
        provider: "none",
        error: "durable-queue-unavailable",
      },
    };
  }

  const build = await triggerPublicBuild(reason);
  if (build.ok) {
    await supabase.from("admin_audit_log").insert({
      actor_id: actorId,
      action: "public_build.dispatched",
      entity_type: entityType,
      entity_id: entityId,
      metadata: {
        ...metadata,
        reason,
        provider: build.provider,
        requested_at: new Date().toISOString(),
      },
    });
  }

  return {
    build,
    state: build.ok ? "started" : "queued",
  };
}
