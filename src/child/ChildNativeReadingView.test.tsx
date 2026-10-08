import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChildNativeReadingView, childReadingLabels } from "./ChildNativeReadingView";
import type { ChildNativeAppSnapshot } from "./childNativeAppBridge";
import type { ChildReadingHost } from "./childReadingSession";
import type { ChildEntityPayload } from "./childPackage";
const hash = "a".repeat(64), reference = { kind: "activity" as const, id: "Chapter-A", contentChecksum: hash };
const payload: ChildEntityPayload = { title: "Original", text: "<First>\nSecond", terms: [], references: [], readingAnchors: {
  schemaVersion: 1, anchorVersion: 3, segments: [{ anchorId: "Opening", text: "<First>\n" }, { anchorId: "End", text: "Second" }], narration: null } };
function fixture(language: "ru" | "en" = "en") {
  const reading = { readReadingPosition: vi.fn(async () => null), rememberReadingPosition: vi.fn(async () => null) };
  const snapshot: ChildNativeAppSnapshot = {
    phase: "ready", status: "child", reason: null, profiles: [], context: { token: "a".repeat(32), generation: 1,
      revision: 2, selectionRevision: 2, profileRevision: 2, policyVersion: "child-local-v2.1", policyChecksum: hash,
      mode: "child", profileId: "Reader-A", locale: language, remainingLifetimeMs: 50000,
      package: { id: "package", version: 1, checksum: hash }, home: reference } };
  const controller: ChildReadingHost = { reading, subscribe: () => () => undefined, getSnapshot: () => snapshot };
  return { reading, controller, props: { controller, reference, payload, contextToken: "a".repeat(32), language } };
}
describe("S16 BIL009 native reader position presentation", () => {
  it("has complete RU and EN actions with honest unknown and unconfirmed-save wording", () => {
    expect(Object.keys(childReadingLabels.ru)).toEqual(Object.keys(childReadingLabels.en));
    expect(childReadingLabels.ru.remember).toBe("Запомнить этот фрагмент");
    expect(childReadingLabels.en.remember).toBe("Remember this passage");
    expect(childReadingLabels.en.unknown).toContain("It has not been changed.");
    expect(childReadingLabels.en.saveError).toContain("could not be confirmed");
  });
  it("renders explicit aligned text safely with disabled initial actions and no RPC or invented saved position", () => {
    for (const language of ["ru", "en"] as const) {
      const f = fixture(language), markup = renderToStaticMarkup(<ChildNativeReadingView {...f.props}/>);
      expect(markup).toContain('data-child-native-reading="anchored"'); expect(markup).toContain("&lt;First&gt;");
      expect(markup).toContain("Second"); expect(markup).toContain('tabindex="-1"');
      expect((markup.match(/disabled=""/gu) ?? []).length).toBe(2);
      expect(markup).toContain(childReadingLabels[language].checking); expect(markup).toContain(childReadingLabels[language].remember);
      expect(markup).not.toContain(childReadingLabels[language].continue);
      expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
    }
  });
  it("preserves original plain text when signed anchors or the real reading port are absent", () => {
    const f = fixture(), legacy = { title: payload.title, text: payload.text, terms: [], references: [] };
    const noPort: ChildReadingHost = { getSnapshot: f.controller.getSnapshot, subscribe: f.controller.subscribe };
    for (const markup of [
      renderToStaticMarkup(<ChildNativeReadingView {...f.props} payload={legacy}/>),
      renderToStaticMarkup(<ChildNativeReadingView {...f.props} controller={noPort}/>),
    ]) { expect(markup).toBe('<p class="child-native-text">&lt;First&gt;\nSecond</p>'); expect(markup).not.toContain("<button"); }
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
  });
  it("clears text and controls for locale token package or CHILD context mismatch", () => {
    const f = fixture();
    expect(renderToStaticMarkup(<ChildNativeReadingView {...f.props} language="ru"/>)).toBe("");
    expect(renderToStaticMarkup(<ChildNativeReadingView {...f.props} contextToken={"b".repeat(32)}/>)).toBe("");
    for (const change of [{ package: null }, { mode: "adult" as const }, { remainingLifetimeMs: 0 }]) {
      const controller: ChildReadingHost = { ...f.controller, getSnapshot: () => {
        const native = f.controller.getSnapshot(); return { ...native, context: { ...native.context!, ...change } }; } };
      expect(renderToStaticMarkup(<ChildNativeReadingView {...f.props} controller={controller}/>)).toBe("");
    }
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
  });
  it("hides anchored legacy and no-port private text on same-token selected-owner or package replacement during render", () => {
    for (const change of [{ profileId: "Sibling" }, { package: { id: "successor-package", version: 1, checksum: hash } }]) {
      for (const legacy of [false, true]) for (const withPort of [false, true]) {
        const f = fixture(), original = f.controller.getSnapshot(), successor: ChildNativeAppSnapshot = {
          ...original, context: { ...original.context!, ...change } };
        let reads = 0;
        // Simulate retirement between the genuine constructor-context read and
        // the view snapshot read; neither DTO grants native authority.
        const controller: ChildReadingHost = { subscribe: f.controller.subscribe,
          ...(withPort ? { reading: f.reading } : {}), getSnapshot: () => ++reads === 1 ? original : successor };
        const text = legacy ? { title: payload.title, text: payload.text, terms: [], references: [] } : payload;
        expect(renderToStaticMarkup(<ChildNativeReadingView {...f.props} controller={controller} payload={text}/>)).toBe("");
        expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
      }
    }
  });
  it("refuses malformed explicit anchors without silently falling back to unreviewed text", () => {
    const f = fixture(), corrupt = { ...payload, readingAnchors: { ...payload.readingAnchors!, anchorVersion: 0 } };
    expect(renderToStaticMarkup(<ChildNativeReadingView {...f.props} payload={corrupt}/>)).toBe("");
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled();
  });
});
