"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { persistWithPrimaryEditionCompensation } from "@/lib/book-edition-primary";
import { historyCatalogFormHref } from "@/lib/history-catalog-query";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import {
  buildRevisionRestorePatch,
  isRevisionSnapshot,
} from "@/lib/revision-restore";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";

type RevisionConfig = {
  revisionTable: string;
  entityTable: string;
  entityIdColumn: string;
  snapshotIdColumn: string;
  blockedColumns: readonly string[];
  allowedColumns?: readonly string[];
  revisionEntityType?: "banner" | "navigation_item";
  publicationType?: string;
  forceUpdatedBy?: boolean;
  revalidate: readonly string[];
};

const revisionConfig: Record<string, RevisionConfig> = {
  article: {
    revisionTable: "article_revisions",
    entityTable: "articles",
    entityIdColumn: "article_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/articles"],
  },
  page: {
    revisionTable: "page_revisions",
    entityTable: "pages",
    entityIdColumn: "page_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/pages"],
  },
  homepage: {
    revisionTable: "homepage_block_revisions",
    entityTable: "homepage_blocks",
    entityIdColumn: "homepage_block_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/homepage"],
  },
  country: {
    revisionTable: "country_profile_override_revisions",
    entityTable: "country_profile_overrides",
    entityIdColumn: "override_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/editorial-database"],
  },
  writer: {
    revisionTable: "writer_profile_override_revisions",
    entityTable: "writer_profile_overrides",
    entityIdColumn: "override_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/editorial-database", "/library"],
  },
  work: {
    revisionTable: "literary_work_revisions",
    entityTable: "literary_works",
    entityIdColumn: "work_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/library"],
  },
  edition: {
    revisionTable: "book_edition_revisions",
    entityTable: "book_editions",
    entityIdColumn: "edition_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    revalidate: ["/library"],
  },
  banner: {
    revisionTable: "site_chrome_revisions",
    entityTable: "banners",
    entityIdColumn: "entity_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at", "created_by"],
    allowedColumns: [
      "name",
      "desktop_media_id",
      "tablet_media_id",
      "mobile_media_id",
      "title",
      "description",
      "target_url",
      "button_text",
      "starts_at",
      "ends_at",
      "display_order",
      "is_active",
      "page_patterns",
    ],
    revisionEntityType: "banner",
    publicationType: "banner",
    forceUpdatedBy: true,
    revalidate: ["/banners", "/homepage"],
  },
  navigation: {
    revisionTable: "site_chrome_revisions",
    entityTable: "navigation_items",
    entityIdColumn: "entity_id",
    snapshotIdColumn: "id",
    blockedColumns: ["created_at", "updated_at"],
    allowedColumns: [
      "menu_id",
      "parent_id",
      "label",
      "href",
      "open_in_new_tab",
      "is_visible",
      "display_order",
    ],
    revisionEntityType: "navigation_item",
    publicationType: "navigation_item",
    revalidate: ["/menus", "/homepage"],
  },
};

function databaseError(_error: { message?: string } | null, fallback: string) {
  return new Error(fallback);
}

