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
  const build = await triggerPublicBuild(reason);
  const { error: queueError } = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action: build.ok ? "public_build.dispatched" : "public_build.requested",
    entity_type: entityType,
    entity_id: entityId,
    metadata: {
      ...metadata,
      reason,
      provider: build.provider,
      hook_configured: build.configured,
      hook_error: build.ok ? null : build.error,
      requested_at: new Date().toISOString(),
    },
  });

  return {
    build,
    state: build.ok ? "started" : queueError ? "queue-error" : "queued",
  };
}
