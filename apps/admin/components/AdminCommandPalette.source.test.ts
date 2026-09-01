import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps/admin/components/AdminCommandPalette.tsx"),
  "utf8"
);

describe("admin command palette", () => {
  it("supports accessible keyboard navigation without arbitrary commands", () => {
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('role="listbox"');
    expect(source).not.toMatch(/eval\(|new Function/u);
  });

  it("keeps all visible interface copy in Russian", () => {
    for (const copy of [
      "Быстрый переход",
      "Навигация по редакции",
      "Куда перейти?",
      "Найти раздел админки",
      "Раздел не найден",
    ]) {
      expect(source).toContain(copy);
    }
  });
});
