import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminEditorOperationsContractSql } from "./admin-editor-operations-contract.mjs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
const migration = read("supabase/migrations/20261007_admin_editor_operations.sql");
const fixture = read("scripts/database/fixtures/admin-editor-operations-contract.sql");

describe("durable Article operation migration boundaries", () => {
  it("builds one unchanged actual predecessor stack for original and fixed replay fixtures", () => {
    const combined = adminEditorOperationsContractSql();
    for (const file of ["20260822_zz_atomic_article_bundle.sql", "20260902_article_working_drafts.sql", "20260905_article_publication_permissions.sql"]) {
      expect(combined).toContain(read(`supabase/migrations/${file}`));
    }
    expect(combined).toContain("LEGACY_COMMITTED_RETRY_CAS_FAILURE_CONFIRMED");
    expect(combined).toContain("LEGACY_COMMITTED_NEW_RETRY_DUPLICATE_CONFIRMED");
    expect(combined).toContain("EDITOR_OPERATIONS_SAME_FIXTURE_REPLAY_OK");
    expect(combined).toContain("EDITOR_OPERATIONS_NON_SUPERUSER_SECOND_APPLY_OK");
    expect(combined).not.toMatch(/__ADMIN_EDITOR_OPERATIONS_(?:MIGRATION|REAPPLY)__/u);
  });

  it("preserves the canonical bundle and extends only private-draft retention in existing producer signatures", () => {
    expect(migration).not.toMatch(/create or replace function public\.save_article_bundle\(/u);
    const promotion = migration.split("create or replace function public.promote_article_working_draft(")[1].split("\n$$;")[0];
    expect(promotion).toContain("security invoker");
    expect(promotion).toContain("public.lock_article_working_draft_for_publication(");
    expect(promotion).toContain("from public.save_article_bundle(");
    expect(promotion).toContain("p_social_publish_requested,\n    p_social_metadata");
    expect(migration).not.toMatch(/grant (?:update|insert|delete|all).*article_working_drafts.*authenticated/iu);
    for (const name of ["save_article_bundle_operation", "save_article_working_draft_operation", "promote_article_working_draft_operation", "get_editor_operation_result"]) {
      expect(migration).toContain(`create or replace function public.${name}(`);
    }
    // Pages use a separate transaction entry point and never enter an Article
    // producer or change its frozen command validation.
    const page = migration.split("create or replace function public.save_page_operation(")[1].split("\n$$;")[0];
    expect(page).not.toMatch(/public\.(?:save_article|promote_article)/u);
  });

  it("keeps the journal as hash/context/receipt data rather than a second content master", () => {
    const columns = migration.split("create table if not exists probpera_editor_operations.receipts (")[1].split("\n);")[0];
    expect(columns).toContain("submitted_intent_sha256 text not null");
    expect(columns).toContain("prepared_command_sha256 text not null");
    expect(columns).not.toMatch(/^\s*(?:payload|content|body|fields|submitted_intent|prepared_command)\s/gmu);
    expect(columns).toContain("octet_length(result::text) <= 8192");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("before update or delete");
  });

  it("binds original actor and current read permission before disclosing a receipt", () => {
    const lookup = migration.split("create or replace function probpera_editor_operations.find_replay(")[1].split("\n$$;")[0];
    expect(lookup.indexOf("not public.is_staff()")).toBeLessThan(lookup.indexOf("select * into saved"));
    expect(lookup).toContain("operation_id = p_operation_id and actor_id = actor");
    expect(lookup).toContain("id = saved.actual_entity_id and deleted_at is null");
    expect(lookup).toContain("saved.submitted_intent_sha256 <>");
    expect(lookup).toContain("saved.prepared_command_sha256 <>");
  });

  it("locks/replays before invoking each existing CAS transaction and writes the receipt afterwards", () => {
    for (const [name, producer] of [
      ["save_article_bundle_operation", "save_article_bundle"],
      ["save_article_working_draft_operation", "save_article_working_draft"],
      ["promote_article_working_draft_operation", "promote_article_working_draft"],
    ]) {
      const wrapper = migration.split(`create or replace function public.${name}(`)[1].split("\n$$;")[0];
      expect(wrapper.indexOf("find_replay(p_operation_id")).toBeLessThan(wrapper.indexOf(`public.${producer}(`));
      expect(wrapper.indexOf(`public.${producer}(`)).toBeLessThan(wrapper.indexOf("insert into probpera_editor_operations.receipts"));
      expect(wrapper).not.toMatch(/exception when/u);
    }
  });

  it("uses an RLS-bound private owner and removes migration membership after installation", () => {
    expect(migration).toContain("nocreatedb nocreaterole noreplication nobypassrls");
    expect(migration).toContain("grant authenticated to probpera_editor_operation_writer with set false");
    expect(migration).toContain("revoke probpera_editor_operation_writer from current_user");
    expect(migration).not.toContain("grant probpera_editor_operation_writer to current_user with admin true");
    expect(migration).toContain("if pg_catalog.to_regnamespace('probpera_editor_operations') is null then");
  });

  it("contains actual actor, publication, new/copy and late-failure rollback scenarios", () => {
    for (const marker of ["NEW_COPY_REPLAY", "WORKING_DRAFT_REPLAY", "PROMOTION_REPLAY", "EN_NONE_CONTEXT", "INVALID_INTENTS", "ACTOR_ACL_BOUNDARY", "ATOMIC_LATE_FAILURE", "CURRENT_ACCESS_RECHECK"]) {
      expect(fixture).toContain(`EDITOR_OPERATIONS_${marker}_OK`);
    }
    expect(fixture).toContain("FIXTURE_RECEIPT_INSERT_FAILURE");
    expect(fixture).toContain("private role wrapper cannot bypass editor publication boundary");
  });

  it("represents authored dash bytes through SQL Unicode escapes without changing the resulting value", () => {
    expect(fixture).not.toContain(String.fromCharCode(8212));
    const source = fixture.match(/p_title text default U&'([^']+)'/u)?.[1];
    expect(source?.replace(/\\([0-9a-f]{4})/giu, (_, code) => String.fromCharCode(Number.parseInt(code, 16))))
      .toBe("Авторский RU \u2014 текст");
    expect(fixture).toContain('Manual EN \\2014 text; hyphen - and dash \\2014 retained.');
    expect(migration).not.toMatch(/normalize(?:Dash|Dashes|Text|Typography)|normalizeArticle/iu);
  });

  it("records accepted English write scope without adding a payload or changing the original RPC result", () => {
    const replay = migration.split("create or replace function probpera_editor_operations.find_replay(")[1].split("\n$$;")[0];
    expect(replay).toContain("'result', saved.result - array['englishWrite','workingDraft']");
    expect(replay).toContain("saved.result ? 'englishWrite'");
    expect(replay).toContain("saved.result ? 'workingDraft'");
    for (const name of ["save_article_bundle_operation", "promote_article_working_draft_operation"]) {
      const wrapper = migration.split(`create or replace function public.${name}(`)[1].split("\n$$;")[0];
      expect(wrapper).toContain("case p_english_mode when 'save' then 'saved' when 'stale' then 'status-only' else 'preserved' end");
      expect(wrapper).toContain("raw_result || jsonb_build_object('englishWrite', english_write)");
      expect(wrapper).toContain("'result', raw_result");
    }
    const draft = migration.split("create or replace function public.save_article_working_draft_operation(")[1].split("\n$$;")[0];
    expect(draft).toContain("case when p_english_payload ->> 'mode' = 'save' then 'saved' else 'preserved' end");
    expect(draft).not.toContain("intent_field(p_submitted_intent, 'english_enabled')");
  });

  it("covers advanced status-only EN CAS and disabled draft with enabled original EN on the same fixture", () => {
    for (const marker of ["EN_STATUS_ONLY_SCOPE", "EN_DISABLED_DRAFT_SCOPE", "EN_SCOPE_CONSTRAINTS"]) {
      expect(fixture).toContain(`EDITOR_OPERATIONS_${marker}_OK`);
    }
    expect(fixture).toContain("accepted full EN write scope is durable while original raw RPC shape stays exact");
    expect(fixture).toContain("accepted disabled English draft cannot acknowledge English enabled in the frozen submitted form");
    expect(fixture).toContain("scope constraints reject missing, corrupt, forbidden and CAS-contradictory metadata");
  });

  it("allows explicit candidate-source comparison while retaining the actual predecessor setup and same ownership fixture", () => {
    const baseline = migration.replace("'englishWrite', english_write);", "'englishWrite', 'unknown');");
    const fixedSql = adminEditorOperationsContractSql();
    const baselineSql = adminEditorOperationsContractSql({ migrationSource: baseline });
    expect(baselineSql).toContain(baseline);
    expect(fixedSql).toContain(migration);
    expect(baselineSql).toContain("accepted full EN write scope is durable while original raw RPC shape stays exact");
    expect(baselineSql).toContain(read("supabase/migrations/20260822_zz_atomic_article_bundle.sql"));
  });

  it("uses the original authored loss-fixture seed and complete private English projection without byte changes", () => {
    // LF-normalized exact definitions captured from the proven pre-fix fixture.
    // Maintained tests never require ignored local evidence artifacts.
    const expected = {
      fixture_en_author_projection: "e858af9374f5cbfa7aa998e54bf6d1d271c6daa4df974503c3dced9c32fc0a60",
      fixture_pending_en_canonical_seed: "916298d663e04ec9100c775a5adeb0d7c704cf0359ed46c5b124f75e93f1168b",
      fixture_pending_en_seed: "7bb6a37314a0b828a721113e549ce4115f41ed0c359c0f6009d252d424ca94d3",
    };
    for (const [name, sha256] of Object.entries(expected)) {
      const prefix = `create or replace function public.${name}(`;
      const from = fixture.indexOf(prefix);
      const end = fixture.indexOf("\n$$;", from);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(from);
      expect(createHash("sha256").update(fixture.slice(from, end + 4)).digest("hex")).toBe(sha256);
    }
    expect(fixture.indexOf("PENDING_EN_PRESERVATION_REQUIRED")).toBeLessThan(fixture.indexOf("disabled flag does not remove prior complete English A"));
  });

  it("covers partial releases, disabled saves, late rollback, independent EN CAS, full release and explicit discard on actual RPCs", () => {
    for (const marker of ["NONE_LEGACY", "STALE_LEGACY", "DISABLED_LEGACY", "OPERATION_REPLAY_FULL_SAVE", "INDEPENDENT_CAS", "PROTECTED_CONTINUATION", "EXPLICIT_DISCARD", "ROLLBACK_BASE_VERSION", "OLD_RECEIPT_COMPATIBILITY", "PRESERVATION"]) {
      expect(fixture).toContain(`EDITOR_OPERATIONS_PENDING_EN_${marker}_OK`);
    }
    expect(fixture).toContain("late English failure rolls back canonical RU/EN, retained A/version/CAS, revisions/audit/outbox together");
    expect(fixture).toContain("nine-key receipt remains nine-key original truth");
    expect(migration).toContain("draft.base_article_updated_at is distinct from old.updated_at");
    expect(migration).toContain("draft.version >= 9007199254740991");
  });

  it("rejects incomplete English commands before touching the working-copy master", () => {
    const save = migration.split("create or replace function public.save_article_working_draft(")[1].split("\n$$;")[0];
    expect(save).toContain("p_english_payload - array['mode','payload'] = '{}'::jsonb");
    expect(save).toContain("english_document ?& array['title'");
    expect(save.indexOf("Require a complete author copy")).toBeLessThan(save.indexOf("select * into current_article"));
    expect(save).toContain("when current_draft.english_payload ->> 'mode' = 'save' then current_draft.english_payload");
    expect(save).not.toMatch(/jsonb_set\(.*english_document|normalize/iu);
  });

  it("keeps all Article operation producer and original intent bodies byte-identical while adding Page durability", () => {
    const expected = {
      "probpera_editor_operations.validate_intent": "cf7d3cefce9910ec5578cb342ba88ba81432a1f2f6bd9e175a1b6328ea93bd71",
      "public.save_article_bundle_operation": "7f847b474582772ab7ab5110a4bb6ff03ab811e9bc812017e66ea8405ee9a9f4",
      "public.save_article_working_draft_operation": "a99a7acf91aa8a11479d6627d59e9ed8b7079ad45763fcc3edf41649c3c3b212",
      "public.promote_article_working_draft_operation": "cb77968533546399195c406726625ebf13ca5161364641ab9b3ade011f470c14",
    };
    for (const [name, expectedHash] of Object.entries(expected)) {
      const from = migration.indexOf(`create or replace function ${name}(`);
      const bodyStart = migration.indexOf("as $$", from) + 5;
      const bodyEnd = migration.indexOf("\n$$;", bodyStart) + 1;
      expect(createHash("sha256").update(migration.slice(bodyStart, bodyEnd)).digest("hex")).toBe(expectedHash);
    }
  });

  it("executes the actual Page schema, RLS and revision predecessor with a separate strict Page receipt API", () => {
    const combined = adminEditorOperationsContractSql();
    expect(combined).toContain(read("supabase/migrations/20260730_page_revision_history.sql"));
    expect(combined).toContain('create policy "Staff manage pages"');
    expect(combined).toContain("and updated_by = (select auth.uid())");
    const page = migration.split("create or replace function public.save_page_operation(")[1].split("\n$$;")[0];
    expect(page.indexOf("find_replay(p_operation_id")).toBeLessThan(page.indexOf("update public.pages set"));
    expect(page.indexOf("update public.pages set")).toBeLessThan(page.indexOf("insert into probpera_editor_operations.receipts"));
    expect(page).not.toMatch(/exception when|grant |from\("pages"/u);
    expect(migration).toContain("'public.save_page_operation(jsonb,timestamptz,uuid,jsonb)'");
    expect(migration).not.toMatch(/grant (?:select|update|all).*public\.pages/iu);
    expect(migration).toContain("constraint editor_operation_entity_contract");
  });

  it("covers Page authored status saves, stale-CAS replay, original/prepared binding, isolation and full transaction rollback", () => {
    for (const marker of ["STATUS_AUTHOR_REPLAY", "NEXT_CAS_ORIGINAL_RECEIPT", "HASH_ENTITY_BINDING", "STRICT_INPUT",
      "ATOMIC_RECEIPT_ROLLBACK", "ACTOR_CURRENT_RLS", "ANON_NONSTAFF_EDITOR_BOUNDARY", "DELETED_CURRENT_ACCESS",
      "STRICT_IMMUTABLE_RECEIPT", "REPEAT_FAIL_CLOSED"]) {
      expect(fixture).toContain(`EDITOR_OPERATIONS_PAGE_${marker}_OK`);
    }
    expect(fixture).toContain("LEGACY_PAGE_COMMITTED_RETRY_CAS_FAILURE_CONFIRMED");
    expect(fixture).toContain("FIXTURE_PAGE_RECEIPT_INSERT_FAILURE");
    expect(fixture).toContain("PAGE_OPERATION_DTO:");
    expect(fixture).toContain("late immutable Page receipt insertion failure rolls back page, actual revision and synthetic outbox together");
  });
});