export async function restoreRevisionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const target = (options: Parameters<typeof historyCatalogFormHref>[1] = {}) =>
    historyCatalogFormHref(formData, options);
  const kind = String(formData.get("kind") || "");
  const revisionId = String(formData.get("revision_id") || "");
  const expectedUpdatedAt = z.string().datetime({ offset: true }).safeParse(
    formData.get("expected_updated_at")
  );
  const config = revisionConfig[kind];
  if (!config || !/^\d+$/u.test(revisionId) || !expectedUpdatedAt.success) {
    redirect(target({ error: "Некорректная версия" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена" }));

  const { data: revision, error: revisionError } = await supabase
    .from(config.revisionTable)
    .select("*")
    .eq("id", revisionId)
    .maybeSingle();
  const revisionRecord = isRevisionSnapshot(revision) ? revision : {};
  const snapshot = isRevisionSnapshot(revisionRecord.snapshot)
    ? revisionRecord.snapshot
    : null;
  const entityId = String(
    revisionRecord[config.entityIdColumn] ||
      snapshot?.[config.snapshotIdColumn] ||
      ""
  );
  if (
    revisionError ||
    !snapshot ||
    !entityId ||
    (config.revisionEntityType &&
      revisionRecord.entity_type !== config.revisionEntityType)
  ) {
    redirect(target({ error: revisionError ? operatorDataError("history", "load") : "Версия не найдена" }));
  }

  let patch: Record<string, unknown>;
  try {
    patch = buildRevisionRestorePatch(
      snapshot,
      {
        snapshotIdColumn: config.snapshotIdColumn,
        blockedColumns: config.blockedColumns,
        allowedColumns: config.allowedColumns,
        forceUpdatedBy:
          config.forceUpdatedBy || "updated_by" in snapshot,
      },
      session.user.id
    );
  } catch (error) {
    redirect(target({
      error: error instanceof Error ? error.message : "Версия повреждена",
    }));
  }
  try {
    if (kind === "edition" && patch.is_primary === true) {
      const workId = String(patch.work_id || "");
      const previousPrimaryVersions = new Map<string, string>();
      const demotedPrimaryVersions = new Map<string, string>();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(workId)) {
        throw new Error("В версии издания повреждён идентификатор произведения.");
      }
      await persistWithPrimaryEditionCompensation({
        enabled: true,
        readPreviousPrimaryIds: async () => {
          const { data, error } = await supabase
            .from("book_editions")
            .select("id,updated_at")
            .eq("work_id", workId)
            .eq("is_primary", true)
            .neq("id", entityId);
          if (error) throw databaseError(error, "Не удалось проверить основное издание.");
          return (data || []).map((edition) => {
            previousPrimaryVersions.set(edition.id, edition.updated_at);
            return edition.id;
          });
        },
        demotePreviousPrimaries: async (ids) => {
          for (const id of ids) {
            const previousUpdatedAt = previousPrimaryVersions.get(id);
            if (!previousUpdatedAt) {
              throw new Error("Не удалось определить версию прежнего основного издания.");
            }
            const { data, error } = await supabase
              .from("book_editions")
              .update({ is_primary: false })
              .eq("id", id)
              .eq("updated_at", previousUpdatedAt)
              .select("id,updated_at")
              .maybeSingle();
            if (error || !data) {
              throw databaseError(
                error,
                "Основное издание уже изменили в другой вкладке. Обновите страницу и повторите восстановление."
              );
            }
            demotedPrimaryVersions.set(data.id, data.updated_at);
          }
        },
        persist: async () => {
          const { data, error } = await supabase
            .from(config.entityTable)
            .update(patch)
            .eq(config.snapshotIdColumn, entityId)
            .eq("updated_at", expectedUpdatedAt.data)
            .select(config.snapshotIdColumn)
            .maybeSingle();
          if (error || !data) {
            throw databaseError(
              error,
              "Объект удалён или уже изменён в другой вкладке. Обновите историю и повторите восстановление."
            );
          }
          return data;
        },
        restorePreviousPrimaries: async (ids) => {
          for (const id of ids) {
            const demotedUpdatedAt = demotedPrimaryVersions.get(id);
            if (!demotedUpdatedAt) {
              throw new Error("Не удалось определить версию для возврата основного издания.");
            }
            const { data, error } = await supabase
              .from("book_editions")
              .update({ is_primary: true })
              .eq("id", id)
              .eq("updated_at", demotedUpdatedAt)
              .select("id")
              .maybeSingle();
            if (error || !data) {
              throw databaseError(
                error,
                "Не удалось безопасно вернуть прежнее основное издание: его уже изменили."
              );
            }
          }
        },
      });
    } else {
      const { data, error } = await supabase
        .from(config.entityTable)
        .update(patch)
        .eq(config.snapshotIdColumn, entityId)
        .eq("updated_at", expectedUpdatedAt.data)
        .select(config.snapshotIdColumn)
        .maybeSingle();
      if (error || !data) {
        throw databaseError(
          error,
          "Объект удалён или уже изменён в другой вкладке. Обновите историю и повторите восстановление."
        );
      }
    }
  } catch (error) {
    redirect(target({
      error: error instanceof Error ? error.message : "Версию не удалось восстановить.",
    }));
  }

  const action = `${kind}.revision_restored`;
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: config.publicationType || kind,
    entity_id: entityId,
    metadata: { revisionId },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: config.publicationType || kind,
    entityId,
    reason: action,
    metadata: { revisionId },
  });
  config.revalidate.forEach((path) => revalidatePath(path));
  revalidatePath("/history");
  if (auditError) {
    redirect(target({
      restored: kind,
      published: publication.state,
      error: operatorDataError("history", "audit"),
    }));
  }
  redirect(target({ restored: kind, published: publication.state }));
}
