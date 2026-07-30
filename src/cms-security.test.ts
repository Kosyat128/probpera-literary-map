import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260728_cms_foundation.sql", import.meta.url),
  "utf8"
);
const favoritesMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260728_reader_favorites.sql",
    import.meta.url
  ),
  "utf8"
);
const pageRevisionMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260730_page_revision_history.sql",
    import.meta.url
  ),
  "utf8"
);
const communitySchema = readFileSync(
  new URL("../supabase/schema.sql", import.meta.url),
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

  it("хранит личную библиотеку отдельно для каждого читателя", () => {
    expect(favoritesMigration).toContain(
      "alter table public.reader_favorites enable row level security"
    );
    expect(favoritesMigration).toContain(
      "user_id = (select auth.uid())"
    );
    expect(favoritesMigration).not.toContain("to anon");
  });

  it("сохраняет восстановимые версии постоянных страниц", () => {
    expect(pageRevisionMigration).toContain(
      "create or replace function public.capture_page_revision()"
    );
    expect(pageRevisionMigration).toContain(
      "before update on public.pages"
    );
  });

  it("разрешает отдельные рейтинги книг без регистрации", () => {
    expect(communitySchema).toContain(
      "subject_type text not null check (subject_type in ('article', 'book'))"
    );
    expect(communitySchema).toContain(
      "grant execute on function public.rate_content(text, text, smallint, uuid)"
    );
    expect(communitySchema).toContain("to anon, authenticated");
  });
});
