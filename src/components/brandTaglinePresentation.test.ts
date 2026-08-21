import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const cmsReaderSource = readFileSync(
  new URL("./CmsPageReader.tsx", import.meta.url),
  "utf8"
);

describe("compact brand tagline", () => {
  it("keeps only the literary-journal label in the public footer brand", () => {
    const start = appSource.indexOf('<section className="footer-brand">');
    const end = appSource.indexOf("</section>", start);
    const footerBrand = appSource.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(footerBrand).toContain('<small>{t("Литературный журнал")}</small>');
    expect(footerBrand).not.toContain("мировая энциклопедия");
  });

  it("uses the same short label in standalone CMS page headers", () => {
    const start = cmsReaderSource.indexOf('<a className="cms-page-brand"');
    const end = cmsReaderSource.indexOf("</a>", start);
    const cmsBrand = cmsReaderSource.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(cmsBrand).toContain('<small>{t("Литературный журнал")}</small>');
    expect(cmsBrand).not.toContain("и энциклопедия");
  });
});
