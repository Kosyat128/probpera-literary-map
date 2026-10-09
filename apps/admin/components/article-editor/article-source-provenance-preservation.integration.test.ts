import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const baseline = process.env.M07_SOURCE_PROVENANCE_BASELINE_ROOT;
const nativeRequire = createRequire(import.meta.url), graph = new Map<string, Row>(), cache = new Map<string, Row>();
const observations: Row[] = [];
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
function parse(file: string) { return ts.createSourceFile(file, bytes(file).toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
const editorFile = "apps/admin/components/ArticleEditor.tsx", ast = parse(editorFile);
function find(predicate: (node: ts.Node) => boolean, source = ast) {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); };
  visit(source); return found;
}
function compile(expression: string, scope: Row): any {
  const emitted = ts.transpileModule("const callable = " + expression + ";", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function("scope", "with(scope) { " + emitted + " return callable; }")(scope);
}
function action(name: string, scope: Row, source = ast) {
  const node = find(value => ts.isFunctionDeclaration(value) && value.name?.text === name, source);
  if (!node) throw new Error("Missing actual function " + name);
  return compile("(" + node.getText(source) + ")", scope);
}
function memo(name: string, scope: Row): any {
  const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name) as ts.VariableDeclaration;
  if (!declaration?.initializer || !ts.isCallExpression(declaration.initializer)) throw new Error("Missing actual memo " + name);
  return compile(declaration.initializer.arguments[0].getText(ast), scope)();
}
function submit(scope: Row) {
  const node = find(value => ts.isJsxAttribute(value) && value.name.getText(ast) === "onSubmit") as ts.JsxAttribute;
  if (!node?.initializer || !ts.isJsxExpression(node.initializer) || !node.initializer.expression) throw new Error("Missing actual onSubmit");
  return compile(node.initializer.expression.getText(ast), scope);
}
function update(scope: Row) {
  const node = find(value => ts.isMethodDeclaration(value) && value.name.getText(ast) === "onUpdate");
  if (!node) throw new Error("Missing actual onUpdate");
  return compile("({" + node.getText(ast) + "}).onUpdate", scope)({ editor: scope.editor, transaction: { docChanged: true } });
}
function rawCopy(scope: Row) {
  const node = find(value => (ts.isJsxSelfClosingElement(value) || ts.isJsxOpeningElement(value)) && value.tagName.getText(ast) === "textarea" &&
    value.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "aria-label" && attribute.initializer?.getText(ast) === '"Исходная копия статьи RU/EN"')) as ts.JsxSelfClosingElement;
  if (!node) throw new Error("Missing actual original copy textarea");
  const value = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "value") as ts.JsxAttribute;
  if (!value?.initializer || !ts.isJsxExpression(value.initializer) || !value.initializer.expression) throw new Error("Missing actual original copy value");
  for (let ancestor: ts.Node | undefined = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isJsxElement(ancestor) && ancestor.openingElement.tagName.getText(ast) === "fieldset") throw new Error("Original copy is inside disabled fieldset");
  }
  return JSON.parse(compile("() => (" + value.initializer.expression.getText(ast) + ")", scope)());
}
function fieldsetDisabled(scope: Row) {
  const node = find(value => ts.isJsxOpeningElement(value) && value.tagName.getText(ast) === "fieldset") as ts.JsxOpeningElement;
  const attribute = node?.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.getText(ast) === "disabled") as ts.JsxAttribute;
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) throw new Error("Missing actual fieldset disabled guard");
  return compile("() => (" + attribute.initializer.expression.getText(ast) + ")", scope)();
}
const parserAst = parse("apps/admin/app/(dashboard)/articles/atomic-standard-save-action.ts");
const parseLineItems = action("lineItems", {}, parserAst);
const listValue = action("listValue", {});
const { createRichEditorExtensions } = load("apps/admin/components/rich-editor/RichEditorExtensions.ts");
const { EditorialBlock } = load("apps/admin/components/EditorialBlock.ts");
const { ArticleTextTone } = load("apps/admin/components/ArticleTextTone.ts");
const { ArticleTypographyScope } = load("apps/admin/components/ArticleTypographyScope.ts");
const { getSchema } = nativeRequire("@tiptap/core");
const schema = getSchema(createRichEditorExtensions({ placeholder: "Source provenance fixture", afterStarterKit: [EditorialBlock], afterImage: [ArticleTextTone, ArticleTypographyScope] }));
const recovery = load("apps/admin/lib/article-recovery-snapshot.ts");
const sourceListFile = "apps/admin/components/article-editor/article-source-preservation.ts";
// The baseline component does not reference this new dependency. Its original guard is executed unchanged.
const sourceLists = existsSync(path.join(baseline || root, sourceListFile)) ? load(sourceListFile) : null;
const document = schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Authored text and rights remain exact." }] }] }).toJSON();
type Entity = "article" | "englishTranslation" | "canonicalEnglishTranslation";
type Field = "sources" | "bibliography";
function setup() {
  const ref = (current: any) => ({ current });
  const row = (locale: string): Row => ({ locale, content_html: "<p> Authored " + locale + " HTML </p>", content_json: structuredClone(document), sources: [], bibliography: [], rights: { owner: "Original author", permission: "Original exact permission" } });
  const state: Row = { dirty: false, ruJson: JSON.stringify(document), enJson: JSON.stringify(document), notices: [] };
  const editor = { schema, getJSON: vi.fn(() => structuredClone(document)), getHTML: vi.fn(() => "<p>Manual edit</p>"), getText: () => "Authored text" };
  const scope: Row = {
    editor, article: row("ru"), englishTranslation: row("en"), canonicalEnglishTranslation: row("en"),
    contentHtml: "<p> Authored RU HTML </p>", contentJson: state.ruJson, englishContentHtml: "<p> Authored EN HTML </p>", englishContentJson: state.enJson,
    prepareArticleEditorDocumentContent: recovery.prepareArticleEditorDocumentContent,
    canPreserveArticleEditorSourceList: sourceLists?.canPreserveArticleEditorSourceList,
    contentPreservationBlockedRef: ref(false), submissionInFlightRef: ref(false), saveBlockedRef: ref(false), readUnavailableRef: ref(false), operationRecoveryReadyRef: ref(true), actionRunningRef: ref(false),
    isImageUploadActive: false, submittedRecoverySnapshotRef: ref(null), latestRecoverySnapshotRef: ref({ sourceText: "Current local input remains exact" }),
    recoveryKey: "", recoveryDraftScope: null, actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    window: { crypto: { randomUUID: vi.fn(() => { throw new Error("Synthetic operation boundary: no request starts"); }) }, sessionStorage: { setItem: vi.fn() } },
    setSaveNotice: (value: string) => state.notices.push(value),
    setImageUploadError: vi.fn(), setDraftStorageError: vi.fn(), setRecoverySourceKey: vi.fn(), persistCurrentArticleRecovery: vi.fn(),
    activeLocale: "ru", publicationChecks: [], workspaceDocument: { outline: [], metrics: {} }, workspaceSaveState: "Original state", canPublish: true, publicationActionReady: true,
    savePending: false, saveBlocked: false, readUnavailable: false, publicationReady: true,
    switchingLocaleRef: ref(false), activeLocaleRef: ref("ru"), authorInteractionRef: ref(true), hasAuthoredRecoveryEditsRef: ref(false), editorMediaBusyRef: ref(false),
    setContentHtml: vi.fn(), setContentJson: (value: string) => { state.ruJson = value; }, setEnglishContentHtml: vi.fn(), setEnglishContentJson: (value: string) => { state.enJson = value; },
    setEnglishEnabled: vi.fn(), markRussianSourceChanged: vi.fn(), setIsDirty: (value: boolean) => { state.dirty = value; }, englishEnabled: false,
  };
  return { scope, editor, state };
}
const unsafe: Array<{ name: string; entity: Entity; field: Field; value: unknown }> = [
  { name: "RU bare strings retain their original representation", entity: "article", field: "sources", value: ["  Original RU source  "] },
  { name: "RU bibliography wrapper keeps ISBN and rights", entity: "article", field: "bibliography", value: [{ text: " Original bibliography ", isbn: "978-fixture", rights: "Author permission" }] },
  { name: "disabled effective EN retains whitespace-only entries", entity: "englishTranslation", field: "sources", value: [{ text: "\t\u00a0 " }] },
  { name: "disabled effective EN retains embedded LF item boundaries", entity: "englishTranslation", field: "bibliography", value: [{ text: "First line\nSecond line" }] },
  { name: "separate canonical EN source retains permission metadata", entity: "canonicalEnglishTranslation", field: "sources", value: [{ text: "Canonical EN source", permission: { owner: "Author", approved: false } }] },
  { name: "separate canonical EN bibliography retains bare strings", entity: "canonicalEnglishTranslation", field: "bibliography", value: ["Canonical EN bibliography"] },
  { name: "empty authored item remains retained", entity: "article", field: "sources", value: [{ text: "" }] },
  { name: "embedded CR remains retained", entity: "article", field: "sources", value: [{ text: "First\rSecond" }] },
  { name: "embedded CRLF remains retained", entity: "article", field: "sources", value: [{ text: "First\r\nSecond" }] },
  { name: "null item is refused", entity: "article", field: "sources", value: [null] },
  { name: "numeric item is refused", entity: "article", field: "sources", value: [12] },
  { name: "array item is refused", entity: "article", field: "sources", value: [["Authored source"]] },
  { name: "non-string text is refused", entity: "article", field: "sources", value: [{ text: 12 }] },
  { name: "non-array list is refused", entity: "article", field: "sources", value: { text: "Authored source" } },
  { name: "101 loaded items cannot be silently truncated", entity: "article", field: "sources", value: Array.from({ length: 101 }, (_, index) => ({ text: "Source " + index })) },
  { name: "1001 UTF16 units remain retained", entity: "article", field: "sources", value: [{ text: "x".repeat(1001) }] },
];

