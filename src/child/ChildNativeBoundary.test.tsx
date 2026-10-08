import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import { PlatformServicesProvider } from "../platform/PlatformServices";
import type { PlatformServices } from "../platform/ports";
import { ChildNativeClosedView, ChildNativeReadyView, NativeProfileControls, NativeProfileExportControl, ParentChildExportStatus } from "./ChildNativeBoundary";
import { CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppSnapshot } from "./childNativeAppBridge";

// AUTHORED_NOT_RUN. Server presentation fixtures do not execute native owners,
// PIN UI, globe WebGL, browser effects or authenticated package admission.
const calls = vi.hoisted(() => ({ globe: vi.fn(), mascot: vi.fn() }));
vi.mock("../components/LiteraryWorldMap", () => ({ default: (props: unknown) => { calls.globe(props); return <div data-fixture-canonical-globe="" />; } }));
vi.mock("../host/PlanetMascotAvatar", () => ({ default: (props: unknown) => { calls.mascot(props); return <div data-fixture-booky="" />; } }));
const HASH = "a".repeat(64), TOKEN = "b".repeat(32);
function snapshot(status: ChildNativeAppSnapshot["status"] = "child", locale: "ru" | "en" = "en"): ChildNativeAppSnapshot {
  const mode = status === "adult" || status === "unenrolled" ? "adult" : "child", admitted = status === "child";
  return { phase: status === "unavailable" ? "sealed" : "ready", status, reason: status === "blocked-child" ? "missing-pins" : status === "unavailable" ? "corrupt" : null,
    context: status === "first-install-required" || status === "unavailable" ? null : { token: TOKEN, generation: 1, revision: 2, selectionRevision: 2, profileRevision: 2,
      policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, mode,
      profileId: "native-profile", locale, package: admitted ? { id: "native-package", version: 1, checksum: HASH } : null,
      home: admitted ? { kind: "activity", id: "home", contentChecksum: HASH } : null, remainingLifetimeMs: 30_000 },
    profiles: status === "first-install-required" || status === "unavailable" || status === "unenrolled" ? [] : [{ id: "native-profile", label: "Native saved profile", exactAge: 9, locale }] };
}
function controller(value: ChildNativeAppSnapshot) {
  return { getSnapshot: () => value, subscribe: () => () => undefined, attachPresentationBarrier: vi.fn(() => () => undefined),
    start: vi.fn(async () => undefined), refresh: vi.fn(async () => undefined), perform: vi.fn(async () => false), suspend: vi.fn(async () => undefined), dispose: vi.fn(async () => undefined),
    readEntity: vi.fn(async () => null), search: vi.fn(async () => null), readCollection: vi.fn(async () => null), writeCollection: vi.fn(async () => null) } satisfies ChildNativeAppController;
}
function services() {
  const preferences = { persistence: "durable" as const, get: vi.fn(async () => null), set: vi.fn(async () => false), remove: vi.fn(async () => false) };
  const state = Object.freeze({ connectivity: "online", visibility: "active" } as const);
  return { kind: "ios", channel: "appStore", preferences, getSnapshot: () => state, subscribe: () => () => undefined,
    getSystemLanguages: () => ["en"], openExternalLink: vi.fn(() => "blocked" as const) } satisfies PlatformServices;
}
function render(node: ReactNode, language: "ru" | "en" = "en", platform = services()) {
  return renderToStaticMarkup(<PlatformServicesProvider services={platform}><InterfaceLanguageProvider hostLanguage={{ initialLanguage: language, persist: async () => false }}>{node}</InterfaceLanguageProvider></PlatformServicesProvider>);
}
afterEach(() => { vi.clearAllMocks(); });

