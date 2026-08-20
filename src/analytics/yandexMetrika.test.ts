import { describe, expect, it } from "vitest";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  installYandexMetrika,
  parseYandexMetrikaCounterId,
  readAnalyticsConsent,
} from "./yandexMetrika";

class FakeDocument extends EventTarget {
  title = "Проба Пера";
  referrer = "https://yandex.ru/search/";
  prerendering = false;
  scripts: Array<Record<string, unknown>> = [];
  head = {
    appendChild: (script: Record<string, unknown>) => {
      this.scripts.push(script);
      return script;
    },
  };

  getElementById(id: string) {
    return this.scripts.find((script) => script.id === id) || null;
  }

  createElement() {
    return {} as HTMLScriptElement;
  }
}

class FakeWindow extends EventTarget {
  location = { href: "https://probpera.ru/" };
  ym?: ((...args: unknown[]) => void) & { a?: unknown[][] };
  history = {
    pushState: (_data: unknown, _unused: string, url?: string | URL | null) => {
      if (url) this.location.href = new URL(String(url), this.location.href).href;
    },
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => {
      if (url) this.location.href = new URL(String(url), this.location.href).href;
    },
  };
}

describe("Yandex Metrika SPA integration", () => {
  it("accepts only a positive safe numeric counter identifier", () => {
    expect(parseYandexMetrikaCounterId("12345678")).toBe(12345678);
    expect(parseYandexMetrikaCounterId(" 12345678 ")).toBe(12345678);
    expect(parseYandexMetrikaCounterId(12345678)).toBeNull();
    expect(parseYandexMetrikaCounterId("0")).toBeNull();
    expect(parseYandexMetrikaCounterId("counter-123")).toBeNull();
    expect(parseYandexMetrikaCounterId("9999999999999999")).toBeNull();
  });

  it("initializes once and records only real SPA URL changes", () => {
    const documentObject = new FakeDocument();
    const windowObject = new FakeWindow();
    const installation = installYandexMetrika({
      counterId: "12345678",
      enabled: true,
      documentObject: documentObject as unknown as Document,
      windowObject: windowObject as unknown as Window,
    });

    expect(installation.enabled).toBe(true);
    expect(documentObject.scripts).toHaveLength(1);
    expect(documentObject.scripts[0]).toMatchObject({
      id: "probpera-yandex-metrika",
      src: "https://mc.yandex.ru/metrika/tag.js",
      async: true,
    });
    expect(windowObject.ym?.a?.[0]).toEqual([
      12345678,
      "init",
      expect.objectContaining({ defer: true, webvisor: false }),
    ]);
    expect(windowObject.ym?.a?.[1]).toEqual([
      12345678,
      "hit",
      "https://probpera.ru/",
      {
        title: "Проба Пера",
        referer: "https://yandex.ru/search/",
      },
    ]);

    windowObject.dispatchEvent(new Event("probpera:navigation"));
    expect(windowObject.ym?.a).toHaveLength(2);
    windowObject.history.pushState({}, "", "/?book=morskoy-volk#books");
    expect(windowObject.ym?.a?.[2]).toEqual([
      12345678,
      "hit",
      "https://probpera.ru/?book=morskoy-volk#books",
      {
        title: "Проба Пера",
        referer: "https://probpera.ru/",
      },
    ]);
    windowObject.location.href = "https://probpera.ru/#journal";
    windowObject.dispatchEvent(new Event("hashchange"));
    expect(windowObject.ym?.a?.[3]).toEqual([
      12345678,
      "hit",
      "https://probpera.ru/#journal",
      {
        title: "Проба Пера",
        referer: "https://probpera.ru/?book=morskoy-volk#books",
      },
    ]);

    installation.stop();
    windowObject.location.href = "https://probpera.ru/#atlas";
    windowObject.dispatchEvent(new Event("hashchange"));
    expect(windowObject.ym?.a).toHaveLength(4);
  });

  it("fails closed when the counter is absent or invalid", () => {
    const documentObject = new FakeDocument();
    const windowObject = new FakeWindow();
    const installation = installYandexMetrika({
      counterId: "not-a-counter",
      enabled: true,
      documentObject: documentObject as unknown as Document,
      windowObject: windowObject as unknown as Window,
    });

    expect(installation.enabled).toBe(false);
    expect(documentObject.scripts).toHaveLength(0);
    expect(windowObject.ym).toBeUndefined();
  });

  it("treats missing, unavailable, or malformed consent as unknown", () => {
    expect(readAnalyticsConsent(null)).toBe("unknown");
    expect(readAnalyticsConsent({ getItem: () => null })).toBe("unknown");
    expect(readAnalyticsConsent({ getItem: () => "granted" })).toBe("granted");
    expect(readAnalyticsConsent({ getItem: () => "denied" })).toBe("denied");
    expect(readAnalyticsConsent({ getItem: () => "yes" })).toBe("unknown");
    expect(
      readAnalyticsConsent({
        getItem: (key) => {
          expect(key).toBe(ANALYTICS_CONSENT_STORAGE_KEY);
          throw new Error("storage disabled");
        },
      })
    ).toBe("unknown");
  });
});
