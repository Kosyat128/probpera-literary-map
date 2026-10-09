import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { flattenExtensions, getExtensionField, getSchema, type AnyExtension, type Extensions, type JSONContent } from "@tiptap/core";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import type { RichEditorExtensionsOptions } from "./RichEditorExtensions";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../..");
type ModuleExports = Record<string, unknown>;
type Factory = (options: RichEditorExtensionsOptions) => Extensions;
const browserImport = /(?:@tiptap\/react|RichEditorClientExtensions|Editorial(?:Block|Image)View)/u;

/** Execute the actual schema modules; browser imports and normalizer calls fail immediately. */
function loader(client: boolean) {
  const cache = new Map<string, ModuleExports>();
  const imports: string[] = [];
  const normalizer = vi.fn((): never => { throw new Error("Schema construction must not execute a content normalizer"); });
  const blockView = function BlockViewSentinel() { throw new Error("A browser view must not render in this test"); };
  const imageView = function ImageViewSentinel() { throw new Error("A browser view must not render in this test"); };
  const renderer = vi.fn((view: unknown) => ({ view, renderer: "React node view sentinel" }));
  function load(relative: string): ModuleExports {
    const filename = path.join(adminRoot, relative);
    if (!client && browserImport.test(filename)) throw new Error(`Forbidden browser import: ${relative}`);
    const cached = cache.get(filename);
    if (cached) return cached;
    // An optional, local snapshot lets the same fixtures check the old pure modules without swapping runtime files.
    const snapshot = process.env.M02_RICH_EDITOR_SOURCE_ROOT;
    const alternate = snapshot ? path.join(snapshot, relative) : undefined;
    const source = alternate && existsSync(alternate) ? alternate : filename;
    const compiled = ts.transpileModule(readFileSync(source, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} as ModuleExports };
    cache.set(filename, module.exports);
    function require(name: string): unknown {
      imports.push(name);
      if (!client && browserImport.test(name)) throw new Error(`Forbidden browser import: ${name}`);
      if (name === "@tiptap/react") return { ReactNodeViewRenderer: renderer };
      if (/EditorialBlockView$/u.test(name)) return { __esModule: true, default: blockView };
      if (/EditorialImageView$/u.test(name)) return { __esModule: true, default: imageView };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = [target, target + ".ts", target + ".tsx"].find(existsSync);
        if (resolved) {
          const resolvedRelative = path.relative(adminRoot, resolved).replaceAll("\\", "/");
          if (resolvedRelative === "lib/editorial-gallery.ts") return {
            editorialGalleryHtmlAttributes: normalizer, normalizeEditorialGalleryItems: normalizer,
            normalizeEditorialGallerySettings: normalizer, parseEditorialGalleryElement: normalizer,
          };
          if (resolvedRelative === "lib/editorial-media-content.ts") return {
            editorialImageHtmlAttributes: normalizer, normalizeEditorialImageAttributes: normalizer,
          };
          if (resolvedRelative === "lib/article-content-presentation.ts") return {
            articleTextTone: normalizer, articleTypographyScope: normalizer,
          };
          return load(resolvedRelative);
        }
      }
      return nativeRequire(name);
    }
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    cache.set(filename, module.exports);
    return module.exports;
  }
  function extensions() {
    const afterStarterKit = [load("components/EditorialBlock.ts").EditorialBlock as AnyExtension];
    const afterImage = [load("components/ArticleTextTone.ts").ArticleTextTone as AnyExtension,
      load("components/ArticleTypographyScope.ts").ArticleTypographyScope as AnyExtension];
    const factory = load(`components/rich-editor/${client ? "RichEditorClientExtensions" : "RichEditorExtensions"}.ts`).createRichEditorExtensions as Factory;
    return factory({ placeholder: "Fixture placeholder", afterStarterKit, afterImage });
  }
  return { load, extensions, imports, normalizer, renderer, blockView, imageView };
}

function schemas() {
  const server = loader(false), client = loader(true);
  const serverExtensions = server.extensions(), clientExtensions = client.extensions();
  const serverSchema = getSchema(serverExtensions), clientSchema = getSchema(clientExtensions);
  expect(server.normalizer).not.toHaveBeenCalled(); expect(client.normalizer).not.toHaveBeenCalled();
  expect(server.renderer).not.toHaveBeenCalled(); expect(client.renderer).not.toHaveBeenCalled();
  return { server, client, serverExtensions, clientExtensions, serverSchema, clientSchema };
}

