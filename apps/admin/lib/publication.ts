import {
  ensurePublishedArticlePremiumEnglish,
  type PremiumArticleBackfillState,
} from "@/lib/auto-translate-published-article-premium";
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

function normalizeOutboxId(value: unknown): string | null {
  if (typeof value === "string" && /^[1-9]\d*$/u.test(value)) return value;
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }
  return null;
}

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
  autoTranslation?: PremiumArticleBackfillState;
}> {
  // Translate a published Russian article before dispatching the public build,
  // so the same release can contain the synchronized English version. The
  // premium helper skips unchanged/human-owned English rows and keeps provider
  // credentials server-side. Translation failure is audited but does not
  // destroy the accepted Russian publication; a later republish can retry.
  const translation =
    entityType === "article" && reason === "article.published"
      ? await ensurePublishedArticlePremiumEnglish({
          supabase,
          actorId,
          articleId: entityId,
        })
      : { state: "skipped" as const };
  const publicationMetadata = {
    ...metadata,
    auto_translation: translation.state,
    auto_translation_model: translation.model || null,
    auto_translation_error: translation.error?.slice(0, 300) || null,
  };

  // Prefer the transactional outbox introduced by the current schema. Older
  // databases keep working through the audit-log fallback until migration.
  // Table triggers enqueue the underlying mutation inside its own transaction,
  // so a process crash before this fast dispatch cannot lose the request.
  const { data: outboxId, error: outboxError } = await supabase.rpc(
    "enqueue_public_build_request",
    {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_reason: reason,
      p_metadata: publicationMetadata,
    }
  );
  // Only a confirmed missing-RPC response may use the compatibility queue.
  // Permission, validation and transient database failures must remain visible;
  // treating them as an old schema can lose manual republish requests once the
  // scheduled consumer has switched to the outbox.
  const outboxUnavailable = Boolean(
    outboxError &&
      (outboxError.code === "PGRST202" ||
        (outboxError.code === "42883" &&
          /function public\.enqueue_public_build_request\([^)]*\) does not exist/iu.test(
            outboxError.message || ""
          )))
  );
  const durableOutboxId = outboxError ? null : normalizeOutboxId(outboxId);
  const { error: queueError } = outboxUnavailable
    ? await supabase.from("admin_audit_log").insert({
        actor_id: actorId,
        action: "public_build.requested",
        entity_type: entityType,
        entity_id: entityId,
        metadata: {
          ...publicationMetadata,
          reason,
          requested_at: new Date().toISOString(),
        },
      })
    : { error: outboxError };
  if (queueError || (!outboxUnavailable && durableOutboxId === null)) {
    return {
      state: "queue-error",
      autoTranslation: translation.state,
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
    if (durableOutboxId !== null) {
      await supabase.rpc("mark_public_build_dispatched", {
        p_outbox_id: durableOutboxId,
        p_provider: build.provider,
      });
    }
    await supabase.from("admin_audit_log").insert({
      actor_id: actorId,
      action: "public_build.dispatched",
      entity_type: entityType,
      entity_id: entityId,
      metadata: {
        ...publicationMetadata,
        reason,
        provider: build.provider,
        requested_at: new Date().toISOString(),
      },
    });
  }

  return {
    build,
    autoTranslation: translation.state,
    state: build.ok ? "started" : "queued",
  };
}
