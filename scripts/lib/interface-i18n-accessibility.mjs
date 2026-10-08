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
  const interfaceLanguageBinding = (identifier) => {
    const binding = declarationOf(identifier);
    if (!binding || !ts.isBindingElement(binding) || binding.initializer || binding.dotDotDotToken
      || !ts.isObjectBindingPattern(binding.parent)) return null;
    const property = binding.propertyName ?? binding.name;
    if (!ts.isIdentifier(property) || property.text !== "language") return null;
    const variable = binding.parent.parent;
    if (!ts.isVariableDeclaration(variable) || !isConst(variable) || !variable.initializer) return null;
    const call = unwrap(variable.initializer);
    if (!ts.isCallExpression(call) || call.questionDotToken || call.arguments.length !== 0) return null;
    const imported = declarationOf(call.expression);
    if (!imported || !ts.isImportSpecifier(imported) || imported.isTypeOnly
      || (imported.propertyName ?? imported.name).text !== "useInterfaceLanguage") return null;
    const clause = imported.parent.parent;
    const declaration = clause.parent;
    return ts.isImportClause(clause) && !clause.isTypeOnly && ts.isImportDeclaration(declaration)
      && ts.isStringLiteral(declaration.moduleSpecifier)
      && declaration.moduleSpecifier.text.startsWith(".")
      && resolve(dirname(fileName), declaration.moduleSpecifier.text) === resolve(interfaceLanguagePath).replace(/\.tsx$/u, "") ? binding : null;
  };
  // Bind the condition to its locale declaration and Boolean value in English.
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
    if (!ts.isStringLiteralLike(literal) || !["ru", "en"].includes(literal.text)) return null;
    const binding = interfaceLanguageBinding(language);
    return binding ? { binding, value: (literal.text === "en") === (operator === ts.SyntaxKind.EqualsEqualsEqualsToken) } : null;
  };
  const numericParameters = new Map();
  const isNumericMapParameter = (parameter) => {
    if (numericParameters.has(parameter)) return numericParameters.get(parameter);
    if (!ts.isParameter(parameter) || parameter.initializer || parameter.dotDotDotToken
      || !ts.isIdentifier(parameter.name)) return false;
    const callback = parameter.parent, call = callback.parent;
    if (!ts.isArrowFunction(callback) || callback.parameters.length !== 1
      || callback.parameters[0] !== parameter || ts.isBlock(callback.body)
      || !ts.isCallExpression(call) || call.arguments.length !== 1 || call.arguments[0] !== callback
      || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== "map") return false;
    const array = unwrap(call.expression.expression);
    if (!ts.isArrayLiteralExpression(array) || array.elements.length === 0
      || !array.elements.every(ts.isNumericLiteral)) return false;
    // A fresh literal numeric array proves the input, but callback writes or direct
    // eval could replace that primitive. Refuse these anywhere in its body,
    // including eval identifiers wrapped in erased TypeScript assertions.
    let stable = true;
    const check = (node) => {
      if ((ts.isBinaryExpression(node)
        && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
        || ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
          && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))
        || ts.isForInStatement(node) || ts.isForOfStatement(node)
        || (ts.isIdentifier(node) && node.text === "eval")) stable = false;
      ts.forEachChild(node, check);
    };
    check(callback.body);
    numericParameters.set(parameter, stable);
    return stable;
  };
  // This is a proof string, never product output. Numeric inputs use a neutral
  // marker; immutable text is resolved only under the same locale declaration.
  const englishTemplateText = (input, binding, seen = new Set()) => {
    const node = unwrap(input);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
      return cyrillicPattern.test(node.text) ? null : node.text;
    }
    if (ts.isTemplateExpression(node)) {
      let text = node.head.text;
      if (cyrillicPattern.test(text)) return null;
      for (const span of node.templateSpans) {
        const value = englishTemplateText(span.expression, binding, seen);
        if (value === null || cyrillicPattern.test(span.literal.text)) return null;
        text += value + span.literal.text;
      }
      return text;
    }
    if (ts.isConditionalExpression(node)) {
      const condition = conditionInEnglish(node.condition);
      return condition?.binding === binding
        ? englishTemplateText(condition.value ? node.whenTrue : node.whenFalse, binding, seen) : null;
    }
    if (!ts.isIdentifier(node)) return null;
    const declaration = declarationOf(node);
    if (!declaration || seen.has(declaration)) return null;
    if (isNumericMapParameter(declaration)) return "0";
    if (!ts.isVariableDeclaration(declaration) || !isConst(declaration) || !declaration.initializer) return null;
    return englishTemplateText(declaration.initializer, binding, new Set([...seen, declaration]));
  };
  const find = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && ["t", "translateInterfaceText"].includes(node.expression.text)) return [];
    if (ts.isConditionalExpression(node)) {
      const english = conditionInEnglish(node.condition);
      if (english !== null) {
        const branch = unwrap(english.value ? node.whenTrue : node.whenFalse);
        // Only literal/template arms with fully proven substitutions can exempt Russian.
        if (ts.isStringLiteralLike(branch) || ts.isTemplateExpression(branch)) {
          const text = englishTemplateText(branch, english.binding);
          if (text !== null && text.trim()) return [];
        }
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