describe("actual ArticleEditor loaded source representation preservation", () => {
  for (const sample of unsafe) {
    it(sample.name + " blocks actual writes and retains the full raw copy", async () => {
      const { scope, editor } = setup(); scope[sample.entity][sample.field] = structuredClone(sample.value);
      const original = JSON.stringify(scope[sample.entity][sample.field]);
      const projected = parseLineItems(listValue(scope[sample.entity][sample.field]));
      const blocked = memo("contentPreservationBlocked", scope); scope.contentPreservationBlocked = blocked; scope.contentPreservationBlockedRef.current = blocked;
      const event = { preventDefault: vi.fn() }; submit(scope)(event);
      const workspace = memo("workspaceSnapshot", scope);
      update(scope);
      await action("saveArticle", scope)(new FormData());
      const copy = rawCopy(scope);
      observations.push({ name: sample.name, blocked, projectionEqual: JSON.stringify(projected) === original, submitPrevented: event.preventDefault.mock.calls.length,
        operationIdsAllocated: scope.window.crypto.randomUUID.mock.calls.length, documentSerializations: editor.getJSON.mock.calls.length, workspace, rawCopyContainsEntity: sample.entity in copy });
      expect(blocked).toBe(true);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(scope.submissionInFlightRef.current).toBe(false);
      expect(scope.submittedRecoverySnapshotRef.current).toBe(null);
      expect(scope.window.crypto.randomUUID).not.toHaveBeenCalled();
      expect(editor.getJSON).not.toHaveBeenCalled();
      expect(workspace.canSave).toBe(false); expect(workspace.canPreview).toBe(false); expect(workspace.canPublish).toBe(false);
      expect(fieldsetDisabled(scope)).toBe(true);
      expect(copy[sample.entity][sample.field]).toEqual(sample.value);
      expect(JSON.stringify(scope[sample.entity][sample.field])).toBe(original);
    });
  }
  for (const value of [undefined, null, []]) {
    it("optional new/absent EN lists remain compatible: " + String(value), () => {
      const { scope } = setup(); scope.englishTranslation = undefined; scope.canonicalEnglishTranslation = null;
      scope.article = { content_html: "", content_json: { type: "doc", content: [] }, sources: value, bibliography: value };
      scope.contentHtml = ""; scope.contentJson = JSON.stringify(scope.article.content_json);
      expect(memo("contentPreservationBlocked", scope)).toBe(false);
    });
  }
  it("all six strict loaded lists retain leading/trailing spaces, tabs and Unicode", () => {
    const { scope } = setup();
    const list = [{ text: "  Источник: Émile, Ω, 東京, 😀  " }, { text: "\tAuthor's permission\t" }, { text: " Same source " }, { text: " Same source " }];
    for (const entity of ["article", "englishTranslation", "canonicalEnglishTranslation"] as const) {
      for (const field of ["sources", "bibliography"] as const) {
        scope[entity][field] = structuredClone(list); expect(parseLineItems(listValue(scope[entity][field]))).toEqual(list);
      }
    }
    expect(memo("contentPreservationBlocked", scope)).toBe(false);
  });
  it("100 loaded entries remain supported", () => {
    const { scope } = setup(); scope.article.sources = Array.from({ length: 100 }, (_, index) => ({ text: " Source " + index + " " }));
    expect(memo("contentPreservationBlocked", scope)).toBe(false); expect(parseLineItems(listValue(scope.article.sources))).toEqual(scope.article.sources);
  });
  it("1000 UTF16 units remain supported including Unicode pairs", () => {
    const { scope } = setup(); scope.englishTranslation.bibliography = [{ text: "😀".repeat(500) }];
    expect(memo("contentPreservationBlocked", scope)).toBe(false); expect(parseLineItems(listValue(scope.englishTranslation.bibliography))).toEqual(scope.englishTranslation.bibliography);
  });
  it("safe known lists allow explicit manual textarea edits with CRLF separators", () => {
    const { scope } = setup(); scope.article.sources = [{ text: " Original source " }]; scope.sourceText = "  Changed source  \r\nSecond source";
    expect(memo("contentPreservationBlocked", scope)).toBe(false);
    expect(parseLineItems(scope.sourceText)).toEqual([{ text: "  Changed source  " }, { text: "Second source" }]);
    expect(scope.article.sources).toEqual([{ text: " Original source " }]);
  });
  it("safe loaded lists permit actual workspace/form and manual document editing", () => {
    const { scope, editor, state } = setup(); scope.article.sources = [{ text: " Original source " }];
    scope.contentPreservationBlocked = memo("contentPreservationBlocked", scope); scope.contentPreservationBlockedRef.current = scope.contentPreservationBlocked;
    const workspace = memo("workspaceSnapshot", scope), event = { preventDefault: vi.fn() }; submit(scope)(event); update(scope);
    expect(workspace.canSave).toBe(true); expect(workspace.canPreview).toBe(true); expect(workspace.canPublish).toBe(true);
    expect(event.preventDefault).not.toHaveBeenCalled(); expect(scope.submissionInFlightRef.current).toBe(true); expect(editor.getJSON).toHaveBeenCalledOnce(); expect(state.dirty).toBe(true);
  });
  it("copies without article identity cannot bypass loaded source preservation", () => {
    const { scope } = setup(); scope.article.id = undefined; scope.article.sources = [{ text: "Source", rights: "Copy must retain permission" }];
    expect(memo("contentPreservationBlocked", scope)).toBe(true); expect(rawCopy(scope).article.sources).toEqual(scope.article.sources);
  });
  it("replacing current recovery textarea values cannot authorize unsupported loaded sources", () => {
    const { scope } = setup(); scope.article.sources = [{ text: "Source", rights: "Original permission" }];
    scope.sourceText = ""; scope.bibliographyText = ""; scope.englishSourceText = ""; scope.englishBibliographyText = "";
    expect(memo("contentPreservationBlocked", scope)).toBe(true); expect(rawCopy(scope).article.sources).toEqual(scope.article.sources);
  });
  it("discarding a pending journal cannot authorize unsupported canonical EN sources", () => {
    const { scope } = setup(); scope.canonicalEnglishTranslation.sources = [{ text: "Source", rights: "Canonical permission" }];
    scope.pendingRecoveryJournalRef = { current: null }; scope.latestRecoverySnapshotRef.current = null; scope.englishEnabled = false;
    expect(memo("contentPreservationBlocked", scope)).toBe(true); expect(rawCopy(scope).canonicalEnglishTranslation.sources).toEqual(scope.canonicalEnglishTranslation.sources);
  });
  it("the full raw copy includes canonical EN and remains outside the disabled fieldset", () => {
    const { scope } = setup(); const copy = rawCopy(scope);
    expect(copy).toEqual({ article: scope.article, englishTranslation: scope.englishTranslation, canonicalEnglishTranslation: scope.canonicalEnglishTranslation });
  });
});

afterAll(() => {
  const trace = process.env.M07_SOURCE_PROVENANCE_TRACE;
  if (trace) writeFileSync(trace, JSON.stringify({ baseline: baseline || null, modules: Object.fromEntries(graph), observations,
    scope: "Actual ArticleEditor useMemo/onSubmit/saveArticle/onUpdate/workspace/fieldset/raw-copy expressions, actual server lineItems and TipTap schema. Callback closure/form events controlled; no mounted React, Next, Auth/DB, provider or production acceptance." }, null, 2) + "\n", { flag: "wx" });
});
