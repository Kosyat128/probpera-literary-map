import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL(
    "../../../../../supabase/migrations/20260813_unified_revision_history.sql",
    import.meta.url
  ),
  "utf8"
);

describe("revision restore optimistic concurrency", () => {
  it("passes the current entity version from the staff-only catalog to the restore action", () => {
    expect(pageSource).toContain("restorable,entity_updated_at");
    expect(pageSource).toContain(
      'name="expected_updated_at" type="hidden" value={revision.entity_updated_at}'
    );
    expect(pageSource).toContain("revision.restorable && revision.entity_updated_at");
    expect(actionsSource).toContain('formData.get("expected_updated_at")');
    expect(actionsSource.match(/\.eq\("updated_at", expectedUpdatedAt\.data\)/gu)).toHaveLength(2);
  });

  it("does not advertise restore for revisions whose entity was deleted", () => {
    expect(migrationSource).not.toContain("true as restorable");
    for (const table of [
      "articles",
      "pages",
      "homepage_blocks",
      "country_profile_overrides",
      "writer_profile_overrides",
      "literary_works",
      "book_editions",
    ]) {
      expect(migrationSource).toContain(`left join public.${table} entity`);
    }
    expect(migrationSource).toContain("entity.updated_at as entity_updated_at");
    expect(migrationSource).toContain("when 'banner' then banner.id is not null");
    expect(migrationSource).toContain("else navigation.id is not null");
  });

  it("CAS-protects both edition demotion and compensation", () => {
    expect(actionsSource).toContain('.select("id,updated_at")');
    expect(actionsSource).toContain('.eq("updated_at", previousUpdatedAt)');
    expect(actionsSource).toContain("demotedPrimaryVersions.set(data.id, data.updated_at)");
    expect(actionsSource).toContain('.eq("updated_at", demotedUpdatedAt)');
    expect(actionsSource).toContain("await persistWithPrimaryEditionCompensation({");
  });

  it("keeps catalog context and reports publication state after a successful restore", () => {
    for (const name of [
      "history_kind",
      "history_entity",
      "history_page",
      "history_events_page",
    ]) {
      expect(pageSource).toContain(`name="${name}"`);
    }
    expect(actionsSource).toContain("published: publication.state");
    expect(actionsSource).toContain("historyCatalogFormHref(formData, options)");
  });
});
