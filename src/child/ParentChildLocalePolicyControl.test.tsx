import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import { ParentChildLocalePolicyControl } from "./ParentChildLocalePolicyControl";
import { CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppSnapshot, type ChildNativeContext } from "./childNativeAppBridge";

// AUTHORED_NOT_RUN: actual component SSR only, no browser/native Gate.
function snapshot(configured = false): ChildNativeAppSnapshot {
  return { phase: "ready", status: "child", reason: null, context: { token: "b".repeat(32), generation: 1, revision: 2,
    profileRevision: 2, selectionRevision: 2, policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION,
    policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, mode: "child", profileId: "reader", locale: "en",
    package: { id: "package", version: 1, checksum: "a".repeat(64) }, home: { kind: "activity", id: "home", contentChecksum: "a".repeat(64) }, remainingLifetimeMs: 30_000 },
    profiles: [{ id: "reader", label: "Synthetic reader", exactAge: 9, locale: "en", localeLocked: true,
      ...(configured ? { localePolicy: { schemaVersion: 1, allowedLocales: ["ru", "en"] as const } } : {}) }] };
}
function render(value: ChildNativeAppSnapshot, language: "ru" | "en", disabled = false, expectedContext: ChildNativeContext | null = value.context) {
  const request = vi.fn(), persist = vi.fn(async () => false);
  const markup = renderToStaticMarkup(<InterfaceLanguageProvider hostLanguage={{ initialLanguage: language, persist }}>
    <ParentChildLocalePolicyControl snapshot={value} expectedContext={expectedContext} disabled={disabled} onRequest={request} />
  </InterfaceLanguageProvider>);
  return { markup, request, persist };
}
describe("S16 BIL009 parent allowed locale presentation", () => {
  it.each(["ru", "en"] as const)("shows legacy current-only readback with an explicit adult proposal in %s", language => {
    const result = render(snapshot(), language);
    expect(result.markup).toContain('data-child-native-locale-policy="current-only"');
    expect(result.markup).toContain(language === "ru" ? "Пока разрешён только текущий язык профиля." : "Only the profile&#x27;s current language is allowed for now.");
    expect(result.markup).toContain('<input type="checkbox" disabled="" checked=""/>');
    expect(result.request).not.toHaveBeenCalled(); expect(result.persist).not.toHaveBeenCalled();
  });
  it.each(["ru", "en"] as const)("shows saved languages with an unchanged disabled proposal while locked in %s", language => {
    const result = render(snapshot(true), language);
    expect(result.markup).toContain('data-child-native-locale-policy="configured"');
    expect(result.markup).toContain("Русский, English"); expect(result.markup.match(/checked=""/g)).toHaveLength(2);
    expect(result.markup).toContain('<button type="submit" disabled="">'); expect(result.request).not.toHaveBeenCalled();
  });
  it("disables the whole form during a native parent operation", () => {
    expect(render(snapshot(), "en", true).markup).toContain('<fieldset disabled="">');
  });
  it("hides stale retired adult sibling and mismatched-locale readbacks", () => {
    const value = snapshot(true);
    expect(render(value, "en", false, { ...value.context! }).markup).toBe("");
    for (const changed of [{ ...value, phase: "transition" as const }, { ...value, context: null },
      { ...value, context: { ...value.context!, mode: "adult" as const } },
      { ...value, context: { ...value.context!, profileId: "sibling" } },
      { ...value, context: { ...value.context!, locale: "ru" as const } }]) expect(render(changed, "en").markup).toBe("");
  });
});
