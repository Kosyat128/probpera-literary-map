import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as canonical from "../i18n/InterfaceLanguage";
import type { InterfaceLanguage as CanonicalLanguage } from "../i18n/InterfaceLanguage";
import * as shared from "./localization";
import type { InterfaceLanguage, InterfaceTranslationAudit } from "./localization";
import type { WorkLocale, WriterBiographyLocale } from "./types";

// Locale access must not evaluate the demand-loaded country/book/globe payload.
vi.mock("../data/countries", () => { throw new Error("Country payload evaluated by localization entry"); });
vi.mock("../data/countries/index", () => { throw new Error("Editorial payload evaluated by localization entry"); });
vi.mock("../data/bookArchive", () => { throw new Error("Book payload evaluated by localization entry"); });
vi.mock("../components/LiteraryGlobe", () => { throw new Error("Globe evaluated by localization entry"); });
vi.mock("three", () => { throw new Error("3D runtime evaluated by localization entry"); });

describe("shared canonical localization boundary", () => {
  it("reuses the exact provider, hook, translations, plural and audit functions", () => {
    for (const name of Object.keys(shared) as Array<keyof typeof shared>) {
      expect(shared[name]).toBe(canonical[name]);
    }
    expect(shared.InterfaceLanguageProvider).toBe(canonical.InterfaceLanguageProvider);
    expect(shared.useInterfaceLanguage).toBe(canonical.useInterfaceLanguage);
    expect(shared.translateInterfaceText).toBe(canonical.translateInterfaceText);
    expect(shared.selectInterfacePlural).toBe(canonical.selectInterfacePlural);
  });

  it.each([
    ["canonical provider", canonical.InterfaceLanguageProvider],
    ["shared provider", shared.InterfaceLanguageProvider],
  ] as const)("%s serves both import paths through one context value", (_name, Provider) => {
    function Consumer() {
      const original = canonical.useInterfaceLanguage();
      const facade = shared.useInterfaceLanguage();
      expect(facade).toBe(original);
      expect(facade.setLanguage).toBe(original.setLanguage);
      expect(facade.t).toBe(original.t);
      return createElement("span", { lang: facade.language }, facade.t("Закрыть"));
    }
    const output = renderToString(createElement(Provider, { children: createElement(Consumer) }));
    expect(output).toContain('lang="ru"');
    expect(output).toContain(shared.translateInterfaceText("Закрыть", "ru"));
  });

  it("retains exact RU/EN types across UI, work and biography boundaries", () => {
    expectTypeOf<InterfaceLanguage>().toEqualTypeOf<CanonicalLanguage>();
    expectTypeOf<InterfaceLanguage>().toEqualTypeOf<"ru" | "en">();
    expectTypeOf<InterfaceLanguage>().toEqualTypeOf<WorkLocale>();
    expectTypeOf<InterfaceLanguage>().toEqualTypeOf<WriterBiographyLocale>();
    expectTypeOf(shared.translateInterfaceText).parameters.toEqualTypeOf<[string, InterfaceLanguage]>();
    expectTypeOf(shared.translateInterfaceText).returns.toEqualTypeOf<string>();
    expectTypeOf(shared.auditInterfaceTranslations).returns.toEqualTypeOf<InterfaceTranslationAudit>();
    expectTypeOf<ReturnType<typeof shared.useInterfaceLanguage>["language"]>().toEqualTypeOf<InterfaceLanguage>();
  });

  it("uses existing critical interaction units without inserting a second string catalog", () => {
    for (const text of ["Закрыть", "Обновить", "Нет сети - доступны уже открытые материалы"]) {
      expect(shared.hasInterfaceTranslation(text)).toBe(true);
      for (const locale of ["ru", "en"] as const) {
        const translated = shared.translateInterfaceText(text, locale);
        expect(translated).toBe(canonical.translateInterfaceText(text, locale));
        expect(translated.trim()).not.toBe("");
      }
    }
  });

  it("preserves route priority and the existing plural API without claiming ICU support", () => {
    expect(shared.resolveInitialInterfaceLanguage("ru", "en")).toBe("en");
    expect(shared.resolveInitialInterfaceLanguage("en", undefined)).toBe("en");
    expect(shared.resolveInitialInterfaceLanguage(undefined, undefined)).toBe("ru");
    const forms = ["one", "few", "many"] as const;
    for (const locale of ["ru", "en"] as const) {
      for (const count of [0, 1, 2, 5, 11, 21, 22, 25]) {
        expect(shared.selectInterfacePlural(count, locale, forms)).toBe(canonical.selectInterfacePlural(count, locale, forms));
      }
    }
    expect(shared.selectInterfacePlural(2, "ru", forms)).toBe("few");
    expect(shared.selectInterfacePlural(2, "en", forms)).toBe("many");
  });
});
