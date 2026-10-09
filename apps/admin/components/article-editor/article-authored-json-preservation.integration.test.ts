import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const baseline = process.env.M07_AUTHORED_JSON_BASELINE_ROOT;
const nativeRequire = createRequire(import.meta.url), graph = new Map<string, Row>(), cache = new Map<string, Row>();
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
function bytes(file: string) {
  const actual = path.join(baseline || root, file);
  if (!existsSync(actual)) throw new Error("Missing exact captured/current source: " + actual);
  const source = readFileSync(actual);
  graph.set(file, { source: path.relative(root, actual).replaceAll("\\", "/"), sha256: sha(source) });
  return source;
}
function load(file: string): Row {
  if (cache.has(file)) return cache.get(file)!;
  const source = bytes(file), module = { exports: {} as Row }; cache.set(file, module.exports);
  const require = (name: string) => {
    if (!name.startsWith(".") && !name.startsWith("@/")) return nativeRequire(name);
    const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2)) : path.resolve(path.dirname(path.join(root, file)), name);
    const found = [".ts", ".tsx"].map(extension => path.relative(root, target + extension))
      .find(relative => existsSync(path.join(baseline || root, relative)));
    if (!found) throw new Error("Missing exact dependency " + name);
    return load(found);
  };
  new Function("require", "module", "exports", ts.transpileModule(source.toString(), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText)(require, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
const editorFile = "apps/admin/components/ArticleEditor.tsx", editorSource = bytes(editorFile).toString();
const ast = ts.createSourceFile(editorFile, editorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate: (node: ts.Node) => boolean) {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); };
  visit(ast); return found;
}
function compile(expression: string, scope: Row): any {
  const emitted = ts.transpileModule("const callable = " + expression + ";", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function("scope", "with(scope) { " + emitted + " return callable; }")(scope);
}
function method(name: string, scope: Row) {
  const node = find(value => ts.isMethodDeclaration(value) && value.name.getText(ast) === name);
  if (!node) throw new Error("Missing actual editor callback " + name);
  return compile("({" + node.getText(ast) + "})." + name, scope);
}
function submit(scope: Row) {
  const node = find(value => ts.isJsxAttribute(value) && value.name.getText(ast) === "onSubmit") as ts.JsxAttribute;
  if (!node?.initializer || !ts.isJsxExpression(node.initializer) || !node.initializer.expression) throw new Error("Missing actual onSubmit");
  return compile(node.initializer.expression.getText(ast), scope);
}
function action(name: string, scope: Row) {
  const node = find(value => ts.isFunctionDeclaration(value) && value.name?.text === name);
  if (!node) throw new Error("Missing actual action " + name);
  return compile("(" + node.getText(ast) + ")", scope);
}
const { createRichEditorExtensions } = load("apps/admin/components/rich-editor/RichEditorExtensions.ts");
const { EditorialBlock } = load("apps/admin/components/EditorialBlock.ts");
const { ArticleTextTone } = load("apps/admin/components/ArticleTextTone.ts");
const { ArticleTypographyScope } = load("apps/admin/components/ArticleTypographyScope.ts");
const { getSchema } = nativeRequire("@tiptap/core");
const schema = getSchema(createRichEditorExtensions({ placeholder: "Source preservation fixture", afterStarterKit: [EditorialBlock], afterImage: [ArticleTextTone, ArticleTypographyScope] }));
const recovery = load("apps/admin/lib/article-recovery-snapshot.ts");
const sourceListFile = "apps/admin/components/article-editor/article-source-preservation.ts";
const sourceLists = existsSync(path.join(baseline || root, sourceListFile)) ? load(sourceListFile) : null;
const document = schema.nodeFromJSON({ type: "doc", content: [
  { type: "paragraph", content: [{ type: "text", text: "Original authored text, exact sources and author rights." }] },
  { type: "image", attrs: { src: "https://fixture.invalid/image.jpg", mediaId: "dddddddd-dddd-4ddd-8ddd-000000000001", alt: "Original image", credit: "Original photographer", source: "https://fixture.invalid/permission", license: "Author permission retained" } },
] }).toJSON();
function guard(scope: Row): boolean {
  const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === "contentPreservationBlocked") as ts.VariableDeclaration | undefined;
  if (!declaration?.initializer || !ts.isCallExpression(declaration.initializer)) return false;
  return compile(declaration.initializer.arguments[0].getText(ast), scope)();
}
function setup(options: { locale?: "ru" | "en"; blocked?: boolean; author?: boolean; busy?: boolean; authored?: boolean; raw?: Row } = {}) {
  const state: Row = { ruJson: JSON.stringify(options.raw || document), enJson: JSON.stringify(document), ruHtml: "<p> Exact original RU HTML </p>", enHtml: "<p> Exact original EN HTML </p>", russianChanged: false, dirty: false, confirmed: false, englishEnabled: false, notices: [] };
  const ref = (current: any) => ({ current });
  const editor: Row = { schema, getJSON: () => structuredClone(document), getHTML: () => "<p>Editor projection</p>", getText: () => "Original authored text" };
  const scope: Row = {
    editor, article: { content_html: state.ruHtml, content_json: JSON.parse(state.ruJson) }, englishTranslation: { content_html: state.enHtml, content_json: JSON.parse(state.enJson) },
    canonicalEnglishTranslation: null,
    contentHtml: state.ruHtml, contentJson: state.ruJson, englishContentHtml: state.enHtml, englishContentJson: state.enJson,
    prepareArticleEditorDocumentContent: recovery.prepareArticleEditorDocumentContent,
    canPreserveArticleEditorSourceList: sourceLists?.canPreserveArticleEditorSourceList,
    switchingLocaleRef: ref(false), activeLocaleRef: ref(options.locale || "ru"), authorInteractionRef: ref(!!options.author), hasAuthoredRecoveryEditsRef: ref(!!options.authored),
    contentPreservationBlockedRef: ref(!!options.blocked), editorMediaBusyRef: ref(!!options.busy),
    setContentHtml: (value: string) => { state.ruHtml = value; }, setContentJson: (value: string) => { state.ruJson = value; },
    setEnglishContentHtml: (value: string) => { state.enHtml = value; }, setEnglishContentJson: (value: string) => { state.enJson = value; },
    setEnglishEnabled: (value: boolean) => { state.englishEnabled = value; }, markRussianSourceChanged: () => { state.russianChanged = true; state.confirmed = false; },
    setIsDirty: (value: boolean) => { state.dirty = value; }, setSaveNotice: (value: string) => state.notices.push(value),
    submissionInFlightRef: ref(false), saveBlockedRef: ref(false), readUnavailableRef: ref(false), operationRecoveryReadyRef: ref(true), actionRunningRef: ref(false),
    isImageUploadActive: false, setImageUploadError: vi.fn(), submittedRecoverySnapshotRef: ref(null), latestRecoverySnapshotRef: ref(null),
    recoveryKey: "", recoveryDraftScope: null, actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", recoveryOriginRef: ref(null),
    window: { crypto: { randomUUID: vi.fn(() => "eeeeeeee-eeee-4eee-8eee-000000000001") }, sessionStorage: { setItem: vi.fn() } },
    setDraftStorageError: vi.fn(), setRecoverySourceKey: vi.fn(), persistCurrentArticleRecovery: vi.fn(),
  };
  scope.cloneArticleFormData = action("cloneArticleFormData", scope);
  const update = (docChanged = true) => method("onUpdate", scope)({ editor, transaction: { docChanged } });
  return { state, scope, editor, update };
}
describe("actual ArticleEditor authored JSON and initialization callback integration", () => {
  for (const locale of ["ru", "en"] as const) {
    it(locale + " initialization preserves exact raw HTML/JSON and does not mark the source dirty", () => {
      const fixture = setup({ locale }), before = structuredClone(fixture.state); fixture.update(); expect(fixture.state).toEqual(before);
    });
    it(locale + " unsupported JSON cannot be serialized even after an author toolbar event", () => {
      const fixture = setup({ locale, blocked: true, author: true, raw: { ...document, authorMetadata: { rights: "Exact author permission", source: "https://fixture.invalid/source" } } });
      const before = structuredClone(fixture.state); fixture.update(); expect(fixture.state).toEqual(before);
    });
    it(locale + " actual schema-supported authored edits are serialized", () => {
      const fixture = setup({ locale, author: true }), edited = structuredClone(document);
      edited.content[0].content[0].text = "Manually edited " + locale + " text; source and image rights remain exact.";
      const editedDocument = schema.nodeFromJSON(edited); editedDocument.check(); fixture.editor.getJSON = () => editedDocument.toJSON(); fixture.update();
      expect(fixture.state[locale === "ru" ? "ruJson" : "enJson"]).toBe(JSON.stringify(editedDocument.toJSON()));
      expect(JSON.parse(fixture.state[locale === "ru" ? "ruJson" : "enJson"]).content[1].attrs).toEqual(document.content[1].attrs);
      expect(fixture.state[locale === "ru" ? "ruHtml" : "enHtml"]).toBe("<p>Editor projection</p>"); expect(fixture.state.dirty).toBe(true);
    });
    it(locale + " authorized async media updates remain effective after the DOM event ends", () => {
      const fixture = setup({ locale, busy: true }); fixture.update(); expect(fixture.state[locale === "ru" ? "ruHtml" : "enHtml"]).toBe("<p>Editor projection</p>"); expect(fixture.state.dirty).toBe(true);
    });
    it(locale + " later supported document commands remain effective after authored edits", () => {
      const fixture = setup({ locale, authored: true }); fixture.update(); expect(fixture.state.dirty).toBe(true);
    });
  }
  it("locale switching does not serialize a different projected locale over either raw document", () => {
    const fixture = setup({ author: true }), before = structuredClone(fixture.state); fixture.scope.switchingLocaleRef.current = true; fixture.update(); expect(fixture.state).toEqual(before);
  });
  it("an unsupported loaded RU root field remains guarded even if the current editor projection is schema-supported", () => {
    const fixture = setup({ raw: { ...document, authorMetadata: { rights: "Exact retained rights" } } }); fixture.scope.contentJson = JSON.stringify(document); expect(guard(fixture.scope)).toBe(true);
  });
  it("an unsupported loaded EN node attribute remains guarded even if RU is supported", () => {
    const fixture = setup(), node = fixture.scope.englishTranslation.content_json.content[0]; node.attrs = { ...node.attrs, authorRights: "Exact EN rights" }; expect(guard(fixture.scope)).toBe(true);
  });
  it("unsupported current RU JSON cannot be authorized by supported loaded rows", () => {
    const fixture = setup(); fixture.scope.contentJson = JSON.stringify({ ...document, authorMetadata: { preserve: true } }); expect(guard(fixture.scope)).toBe(true);
  });
  it("unsupported current EN JSON cannot be authorized by supported loaded rows", () => {
    const fixture = setup(); fixture.scope.englishContentJson = JSON.stringify({ ...document, authorMetadata: { preserve: true } }); expect(guard(fixture.scope)).toBe(true);
  });
  it("supported current and loaded documents permit the existing editor flow", () => { expect(guard(setup().scope)).toBe(false); });
  it("the write guard stays closed until the actual editor schema is available", () => { const fixture = setup(); fixture.scope.editor = null; expect(guard(fixture.scope)).toBe(true); });
  it("unsupported form submit is rejected before snapshots or in-flight state change", () => {
    const fixture = setup({ blocked: true }), event = { preventDefault: vi.fn() }; submit(fixture.scope)(event);
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(fixture.scope.submissionInFlightRef.current).toBe(false); expect(fixture.scope.window.sessionStorage.setItem).not.toHaveBeenCalled();
  });
  it("unsupported direct action invocation is rejected before operation ID allocation", async () => {
    const fixture = setup({ blocked: true }); await action("saveArticle", fixture.scope)(new FormData()); expect(fixture.scope.window.crypto.randomUUID).not.toHaveBeenCalled(); expect(fixture.state.notices).toEqual([]);
  });
  it("schema-preservation guard cannot provide human review confirmation", () => {
    const fixture = setup({ locale: "en", blocked: true, author: true }); fixture.update(); expect(fixture.state.confirmed).toBe(false); expect(fixture.state.englishEnabled).toBe(false);
  });
});
afterAll(() => {
  const trace = process.env.M07_AUTHORED_JSON_TRACE;
  if (trace) writeFileSync(trace, JSON.stringify({ scope: "Actual source callbacks and actual TipTap schema; no React DOM, Next server, Auth, DB, provider or production acceptance", baseline: baseline || null, modules: Object.fromEntries(graph) }, null, 2) + "\n", { flag: "wx" });
});
