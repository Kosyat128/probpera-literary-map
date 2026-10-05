import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChildNativeDiscoveryPassportView, childDiscoveryPassportLabels } from "./ChildNativeDiscoveryPassportView";
import type { ChildNativeAppController } from "./childNativeAppBridge";
const discovery = { list: vi.fn(async () => null) }, passport = { read: vi.fn(async () => null), recordCountryOpen: vi.fn(async () => null) };
const controller = { discovery, passport } as unknown as ChildNativeAppController;
const props = { controller, contextToken: "a".repeat(32), profileId: "profile-a", view: "home" as const, visible: true, onRequestView: vi.fn(), onOpen: vi.fn() };
// AUTHORED_NOT_RUN. Actual interactions/lifecycle are covered by the authored original-App browser scenario.
describe("native child discovery/passport closed-first UI", () => {
  it("exposes equal RU/EN age-specific Home actions with private local passport wording", () => {
    expect(Object.keys(childDiscoveryPassportLabels.ru)).toEqual(Object.keys(childDiscoveryPassportLabels.en));
    for (const language of ["ru", "en"] as const) {
      const html = renderToStaticMarkup(<ChildNativeDiscoveryPassportView {...props} language={language} />);
      expect(html).toContain(childDiscoveryPassportLabels[language].writers); expect(html).toContain(childDiscoveryPassportLabels[language].books);
      expect(html).toContain(childDiscoveryPassportLabels[language].passport); expect(html).toContain('aria-busy="true"');
    }
  });
  it("does not fetch, credit study/open, persist or publish counts during rendering or while hidden", () => {
    const html = renderToStaticMarkup(<ChildNativeDiscoveryPassportView {...props} view="passport" language="en" />);
    expect(html).toContain(childDiscoveryPassportLabels.en.loading); expect(html).not.toContain('data-child-passport="private-local"');
    expect(renderToStaticMarkup(<ChildNativeDiscoveryPassportView {...props} visible={false} language="ru" />)).toBe("");
    expect(discovery.list).not.toHaveBeenCalled(); expect(passport.read).not.toHaveBeenCalled(); expect(passport.recordCountryOpen).not.toHaveBeenCalled();
  });
  it("keeps unavailable badge/route categories honest and carries no commerce or streak pressure", () => {
    for (const language of ["ru", "en"] as const) {
      expect(childDiscoveryPassportLabels[language].badgesUnavailable).toMatch(language === "ru" ? /недоступны/ : /unavailable/);
      expect(childDiscoveryPassportLabels[language].routesUnavailable).toMatch(language === "ru" ? /недоступны/ : /unavailable/);
    }
    expect(JSON.stringify(childDiscoveryPassportLabels)).not.toMatch(/buy|purchase|streak|leaderboard|купить/iu);
  });
});