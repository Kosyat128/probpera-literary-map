import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const uploadSource = readFileSync(
  new URL("./FontUploadForm.tsx", import.meta.url),
  "utf8"
);
const cssSource = readFileSync(new URL("./page.module.css", import.meta.url), "utf8");
const shellSource = readFileSync(
  new URL("../../../../components/AdminShell.tsx", import.meta.url),
  "utf8"
);

describe("Site Studio typography admin contract", () => {
  it("uses the canonical tables, RPCs and exact CAS arguments", () => {
    expect(pageSource).toContain('.from("font_assets")');
    expect(pageSource).toContain('.from("site_typography_overrides")');
    expect(pageSource).toContain('.from("site_typography_revisions")');
    expect(actionsSource).toContain('rpc("save_site_typography_override"');
    expect(actionsSource).toContain('rpc("publish_site_typography_override"');
    expect(actionsSource).toContain('rpc("restore_site_typography_revision"');
    expect(actionsSource).toContain('rpc("archive_font_asset"');
    expect(actionsSource).toContain("p_expected_cas_version: expectedVersion");
    expect(actionsSource).toContain("p_draft_settings: settings");
    expect(actionsSource).toContain("p_draft_settings: {}");
  });

  it("authorizes every mutation and renders its expected version", () => {
    expect(actionsSource).toContain('requireStaff(["owner", "admin"])');
    expect(actionsSource).toContain("expectedTypographyVersionFromForm(formData)");
    expect(pageSource.match(/name="expected_version"/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(pageSource).toContain('name="override_id"');
    expect(pageSource).toContain('name="revision_id"');
    expect(pageSource).toContain('name="font_id"');
    expect(pageSource).toContain(
      'key={selected ? `${selected.id}:${selected.casVersion}` : "new"}'
    );
  });

  it("keeps upload local, accessible and delegated to the protected endpoint", () => {
    expect(uploadSource).toContain('withClientAdminPath("/api/site-fonts/upload")');
    expect(uploadSource).toContain('accept=".woff2,.woff,font/woff2,font/woff"');
    expect(uploadSource).toMatch(/name="licenseName"[\s\S]{0,180}required/u);
    expect(uploadSource).toContain('aria-live="polite"');
    expect(pageSource).toContain('rel="noreferrer"');
    expect(uploadSource).not.toMatch(/name="(?:cssUrl|fontUrl|importUrl|remoteUrl)"/u);
  });

  it("uses a scoped responsive CSS module and one AdminShell entry", () => {
    expect(pageSource).toContain('import styles from "./page.module.css"');
    expect(cssSource).toContain("@media (max-width: 760px)");
    expect(cssSource).toContain(".workspace");
    expect(shellSource.match(/"Шрифты", "\/site-studio\/fonts"/gu)).toHaveLength(1);
  });

  it("shows Russian workflow copy and never accepts a raw style payload", () => {
    expect(pageSource).toContain("Сохранить черновик");
    expect(pageSource).toContain("Сбросить и опубликовать");
    expect(pageSource).toContain("Восстановить");
    expect(pageSource).toContain("Произвольный CSS");
    expect(pageSource).toContain('normal: "Обычное"');
    expect(pageSource).toContain('publish: "Публикация"');
    expect(actionsSource).not.toContain("return error?.message");
    expect(pageSource).not.toContain('name="style"');
    expect(pageSource).not.toContain('name="css"');
  });
});
