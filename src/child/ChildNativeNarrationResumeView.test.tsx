import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChildNativeMediaActions, ChildNativeNarrationResumeStatus, ChildNativeMediaView } from "./ChildNativeMediaView";
import { CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppSnapshot } from "./childNativeAppBridge";
import type { ChildNativeMediaAsset } from "./childNativeMedia";

// AUTHORED_NOT_RUN. These real component SSR cases prove presentation only.
// Browser effects/keyboard/touch/geometry, native admission and Play remain NOT_RUN.
const HASH = "a".repeat(64), TOKEN = "b".repeat(32);
const narration: ChildNativeMediaAsset = { assetId: "Narration.ONE",
  owner: { kind: "work", id: "Work.ONE", contentChecksum: HASH },
  entity: { kind: "narration", id: "Narration.ONE", contentChecksum: "c".repeat(64) }, mime: "audio/wav", role: "narration",
  altText: "Reviewed narration caption", transcript: "Reviewed fixture text." };
const image: ChildNativeMediaAsset = { ...narration, assetId: "Image.ONE", entity: { kind: "image", id: "Image.ONE", contentChecksum: HASH },
  mime: "image/png", role: "image", altText: "Reviewed image caption", transcript: null };
function controller(locale: "ru" | "en") {
  const state: ChildNativeAppSnapshot = { phase: "ready", status: "child", reason: null,
    context: { token: TOKEN, generation: 1, revision: 2, selectionRevision: 2, profileRevision: 2,
      policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
      mode: "child", profileId: "Reader.ONE", locale, package: { id: "Package.ONE", version: 1, checksum: HASH },
      home: { kind: "activity", id: "Home.ONE", contentChecksum: HASH }, remainingLifetimeMs: 30000 }, profiles: [] };
  const media = { list: vi.fn(async () => [narration]), present: vi.fn(async () => null),
    resumeNarration: vi.fn(async () => null), release: vi.fn(async () => true), releaseAll: vi.fn(async () => true) };
  const reading = { readReadingPosition: vi.fn(async () => null), rememberReadingPosition: vi.fn(async () => null) };
  const c = { getSnapshot: () => state, subscribe: vi.fn(() => () => undefined), media, reading,
    attachPresentationBarrier: vi.fn(() => () => undefined), start: vi.fn(async () => undefined), refresh: vi.fn(async () => undefined),
    perform: vi.fn(async () => false), suspend: vi.fn(async () => undefined), dispose: vi.fn(async () => undefined),
    readEntity: vi.fn(async () => null), search: vi.fn(async () => null), readCollection: vi.fn(async () => null),
    writeCollection: vi.fn(async () => null) } satisfies ChildNativeAppController;
  return c;
}
describe("S16 BIL009 narration resume accessible child presentation", () => {
  it("keeps ordinary image and narration opening alongside locale-specific explicit resume for canonical narration only", () => {
    const open = vi.fn(), resume = vi.fn();
    for (const language of ["ru", "en"] as const) {
      const markup = renderToStaticMarkup(<ChildNativeMediaActions assets={[image, narration]} language={language}
        disabled={false} resumeAvailable={true} onPresent={open} onResume={resume} />);
      expect(markup.match(/<button\b/gu)).toHaveLength(3); expect(markup.match(/type="button"/gu)).toHaveLength(3);
      expect(markup).toContain(language === "ru" ? "Открыть изображение" : "Open image");
      expect(markup).toContain(language === "ru" ? "Открыть озвучивание" : "Open narration");
      expect(markup).toContain(language === "ru" ? "Продолжить озвучивание с сохранённого места" : "Continue narration from your saved place");
      expect(markup).toContain(language === "ru" ? "Русский" : "English");
      expect(markup).not.toContain(language === "ru" ? "Continue narration" : "Продолжить озвучивание");
    }
    expect(open).not.toHaveBeenCalled(); expect(resume).not.toHaveBeenCalled();
  });
  it("offers no resume for an older host or a noncanonical collection owner while preserving ordinary opening", () => {
    for (const props of [{ assets: [narration], resumeAvailable: false },
      { assets: [{ ...narration, owner: { ...narration.owner, kind: "recent" as const } }], resumeAvailable: true }]) {
      const markup = renderToStaticMarkup(<ChildNativeMediaActions {...props} language="en" disabled={false} onPresent={() => undefined} onResume={() => undefined} />);
      expect(markup.match(/<button\b/gu)).toHaveLength(1); expect(markup).toContain("Open narration");
      expect(markup).not.toContain("Continue narration");
    }
  });
  it("disables all explicit native media actions while an existing request is pending", () => {
    const markup = renderToStaticMarkup(<ChildNativeMediaActions assets={[image, narration]} language="en" disabled={true}
      resumeAvailable={true} onPresent={() => undefined} onResume={() => undefined} />);
    expect(markup.match(/disabled=""/gu)).toHaveLength(3); expect(markup.match(/type="button"/gu)).toHaveLength(3);
    expect(markup).not.toMatch(/<(?:audio|video|canvas|iframe)\b/u); expect(markup).not.toMatch(/(?:autoplay|src|href)=/u);
  });
  it("describes prepared audio as requiring a separate device control in both locales without claiming playback", () => {
    for (const language of ["ru", "en"] as const) {
      const markup = renderToStaticMarkup(<ChildNativeNarrationResumeStatus language={language} phase="prepared" />);
      expect(markup).toContain('role="status"');
      expect(markup).toContain(language === "ru" ? "Озвучивание подготовлено с сохранённого места. Включите его кнопкой на устройстве."
        : "Narration is prepared at your saved place. Start it with the control on your device.");
      expect(markup).not.toMatch(/(?:playing|audible|completed|воспроизводится|прослушано|завершено)/u);
      expect(markup).not.toContain(TOKEN); expect(markup).not.toContain("Passage.B"); expect(markup).not.toContain("startFrame");
    }
  });
  it("keeps checking absence and refusal messages localized and honest without hidden autoplay or technical authority", () => {
    expect(renderToStaticMarkup(<ChildNativeNarrationResumeStatus language="en" phase="none" />)).toBe("");
    for (const language of ["ru", "en"] as const) {
      const checking = renderToStaticMarkup(<ChildNativeNarrationResumeStatus language={language} phase="reading" />);
      const absent = renderToStaticMarkup(<ChildNativeNarrationResumeStatus language={language} phase="absent" />);
      const refused = renderToStaticMarkup(<ChildNativeNarrationResumeStatus language={language} phase="unavailable" />);
      expect(checking).toContain(language === "ru" ? "Проверяем сохранённое место" : "Checking your saved place");
      expect(absent).toContain(language === "ru" ? "Сохранённого места пока нет" : "There is no saved place yet");
      expect(refused).toContain(language === "ru" ? "Сохранённое место сейчас недоступно" : "Your saved place is unavailable right now");
      for (const markup of [checking, absent, refused]) {
        expect(markup).toContain('role="status"'); expect(markup).not.toMatch(/(?:PCM|SHA|revision|grant|autoplay|contextToken)/u);
        expect(markup).not.toMatch(/<(?:audio|video|canvas|iframe)\b/u);
      }
    }
  });
  it("keeps the actual media view sealed before effects without render-time bookmark entity or preparation requests", () => {
    for (const language of ["ru", "en"] as const) {
      const c = controller(language);
      for (const contextToken of [TOKEN, "f".repeat(32)]) {
        const markup = renderToStaticMarkup(<ChildNativeMediaView controller={c} owner={narration.owner}
          contextToken={contextToken} language={language} />);
        expect(markup).toContain('data-child-native-media-phase="sealed"');
        expect(markup).not.toContain(narration.altText); expect(markup).not.toContain(narration.transcript!);
        expect(markup).not.toContain("Continue narration"); expect(markup).not.toContain("Продолжить озвучивание");
        expect(markup).not.toContain(narration.assetId); expect(markup).not.toContain(HASH);
        expect(markup).not.toMatch(/<(?:audio|video|canvas|iframe)\b/u);
      }
      expect(c.media.list).not.toHaveBeenCalled(); expect(c.media.present).not.toHaveBeenCalled();
      expect(c.media.resumeNarration).not.toHaveBeenCalled(); expect(c.reading.readReadingPosition).not.toHaveBeenCalled();
      expect(c.readEntity).not.toHaveBeenCalled(); expect(c.perform).not.toHaveBeenCalled();
    }
  });
});
