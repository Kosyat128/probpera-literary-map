import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps/admin/app/(dashboard)/health/page.tsx"),
  "utf8"
);

describe("site health atomic article persistence card", () => {
  it("shows atomic RU+EN readiness only for the current production schema", () => {
    expect(source).toContain("CURRENT_EDITORIAL_SCHEMA_VERSION");
    expect(source).toContain(
      "schemaHealth?.version === CURRENT_EDITORIAL_SCHEMA_VERSION"
    );
    expect(source).toContain("schemaHealth?.articleBundleRpc === true");
  });

  it("makes the active persistence mode visible to editors", () => {
    expect(source).toContain("Сохранение RU+EN");
    expect(source).toContain("Атомарно");
    expect(source).toContain("Недоступно");
    expect(source).not.toContain("Legacy fallback");
    expect(source).toContain("RU + EN сохраняются одной транзакцией");
    expect(source).toContain("сохранение закрыто безопасно");
  });
});
