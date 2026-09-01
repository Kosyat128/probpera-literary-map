import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { operatorDataError } from "./operator-data-error";

const root = path.resolve(process.cwd());
const dashboard = path.join(root, "apps/admin/app/(dashboard)");
const auditedAreas = [
  "articles", "banners", "categories", "history", "homepage",
  "menus", "pages", "publication",
];

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sources(absolute);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !entry.name.includes(".test.")
      ? [readFileSync(absolute, "utf8").replace(/\r\n?/gu, "\n")]
      : [];
  });
}

describe("Phase 10 safe operator database errors", () => {
  it("returns stable Russian copy without accepting a provider error", () => {
    expect(operatorDataError.length).toBe(2);
    expect(operatorDataError("pages", "save")).toBe(
      "Не удалось сохранить изменения: страницы. Обновите страницу или повторите позже."
    );
    expect(operatorDataError("publication", "load")).not.toMatch(
      /postgres|supabase|sql|pgrst|stack/iu
    );
  });

  it("does not forward database response messages into scoped URLs or UI", () => {
    const source = auditedAreas
      .flatMap((area) => sources(path.join(dashboard, area)))
      .join("\n");
    for (const unsafe of [
      "encodeURIComponent(error.message)",
      "encodeURIComponent(existingError.message)",
      "encodeURIComponent(sceneMediaError.message)",
      "{ error: error.message }",
      "{pagesError.message}",
      "{eventsResponse.error.message}",
      "{revisionResult.error.message}",
      "{redirectsResponse.error.message}",
      "return { items: [], error: response.error.message }",
    ]) {
      expect(source, unsafe).not.toContain(unsafe);
    }
    expect(source).not.toContain("return message ||");
  });

  it("retains explicit validation and concurrency guidance", () => {
    const pages = readFileSync(
      path.join(dashboard, "pages/actions.ts"), "utf8"
    );
    const homepage = readFileSync(
      path.join(dashboard, "homepage/actions.ts"), "utf8"
    );
    expect(pages).toContain("Страницу уже изменили в другой вкладке");
    expect(pages).toContain("JSON редактора повреждён");
    expect(homepage).toContain("Блок уже изменён в другой вкладке");
    expect(homepage).toContain("bookArchiveBackgroundMediaIssue");
  });
});
