import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import { PlatformServicesProvider } from "../platform/PlatformServices";
import type { PlatformServices } from "../platform/ports";
import { ChildNativeMediaView } from "./ChildNativeMediaView";
import { ChildNativeReadyView } from "./ChildNativeBoundary";
import { CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppSnapshot } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";

// AUTHORED_NOT_RUN. SSR fixtures cover accessible presentation composition only.
// Effects, browser geometry, native pixels/audio, real Play touches and actual
// OS package admission/retirement remain unexecuted and supply no authority.
const calls = vi.hoisted(() => ({ globe: vi.fn(), booky: vi.fn() }));
vi.mock("../components/LiteraryWorldMap", () => ({ default: (props: unknown) => {
  calls.globe(props); return <div data-fixture-canonical-globe="" />;
} }));
vi.mock("../host/PlanetMascotAvatar", () => ({ default: (props: unknown) => {
  calls.booky(props); return <div data-fixture-canonical-booky="" />;
} }));
const HASH = "a".repeat(64), TOKEN = "b".repeat(32);
const owner: ChildEntityReference = { kind: "work", id: "work-one", contentChecksum: HASH };
function snapshot(status: ChildNativeAppSnapshot["status"] = "child", locale: "ru" | "en" = "en"): ChildNativeAppSnapshot {
  return { phase: status === "unavailable" ? "sealed" : "ready", status,
    reason: status === "blocked-child" ? "missing-pins" : status === "unavailable" ? "corrupt" : null,
    context: status === "unavailable" ? null : { token: TOKEN, generation: 1, revision: 2, selectionRevision: 2, profileRevision: 2,
      policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
      mode: "child", profileId: "native-profile", locale,
      package: status === "child" ? { id: "native-package", version: 1, checksum: HASH } : null,
      home: status === "child" ? { kind: "activity", id: "home", contentChecksum: HASH } : null, remainingLifetimeMs: 30_000 },
    profiles: status === "unavailable" ? [] : [{ id: "native-profile", label: "Native saved profile", exactAge: 9, locale }] };
}
function controller(value = snapshot()) {
  const media = { list: vi.fn(async () => []), present: vi.fn(async () => null),
    release: vi.fn(async () => true), releaseAll: vi.fn(async () => true) };
  return { media, getSnapshot: () => value, subscribe: () => () => undefined,
    attachPresentationBarrier: vi.fn(() => () => undefined), start: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined), perform: vi.fn(async () => false), suspend: vi.fn(async () => undefined), dispose: vi.fn(async () => undefined),
    readEntity: vi.fn(async () => null), search: vi.fn(async () => null),
    readCollection: vi.fn(async () => null), writeCollection: vi.fn(async () => null) } satisfies ChildNativeAppController;
}
function services() {
  const state = Object.freeze({ connectivity: "online", visibility: "active" } as const);
  return { kind: "ios", channel: "appStore", preferences: { persistence: "durable",
    get: vi.fn(async () => null), set: vi.fn(async () => false), remove: vi.fn(async () => false) },
    getSnapshot: () => state, subscribe: () => () => undefined, getSystemLanguages: () => ["en"],
    openExternalLink: vi.fn(() => "blocked" as const) } satisfies PlatformServices;
}
function render(node: ReactNode, language: "ru" | "en" = "en", platform = services()) {
  return renderToStaticMarkup(<PlatformServicesProvider services={platform}>
    <InterfaceLanguageProvider hostLanguage={{ initialLanguage: language, persist: async () => false }}>{node}</InterfaceLanguageProvider>
  </PlatformServicesProvider>);
}
function expectNoRPC(c: ReturnType<typeof controller>) {
  expect(c.media.list).not.toHaveBeenCalled(); expect(c.media.present).not.toHaveBeenCalled();
  expect(c.media.release).not.toHaveBeenCalled(); expect(c.media.releaseAll).not.toHaveBeenCalled();
  expect(c.readEntity).not.toHaveBeenCalled(); expect(c.perform).not.toHaveBeenCalled();
}
afterEach(() => { vi.clearAllMocks(); });

