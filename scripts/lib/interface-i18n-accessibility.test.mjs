import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { createAccessibilityCyrillicFinder } from "./interface-i18n-accessibility.mjs";

const hookImport = 'import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";';
function findings(body, imports = hookImport) {
  const source = ts.createSourceFile(resolve("src/fixtures/audit-probe.tsx"),
    `${imports}\n${body}`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  expect(source.parseDiagnostics).toEqual([]);
  const find = createAccessibilityCyrillicFinder(source, resolve("src/i18n/InterfaceLanguage.tsx"));
  const result = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) result.push(...find(node.initializer));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}
const view = (expression, declarations = 'const { language } = useInterfaceLanguage();') =>
  `function View() { ${declarations} return <button aria-label={${expression}} />; }`;

describe("interface accessibility AST locale branches", () => {
  it.each([
    'language === "ru" ? "Коллекция" : "Collection"',
    'language === "en" ? "Collection" : "Коллекция"',
    '"ru" !== language ? "Collection" : "Коллекция"',
    '(language) !== "en" ? "Коллекция" : ("Collection")',
  ])("accepts the real interface-language binding: %s", (expression) => {
    expect(findings(view(expression))).toEqual([]);
  });

  it("accepts the existing nested state branches with an immutable locale alias", () => {
    expect(findings(view(`walk.active ? ru ? "Остановить прогулку" : "Stop walking"
      : walk.reducedMotion ? ru ? "Включено уменьшенное движение" : "Reduced motion is enabled"
      : open ? ru ? "Сверните подсказки" : "Collapse tips"
      : ru ? "Короткая прогулка" : "A short walk"`,
    'const { language } = useInterfaceLanguage(); const ru = language === "ru";'))).toEqual([]);
  });

  it("resolves import and destructuring aliases by symbol", () => {
    expect(findings(view('russian ? "Карта" : "Map"',
      'const { language: chosen } = useLocale(); const russian = chosen === "ru";'),
    'import { useInterfaceLanguage as useLocale } from "../i18n/InterfaceLanguage";')).toEqual([]);
  });

  it.each([
    ['const ru = true;', 'ru'],
    ['const language = "ru";', 'language === "ru"'],
    ['const { language } = useInterfaceLanguage(); let ru = language === "ru";', 'ru'],
    ['let { language } = useInterfaceLanguage();', 'language === "ru"'],
    ['const { language } = useInterfaceLanguage();', 'language == "ru"'],
    ['const { language } = useInterfaceLanguage();', 'language === "fr"'],
    ['const { language } = useInterfaceLanguage();', 'ready || language === "ru"'],
  ])("rejects an unproven language condition: %s / %s", (declarations, condition) => {
    expect(findings(view(`${condition} ? "Нельзя скрыть" : "English"`, declarations))).toContain("Нельзя скрыть");
  });

  it("rejects a hook imported from a different module", () => {
    expect(findings(view('language === "ru" ? "Утечка" : "English"'),
      'import { useInterfaceLanguage } from "../fake/InterfaceLanguage";')).toContain("Утечка");
  });

  it("rejects shadowed locale and Boolean alias parameters", () => {
    expect(findings(`function View() {
      const { language } = useInterfaceLanguage(); const ru = language === "ru";
      const first = (language) => <button title={language === "ru" ? "Чужой язык" : "English"} />;
      const second = (ru) => <button title={ru ? "Чужой флаг" : "English"} />;
      return first;
    }`)).toEqual(["Чужой язык", "Чужой флаг"]);
  });

  it("rejects a locally shadowed hook despite its familiar name", () => {
    expect(findings(`function View(useInterfaceLanguage) {
      const { language } = useInterfaceLanguage();
      return <button title={language === "ru" ? "Утечка" : "English"} />;
    }`)).toContain("Утечка");
  });

  it.each(['"English с утечкой"', '`English ${name} с утечкой`'])
  ("reports Cyrillic in the English arm: %s", (english) => {
    const leaks = findings(view(`language === "ru" ? "Карта" : ${english}`));
    expect(leaks.some((text) => text.includes("с утечкой"))).toBe(true);
  });

  it.each(['""', '"   "', 'englishLabel', 'getEnglishLabel()'])
  ("does not exempt opaque or empty English arms: %s", (english) => {
    expect(findings(view(`language === "ru" ? "Карта" : ${english}`))).toContain("Карта");
  });

  it("continues checking a non-language fallback beside a valid localized pair", () => {
    expect(findings(view('ready ? (language === "ru" ? "Карта" : "Map") : "Всегда русский"')))
      .toEqual(["Всегда русский"]);
  });

  it("retains literal refusals and the existing explicit translation-call contract", () => {
    expect(findings(`function View() { return <>
      <img alt="Без перевода" />
      <button title={t("Карта")} aria-label={translateInterfaceText("Карта", "en")} />
      <input placeholder={otherFunction("Утечка в вызове")} />
    </>; }`)).toEqual(["Без перевода", "Утечка в вызове"]);
  });
});
