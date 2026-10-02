import { isLocalCliEntry } from "./local-cli-entry.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT = /\.(?:[cm]?[jt]sx?)$/iu;
const ASSET = /\.(?:css|scss|sass|less|json|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp3|mp4|ogg|wav|glb|gltf|wasm)$/iu;
const TEST = /(?:^|\/)(?:__tests__|__fixtures__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|[.-])test-support\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/iu;
const NATIVE = /^(?:@capacitor\/|@capacitor-community\/|@ionic-native\/|@awesome-cordova-plugins\/|@react-native\/|@capawesome(?:-team)?\/|react-native(?:$|[-/])|cordova(?:$|[-/])|capacitor-)/u;
const REMOTE_SDK = /^(?:@capgo\/capacitor-updater|@ionic\/pro|cordova-plugin-code-push|react-native-code-push)(?:$|\/)/u;
const NATIVE_PATH = /(?:^|\/)(?:android|ios|native)(?:\/|\.)|\.(?:native|android|ios)\.[cm]?[jt]sx?$|(?:Android|IOS|Ios|StoreKit|PlayBilling|RuStore)[^/]*(?:Provider|Adapter)\.[cm]?[jt]sx?$/u;
const SPECIAL = new Map([
  ["@react-three/fiber", new Set(["Canvas", "createRoot"])],
  ["three", new Set(["WebGLRenderer", "WebGPURenderer"])],
  ["react", new Set(["createElement"])],
  ["react/jsx-runtime", new Set(["jsx", "jsxs"])],
  ["react/jsx-dev-runtime", new Set(["jsxDEV"])],
]);
const posix = (value) => value.replaceAll("\\", "/");
const inside = (root, file) => { const relative = path.relative(root, file); return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative)); };
const unwrapped = (node) => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
};
const literal = (node) => { node = unwrapped(node); return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined; };
const propertyName = (node) => ts.isComputedPropertyName(node) ? literal(node.expression) : (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) ? node.text : undefined;
const member = (node) => ts.isPropertyAccessExpression(node) ? node.name.text : ts.isElementAccessExpression(node) ? literal(node.argumentExpression) : undefined;
const modifier = (node, kind) => node.modifiers?.some((item) => item.kind === kind);
const cleanSpecifier = (specifier) => {
  const suffixes = [specifier.indexOf("?"), specifier.indexOf("#", 1)].filter((index) => index >= 0);
  return suffixes.length ? specifier.slice(0, Math.min(...suffixes)) : specifier;
};
const functionScope = (node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node);