describe("LOCAL2 native child presentation boundary", () => {
  it("transition and unknown storage render a closed screen without native data or a globe", () => {
    for (const value of [{ ...snapshot("unavailable"), phase: "transition" as const, reason: null }, snapshot("unavailable")]) {
      const owner = controller(value), markup = render(<ChildNativeClosedView snapshot={value} controller={owner} />);
      expect(markup).toContain("data-child-native-phase"); expect(markup).not.toContain("data-fixture-canonical-globe"); expect(markup).not.toContain("data-child-native-profiles");
      expect(markup).not.toContain("Set up secure storage"); expect(owner.readEntity).not.toHaveBeenCalled(); expect(owner.perform).not.toHaveBeenCalled();
    }
    expect(calls.globe).not.toHaveBeenCalled();
  });
  it("first-install copy and button appear only for explicit first-install-required status in RU/EN", () => {
    const value = snapshot("first-install-required"), owner = controller(value);
    const en = render(<ChildNativeClosedView snapshot={value} controller={owner} />, "en");
    const ru = render(<ChildNativeClosedView snapshot={value} controller={owner} />, "ru");
    expect(en).toContain("Set up secure storage"); expect(en).toContain("Confirm the device owner"); expect(ru).toContain("Настроить защищённое хранение"); expect(ru).toContain("Подтвердите владельца устройства");
    expect(owner.perform).not.toHaveBeenCalled(); expect(owner.start).not.toHaveBeenCalled(); expect(calls.globe).not.toHaveBeenCalled();
  });
  it("authenticated blocked child exposes a closed parent-request pane and no child contents", () => {
    const value = snapshot("blocked-child"), owner = controller(value), markup = render(<ChildNativeClosedView snapshot={value} controller={owner} />);
    expect(markup).toContain("Child content is currently unavailable"); expect(markup).toContain("Ask an adult"); expect(markup).toContain("data-child-native-profiles");
    expect(markup).not.toContain("class=\"child-native-app\""); expect(markup).not.toContain("data-fixture-canonical-globe"); expect(markup).not.toContain("type=\"password\"");
    expect(owner.readEntity).not.toHaveBeenCalled(); expect(owner.readCollection).not.toHaveBeenCalled(); expect(owner.perform).not.toHaveBeenCalled();
  });
  it("the admitted child view uses the canonical globe with calm runtime props and no render-time fetch", () => {
    const value = snapshot(), owner = controller(value), platform = services(), markup = render(<ChildNativeReadyView snapshot={value} controller={owner} />, "en", platform);
    expect(markup).toContain("data-child-native-phase=\"ready\""); expect(markup).toContain("data-child-native-profile=\"native-profile\""); expect(markup).toContain("data-fixture-canonical-globe"); expect(markup).toContain("Mr. Booky");
    expect(calls.globe).toHaveBeenCalledOnce(); expect(calls.globe.mock.calls[0][0]).toMatchObject({ countries: [], childPresentation: true, mode: "immersive", forceLoad: true, bookyCalmMotion: true, runtimeActive: true, preserveSceneDuringReload: true });
    expect(calls.mascot.mock.calls[0][0]).toMatchObject({ calmMotion: true, active: true }); expect(owner.readEntity).not.toHaveBeenCalled(); expect(owner.search).not.toHaveBeenCalled();
    expect(platform.preferences.get).not.toHaveBeenCalled(); expect(platform.openExternalLink).not.toHaveBeenCalled();
  });
  it("ready view refuses blocked or corrupt state and never renders a child globe in those states", () => {
    for (const value of [snapshot("blocked-child"), snapshot("unavailable")]) {
      const owner = controller(value), markup = render(<ChildNativeReadyView snapshot={value} controller={owner} />);
      expect(markup).not.toContain("data-fixture-canonical-globe"); expect(markup).not.toContain("data-child-native-profile=\""); expect(owner.readEntity).not.toHaveBeenCalled();
    }
    expect(calls.globe).not.toHaveBeenCalled();
  });
  it("profile controls do not render a PIN secret form or execute an action during rendering", () => {
    const value = snapshot("adult"), owner = controller(value), markup = render(<NativeProfileControls controller={owner} snapshot={value} />);
    expect(markup).toContain("Profiles on this device"); expect(markup).toContain("aria-expanded=\"false\""); expect(markup).not.toContain("type=\"password\""); expect(markup).not.toContain("ageConfirmedAt");
    expect(owner.perform).not.toHaveBeenCalled(); expect(owner.readEntity).not.toHaveBeenCalled();
  });
});

describe("stable retained canonical shell",()=>{
 it("retains only an inert hidden globe for an already admitted profile while child UI/data are sealed",()=>{
  const value={...snapshot("unavailable"),phase:"transition" as const},owner=controller(value);
  const markup=render(<ChildNativeReadyView snapshot={value} controller={owner} retainedProfileId="native-profile"/>);
  expect(markup).toContain('data-native-child-retained="sealed"');expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain("data-fixture-canonical-globe");expect(markup).not.toContain("data-child-native-profile=");
  expect(markup).not.toContain("child-native-panel");expect(owner.readEntity).not.toHaveBeenCalled();
  expect(calls.globe.mock.calls[calls.globe.mock.calls.length-1]?.[0]).toMatchObject({childPresentation:true,runtimeActive:false});
 });
});
describe("original canonical resource recipient presentation",()=>{
 it("provides one resource owner and guarded hotspot proposal to the same RU/EN canonical globe",()=>{
  for(const language of ["ru","en"] as const){
   calls.globe.mockClear();const value=snapshot("child",language),owner=controller(value);
   const markup=render(<ChildNativeReadyView snapshot={value} controller={owner}/>,language);
   expect((markup.match(/data-fixture-canonical-globe/g)||[])).toHaveLength(1);
   const props=calls.globe.mock.calls[0][0] as {childResources:{getSnapshot():{phase:string}};onChildHotspot:unknown};
   expect(props.childResources.getSnapshot().phase).toBe("empty");expect(typeof props.onChildHotspot).toBe("function");
   expect(markup).not.toContain("planet-child-resource:");expect(owner.readEntity).not.toHaveBeenCalled();
  }
 });
});

