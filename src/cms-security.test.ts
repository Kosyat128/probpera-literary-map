import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260728_cms_foundation.sql", import.meta.url),
  "utf8"
);

describe("защита редакционной системы", () => {
  it("не позволяет читателю повысить себе роль", () => {
    expect(migration).toContain("revoke update on public.profiles from authenticated");
    expect(migration).toContain(
      "grant update(display_name, avatar_url, bio) on public.profiles to authenticated"
    );
    expect(migration).not.toContain(
      "grant update(role) on public.profiles to authenticated"
    );
  });

  it("хранит редакционные роли отдельно", () => {
    expect(migration).toContain("create table if not exists public.staff_memberships");
    expect(migration).toContain("create policy \"Owners manage staff\"");
  });

  it("не разрешает анонимное изменение CMS", () => {
    expect(migration).toContain("create policy \"Staff create articles\"");
    expect(migration).toContain("create policy \"Staff update articles\"");
  });
});
