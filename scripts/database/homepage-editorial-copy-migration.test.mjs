import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260820_homepage_book_month_editorial_choice.sql",
    import.meta.url
  ),
  "utf8"
);
const planner = readFileSync(
  new URL("./build-production-migration-plan.mjs", import.meta.url),
  "utf8"
);

describe("book-of-the-month editorial attribution migration", () => {
  it("updates only the exact legacy core-block value", () => {
    expect(migration).toContain("settings ->> 'coreSectionKey' = 'book-month'");
    expect(migration).toContain(
      "settings ->> 'eyebrow' = 'Выбор энциклопедии'"
    );
    expect(migration).toContain("to_jsonb('Выбор редакции'::text)");
    expect(migration).not.toMatch(/delete\s+from|truncate|drop\s+/iu);
  });

  it("is included in the checksum-pinned production plan", () => {
    expect(planner).toContain(
      '20260820_homepage_book_month_editorial_choice.sql", "436bb25b4513ed451320489278fda8670a1e4ada9f66b065fd6b734ba84c729f"'
    );
  });
});
