import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260814_publication_outbox_and_schema_health.sql"
  ),
  "utf8"
);
const consumer = readFileSync(
  path.join(root, "scripts/check-public-build-requests.mjs"),
  "utf8"
);
const backupWorkflow = readFileSync(
  path.join(root, ".github/workflows/backup.yml"),
  "utf8"
);

describe("transactional public build outbox", () => {
  it("enqueues every public editorial mutation inside its transaction", () => {
    expect(migration).toContain("create table if not exists public.public_build_outbox");
    expect(migration).toContain("after insert or update or delete");
    expect(migration).toContain("execute function public.capture_public_build_outbox()");
    expect(migration).toContain("create or replace function public.enqueue_public_build_request");
    expect(migration).toContain("create or replace function public.get_editorial_schema_health");
    expect(migration).not.toContain("on conflict (entity_type, entity_id)");
    expect(migration).toContain("'publicationTriggers'");
    expect(migration).toContain("'pendingPublicBuilds'");
  });

  it("binds finalization to immutable queue markers and drains the fallback", () => {
    expect(consumer).toContain('"public_build_outbox?select=id&limit=1"');
    expect(consumer).toContain('status: "deployed"');
    expect(consumer).toContain('`outbox:${outbox.maxId}`');
    expect(consumer).toContain('`legacy-audit:${legacy.maxId}`');
    expect(consumer).toContain("const legacy = await pendingLegacyRequests()");
    expect(consumer).toContain('response.status === 404');
    expect(consumer).toContain("const markers = parseFinalizeMarkers(rawMarker)");
    expect(consumer).not.toContain("/^\\d+$/u.test(rawMarker)");
  });

  it("restores the decrypted dump before uploading it", () => {
    expect(backupWorkflow).toContain(
      "public.ecr.aws/supabase/postgres:17.6.1.136"
    );
    expect(backupWorkflow).toContain("--exit-on-error");
    expect(backupWorkflow).toContain("public.get_editorial_schema_health()");
    expect(backupWorkflow).toContain("pre-20260814");
    expect(backupWorkflow).toContain("20260814-current");
    expect(backupWorkflow).toContain("Restore drill passed");
  });
});
