import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import ShareLinks from "./ShareLinks";

const title = "Книги: «Чтение & разговор»";
const url = "/articles/reading/?edition=1&language=ru";

function renderShareLinks(variant?: "card" | "reader") {
  return load(
    renderToStaticMarkup(
      <InterfaceLanguageProvider>
        <ShareLinks title={title} url={url} variant={variant} />
      </InterfaceLanguageProvider>
    )
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("ShareLinks", () => {
  it("keeps all four named card actions in keyboard order and encodes the complete destination", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://probpera.ru/");
    const $ = renderShareLinks("card");
    const group = $(".share-links--card");
    const controls = group.find(".share-links__controls").children();

    expect(group.attr("role")).toBe("group");
    expect(group.attr("aria-label")).toContain(title);
    expect(group.children("span").text()).toBe("Поделиться");
    expect(controls).toHaveLength(4);
    expect(controls.map((_, element) => $(element).attr("aria-label")).get()).toEqual([
      "Поделиться во ВКонтакте",
      "Поделиться в Telegram",
      "Поделиться в Одноклассниках",
      "Копировать ссылку",
    ]);
    group.find("a").each((_, element) => {
      const anchor = $(element);
      const destination = new URL(anchor.attr("href")!);
      expect(destination.searchParams.get("url")).toBe(`https://probpera.ru${url}`);
      expect(destination.searchParams.get("title") ?? destination.searchParams.get("text")).toBe(title);
      expect(anchor.attr("target")).toBe("_blank");
      expect(anchor.attr("rel")).toContain("noreferrer");
    });
    expect(group.find("button").attr("type")).toBe("button");
    expect(group.find("svg")).toHaveLength(4);
    group.find("svg").each((_, element) => {
      expect($(element).attr("viewBox")).toBe("0 0 24 24");
      expect($(element).attr("aria-hidden")).toBe("true");
    });
  });

  it("defaults existing reader callers to the reader variant with identical sharing destinations", () => {
    const reader = renderShareLinks();
    const card = renderShareLinks("card");

    expect(reader(".share-links--reader")).toHaveLength(1);
    expect(reader(".share-links--card")).toHaveLength(0);
    expect(reader("a").map((_, element) => reader(element).attr("href")).get()).toEqual(
      card("a").map((_, element) => card(element).attr("href")).get()
    );
    expect(reader(".share-links__controls").children()).toHaveLength(4);
  });
});