function schemaSignature(schema: ReturnType<typeof getSchema>) {
  const fields = ["attrs", "content", "marks", "group", "inline", "atom", "defining", "definingAsContext",
    "definingForContent", "isolating", "selectable", "draggable", "code", "whitespace", "linebreakReplacement",
    "inclusive", "spanning", "excludes"];
  const signature = (types: typeof schema.nodes | typeof schema.marks) => Object.entries(types).map(([name, type]) => ({
    name, spec: Object.fromEntries(fields.map(field => [field, type.spec[field]])),
  }));
  return { topNode: schema.topNodeType.name, nodes: signature(schema.nodes), marks: signature(schema.marks) };
}

const imageAttrs = { src: "https://example.invalid/image.jpg", alt: "  Ручная подпись \u2014 и - как есть  ", title: "Original title",
  layout: "left", width: 66, maxWidth: 640, aspect: "4-3", fit: "cover", appearance: "shadow", reveal: "fade-up",
  focusX: 0.12, focusY: 0.91, credit: "Original credit", source: "https://example.invalid/source", license: "CC BY",
  licenseUrl: "https://example.invalid/license", lightbox: false, decorative: true,
  caption: "  Original caption  ", mediaId: "ABCDEF00-1111-4111-8111-000000000001" };
const galleryAttrs = { kind: "gallery", reveal: "slide-left", galleryVersion: 1, galleryId: " original-gallery-id ",
  galleryColumnsDesktop: 3, galleryColumnsTablet: 2, galleryColumnsMobile: 1, galleryGap: "spacious",
  galleryAspect: "16-9", galleryFit: "contain", galleryCaptions: false, galleryLightbox: true,
  sliderArrows: false, sliderDots: true, sliderAutoplay: false, sliderInterval: 7000, sliderLoop: false };
const textPage: JSONContent = { type: "doc", content: [
  { type: "heading", attrs: { level: 3, textAlign: "center" }, content: [{ type: "text", text: "  Ручной заголовок \u2014 как есть  " }] },
  { type: "paragraph", attrs: { textAlign: "right" }, content: [
    { type: "text", text: "Original text \u2014 and - punctuation", marks: [
      { type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "textTone", attrs: { tone: "plum" } },
      { type: "typographyScope", attrs: { scope: "lead" } },
      { type: "link", attrs: { href: "https://example.invalid/literature", target: null, rel: null, class: null } },
    ] },
  ] },
] };
const documents: { name: string; value: JSONContent }[] = [
  { name: "text, tones, typography and link", value: textPage },
  { name: "image attributes and author text", value: { type: "doc", content: [{ type: "image", attrs: imageAttrs }] } },
  { name: "gallery with unchanged settings and media identities", value: { type: "doc", content: [
    { type: "editorialBlock", attrs: galleryAttrs, content: [textPage.content![0], { type: "image", attrs: imageAttrs }] },
  ] } },
  { name: "slider with independent settings", value: { type: "doc", content: [
    { type: "editorialBlock", attrs: { ...galleryAttrs, kind: "slider", sliderAutoplay: true, sliderArrows: true },
      content: [{ type: "image", attrs: { ...imageAttrs, decorative: false, caption: "Second caption" } }] },
  ] } },
  { name: "table and list from the common foundation", value: { type: "doc", content: [
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }] }] },
    { type: "table", content: [{ type: "tableRow", content: [
      { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: [120] }, content: [{ type: "paragraph", content: [{ type: "text", text: "Header" }] }] },
      { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: [240] }, content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }] },
    ] }] },
  ] } },
];

