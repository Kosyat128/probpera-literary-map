import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  adminCommandEntries,
  adminModuleRegistry,
  adminSidebarEntries,
} from "./admin-module-registry";

const root = path.resolve(process.cwd());
const dashboardRoot = path.join(root, "apps/admin/app/(dashboard)");

function pageRoutes(directory = dashboardRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return pageRoutes(absolute);
    if (entry.name !== "page.tsx") return [];
    const relative = path.relative(dashboardRoot, path.dirname(absolute));
    return [`/${relative.replaceAll(path.sep, "/")}`];
  });
}

const routes = pageRoutes();
const staticRoutes = routes.filter((route) => !route.includes("["));
const compatibilityRoutes = new Set(["/articles/edit"]);

describe("Phase 9 admin module coverage", () => {
  it("keeps every canonical module unique and backed by a real page", () => {
    const hrefs = adminModuleRegistry.map(({ entry }) => entry[2]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(adminModuleRegistry.map(({ entry }) => entry[1])).size).toBe(
      adminModuleRegistry.length
    );
    for (const href of hrefs) {
      expect(
        existsSync(path.join(dashboardRoot, href.slice(1), "page.tsx")),
        `dead admin module link: ${href}`
      ).toBe(true);
    }
  });

  it("covers every operator-facing static page in the command palette", () => {
    const paletteRoutes = new Set<string>(
      adminCommandEntries.map((entry) => entry[2])
    );
    expect(
      staticRoutes.filter(
        (route) => !paletteRoutes.has(route) && !compatibilityRoutes.has(route)
      )
    ).toEqual([]);
  });

  it("keeps every top-level module in AdminShell and every shell module searchable", () => {
    const topLevelRoutes = staticRoutes.filter(
      (route) => route.slice(1).length > 0 && !route.slice(1).includes("/")
    );
    expect(adminSidebarEntries.map((entry) => entry[2]).sort()).toEqual(
      topLevelRoutes.sort()
    );
    expect(adminCommandEntries).toEqual(
      adminModuleRegistry.map((module) => module.entry)
    );
  });

  it("uses the registry in both navigation surfaces and leaves no second route list", () => {
    const shell = readFileSync(
      path.join(root, "apps/admin/components/AdminShell.tsx"),
      "utf8"
    );
    const palette = readFileSync(
      path.join(root, "apps/admin/components/AdminCommandPalette.tsx"),
      "utf8"
    );
    expect(shell).toContain("adminSidebarEntries.map");
    expect(shell).toContain("entries={adminCommandEntries}");
    expect(shell).not.toContain("const navigation = [");
    expect(palette).toContain("AdminNavigationEntry");
  });
});
