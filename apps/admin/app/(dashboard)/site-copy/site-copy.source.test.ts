import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(process.cwd());

describe("site-copy admin wiring", () => {
  it("stores overrides in the deployed homepage schema", () => {
    const actions = readFileSync(
      path.join(
        projectRoot,
        "apps/admin/app/(dashboard)/site-copy/actions.ts"
      ),
      "utf8"
    );
    expect(actions).toContain('.from("homepage_blocks")');
    expect(actions).toContain("is_enabled: true");
    expect(actions).toContain('systemKey: SITE_COPY_SYSTEM_KEY');
    expect(actions).not.toContain("site_copy_overrides");
  });

  it("submits only edited rows and preserves filtered draft values in state", () => {
    const editor = readFileSync(
      path.join(projectRoot, "apps/admin/components/SiteCopyEditor.tsx"),
      "utf8"
    );
    expect(editor).toContain("visibleDefinitions.map");
    expect(editor).toContain("Array.from(dirtyKeys).map");
    expect(editor).toContain('name="copy_key"');
    expect(editor).not.toContain("definitions.map((definition) => {");
  });

  it("protects the system record from generic homepage mutations", () => {
    const homepageActions = readFileSync(
      path.join(
        projectRoot,
        "apps/admin/app/(dashboard)/homepage/actions.ts"
      ),
      "utf8"
    );
    expect(homepageActions).toContain("Системный блок редактируется");
    expect(homepageActions).toContain("Системный блок нельзя выключить");
    expect(homepageActions).toContain("Системный блок нельзя перемещать");
    expect(homepageActions).toContain("Системный блок нельзя удалить");
  });
});
