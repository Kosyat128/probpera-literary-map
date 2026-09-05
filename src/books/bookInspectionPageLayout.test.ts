import { describe, expect, it } from "vitest";
import { buildBookEditorialDocument, type BookEditorialDocument } from "./bookEditorialPages";
import { bookDossierTemplates } from "./bookDossierDocument";
import { BookDossierTypographyTokens, BookDossierSpacingTokens } from "./bookTypography";
import { getBookInspectionPageLayout, layoutBookInspectionDocument, wrapBookInspectionText, type BookInspectionTextMeasure } from "./bookInspectionPageLayout";

const measure: BookInspectionTextMeasure = (text, role) => Array.from(text).length * BookDossierTypographyTokens[role].size * .5;
const base = buildBookEditorialDocument({ bookKey: "layout-book", locale: "ru", themeVersion: "test", title: "Война и мир", writer: "Лев Николаевич Толстой" });
const sourceWith = (paragraphs: readonly string[]): BookEditorialDocument => ({ ...base, pages: [{ ...base.pages[0], id: "essay", template: "essay", rows: [], paragraphs }] });

describe("book inspection semantic pagination", () => {
  it("paginates all prose without ellipsis, omitted paragraphs or unsafe gutter overlap", () => {
    const paragraphs = Array.from({ length: 9 }, (_, index) => `Абзац ${index} ` + "Полный редакционный текст без потери содержания. ".repeat(3));
    const source = sourceWith(paragraphs);
    const result = layoutBookInspectionDocument(source, measure);
    expect(result.status, result.issues.join("; ")).toBe("ready");
    expect(result.document!.pages.length).toBeGreaterThan(2);
    const commands = result.document!.pages.flatMap((page) => getBookInspectionPageLayout(page)!.commands);
    paragraphs.forEach((paragraph, index) => {
      const rendered = commands.filter((command) => command.sourceId === `essay:paragraph:${index}`).map((command) => command.text).join(" ");
      expect(rendered).toBe(paragraph.trim());
    });
    for (const command of commands) {
      expect(command.x).toBeGreaterThanOrEqual(132);
      expect(command.x + measure(command.text, command.role)).toBeLessThanOrEqual(1400 - 132);
      expect(command.y).toBeLessThan(1800);
    }
    expect(result.sourceDocument).toBe(source);
  });

  it("fails closed at a tier cap with the complete semantic source retained", () => {
    const source = sourceWith(Array(20).fill("Содержательный абзац. ".repeat(100)));
    const result = layoutBookInspectionDocument(source, measure, { maximumPages: 4 });
    expect(result.status).toBe("needs-design-review");
    expect(result.document).toBeNull();
    expect(result.sourceDocument).toBe(source);
    expect(result.sourceDocument.pages[0].paragraphs).toHaveLength(20);
    expect(result.issues.join(" ")).toContain("4-page design limit");
  });

  it("preserves a complete long source URL and refuses arbitrary word slicing", () => {
    const url = `https://example.org/${"verified".repeat(32)}`;
    expect(wrapBookInspectionText(url, 100, "metadata", measure, true)!.join("")).toBe(url);
    expect(wrapBookInspectionText(url, 100, "metadata", measure)!.join("")).toBe(url);
    expect(wrapBookInspectionText("a".repeat(100), 100, "body", measure)).toBeNull();
    const domain = "api.chekhovmuseum.com";
    const domainLines = wrapBookInspectionText(domain, 900, "heading", measure)!;
    expect(domainLines.join("")).toBe(domain);
    expect(domainLines[0]).toBe("api.");
  });

  it("retains public source titles and attribution instead of reducing a source to its provider", () => {
    const publicSource = { id: "source-1", provider: "Library", title: "Full catalogue entry", attribution: "Public attribution", usageLabel: "Reference", sourceUrl: "https://example.org/item" };
    const result = layoutBookInspectionDocument({ ...base, pages: [{ ...base.pages[0], rows: [],
      sources: [publicSource],
    }] }, measure);
    expect(result.status).toBe("ready");
    const text = result.document!.pages.flatMap(page => getBookInspectionPageLayout(page)!.commands).map(command => command.text).join(" ");
    expect(text).toContain("Full catalogue entry");
    expect(text).toContain("Public attribution");
    expect(text).toContain("example.org");
    expect(text).not.toContain("https://example.org/item");
    expect(result.document!.pages[0].sources[0].sourceUrl).toBe("https://example.org/item");
  });

  it("keeps a real journal title and a long internal article URL available for 3D pagination", () => {
    const href = "/stati/literatura/buddenbroki-istoriya-semi-i-literaturnaya-traditsiya-tomasa-manna/";
    const row = { id: "cms-db3ab5d8-4d2f-41a3-8369-8fab1df44d86", kind: "related-articles", label: "Будденброки", value: `Материал из журнала ${href}` };
    const result = layoutBookInspectionDocument({ ...base, pages: [{ ...base.pages[0], template: "related-articles", rows: [row] }] }, measure);
    expect(result.status).toBe("ready");
    const commands = result.document!.pages.flatMap(page => getBookInspectionPageLayout(page)!.commands);
    expect(commands.filter(command => command.sourceId === row.id).map(command => command.text).join("").replace(/\s/gu, "")).toBe(row.value.replace(/\s/gu, ""));
  });

  it("keeps semantic anchors across continuation pages and every supported template", () => {
    for (const template of bookDossierTemplates) {
      const anchor = { sectionId: "context", blockId: "context-essay", dossierVersion: "review-1", locale: "ru" as const, readingMode: "BEFORE_READING" as const };
      const result = layoutBookInspectionDocument({ ...base, pages: [{ ...sourceWith(["Полный текст. ".repeat(60)]).pages[0], template, anchor }] }, measure);
      expect(result.status, `${template}: ${result.issues.join("; ")}`).toBe("ready");
      expect(result.document!.pages.length).toBeGreaterThan(1);
      result.document!.pages.forEach((page) => {
        expect(page.anchor).toBe(anchor);
        expect(getBookInspectionPageLayout(page)!.template).toBe(template);
      });
    }
  });

  it("keeps final lines above the folio and layout independent of texture resolution", () => {
    const first = layoutBookInspectionDocument(base, measure);
    const second = layoutBookInspectionDocument(base, measure);
    expect(first).toEqual(second);
    for (const page of first.document!.pages) {
      const commands = getBookInspectionPageLayout(page)!.commands;
      expect(Math.max(...commands.map((command) => command.y))).toBeLessThan(BookDossierSpacingTokens.designHeight - BookDossierSpacingTokens.bottom);
    }
  });

  it("uses aligned metadata columns and distinct name/body hierarchy without losing text", () => {
    const row = { id: "event-1", kind: "timeline", label: "1949", value: "First publication" };
    const columns = layoutBookInspectionDocument({ ...base, pages: [{ ...base.pages[0], template: "timeline", rows: [row] }] }, measure);
    const commands = getBookInspectionPageLayout(columns.document!.pages[0])!.commands;
    const label = commands.find(command => command.sourceId === "event-1:label")!;
    const value = commands.find(command => command.sourceId === "event-1")!;
    expect(value.y).toBe(label.y);
    expect(value.x).toBeGreaterThan(label.x + label.width);
    expect(value.text).toBe(row.value);
    const names = layoutBookInspectionDocument({ ...base, pages: [{ ...base.pages[0], template: "characters", rows: [row] }] }, measure);
    const namedCommands = getBookInspectionPageLayout(names.document!.pages[0])!.commands;
    expect(namedCommands.find(command => command.sourceId === "event-1:label")!.role).toBe("heading");
    expect(namedCommands.find(command => command.sourceId === "event-1")!.role).toBe("body");
  });
});
