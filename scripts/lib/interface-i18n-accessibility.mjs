import { dirname, resolve } from "node:path";
import ts from "typescript";

const cyrillicPattern = /[\u0400-\u04ff]/u;
const unwrap = (node) => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
const isConst = (declaration) => ts.isVariableDeclarationList(declaration.parent)
  && (declaration.parent.flags & ts.NodeFlags.Const) !== 0;

/** Bind local names without resolving imports, reading dependencies or emitting code.
 * Only the actual interface hook binding can exempt a static RU/EN pair. */
export function createAccessibilityCyrillicFinder(source, interfaceLanguagePath) {
  const fileName = resolve(source.fileName);
  const options = { noResolve: true, noLib: true, noEmit: true, types: [], jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options, true);
  host.getSourceFile = (name) => resolve(name) === fileName ? source : undefined;
  host.fileExists = (name) => resolve(name) === fileName;
  host.readFile = () => undefined;
  host.directoryExists = () => false;
  host.getDirectories = () => [];
  host.getCurrentDirectory = () => dirname(fileName);
  let checker;
  const declarationOf = (identifier) => {
    if (!ts.isIdentifier(identifier)) return undefined;
    checker ??= ts.createProgram([fileName], options, host).getTypeChecker();
    const declarations = checker.getSymbolAtLocation(identifier)?.declarations;
    return declarations?.length === 1 ? declarations[0] : undefined;
  };
  const isInterfaceLanguage = (identifier) => {
    const binding = declarationOf(identifier);
    if (!binding || !ts.isBindingElement(binding) || binding.initializer || binding.dotDotDotToken
      || !ts.isObjectBindingPattern(binding.parent)) return false;
    const property = binding.propertyName ?? binding.name;
    if (!ts.isIdentifier(property) || property.text !== "language") return false;
    const variable = binding.parent.parent;
    if (!ts.isVariableDeclaration(variable) || !isConst(variable) || !variable.initializer) return false;
    const call = unwrap(variable.initializer);
    if (!ts.isCallExpression(call) || call.questionDotToken || call.arguments.length !== 0) return false;
    const imported = declarationOf(call.expression);
    if (!imported || !ts.isImportSpecifier(imported) || imported.isTypeOnly
      || (imported.propertyName ?? imported.name).text !== "useInterfaceLanguage") return false;
    const clause = imported.parent.parent;
    const declaration = clause.parent;
    return ts.isImportClause(clause) && !clause.isTypeOnly && ts.isImportDeclaration(declaration)
      && ts.isStringLiteral(declaration.moduleSpecifier)
      && declaration.moduleSpecifier.text.startsWith(".")
      && resolve(dirname(fileName), declaration.moduleSpecifier.text) === resolve(interfaceLanguagePath).replace(/\.tsx$/u, "");
  };
  // Return the condition's Boolean value in English, or null when unproven.
  const conditionInEnglish = (input, seen = new Set()) => {
    const node = unwrap(input);
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node);
      if (!declaration || !ts.isVariableDeclaration(declaration) || !isConst(declaration)
        || !declaration.initializer || seen.has(declaration)) return null;
      seen.add(declaration);
      return conditionInEnglish(declaration.initializer, seen);
    }
    if (!ts.isBinaryExpression(node)) return null;
    const operator = node.operatorToken.kind;
    if (operator !== ts.SyntaxKind.EqualsEqualsEqualsToken
      && operator !== ts.SyntaxKind.ExclamationEqualsEqualsToken) return null;
    const left = unwrap(node.left), right = unwrap(node.right);
    const literal = ts.isStringLiteralLike(left) ? left : right;
    const language = literal === left ? right : left;
    if (!ts.isStringLiteralLike(literal) || !["ru", "en"].includes(literal.text)
      || !isInterfaceLanguage(language)) return null;
    return (literal.text === "en") === (operator === ts.SyntaxKind.EqualsEqualsEqualsToken);
  };
  const find = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && ["t", "translateInterfaceText"].includes(node.expression.text)) return [];
    if (ts.isConditionalExpression(node)) {
      const english = conditionInEnglish(node.condition);
      if (english !== null) {
        const branch = unwrap(english ? node.whenTrue : node.whenFalse);
        // Opaque values and blank or Cyrillic English arms cannot hide Russian text.
        if (ts.isStringLiteralLike(branch) && branch.text.trim() && !cyrillicPattern.test(branch.text)) return [];
      }
    }
    const findings = [];
    if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && cyrillicPattern.test(node.text)) findings.push(node.text);
    ts.forEachChild(node, (child) => { findings.push(...find(child)); });
    return findings;
  };
  return find;
}
