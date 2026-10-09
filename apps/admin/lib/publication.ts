import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

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
  skipAutoTranslation?: boolean;
};

const uuid = z.string().uuid();
const uuidEntityTypes = new Set([
  "article", "page", "redirect", "media", "banner", "navigation_item",
  "category", "tag", "country_profile", "writer_profile", "literary_work",
  "book_edition", "literary_work_translation", "literary_work_source",
  "literary_work_external_id", "book_import_candidate", "site_copy",
  "country", "writer", "work", "edition",
]);

function validPublicationIdentity(entityType: unknown, entityId: unknown): boolean {
  if (typeof entityType !== "string" || !entityType.trim() || entityType.length > 120 ||
      typeof entityId !== "string" || !entityId.trim() || entityId.length > 240) return false;
  if (uuidEntityTypes.has(entityType.trim())) return uuid.safeParse(entityId).success;
  if (entityType.trim() === "homepage") {
    return entityId === "manual_publish" || uuid.safeParse(entityId).success;
  }
  // Batch commands and row-trigger events also use natural text identities.
  return true;
}

function validPublicationMetadata(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

const enqueueArgumentNames = ["p_entity_id", "p_entity_type", "p_metadata", "p_reason"];

function isMissingPublicBuildRpc(outboxError: { code: string; message: string; details?: string; hint?: string }): boolean {
  if (typeof outboxError.message !== "string") return false;
  if (outboxError.code === "PGRST202") {
    const match = /^Could not find the function public\.enqueue_public_build_request\(([^()]*)\) in the schema cache$/u.exec(outboxError.message);
    if (!match || outboxError.hint != null) return false;
    const names = match[1].split(", ");
    return JSON.stringify([...names].sort()) === JSON.stringify(enqueueArgumentNames) &&
      outboxError.details === `Searched for the function public.enqueue_public_build_request with parameters ${match[1]} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`;
  }
  if (outboxError.code !== "42883") return false;
  const match = /^function public\.enqueue_public_build_request\(([^()]*)\) does not exist$/u.exec(outboxError.message);
  if (!match) return false;
  if (match[1] === "text, text, text, jsonb") return true;
  const parameters = match[1].split(", ").map(value => /^(p_entity_id|p_entity_type|p_metadata|p_reason) => (text|jsonb)$/u.exec(value));
  return parameters.length === 4 && parameters.every(Boolean) &&
    JSON.stringify(parameters.map(value => [value![1], value![2]]).sort(([a], [b]) => a.localeCompare(b))) ===
    JSON.stringify(enqueueArgumentNames.map(name => [name, name === "p_metadata" ? "jsonb" : "text"]));
}

async function isPublicBuildTableMissing(supabase: SupabaseServerClient): Promise<boolean> {
  try {
    // A missing function signature alone also occurs on modern schemas. Probe
    // the existing queue without reading rows before using the compatibility path.
    const result = await supabase.from("public_build_outbox").select("id").limit(0);
    unstable_rethrow(result?.error);
    if (!result || result.data !== null || !result.error) return false;
    const { code, message } = result.error;
    return (code === "PGRST205" && message === "Could not find the table 'public.public_build_outbox' in the schema cache") ||
      (code === "42P01" && message === 'relation "public.public_build_outbox" does not exist');
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

function normalizeOutboxId(value: unknown): string | null {
  if (typeof value === "string" && /^[1-9]\d*$/u.test(value) && value.length <= 19 &&
      (value.length < 19 || value <= "9223372036854775807")) return value;
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
  skipAutoTranslation = false,
}: RequestPublicBuildOptions): Promise<{
  state: PublicationState;
  build: PublicBuildResult;
  autoTranslation?: PremiumArticleBackfillState;
}> {
  if (!uuid.safeParse(actorId).success || !validPublicationIdentity(entityType, entityId) ||
      typeof reason !== "string" || !reason.trim() || reason.length > 240 ||
      !validPublicationMetadata(metadata) || typeof skipAutoTranslation !== "boolean") {
    return {
      state: "queue-error",
      build: { configured: false, ok: false, provider: "none", error: "durable-queue-unavailable" },
    };
  }
  // Preparing English creates a private working draft for separate human
  // review and publication. This build dispatches the accepted canonical
  // Russian publication and preserves any previous canonical English version.
  // The helper skips unchanged/human-owned English rows; translation failure
  // remains separate from the accepted Russian publication.
  const translation =
    !skipAutoTranslation &&
    entityType === "article" &&
    reason === "article.published"
      ? await ensurePublishedArticlePremiumEnglish({
          supabase,
          actorId,
          articleId: entityId,
        })
      : { state: "skipped" as const };
  const privateTranslationConfirmed = translation.state === "translated" &&
    translation.publication === "draft" &&
    translation.translationPersistence === "working-draft" &&
    translation.humanReview === "pending" &&
    typeof translation.workingDraftVersion === "number" &&
    Number.isSafeInteger(translation.workingDraftVersion) && translation.workingDraftVersion > 0 &&
    typeof translation.workingDraftUpdatedAt === "string" && translation.workingDraftUpdatedAt.length <= 64 &&
    z.string().datetime({ offset: true }).safeParse(translation.workingDraftUpdatedAt).success;
  const publicationMetadata = {
    ...metadata,
    auto_translation: translation.state,
    auto_translation_model: translation.model || null,
    auto_translation_error: translation.error?.slice(0, 300) || null,
    ...(entityType === "article" ? {
      auto_translation_persistence: privateTranslationConfirmed ? "working-draft" : null,
      auto_translation_review: privateTranslationConfirmed ? "pending" : null,
      auto_translation_publication: privateTranslationConfirmed ? "draft" : null,
      auto_translation_working_draft_version: privateTranslationConfirmed ? translation.workingDraftVersion : null,
      auto_translation_working_draft_updated_at: privateTranslationConfirmed ? translation.workingDraftUpdatedAt : null,
    } : {}),
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
  unstable_rethrow(outboxError);
  // Only matching missing-RPC and missing-table responses may use the
  // compatibility queue. These describe accessible API capabilities; they
  // do not prove the physical database version or a fresh schema cache.
  // Permission, validation and transient database failures must remain visible;
  // treating them as an old schema can lose manual republish requests once the
  // scheduled consumer has switched to the outbox.
  const outboxUnavailable = Boolean(
    outboxId === null && outboxError && isMissingPublicBuildRpc(outboxError) &&
      await isPublicBuildTableMissing(supabase)
  );
  const durableOutboxId = outboxError == null ? normalizeOutboxId(outboxId) : null;
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
  unstable_rethrow(queueError);
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
      const recorded = await supabase.rpc("mark_public_build_dispatched", {
        p_outbox_id: durableOutboxId,
        p_provider: build.provider,
      });
      unstable_rethrow(recorded.error);
    }
    const recordedAudit = await supabase.from("admin_audit_log").insert({
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
    unstable_rethrow(recordedAudit.error);
  }

  return {
    build,
    autoTranslation: translation.state,
    state: build.ok ? "started" : "queued",
  };
}
