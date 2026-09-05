import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const edition = vi.hoisted(() => ({ controlled: true }));
vi.mock("../platform/distribution", () => ({
  get isControlledWebEdition() { return edition.controlled; },
  canonicalJournalOrigin: "https://probpera.ru",
}));

import {
  InterfaceLanguageProvider,
  resolveInitialInterfaceLanguage,
  useInterfaceLanguage,
} from "./InterfaceLanguage";

afterEach(() => { vi.unstubAllGlobals(); edition.controlled = true; });

function renderLanguage(stored: unknown, route: unknown, preferences: readonly string[]) {
  const getItem = vi.fn(() => stored);
  const setItem = vi.fn();
  vi.stubGlobal("window", { localStorage: { getItem, setItem }, navigator: { languages: preferences } });
  vi.stubGlobal("document", { documentElement: { dataset: { routeLanguage: route } } });
  function Consumer() { return <span>{useInterfaceLanguage().language}</span>; }
  const html = renderToStaticMarkup(<InterfaceLanguageProvider><Consumer /></InterfaceLanguageProvider>);
  return { html, getItem, setItem };
}

describe("controlled PWA initial locale negotiation", () => {
  it.each([
    ["ru", "ru"], ["ru-RU", "ru"], ["RU-cyrl-RU", "ru"], ["ru-u-nu-latn", "ru"],
    ["en", "en"], ["en-US", "en"], ["EN-latn-GB", "en"], ["en-u-ca-gregory", "en"],
    ["fr-FR", "en"], ["uk-UA", "en"], ["rue", "en"], ["enochian", "en"],
  ])("resolves proper BCP47 preference %s to %s", (preferred, expected) => {
    expect(resolveInitialInterfaceLanguage(null, undefined, [preferred])).toBe(expected);
  });

  it("uses the first valid preference and skips malformed tags", () => {
    expect(resolveInitialInterfaceLanguage(null, null, ["fr-FR", "ru-RU"])).toBe("en");
    expect(resolveInitialInterfaceLanguage(null, null, ["en-US", "ru-RU"])).toBe("en");
    expect(resolveInitialInterfaceLanguage(null, null, ["ru-RU", "en-US"])).toBe("ru");
    expect(resolveInitialInterfaceLanguage(null, null, ["ru_RU", "not a tag", "ru-Cyrl-RU"])).toBe("ru");
    expect(resolveInitialInterfaceLanguage(null, null, ["", "_", "en--US", "en-US"])).toBe("en");
  });

  it("uses English for empty or entirely invalid controlled preferences", () => {
    expect(resolveInitialInterfaceLanguage(null, null, [])).toBe("en");
    expect(resolveInitialInterfaceLanguage(null, null, ["", "ru_RU", "ru-", " ru "])).toBe("en");
  });

  it("retains explicit route and stored-choice precedence before browser preferences", () => {
    expect(resolveInitialInterfaceLanguage("en", "ru", ["en-US"])).toBe("ru");
    expect(resolveInitialInterfaceLanguage("ru", "en", ["ru-RU"])).toBe("en");
    expect(resolveInitialInterfaceLanguage("ru", undefined, ["fr-FR"])).toBe("ru");
    expect(resolveInitialInterfaceLanguage("en", undefined, ["ru-RU"])).toBe("en");
  });

  it("keeps existing callers and public-site defaults unchanged", () => {
    expect(resolveInitialInterfaceLanguage(null, undefined)).toBe("ru");
    expect(resolveInitialInterfaceLanguage("invalid", "invalid")).toBe("ru");
    expect(resolveInitialInterfaceLanguage("en", undefined)).toBe("en");
    edition.controlled = false;
    expect(renderLanguage(null, undefined, ["fr-FR"]).html).toBe("<span>ru</span>");
    expect(renderLanguage("en", undefined, ["ru-RU"]).html).toBe("<span>en</span>");
  });

  it.each([
    [null, undefined, ["ru-RU"], "ru"],
    [null, undefined, ["en-US"], "en"],
    [null, undefined, ["fr-FR", "ru-RU"], "en"],
    [null, undefined, [], "en"],
    ["ru", "en", ["ru-RU"], "en"],
    ["ru", undefined, ["en-US"], "ru"],
  ])("resolves language during the existing provider's initial render", (stored, route, preferences, expected) => {
    const result = renderLanguage(stored, route, preferences as string[]);
    expect(result.html).toBe(`<span>${expected}</span>`);
    expect(result.getItem).toHaveBeenCalledExactlyOnceWith("probpera-interface-language");
    expect(result.setItem).not.toHaveBeenCalled();
  });

  it("does not read browser globals during server rendering", () => {
    function Consumer() { return <span>{useInterfaceLanguage().language}</span>; }
    expect(renderToStaticMarkup(<InterfaceLanguageProvider><Consumer /></InterfaceLanguageProvider>))
      .toBe("<span>ru</span>");
  });
});