describe("LOCAL2 native media accessible slot", () => {
  it("renders RU and EN native-owned slots sealed without issuing any render-time RPC", () => {
    const c = controller();
    const ru = render(<ChildNativeMediaView controller={c} owner={owner} contextToken={TOKEN} language="ru" />, "ru");
    const en = render(<ChildNativeMediaView controller={c} owner={owner} contextToken={TOKEN} language="en" />, "en");
    expect(ru).toContain('aria-label="Изображения и озвучивание · Русский"'); expect(ru).toContain('aria-label="Изображение"');
    expect(en).toContain('aria-label="Images and narration · English"'); expect(en).toContain('aria-label="Image"');
    for (const markup of [ru, en]) {
      expect(markup).toContain('data-child-native-media-phase="sealed"');
      expect(markup).toContain('data-child-native-media-slot="owned-native"');
      expect(markup).toContain('role="img"'); expect(markup).not.toContain("Reviewed fixture caption");
    }
    expectNoRPC(c);
  });
  it("exports no DOM media source, byte URL, autonomous playback or second canvas", () => {
    const c = controller(), markup = render(<ChildNativeMediaView controller={c} owner={owner} contextToken={TOKEN} language="en" />);
    expect(markup).not.toMatch(/<(?:img|audio|video|canvas|iframe)\b/u);
    expect(markup).not.toMatch(/(?:src|href|autoplay|onplay|data-base64)=/u);
    expect(markup).not.toMatch(/(?:blob:|data:audio|data:image|file:\/\/|https?:\/\/)/u);
    expect(markup).not.toContain("presentationToken"); expect(markup).not.toContain("contentChecksum");
    expect(markup).not.toContain("Start playback"); expectNoRPC(c); expect(calls.globe).not.toHaveBeenCalled();
  });
  it("keeps unrelated owners and native context tokens out of a sealed server frame", () => {
    const c = controller();
    const first = render(<ChildNativeMediaView controller={c} owner={owner} contextToken={TOKEN} language="en" />);
    const sibling: ChildEntityReference = { kind: "writer", id: "inactive-profile-private-row", contentChecksum: "d".repeat(64) };
    const second = render(<ChildNativeMediaView controller={c} owner={sibling} contextToken={"f".repeat(32)} language="en" />);
    expect(first).toBe(second); expect(second).not.toContain(sibling.id); expect(second).not.toContain(sibling.contentChecksum);
    expect(second).not.toContain("f".repeat(32)); expectNoRPC(c);
  });
  it("keeps a host without optional media methods sealed and issues no text or control request", () => {
    const c = controller(), withoutMedia: ChildNativeAppController = { ...c, media: undefined };
    const markup = render(<ChildNativeMediaView controller={withoutMedia} owner={owner} contextToken={TOKEN} language="en" />);
    expect(markup).toContain('data-child-native-media-phase="sealed"');
    expect(markup).not.toContain("Open image"); expect(markup).not.toContain("Open narration");
    expect(markup).not.toContain("available for this material"); expectNoRPC(c);
  });
  it("composes with exactly the original calm globe and Booky without a new media renderer", () => {
    const value = snapshot(), c = controller(value), platform = services();
    const markup = render(<><ChildNativeReadyView controller={c} snapshot={value} />
      <ChildNativeMediaView controller={c} owner={owner} contextToken={TOKEN} language="en" /></>, "en", platform);
    expect(markup.match(/data-fixture-canonical-globe=/gu)).toHaveLength(1);
    expect(markup.match(/data-fixture-canonical-booky=/gu)).toHaveLength(1); expect(markup).toContain("Mr. Booky");
    expect(calls.globe).toHaveBeenCalledOnce(); expect(calls.globe.mock.calls[0][0]).toMatchObject({
      countries: [], childPresentation: true, mode: "immersive", forceLoad: true, bookyCalmMotion: true,
      runtimeActive: true, preserveSceneDuringReload: true });
    expect(calls.booky.mock.calls[0][0]).toMatchObject({ calmMotion: true, active: true });
    expect(markup).not.toMatch(/<(?:img|audio|video|canvas)\b/u); expectNoRPC(c);
    expect(platform.preferences.get).not.toHaveBeenCalled(); expect(platform.openExternalLink).not.toHaveBeenCalled();
  });
  it("renders neither the media slot nor the globe for blocked child or corrupt ready boundaries", () => {
    for (const status of ["blocked-child", "unavailable"] as const) {
      const value = snapshot(status), c = controller(value), markup = render(<ChildNativeReadyView controller={c} snapshot={value} />);
      expect(markup).not.toContain("data-child-native-media-slot"); expect(markup).not.toContain("data-fixture-canonical-globe");
      expect(markup).not.toContain('data-child-native-profile="'); expectNoRPC(c);
    }
    expect(calls.globe).not.toHaveBeenCalled(); expect(calls.booky).not.toHaveBeenCalled();
  });
});

describe("scene resources use canonical Three receiver",()=>{
 it("keeps exactly one canonical globe owner alongside the original sealed native image/audio slot",()=>{
  const value=snapshot(),c=controller(value);
  render(<ChildNativeReadyView snapshot={value} controller={c}/>);
  const props=calls.globe.mock.calls[calls.globe.mock.calls.length-1]![0] as {childResources:{getSnapshot():{phase:string}};childPresentation:boolean};
  expect(props.childPresentation).toBe(true);expect(props.childResources.getSnapshot().phase).toBe("empty");
  expectNoRPC(c);
 });
});
