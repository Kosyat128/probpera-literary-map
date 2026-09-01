import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("Data Studio entry", () => {
  it("provides one Russian entry point for every Phase 6 data area", () => {
    expect(page).toContain("Студия данных");
    expect(page).toContain('href="/editorial-database"');
    expect(page).toContain('href="/library"');
    expect(page).toContain("Импорт и разбор дублей");
    expect(page).toContain("Автосохранение и восстановление");
  });

  it("synchronizes only the strict code-owned catalog through one RPC", () => {
    expect(actions).toContain('requireStaff(["owner", "admin"])');
    expect(actions).toContain('loadEditorialCatalog()');
    expect(actions).toContain('"sync_editorial_reference_catalog"');
    expect(actions).not.toContain("error.message");
  });
});
