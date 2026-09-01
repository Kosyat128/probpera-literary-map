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
    expect(source).toContain('atomicArticleSaveReady\n    ? "OK"');
    expect(source).toContain('<HealthValue status={atomicArticleSaveStatus} />');
    expect(source).not.toContain("Legacy fallback");
    expect(source).toContain("RU + EN сохраняются одной транзакцией");
    expect(source).toContain("сохранение закрыто безопасно");
  });

  it("uses one closed status vocabulary and redacts client diagnostics", () => {
    expect(source).toContain("type HealthStatus");
    expect(source).toContain("redactHealthDiagnosticText(latest.message)");
    expect(source).toContain("safeDiagnosticPath(latest.path)");
    expect(source).not.toContain("<strong>{latest.message}</strong>");
    expect(source).toContain("требуется реальный self-test провайдера");
  });

  it("fails backup and restore freshness closed when operational evidence is absent", () => {
    expect(source).toContain('supabase.from("admin_ops_markers")');
    expect(source).toContain("operationalMarkerError");
    expect(source).toContain('status: "UNKNOWN"');
    expect(source).toContain("Резервная копия DB + Storage");
    expect(source).toContain("Проверка восстановления");
    expect(source).not.toContain("операционный статус предполагается исправным");
  });
});
