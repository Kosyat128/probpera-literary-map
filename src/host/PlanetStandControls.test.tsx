import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import { createPlanetCompositionController } from "./planetComposition";
import { compositionCustomizationView } from "./planetCompositionPresentation";
import PlanetStandControls from "./PlanetStandControls";

const stops: Array<() => void> = [];
afterEach(() => { stops.splice(0).forEach(stop => stop()); });

function fixture() {
  const preferences = { persistence: "best-effort" as const,
    get: vi.fn(async () => null), set: vi.fn(async () => true), remove: vi.fn(async () => true) };
  const controller = createPlanetCompositionController({ preferences, enabled: true, access: "adult" });
  stops.push(controller.activate());
  const html = (language: "ru" | "en") => {
    const owner = { controller, snapshot: controller.getSnapshot() };
    const stand = compositionCustomizationView(owner, "stand");
    const background = compositionCustomizationView(owner, "background");
    return renderToStaticMarkup(<InterfaceLanguageProvider hostLanguage={{ initialLanguage: language, persist: async () => false }}>
      <PlanetStandControls controller={stand.controller} snapshot={stand.snapshot}
        backgroundController={background.controller} backgroundSnapshot={background.snapshot} onClose={controller.cancel} />
    </InterfaceLanguageProvider>);
  };
  return { controller, preferences, html };
}

// Actual component/server projection: no claim about DOM focus or a retained
// client hook. The browser regression exercises Cancel -> public Menu reopening
// on the same mounted component, plus actual focus and subsequent preview.
describe("Appearance tabs follow their existing composition owner", () => {
  it.each(["ru", "en"] as const)("shows an externally opened background with the correct controls in %s", language => {
    const f = fixture();
    expect(f.controller.open("background")).toBe(true);
    const html = f.html(language);
    expect(html).toContain('data-planet-background-panel=""');
    expect(html).toContain('data-planet-background-select=""');
    expect(html).toContain('data-planet-background-apply=""');
    expect(html).toContain('data-planet-background-cancel=""');
    expect(html).not.toContain('data-planet-stand-panel=""');
    expect(html).toContain(language === "ru" ? "Оформление глобуса" : "Globe appearance");
    expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("projects a public stand opening after background cancellation without retaining the closed editor", () => {
    const f = fixture();
    f.controller.open("background");
    expect(f.html("en")).toContain('data-planet-background-panel=""');
    f.controller.cancel();
    expect(f.html("en")).not.toContain('class="planet-stand-controls__panel"');
    expect(f.controller.open("stand")).toBe(true);
    const html = f.html("en");
    expect(html).toContain('data-planet-stand-panel=""');
    expect(html).toContain('data-planet-stand-select=""');
    expect(html).not.toContain('data-planet-background-panel=""');
    expect(f.preferences.set).not.toHaveBeenCalled();
  });
});