describe("M02 real server/client rich-editor schema parity without DOM", () => {
  it("constructs the server schema while all browser imports throw", () => {
    const { server, serverSchema } = schemas();
    expect(serverSchema.nodes.editorialBlock).toBeDefined(); expect(serverSchema.nodes.image).toBeDefined();
    expect(server.imports.some(name => browserImport.test(name))).toBe(false);
    expect(typeof window).toBe("undefined"); expect(typeof document).toBe("undefined");
  });
  it("proves the server import boundary rejects a client factory itself", () => {
    expect(() => loader(false).load("components/rich-editor/RichEditorClientExtensions.ts"))
      .toThrow("Forbidden browser import");
  });
  it("keeps the same ordered extensions and complete node/mark attribute defaults", () => {
    const { serverExtensions, clientExtensions, serverSchema, clientSchema } = schemas();
    expect(clientExtensions.map(extension => extension.name)).toEqual(serverExtensions.map(extension => extension.name));
    expect(schemaSignature(clientSchema)).toEqual(schemaSignature(serverSchema));
    expect(Object.keys(serverSchema.nodes)).toContain("table"); expect(Object.keys(serverSchema.marks)).toContain("textTone");
    expect(Object.keys(serverSchema.marks)).toContain("typographyScope");
  });
  it("attaches only the same image and editorialBlock React views", () => {
    const { server, client, serverExtensions, clientExtensions } = schemas();
    const views = (extensions: Extensions) => flattenExtensions(extensions).flatMap(extension => {
      const view = getExtensionField(extension, "addNodeView");
      return typeof view === "function" ? [{ name: extension.name, view }] : [];
    });
    // TableKit and the base Image already have non-React views; only the two editorial views are replaced/added.
    const existing = views(serverExtensions), clientViews = views(clientExtensions);
    const targets = new Set(["editorialBlock", "image"]);
    const retained = existing.filter(entry => !targets.has(entry.name));
    const existingNames = new Set(retained.map(entry => entry.name));
    expect(clientViews.filter(entry => existingNames.has(entry.name)).map(entry => entry.name))
      .toEqual(retained.map(entry => entry.name));
    expect(clientViews.filter(entry => !targets.has(entry.name)).map(entry => entry.name))
      .toEqual(retained.map(entry => entry.name));
    for (const entry of retained) {
      expect(clientViews.find(candidate => candidate.name === entry.name)?.view.toString()).toBe(entry.view.toString());
    }
    const attached = clientViews.filter(entry => targets.has(entry.name));
    expect(attached.map(entry => entry.name)).toEqual(["editorialBlock", "image"]);
    for (const entry of attached) {
      const sentinel = entry.name === "image" ? client.imageView : client.blockView;
      expect(entry.view()).toEqual({ view: sentinel, renderer: "React node view sentinel" });
    }
    expect(client.renderer.mock.calls.map(([view]) => view)).toEqual([client.blockView, client.imageView]);
    expect(server.renderer).not.toHaveBeenCalled(); expect(client.normalizer).not.toHaveBeenCalled();
  });
  it("retains default image/gallery/mark attributes on both schemas", () => {
    const { serverSchema, clientSchema } = schemas();
    for (const schema of [serverSchema, clientSchema]) {
      expect(schema.nodes.image.create({ src: imageAttrs.src }).attrs).toMatchObject({
        src: imageAttrs.src, alt: null, title: null, layout: "wide", width: 100, maxWidth: 0,
        aspect: "auto", fit: "contain", appearance: "frame", reveal: "none", focusX: 0.5, focusY: 0.5,
        caption: "", mediaId: null, credit: "", source: "", license: "", licenseUrl: "", lightbox: true, decorative: false,
      });
      expect(schema.nodes.editorialBlock.create().attrs).toMatchObject({ kind: "fact", reveal: "fade-up", galleryVersion: 1,
        galleryId: "", galleryColumnsDesktop: 2, galleryColumnsTablet: 2, galleryColumnsMobile: 1,
        galleryGap: "normal", galleryAspect: "auto", galleryFit: "contain", galleryCaptions: true,
        galleryLightbox: true, sliderArrows: true, sliderDots: true, sliderAutoplay: false, sliderInterval: 5000, sliderLoop: true });
      expect(schema.marks.textTone.create().attrs).toEqual({ tone: null });
      expect(schema.marks.typographyScope.create().attrs).toEqual({ scope: null });
    }
  });
  it.each(documents)("roundtrips $name through both real schemas", ({ value }) => {
    const { server, client, serverSchema, clientSchema } = schemas();
    const before = JSON.stringify(value);
    const serverDocument = serverSchema.nodeFromJSON(value), clientDocument = clientSchema.nodeFromJSON(value);
    serverDocument.check(); clientDocument.check();
    expect(clientDocument.toJSON()).toEqual(serverDocument.toJSON());
    expect(serverSchema.nodeFromJSON(clientDocument.toJSON()).toJSON()).toEqual(serverDocument.toJSON());
    expect(clientSchema.nodeFromJSON(serverDocument.toJSON()).toJSON()).toEqual(clientDocument.toJSON());
    const preserve = (input: JSONContent, output: JSONContent) => {
      expect(output.type).toBe(input.type);
      if (input.attrs) expect(output.attrs).toMatchObject(input.attrs);
      if (input.text !== undefined) expect(output.text).toBe(input.text);
      if (input.marks) for (const mark of input.marks) {
        expect(output.marks?.find(candidate => candidate.type === mark.type)).toMatchObject(mark);
      }
      if (input.content) { expect(output.content).toHaveLength(input.content.length); input.content.forEach((node, index) => preserve(node, output.content![index])); }
    };
    preserve(value, serverDocument.toJSON());
    expect(JSON.stringify(value)).toBe(before);
    expect(server.normalizer).not.toHaveBeenCalled(); expect(client.normalizer).not.toHaveBeenCalled();
    expect(client.renderer).not.toHaveBeenCalled();
  });
});