// AUTHORED_NOT_RUN. Rendering verifies truthful RU/EN receipt presentation only.
describe("parent child-data export presentation", () => {
  const receipt = (outcome: "saved" | "cancelled" | "error" = "saved") => ({ requestId: "c".repeat(32), profileId: "native-profile",
    schemaVersion: 1 as const, sha256: outcome === "saved" ? HASH : null, bytes: outcome === "saved" ? 256 : 0, outcome });
  it("offers an explicit bilingual parent save action without reading data or exporting during render", () => {
    for (const language of ["ru", "en"] as const) {
      const owner = Object.assign(controller(snapshot("adult", language)), { exportChildData: vi.fn(async () => receipt()) });
      const markup = render(<NativeProfileExportControl controller={owner} profileId="native-profile" label="Native saved profile" />, language);
      expect(markup).toContain(language === "ru" ? "Сохранить копию данных со взрослым" : "Save a data copy with an adult");
      expect(markup).not.toContain("disabled"); expect(markup).not.toContain(HASH); expect(markup).not.toContain("ageConfirmedAt");
      expect(owner.exportChildData).not.toHaveBeenCalled(); expect(owner.perform).not.toHaveBeenCalled(); expect(owner.readCollection).not.toHaveBeenCalled();
    }
  });
  it("reports saved cancelled and error only from their strict completed receipt in both languages", () => {
    const text = { ru: { saved: "Файл экспорта сохранён.", cancelled: "Экспорт отменён.", error: "Не удалось сохранить файл экспорта." },
      en: { saved: "The export file was saved.", cancelled: "Export cancelled.", error: "The export file could not be saved." } };
    for (const language of ["ru", "en"] as const) for (const outcome of ["saved", "cancelled", "error"] as const) {
      const owner = Object.assign(controller(snapshot("adult", language)), { getExportSnapshot: () => ({ phase: "complete" as const, receipt: receipt(outcome) }) });
      const markup = render(<ParentChildExportStatus controller={owner} />, language);
      expect(markup).toContain(text[language][outcome]); expect(markup).toContain(outcome === "error" ? 'role="alert"' : 'role="status"');
      expect(markup).not.toContain("native-profile"); expect(markup).not.toContain(HASH); expect(owner.perform).not.toHaveBeenCalled();
    }
  });
  it("keeps saving visible on the sealed tree without rendering child or profile data", () => {
    for (const language of ["ru", "en"] as const) {
      const value = { ...snapshot("unavailable", language), phase: "transition" as const },
        owner = Object.assign(controller(value), { getExportSnapshot: () => ({ phase: "saving" as const, receipt: null }), exportChildData: vi.fn(async () => null) });
      const markup = render(<ChildNativeClosedView snapshot={value} controller={owner} />, language);
      expect(markup).toContain(language === "ru" ? "Сохраняем копию данных со взрослым…" : "Saving a data copy with an adult…");
      expect(markup).not.toContain("Native saved profile"); expect(markup).not.toContain("data-fixture-canonical-globe");
      expect(owner.exportChildData).not.toHaveBeenCalled(); expect(owner.readEntity).not.toHaveBeenCalled();
    }
  });
  it("cannot display saved from an incomplete receipt or an unsupported export port", () => {
    const owner = Object.assign(controller(snapshot("adult")), { getExportSnapshot: () => ({ phase: "complete" as const,
      receipt: { ...receipt(), bytes: 0, sha256: null } }) });
    const markup = render(<ParentChildExportStatus controller={owner} />);
    expect(markup).toContain("The export save could not be confirmed."); expect(markup).not.toContain("The export file was saved.");
    expect(render(<NativeProfileExportControl controller={owner} profileId="native-profile" label="Reader" />)).toContain("disabled");
    expect(owner.perform).not.toHaveBeenCalled();
  });
});
