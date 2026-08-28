import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260828_zz_editor_autosaves.sql"),
  "utf8"
).replace(/\r\n?/gu, "\n");
const actions = readFileSync(
  path.join(
    root,
    "apps/admin/app/(dashboard)/editor-autosave/actions.ts"
  ),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("private editor autosave storage", () => {
  it("keeps recovery copies actor-owned and outside canonical publication", () => {
    expect(migration).toContain("alter table public.editor_autosaves force row level security");
    expect(migration.match(/create policy "Staff [^"]+ editor autosaves"/gu)).toHaveLength(4);
    expect(migration.match(/actor_id = \(select auth\.uid\(\)\)/gu)).toHaveLength(5);
    expect(migration).toContain("public.is_staff()");
    expect(migration).not.toContain("public_build_outbox");
    expect(migration).not.toContain("admin_revision_history");
  });

  it("uses a monotonic session sequence and reports canonical conflicts", () => {
    expect(migration).toContain(
      "current_autosave.client_sequence < excluded.client_sequence"
    );
    expect(migration).toContain("canonical_updated_at is distinct from p_base_updated_at");
    expect(migration).toContain("next_state := 'conflict'");
    expect(migration).toContain("octet_length(p_snapshot::text) > 3500000");
  });

  it("cleans up only an exact confirmed recovery receipt", () => {
    expect(actions).toContain('.eq("actor_id", session.user.id)');
    expect(actions).toContain('.eq("client_session_id", parsed.data.clientSessionId)');
    expect(actions).toContain('.eq("client_sequence", parsed.data.sequence)');
    expect(actions).toContain('.eq("snapshot_hash", parsed.data.snapshotHash)');
  });
});
