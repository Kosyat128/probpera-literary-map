import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import { ParentChildLocaleLockControl } from "./ParentChildLocaleLockControl";
import { CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppSnapshot, type ChildNativeContext } from "./childNativeAppBridge";

// AUTHORED_NOT_RUN: actual component SSR only, no browser/OS/Gate execution.
function snapshot(locked?: boolean): ChildNativeAppSnapshot {
  return { phase: "ready", status: "child", reason: null,
    context: { token: "b".repeat(32), generation: 1, revision: 2, profileRevision: 2, selectionRevision: 2,
      policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
      mode: "child", profileId: "reader", locale: "en", package: { id: "package", version: 1, checksum: "a".repeat(64) }, home: { kind: "activity", id: "home", contentChecksum: "a".repeat(64) }, remainingLifetimeMs: 30_000 },
    profiles: [{ id: "reader", label: "Synthetic reader", exactAge: 9, locale: "en", ...(locked === undefined ? {} : { localeLocked: locked }) }] };
}
function render(value: ChildNativeAppSnapshot, language: "ru" | "en", disabled = false, expectedContext: ChildNativeContext | null = value.context) {
  const request = vi.fn(), persist = vi.fn(async () => false);
  const markup = renderToStaticMarkup(<InterfaceLanguageProvider hostLanguage={{ initialLanguage: language, persist }}>
    <ParentChildLocaleLockControl snapshot={value} expectedContext={expectedContext} disabled={disabled} onRequest={request} />
  </InterfaceLanguageProvider>);
  return { markup, request, persist };
}
describe("S16 BIL009 parent language lock presentation", () => {
  it.each(["ru", "en"] as const)("shows authenticated lock readback and keeps parent unlock available in %s", language => {
    const result = render(snapshot(true), language), html = result.markup;
    expect(html).toContain('data-child-native-locale-lock="locked"'); expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain(language === "ru" ? "Фиксация языка включена." : "Language lock is on.");
    expect(html).toContain(language === "ru" ? '<button type="button" disabled="">Зафиксировать язык со взрослым</button>' : '<button type="button" disabled="">Lock language with an adult</button>');
    expect(html).toContain(language === "ru" ? '<button type="button">Снять фиксацию со взрослым</button>' : '<button type="button">Unlock language with an adult</button>');
    expect(result.request).not.toHaveBeenCalled(); expect(result.persist).not.toHaveBeenCalled();
  });
  it.each(["ru", "en"] as const)("shows strict unlocked readback with parent lock available in %s", language => {
    const html = render(snapshot(false), language).markup;
    expect(html).toContain('data-child-native-locale-lock="unlocked"');
    expect(html).toContain(language === "ru" ? "Фиксация языка выключена." : "Language lock is off.");
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).not.toContain("select"); expect(html).not.toContain("input");
  });
  it.each(["ru", "en"] as const)("keeps legacy absence unknown rather than unlocked in %s", language => {
    const html = render(snapshot(), language).markup;
    expect(html).toContain('data-child-native-locale-lock="unknown"');
    expect(html).toContain(language === "ru" ? "Фиксация языка пока не подтверждена." : "The language lock has not been confirmed.");
    expect(html).not.toContain('disabled=""'); expect(html).not.toContain('data-child-native-locale-lock="unlocked"');
  });
  it("disables both proposals while a parent operation is pending", () => {
    expect(render(snapshot(), "en", true).markup.match(/disabled=""/g)).toHaveLength(2);
  });
  it("hides stale readback rather than displaying an unlocked state", () => {
    const value = snapshot(false);
    expect(render(value, "en", false, { ...value.context! }).markup).toBe("");
  });
  it("renders no control for retired adult sibling or mismatched locale snapshots", () => {
    const value = snapshot(true);
    for (const changed of [{ ...value, phase: "transition" as const }, { ...value, context: null },
      { ...value, context: { ...value.context!, mode: "adult" as const } },
      { ...value, context: { ...value.context!, profileId: "sibling" } },
      { ...value, context: { ...value.context!, locale: "ru" as const } }]) {
      const result = render(changed, "en"); expect(result.markup).toBe(""); expect(result.request).not.toHaveBeenCalled();
    }
  });
});
