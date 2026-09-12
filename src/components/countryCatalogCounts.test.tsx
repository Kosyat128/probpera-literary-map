import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { bookArchiveCountries, countries } from "../data/countries";
import { buildBookArchive } from "../data/bookArchive";
import { isPublicBook } from "../data/bookQuality";
import WriterPanel from "./WriterPanel";

const settings = vi.hoisted(() => ({ language: "ru" as "ru" | "en" }));
vi.mock("../hooks/useSubscriptions", () => ({ useSubscriptions: () => ({ toggle: vi.fn(), isSubscribed: () => false }) }));
vi.mock("../i18n/InterfaceLanguage", async importOriginal => {
  const actual = await importOriginal<typeof import("../i18n/InterfaceLanguage")>();
  return { ...actual, useInterfaceLanguage: () => ({ language: settings.language,
    t: (text: string) => actual.translateInterfaceText(text, settings.language),
    countryName: (_code: string, name: string) => name,
    number: (value: number) => new Intl.NumberFormat(settings.language).format(value) }) };
});

const greekCountry = countries.find(country => country.id === "greece")!;
const greekBooks = buildBookArchive(bookArchiveCountries).filter(book => book.countryId === "greece");
const metric = (count: number | null, loading = false) => load(renderToStaticMarkup(
  <WriterPanel country={greekCountry} catalogWorkCount={count} catalogWorkCountLoading={loading} />
))(".country-metric--works");

describe("country work metric uses the full canonical catalog", () => {
  it.each(["ru", "en"] as const)("counts actual pending Greek books in %s without extending writer biographies", locale => {
    settings.language = locale;
    expect(greekBooks).toHaveLength(23);
    expect(greekBooks.filter(isPublicBook)).toHaveLength(0);
    const shown = metric(greekBooks.length);
    expect(shown.find("strong").text()).toBe("23");
    expect(shown.find("span").text()).toBe(locale === "ru" ? "произведения" : "works");
    expect(shown.attr("aria-busy")).toBe("false");
  });
  it("distinguishes pending loading, unavailable counts, and a confirmed zero", () => {
    const loading = metric(null, true);
    expect(loading.find("strong").text()).toBe("…");
    expect(loading.attr("aria-busy")).toBe("true");
    expect(metric(null).find("strong").text()).toBe("—");
    expect(metric(0).find("strong").text()).toBe("0");
  });
});
