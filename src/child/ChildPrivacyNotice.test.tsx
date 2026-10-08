import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildPrivacyNotice } from "./ChildPrivacyNotice";

// AUTHORED_NOT_RUN. These source tests check presentation contracts only.
// Native keyboard activation, layout, child readability and legal approval
// require separate review; no installed-OS or data-custody acceptance is implied.
const cases = [
  { language: "ru" as const, title: "О твоих данных",
    fields: ["имя профиля", "возраст", "настройки", "избранное", "недавние материалы", "шаги путешествий", "значки", "скачанные маршруты"],
    parent: "подтверждение взрослого", separate: "удаляет его отдельно", help: "прочитать это вместе с тобой" },
  { language: "en" as const, title: "About your information",
    fields: ["profile name", "age", "settings", "favorites", "recent materials", "journey steps", "badges", "downloaded routes"],
    parent: "adult needs to confirm", separate: "deletes it separately", help: "read this with you" },
];
afterEach(() => { vi.unstubAllGlobals(); });

describe("read-only child privacy notice", () => {
  it.each(cases)("explains local records, adult controls and the separate saved copy in $language", ({ language, fields, parent, separate, help }) => {
    const html = renderToStaticMarkup(<ChildPrivacyNotice language={language} />);
    for (const field of fields) expect(html).toContain(field);
    expect(html).toContain(parent); expect(html).toContain(separate); expect(html).toContain(help);
    expect(html).toContain(language === "ru" ? "На этом устройстве" : "on this device");
    expect(html).toContain(language === "ru" ? "отдельная копия" : "separate copy");
  });
  it.each(cases)("uses one named native disclosure, initially collapsed, with $language text", ({ language, title }) => {
    const html = renderToStaticMarkup(<ChildPrivacyNotice language={language} />);
    expect(html).toMatch(/^<details\b/u); expect(html).toContain(`lang="${language}"`);
    expect(html).toContain(`<summary>${title}</summary>`);
    expect((html.match(/<summary>/gu) ?? []).length).toBe(1);
    expect(html).not.toMatch(/<details\b[^>]*\bopen(?:=|\s|>)/u);
    expect(html).not.toMatch(/<(?:a|button|form|input|select|textarea|iframe|script|img|audio|video)\b/u);
    expect(html).not.toContain('role="dialog"'); expect(html).not.toContain('role="button"');
    const other = cases.find(value => value.language !== language)!;
    expect(html).not.toContain(other.title);
  });
  it("renders either locale without network, telemetry or storage access", () => {
    const fetch = vi.fn(), beacon = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
    vi.stubGlobal("fetch", fetch); vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("localStorage", storage); vi.stubGlobal("sessionStorage", storage);
    for (const { language } of cases) renderToStaticMarkup(<ChildPrivacyNotice language={language} />);
    expect(fetch).not.toHaveBeenCalled(); expect(beacon).not.toHaveBeenCalled();
    for (const method of Object.values(storage)) expect(method).not.toHaveBeenCalled();
  });
});