/** Static source policy; runtime identity, installed dependency contents and artifacts require separate gates. */
export function runPlatformBoundaryAudit(options = {}) {
  const rootDir = fs.realpathSync(options.rootDir ?? process.cwd());
  const sourceRoots = options.sourceRoots ?? ["src"];
  const entryPoints = options.entryPoints ?? ["src/main.tsx"];
  const adapterRoots = options.adapterRoots ?? ["src/platform/adapters/android", "src/platform/adapters/ios"];
  const canonicalSceneFiles = options.canonicalSceneFiles ?? {
    LiteraryWorldMap: "src/components/LiteraryWorldMap.tsx",
    LiteraryGlobe: "src/components/LiteraryGlobe.tsx",
    GlobeCameraRig: "src/components/GlobeCameraRig.tsx",
  };
  const canvasOwnerFiles = options.canvasOwnerFiles ?? ["src/components/LiteraryGlobe.tsx", "src/components/BookShelfSceneCanvas.tsx"];
  const nativeConfigFiles = options.nativeConfigFiles ?? ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.mjs", "capacitor.config.json"];
  const moduleAliases = options.moduleAliases ?? { "@/": "apps/admin/" };
  const findings = [];
  const files = new Map();
  const webFiles = new Set();
  const runtimeFiles = new Set();
  const edges = [];
  const canvasSites = [];
  const nativeConfigs = [];
  const relative = (file) => posix(path.relative(rootDir, file));
  const add = (code, file, node, message) => {
    const source = node?.getSourceFile();
    const point = source && source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({ code, file: relative(file), ...(point ? { line: point.line + 1, column: point.character + 1 } : {}), message });
  };
  const localPath = (input) => {
    const result = path.resolve(rootDir, input);
    if (!inside(rootDir, result)) throw new Error("Audit path leaves root: " + input);
    return result;
  };
  const nativeAdapters = adapterRoots.map(localPath);
  const isAdapter = (file) => nativeAdapters.some((root) => inside(root, file));
  const isNativeFile = (file) => isAdapter(file) || NATIVE_PATH.test(relative(file));
  const canonical = new Map(Object.entries(canonicalSceneFiles).map(([name, file]) => [name, localPath(file)]));
  const canvasOwners = new Set(canvasOwnerFiles.map(localPath));
  let compilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true, resolveJsonModule: true, jsx: ts.JsxEmit.ReactJSX };
  const tsconfig = path.join(rootDir, "tsconfig.json");
  if (fs.existsSync(tsconfig)) {
    const config = ts.readConfigFile(tsconfig, ts.sys.readFile);
    if (config.error) add("INVALID_TSCONFIG", tsconfig, undefined, ts.flattenDiagnosticMessageText(config.error.messageText, " "));
    else {
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, rootDir);
      for (const error of parsed.errors.filter((item) => item.code !== 18003)) add("INVALID_TSCONFIG", tsconfig, undefined, ts.flattenDiagnosticMessageText(error.messageText, " "));
      compilerOptions = { ...compilerOptions, ...parsed.options };
    }
  }
  compilerOptions = { ...compilerOptions, ...options.compilerOptions };
  const packageFile = path.join(rootDir, "package.json");
  let dependencies = {};
  if (fs.existsSync(packageFile)) {
    try { const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8")); dependencies = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies }; }
    catch { add("INVALID_PACKAGE_JSON", packageFile, undefined, "Cannot classify external dependencies from invalid package.json."); }
  }
  const packageName = (specifier) => { const clean = cleanSpecifier(specifier); return clean.startsWith("@") ? clean.split("/").slice(0, 2).join("/") : clean.split("/")[0]; };
  const actualPackage = (specifier) => {
    const name = packageName(specifier);
    const version = dependencies[name];
    return typeof version === "string" && version.startsWith("npm:") ? version.slice(4).replace(/@[^/]*$/u, "") : name;
  };
  function resolve(specifier, from) {
    const clean = cleanSpecifier(specifier);
    const query = specifier.split("?", 2)[1] ?? "";
    if (/^(?:https?:|data:|blob:|\/\/)/iu.test(clean)) return { remote: true };
    if (/^(?:node:|virtual:)/u.test(clean)) return { unsupported: true };
    let target;
    if (clean.startsWith(".")) target = path.resolve(path.dirname(from), clean);
    else if (clean.startsWith("/")) target = path.resolve(rootDir, "." + clean);
    else {
      const alias = Object.keys(moduleAliases).sort((a, b) => b.length - a.length).find((key) => clean.startsWith(key));
      if (alias) target = path.resolve(rootDir, moduleAliases[alias], clean.slice(alias.length));
    }
    const resolved = ts.resolveModuleName(target ?? clean, from, compilerOptions, ts.sys).resolvedModule;
    let file = resolved?.resolvedFileName;
    if (!file && target) file = [target, ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"].map((extension) => target + extension), ...["index.ts", "index.tsx", "index.js", "index.mjs"].map((name) => path.join(target, name))].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (file) {
      file = fs.realpathSync(file);
      if (!inside(rootDir, file)) return { outside: true };
      if (posix(file).includes("/node_modules/")) return { external: true, package: actualPackage(clean) };
      return { file, asset: ASSET.test(file) || /(?:^|&)(?:raw|url)(?:&|$)/u.test(query) };
    }
    if (!target && Object.hasOwn(dependencies, packageName(clean))) return { external: true, package: actualPackage(clean) };
    return { unresolved: true };
  }
  function listSources(directory) {
    if (!fs.existsSync(directory)) { add("MISSING_SOURCE_ROOT", directory, undefined, "Configured production source root is missing."); return; }
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "build", "coverage"].includes(item.name)) continue;
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink()) { add("SOURCE_SYMLINK", file, undefined, "Source-tree symlinks require an explicit audited source layout."); continue; }
      if (item.isDirectory()) { if (!TEST.test(relative(file))) listSources(file); }
      else if (SCRIPT.test(file) && !TEST.test(relative(file))) load(file);
    }
  }
  function load(file) {
    if (files.has(file)) return files.get(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const record = { file, source, imports: [], exports: new Map(), stars: [], hazards: [], scopes: new WeakMap(), scope: { id: 0, parent: undefined, function: true, bindings: new Map() } };
    let scopeId = 0;
    files.set(file, record);
    for (const error of source.parseDiagnostics) add("SOURCE_PARSE_ERROR", file, undefined, ts.flattenDiagnosticMessageText(error.messageText, " "));
    const link = (node, value, runtime = true) => {
      const specifier = literal(value);
      if (specifier === undefined) { record.hazards.push({ code: "DYNAMIC_MODULE_LOADER", node, message: "Module dependency cannot be statically resolved." }); return; }
      record.imports.push({ node, specifier, runtime });
    };
    const bindPattern = (scope, name, value = {}) => {
      if (ts.isIdentifier(name)) scope.bindings.set(name.text, value);
      else for (const element of name.elements) if (ts.isBindingElement(element)) bindPattern(scope, element.name);
    };
    const walk = (node, inherited = record.scope) => {
      let scope = inherited;
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) bindPattern(scope, node.name);
      const isFunction = functionScope(node);
      if (isFunction || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseBlock(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isCatchClause(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) scope = { id: ++scopeId, parent: inherited, function: isFunction || ts.isModuleBlock(node), bindings: new Map() };
      record.scopes.set(node, scope);
      if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name) bindPattern(scope, node.name);
      if (ts.isParameter(node)) bindPattern(scope, node.name);
      if (ts.isImportDeclaration(node)) {
        const specifier = literal(node.moduleSpecifier);
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const runtime = !clause?.isTypeOnly && (!named || !ts.isNamedImports(named) || named.elements.length === 0 || named.elements.some((element) => !element.isTypeOnly));
        link(node, node.moduleSpecifier, runtime);
        if (clause?.name) scope.bindings.set(clause.name.text, { specifier, name: "default" });
        if (named && ts.isNamespaceImport(named)) scope.bindings.set(named.name.text, { specifier, name: "*" });
        if (named && ts.isNamedImports(named)) for (const element of named.elements) scope.bindings.set(element.name.text, { specifier, name: element.propertyName?.text ?? element.name.text });
      } else if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) link(node, node.moduleSpecifier, !node.isTypeOnly && (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some((element) => !element.isTypeOnly)));
        if (node.parent === source) {
          if (!node.exportClause && node.moduleSpecifier) record.stars.push(literal(node.moduleSpecifier));
          if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const element of node.exportClause.elements) record.exports.set(element.name.text, { specifier: literal(node.moduleSpecifier), name: element.propertyName?.text ?? element.name.text, local: element.propertyName ?? element.name });
          if (node.exportClause && ts.isNamespaceExport(node.exportClause)) record.exports.set(node.exportClause.name.text, { specifier: literal(node.moduleSpecifier), name: "*" });
        }
      } else if (ts.isExportAssignment(node) && node.parent === source) record.exports.set("default", { expression: node.expression });
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        link(node, node.moduleReference.expression, !node.isTypeOnly);
        scope.bindings.set(node.name.text, { specifier: literal(node.moduleReference.expression), name: "*" });
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) link(node, node.argument.literal, false);
      else if (ts.isVariableDeclaration(node)) {
        let declarationScope = scope;
        if (ts.isVariableDeclarationList(node.parent) && !(node.parent.flags & ts.NodeFlags.BlockScoped)) while (!declarationScope.function && declarationScope.parent) declarationScope = declarationScope.parent;
        bindPattern(declarationScope, node.name);
        if (ts.isIdentifier(node.name)) {
          if (node.initializer) declarationScope.bindings.set(node.name.text, { expression: node.initializer });
          const statement = node.parent?.parent;
          if (statement && ts.isVariableStatement(statement) && statement.parent === source && modifier(statement, ts.SyntaxKind.ExportKeyword)) record.exports.set(node.name.text, { expression: node.initializer });
        } else if (ts.isObjectBindingPattern(node.name) && node.initializer) {
          for (const element of node.name.elements) if (ts.isIdentifier(element.name) && !element.dotDotDotToken) declarationScope.bindings.set(element.name.text, { object: node.initializer, property: element.propertyName ? propertyName(element.propertyName) : element.name.text });
        }
      } else if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) link(node, node.arguments[0]);
        else if (["glob", "globEager"].includes(member(node.expression)) && ts.isMetaProperty(node.expression.expression) && node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword) {
          const argument = unwrapped(node.arguments[0]);
          const patterns = argument && ts.isArrayLiteralExpression(argument) ? argument.elements.map(literal) : [literal(argument)];
          if (!patterns.length || patterns.some((value) => value === undefined)) record.hazards.push({ code: "DYNAMIC_MODULE_LOADER", node, message: "import.meta.glob requires literal patterns." });
          else {
            const matches = new Set();
            try {
              for (const pattern of patterns.filter((value) => !value.startsWith("!"))) {
                const rooted = pattern.startsWith("/") ? path.resolve(rootDir, "." + pattern) : path.resolve(path.dirname(file), pattern);
                if (!inside(rootDir, rooted)) throw new Error("Glob leaves audit root.");
                for (const match of fs.globSync(posix(rooted))) matches.add(path.resolve(match));
              }
              for (const pattern of patterns.filter((value) => value.startsWith("!"))) {
                const rooted = path.resolve(path.dirname(file), pattern.slice(1));
                if (!inside(rootDir, rooted)) throw new Error("Glob exclusion leaves audit root.");
                for (const match of fs.globSync(posix(rooted))) matches.delete(path.resolve(match));
              }
              if (!matches.size) record.hazards.push({ code: "UNRESOLVED_GLOB", node, message: "Module glob matched no files." });
              for (const match of matches) if (fs.statSync(match).isFile()) record.imports.push({ node, specifier: "./" + posix(path.relative(path.dirname(file), match)), runtime: true });
            } catch (error) { record.hazards.push({ code: "UNRESOLVED_GLOB", node, message: error.message }); }
          }
        } else if ((ts.isIdentifier(node.expression) && ["eval", "Function", "importScripts"].includes(node.expression.text)) || (["eval", "Function", "importScripts", "require"].includes(member(node.expression)) && ts.isIdentifier(node.expression.expression) && ["globalThis", "window", "self", "global", "module"].includes(node.expression.expression.text))) record.hazards.push({ code: "OPAQUE_EXECUTABLE_LOADER", node, message: "Executable loading must have a statically audited dependency graph." });
      } else if (ts.isNewExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === "Function") || (member(node.expression) === "Function" && ts.isIdentifier(node.expression.expression) && ["globalThis", "window", "self"].includes(node.expression.expression.text)))) record.hazards.push({ code: "OPAQUE_EXECUTABLE_LOADER", node, message: "Constructed executable code cannot be audited statically." });
      if (ts.isIdentifier(node) && ["require", "eval", "Function", "importScripts"].includes(node.text)) {
        const parent = node.parent;
        const directCall = (ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression === node;
        const declarationName = (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node;
        const memberName = ts.isPropertyAccessExpression(parent) && parent.name === node;
        const typeReference = ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent);
        if (!directCall && !declarationName && !memberName && !typeReference) record.hazards.push({ code: "ALIASED_MODULE_LOADER", node, message: "Executable loader references must not be aliased or passed indirectly." });
      }
      if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && ["eval", "Function", "importScripts", "require"].includes(member(node)) && ts.isIdentifier(node.expression) && ["globalThis", "window", "self", "global", "module"].includes(node.expression.text)) {
        const parent = node.parent;
        if (!((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression === node)) record.hazards.push({ code: "ALIASED_MODULE_LOADER", node, message: "Global executable loaders must not be aliased or passed indirectly." });
      }
      ts.forEachChild(node, (child) => walk(child, scope));
    };
    walk(source);
    return record;
  }
  for (const sourceRoot of sourceRoots) listSources(localPath(sourceRoot));
  const queue = entryPoints.map(localPath);
  for (const file of queue) if (!fs.existsSync(file)) add("MISSING_WEB_ENTRY", file, undefined, "Configured web entry is missing.");
  // Resolve every production file, including isolated native adapters, without executing it.
  for (const record of files.values()) for (const link of record.imports) {
    link.resolved = resolve(link.specifier, record.file);
    const result = link.resolved;
    if (result.file && SCRIPT.test(result.file) && !result.asset) load(result.file);
  }
  while (queue.length) {
    const file = queue.shift();
    if (webFiles.has(file) || !fs.existsSync(file)) continue;
    webFiles.add(file);
    const record = load(file);
    for (const link of record.imports) {
      link.resolved ??= resolve(link.specifier, file);
      if (link.runtime && link.resolved.file && SCRIPT.test(link.resolved.file) && !link.resolved.asset) queue.push(link.resolved.file);
    }
  }
  // Native adapters are audited independently, even before a native entry exists.
  const runtimeQueue = [...webFiles, ...[...files.keys()].filter(isAdapter)];
  while (runtimeQueue.length) {
    const file = runtimeQueue.shift();
    if (runtimeFiles.has(file)) continue;
    runtimeFiles.add(file);
    const record = load(file);
    for (const link of record.imports) {
      link.resolved ??= resolve(link.specifier, file);
      if (link.runtime && link.resolved.file && SCRIPT.test(link.resolved.file) && !link.resolved.asset) runtimeQueue.push(link.resolved.file);
    }
  }
  const originImport = (record, specifier, name, seen) => {
    if (!specifier) return undefined;
    const clean = cleanSpecifier(specifier);
    const canonicalSpecifier = actualPackage(clean) + clean.slice(packageName(clean).length);
    const special = canonicalSpecifier.startsWith("three/") ? "three" : canonicalSpecifier;
    if (SPECIAL.has(special)) {
      if (name === "*" || (special === "react" && name === "default")) return special + ":*";
      if (SPECIAL.get(special).has(name)) return special + ":" + name;
      if (special === "three" && name === "default") { const renderer = /\/(WebGLRenderer|WebGPURenderer)\.[cm]?js$/u.exec(canonicalSpecifier)?.[1]; if (renderer) return "three:" + renderer; }
      return undefined;
    }
    const resolved = resolve(specifier, record.file);
    if (!resolved.file || resolved.asset || !SCRIPT.test(resolved.file)) return undefined;
    if (name === "*") return { moduleRecord: load(resolved.file) };
    return originExport(load(resolved.file), name, seen);
  };
  const originExport = (record, name, seen) => {
    const key = record.file + ":export:" + name;
    if (seen.has(key)) return undefined;
    seen = new Set([...seen, key]);
    const exported = record.exports.get(name);
    if (exported) return exported.expression ? origin(record, exported.expression, seen) : exported.specifier ? originImport(record, exported.specifier, exported.name, seen) : origin(record, exported.local, seen);
    for (const specifier of record.stars) { const found = originImport(record, specifier, name, seen); if (found) return found; }
    return undefined;
  };
  const origin = (record, expression, seen = new Set()) => {
    const node = unwrapped(expression);
    if (!node) return undefined;
    if (ts.isIdentifier(node)) {
      let scope = record.scopes.get(node) ?? record.scope;
      while (scope && !scope.bindings.has(node.text)) scope = scope.parent;
      if (!scope) return undefined;
      const key = record.file + ":scope:" + scope.id + ":local:" + node.text;
      if (seen.has(key)) return undefined;
      seen = new Set([...seen, key]);
      const binding = scope.bindings.get(node.text);
      if (binding.specifier) return originImport(record, binding.specifier, binding.name, seen);
      if (binding.object) return originMember(origin(record, binding.object, seen), binding.property, seen);
      if (binding.expression) return origin(record, binding.expression, seen);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      return originMember(origin(record, node.expression, seen), member(node), seen);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) return originImport(record, literal(node.arguments[0]), "*", seen);
    if (ts.isAwaitExpression(node)) return origin(record, node.expression, seen);
    return undefined;
  };
  const originMember = (base, name, seen) => {
    if (typeof base === "string" && base.endsWith(":*")) return base.slice(0, -1) + name;
    if (base?.moduleRecord && name !== undefined) return originExport(base.moduleRecord, name, seen);
    return undefined;
  };
  for (const record of files.values()) {
    const { file, source } = record;
    if (isNativeFile(file) && !isAdapter(file)) add("NATIVE_PROVIDER_OUTSIDE_ADAPTER", file, undefined, "Explicit native provider/source belongs in a declared native adapter root.");
    if (webFiles.has(file) && isNativeFile(file)) add("NATIVE_SOURCE_IN_WEB_GRAPH", file, undefined, "A native adapter/provider is reachable from a web entry.");
    if (runtimeFiles.has(file)) for (const hazard of record.hazards) add(hazard.code, file, hazard.node, hazard.message);
    for (const link of record.imports) {
      const result = link.resolved ?? resolve(link.specifier, file);
      const native = NATIVE.test(actualPackage(link.specifier)) || NATIVE.test(cleanSpecifier(link.specifier));
      if (REMOTE_SDK.test(actualPackage(link.specifier))) add("REMOTE_RUNTIME_SDK", file, link.node, "Remote executable update SDK is not allowed in the bundled runtime.");
      if (native && !isAdapter(file)) add("NATIVE_IMPORT_OUTSIDE_ADAPTER", file, link.node, "Native SDK import belongs in a native platform adapter: " + link.specifier);
      if (native && webFiles.has(file)) add("NATIVE_SDK_IN_WEB_GRAPH", file, link.node, "Native SDK is reachable from a web entry: " + link.specifier);
      if (runtimeFiles.has(file) && link.runtime) {
        if (result.remote) add("REMOTE_MODULE_IMPORT", file, link.node, "Remote executable imports are prohibited.");
        else if (result.outside) add("IMPORT_OUTSIDE_ROOT", file, link.node, "Resolved module leaves the audited root.");
        else if (result.unsupported) add("UNSUPPORTED_MODULE_LOADER", file, link.node, "Node/virtual loaders need an explicit audited build contract: " + link.specifier);
        else if (result.unresolved && !native) add("UNRESOLVED_IMPORT", file, link.node, "Cannot resolve module: " + link.specifier);
      }
      edges.push({ from: relative(file), specifier: link.specifier, runtime: link.runtime, ...(result.file ? { to: relative(result.file) } : { external: !!result.external }) });
    }
    const walk = (node) => {
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name && canonical.has(node.name.text) && file !== canonical.get(node.name.text)) add("DUPLICATE_GLOBE_FOUNDATION", file, node, "Canonical foundation is owned by " + relative(canonical.get(node.name.text)) + ".");
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && canonical.has(node.name.text) && node.initializer && (ts.isArrowFunction(unwrapped(node.initializer)) || ts.isFunctionExpression(unwrapped(node.initializer))) && file !== canonical.get(node.name.text)) add("DUPLICATE_GLOBE_FOUNDATION", file, node, "Canonical globe foundation must not be reimplemented.");
      let canvas = false;
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) canvas = origin(record, node.tagName) === "@react-three/fiber:Canvas";
      if (ts.isCallExpression(node)) {
        const factory = origin(record, node.expression);
        canvas ||= ["react:createElement", "react/jsx-runtime:jsx", "react/jsx-runtime:jsxs", "react/jsx-dev-runtime:jsxDEV"].includes(factory) && origin(record, node.arguments[0]) === "@react-three/fiber:Canvas";
        if (factory === "@react-three/fiber:createRoot") add("MANUAL_R3F_ROOT", file, node, "Use the canonical Canvas owner; extra R3F roots are forbidden.");
      }
      if (canvas) { canvasSites.push({ file: relative(file), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 }); if (!canvasOwners.has(file)) add("UNAPPROVED_CANVAS_OWNER", file, node, "R3F Canvas creation is outside the exact canonical owners."); }
      if (ts.isNewExpression(node) && ["three:WebGLRenderer", "three:WebGPURenderer"].includes(origin(record, node.expression))) add("MANUAL_RENDERER", file, node, "Renderer construction belongs to the existing R3F Canvas.");
      ts.forEachChild(node, walk);
    };
    walk(source);
    for (const [name, owner] of canonical) if (path.basename(file).replace(SCRIPT, "") === name && file !== owner) add("DUPLICATE_GLOBE_FOUNDATION", file, undefined, "Duplicate canonical foundation filename.");
  }
  for (const [name, file] of canonical) if (!files.has(file)) add("MISSING_GLOBE_FOUNDATION", file, undefined, "Canonical foundation missing from audited source: " + name);
  for (const owner of canvasOwners) {
    const count = canvasSites.filter((site) => site.file === relative(owner)).length;
    if (count !== 1) add("CANVAS_OWNER_COUNT", owner, undefined, "Expected one static Canvas creation in this canonical owner; observed " + count + ".");
  }
  function staticValue(node, source, locals, seen = new Set()) {
    node = unwrapped(node);
    if (!node) throw new Error("Missing static configuration value.");
    if (literal(node) !== undefined) return literal(node);
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node) && locals.has(node.text) && !seen.has(node.text)) return staticValue(locals.get(node.text), source, locals, new Set([...seen, node.text]));
    if (ts.isArrayLiteralExpression(node)) return node.elements.map((element) => staticValue(element, source, locals, seen));
    if (ts.isObjectLiteralExpression(node)) {
      const result = Object.create(null);
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) { const spread = staticValue(property.expression, source, locals, seen); if (!spread || typeof spread !== "object" || Array.isArray(spread)) throw new Error("Configuration spread is not a static object."); Object.assign(result, spread); }
        else if (ts.isPropertyAssignment(property) && propertyName(property.name) !== undefined) {
          if (propertyName(property.name) === "__proto__") throw new Error("Prototype declarations are not permitted in native configuration.");
          result[propertyName(property.name)] = staticValue(property.initializer, source, locals, seen);
        }
        else if (ts.isShorthandPropertyAssignment(property)) result[property.name.text] = staticValue(property.name, source, locals, seen);
        else throw new Error("Configuration properties must be statically resolvable.");
      }
      return result;
    }
    throw new Error("Native runtime configuration must be literal/static; executable configuration requires explicit review.");
  }
  for (const input of nativeConfigFiles) {
    const file = localPath(input);
    if (!fs.existsSync(file)) continue;
    nativeConfigs.push(relative(file));
    try {
      let config;
      if (file.endsWith(".json")) config = JSON.parse(fs.readFileSync(file, "utf8"));
      else {
        const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
        if (source.parseDiagnostics.length) throw new Error("Native configuration has syntax errors.");
        const locals = new Map();
        for (const statement of source.statements) {
          if (ts.isVariableStatement(statement)) {
            if (!(statement.declarationList.flags & ts.NodeFlags.Const)) throw new Error("Native configuration declarations must be const.");
            for (const declaration of statement.declarationList.declarations) {
              if (!ts.isIdentifier(declaration.name) || locals.has(declaration.name.text)) throw new Error("Native configuration needs unique static named declarations.");
              locals.set(declaration.name.text, declaration.initializer);
            }
          } else if (ts.isImportDeclaration(statement)) {
            if (!statement.importClause?.isTypeOnly && !(statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && !statement.importClause.name && statement.importClause.namedBindings.elements.length && statement.importClause.namedBindings.elements.every((element) => element.isTypeOnly))) throw new Error("Native configuration imports must be type-only; runtime imports are not evaluated.");
          } else if (!ts.isExportAssignment(statement) && !ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement) && !ts.isEmptyStatement(statement)) throw new Error("Native configuration mutations and executable statements are not permitted.");
        }
        const exported = source.statements.filter(ts.isExportAssignment);
        if (exported.length !== 1 || exported[0].isExportEquals) throw new Error("Native configuration needs one static default export.");
        for (const value of locals.values()) staticValue(value, source, locals);
        config = staticValue(exported[0].expression, source, locals);
      }
      if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Native configuration must be an object.");
      if (config.server && (Object.hasOwn(config.server, "url") || (Object.hasOwn(config.server, "allowNavigation") && (!Array.isArray(config.server.allowNavigation) || config.server.allowNavigation.length)))) add("REMOTE_NATIVE_RUNTIME", file, undefined, "Native server.url/allowNavigation is prohibited; bundle the canonical web runtime.");
      if (Object.keys(config.plugins ?? {}).some((name) => /live.?update|code.?push|capacitor.?updater/iu.test(name))) add("REMOTE_NATIVE_RUNTIME", file, undefined, "Executable update plugin configuration is prohibited.");
      if (typeof config.webDir !== "string" || !config.webDir || path.isAbsolute(config.webDir) || /^[a-z][a-z\d+.-]*:/iu.test(config.webDir) || !inside(rootDir, path.resolve(rootDir, config.webDir))) add("INVALID_BUNDLED_WEB_DIR", file, undefined, "webDir must identify a local build directory within the audited root.");
    } catch (error) { add("NATIVE_CONFIG_NOT_STATIC", file, undefined, error.message); }
  }
  const unique = [...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values()].sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code));
  return { pass: unique.length === 0, sourceFileCount: files.size, webReachableFileCount: webFiles.size, auditedRuntimeFileCount: runtimeFiles.size, importCount: edges.length, webEntries: entryPoints, adapterRoots, canonicalSceneFiles, canvasOwnerFiles, canvasSites, nativeConfigs, findings: unique, limitations: ["Static source ownership does not prove a single active globe/Canvas/renderer or preserved runtime identity; browser and native tests must verify those invariants.", "Third-party package contents, bundler plugins, generated artifacts, injected scripts and installed native binaries require separate build/artifact audits.", "Dependency resolution/loader enforcement covers reachable web and native-adapter runtime graphs; inactive source is still scanned for native SDK imports and duplicate scene ownership.", "Computed module loaders and non-static native runtime configuration fail closed; this is not a general JavaScript data-flow proof."] };
}

if (isLocalCliEntry(import.meta.url)) {
  try {
    const options = {};
    for (const argument of process.argv.slice(2)) {
      if (argument.startsWith("--root=")) options.rootDir = argument.slice(7);
      else if (argument.startsWith("--entry=")) (options.entryPoints ??= []).push(argument.slice(8));
      else if (argument.startsWith("--source=")) (options.sourceRoots ??= []).push(argument.slice(9));
      else throw new Error("Unknown argument: " + argument);
    }
    const result = runPlatformBoundaryAudit(options);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) { console.error(JSON.stringify({ pass: false, error: error.message })); process.exitCode = 2; }
}
