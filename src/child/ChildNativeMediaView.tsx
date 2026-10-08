import { childNativeSlotMedia, childNativeNarrationAsset, prepareChildNativeNarrationResume } from "./childNativeMedia";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ChildEntityReference } from "./childPackage";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import { decodeChildNativeMediaLayout, type ChildNativeMediaAsset } from "./childNativeMedia";

const copy = {
  ru: { title: "Изображения и озвучивание", loading: "Проверяем материал…", unavailable: "Этот материал сейчас недоступен.",
    show: "Открыть изображение", audio: "Открыть озвучивание", close: "Закрыть материал", transcript: "Текст озвучивания",
    resume: "Продолжить озвучивание с сохранённого места", reading: "Проверяем сохранённое место…", absent: "Сохранённого места пока нет. Можно открыть озвучивание с начала.", resumeUnavailable: "Сохранённое место сейчас недоступно. Можно открыть озвучивание с начала.", prepared: "Озвучивание подготовлено с сохранённого места. Включите его кнопкой на устройстве.", play: "Включите воспроизведение кнопкой на устройстве.", image: "Изображение", caption: "Подпись", language: "Русский",
    empty: "Для этого материала пока нет доступных изображений или озвучивания. Его русский текст можно читать." },
  en: { title: "Images and narration", loading: "Checking the material…", unavailable: "This material is currently unavailable.",
    show: "Open image", audio: "Open narration", close: "Close material", transcript: "Narration transcript",
    resume: "Continue narration from your saved place", reading: "Checking your saved place…", absent: "There is no saved place yet. You can open narration from the beginning.", resumeUnavailable: "Your saved place is unavailable right now. You can open narration from the beginning.", prepared: "Narration is prepared at your saved place. Start it with the control on your device.", play: "Start playback with the control on your device.", image: "Image", caption: "Caption", language: "English",
    empty: "No images or narration are currently available for this material. You can read its English text." },
} as const;

export type ChildNativeNarrationResumePhase = "none" | "reading" | "absent" | "unavailable" | "prepared";
/** These actual child controls expose no playback/byte/position capability. */
export function ChildNativeMediaActions({ assets, language, disabled, resumeAvailable, onPresent, onResume }: {
  assets: readonly ChildNativeMediaAsset[]; language: "ru" | "en"; disabled: boolean; resumeAvailable: boolean;
  onPresent: (asset: ChildNativeMediaAsset) => void; onResume: (asset: ChildNativeMediaAsset) => void;
}) {
  const text = copy[language];
  return <ul className="child-native-media-list">{assets.map(asset => <li key={asset.assetId}>
    <button type="button" disabled={disabled} onClick={() => onPresent(asset)}>
      {asset.role === "narration" ? text.audio : text.show}: {asset.altText} · {text.language}
    </button>
    {resumeAvailable && childNativeNarrationAsset(asset) && <button type="button" disabled={disabled} onClick={() => onResume(asset)}>
      {text.resume}: {asset.altText} · {text.language}
    </button>}
  </li>)}</ul>;
}
export function ChildNativeNarrationResumeStatus({ language, phase }: { language: "ru" | "en"; phase: ChildNativeNarrationResumePhase }) {
  const text = copy[language];
  return phase === "none" ? null : <p role="status">{phase === "unavailable" ? text.resumeUnavailable : text[phase]}</p>;
}
/** A real native-owned pixel/audio slot. JS owns only accessible captions and
 * geometry. The same native package worker owns bytes, codecs, Play touch and
 * joined retirement; no DOM src, Blob, fetch or second globe renderer exists. */
export function ChildNativeMediaView({ controller, owner, contextToken, language }: {
  controller: ChildNativeAppController; owner: ChildEntityReference; contextToken: string; language: "ru" | "en";
}) {
  const text = copy[language], media = controller.media;
  const ownerKey = owner.kind + "/" + owner.id + "/" + owner.contentChecksum;
  const renderKey = contextToken + "/" + language + "/" + ownerKey;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const boundContext = useMemo(() => snapshot.context, [controller, ownerKey, contextToken, language]);
  const scopeCurrent = () => {
    const snapshot = controller.getSnapshot();
    return !!boundContext && snapshot.context === boundContext && snapshot.phase === "ready" && snapshot.status === "child"
      && boundContext.mode === "child" && !!boundContext.profileId && !!boundContext.package
      && boundContext.token === contextToken && boundContext.locale === language;
  };
  const [loaded, setLoaded] = useState<{ key: string; assets: readonly ChildNativeMediaAsset[] | null } | null>(null);
  const [selection, setSelection] = useState<{ key: string; asset: ChildNativeMediaAsset } | null>(null);
  const assets = loaded?.key === renderKey && scopeCurrent() ? loaded.assets : null;
  const selected = selection?.key === renderKey && scopeCurrent() ? selection.asset : null;
  const setSelected = (asset: ChildNativeMediaAsset | null) => setSelection(asset ? { key: renderKey, asset } : null);
  const [phase, setPhase] = useState<"sealed" | "loading" | "ready" | "unavailable">("sealed");
  const [resume, setResume] = useState<{ key: string; phase: ChildNativeNarrationResumePhase } | null>(null);
  const resumeAvailable = !!controller.reading && typeof media?.resumeNarration === "function";
  const slot = useRef<HTMLDivElement>(null), sequence = useRef(0), live = useRef(false), token = useRef<string | null>(null);
  const anchored = useRef<{ left: number; top: number; right: number; bottom: number; viewportWidth: number; viewportHeight: number } | null>(null);
  const current = () => live.current && scopeCurrent();

  useEffect(() => {
    live.current = true; const attempt = ++sequence.current;
    setLoaded(null); setSelected(null); setResume(null); setPhase("loading"); token.current = null; anchored.current = null;
    void (async () => {
      if (!scopeCurrent()) { setPhase("sealed"); return; }
      if (!media) { if (current() && sequence.current === attempt) setPhase("unavailable"); return; }
      try {
        const values = await media.list(owner);
        if (!current() || sequence.current !== attempt) return;
        setLoaded({ key: renderKey, assets: values?.filter(childNativeSlotMedia) ?? null }); setPhase(values ? "ready" : "unavailable");
      } catch { if (current() && sequence.current === attempt) { setLoaded(null); setPhase("unavailable"); } }
    })();
    return () => {
      live.current = false; ++sequence.current; anchored.current = null;
      token.current = null;
      // The old decoder may not have returned a token yet. Revoke the actual
      // native media epoch before an unmounted slot can receive its pixels.
      if (controller.getSnapshot().context === boundContext) void media?.releaseAll();
    };
  }, [controller, media, ownerKey, contextToken, language, boundContext]);
  useEffect(() => {
    const hide = () => {
      if (!current() || !selected || !media || !anchored.current) return;
      const frame = anchored.current, rect = slot.current?.getBoundingClientRect();
      // A queued scroll event may describe the deliberate pre-dispatch anchor.
      // Only unchanged geometry may keep the original pending/native surface.
      if (rect && rect.left === frame.left && rect.top === frame.top && rect.right === frame.right && rect.bottom === frame.bottom
        && window.innerWidth === frame.viewportWidth && window.innerHeight === frame.viewportHeight) return;
      anchored.current = null;
      const attempt = ++sequence.current; token.current = null; setSelected(null); setResume(null); setPhase("loading");
      void media.releaseAll().then(ok => { if (current() && sequence.current === attempt) setPhase(ok ? "ready" : "unavailable"); });
    };
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => { window.removeEventListener("resize", hide); window.removeEventListener("scroll", hide, true); };
  }, [controller, media, selected, contextToken]);

  async function close() {
    if (!current() || !media) return;
    const attempt = ++sequence.current;
    token.current = null; anchored.current = null; setResume(null); setPhase("loading"); setSelected(null);
    const ok = await media.releaseAll();
    if (current() && sequence.current === attempt) setPhase(ok ? "ready" : "unavailable");
  }
  async function present(asset: ChildNativeMediaAsset, resumePosition = false) {
    if (!current() || !media || resumePosition && (!resumeAvailable || !childNativeNarrationAsset(asset))) return;
    const attempt = ++sequence.current; setPhase("loading"); setResume(resumePosition ? { key: renderKey, phase: "reading" } : null);
    token.current = null; anchored.current = null;
    if (!await media.releaseAll() || !current() || sequence.current !== attempt) { if (current() && sequence.current === attempt) { setPhase("unavailable"); setResume(resumePosition ? { key: renderKey, phase: "unavailable" } : null); } return; }
    setSelected(asset);
    // Commit the accessible slot and reveal it before dispatching the original
    // native worker. Pre-dispatch scrolling grants no native authority.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!current() || sequence.current !== attempt || !slot.current) return;
    slot.current.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!current() || sequence.current !== attempt || !slot.current) return;
    const rect = slot.current.getBoundingClientRect(), viewportWidth = Math.floor(window.innerWidth), viewportHeight = Math.floor(window.innerHeight);
    const x = Math.ceil(rect.left), y = Math.ceil(rect.top);
    const width = Math.floor(rect.right - x), height = Math.floor(rect.bottom - y);
    const layout = rect.left >= 0 && rect.top >= 0 && rect.right <= viewportWidth && rect.bottom <= viewportHeight
      ? decodeChildNativeMediaLayout({ x, y, width, height, viewportWidth, viewportHeight }) : null;
    if (!layout) { setSelected(null); setPhase("unavailable"); setResume(resumePosition ? { key: renderKey, phase: "unavailable" } : null); return; }
    anchored.current = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    if (resumePosition) {
      const result = await prepareChildNativeNarrationResume(controller, boundContext!, asset, layout,
        () => current() && sequence.current === attempt);
      if (!current() || sequence.current !== attempt) {
        if (result.status === "prepared" && result.presentation.presentationToken && controller.getSnapshot().context === boundContext)
          await media.release(result.presentation.presentationToken);
        return;
      }
      if (result.status === "prepared") {
        token.current = result.presentation.presentationToken; setResume({ key: renderKey, phase: "prepared" }); setPhase("ready");
      } else if (result.status !== "retired") {
        anchored.current = null; setSelected(null); setResume({ key: renderKey, phase: result.status }); setPhase("ready");
      }
      return;
    }
    const result = await media.present(asset, layout);
    if (!current() || sequence.current !== attempt) {
      if (result?.presentationToken && controller.getSnapshot().context === boundContext) await media.release(result.presentationToken);
      return;
    }
    if (result?.status === "presented") { token.current = result.presentationToken; setPhase("ready"); }
    else { anchored.current = null; setSelected(null); setPhase("unavailable"); }
  }
  const presentationPhase = scopeCurrent() ? phase : "sealed";
  return <section className="child-native-media" aria-label={text.title + " · " + text.language} lang={language} data-child-native-media-phase={presentationPhase}>
    <h3>{text.title}</h3>
    {assets?.length === 0 && <p>{text.empty}</p>}
    {!!assets?.length && <ChildNativeMediaActions assets={assets} language={language} disabled={phase === "loading"}
      resumeAvailable={resumeAvailable} onPresent={asset => { void present(asset); }} onResume={asset => { void present(asset, true); }} />}
    {scopeCurrent() && <ChildNativeNarrationResumeStatus language={language} phase={resume?.key === renderKey ? resume.phase : "none"} />}
    <div ref={slot} hidden={!selected} className="child-native-media-slot" role={selected?.role === "narration" ? "group" : "img"}
      aria-label={selected?.altText ?? text.image} data-child-native-media-slot="owned-native">
      {selected?.role === "narration" && <p>{text.play}</p>}
    </div>
    {selected && <div className="child-native-media-caption">
      <p>{selected.altText}</p>
      <button type="button" onClick={() => { void close(); }}>{text.close}</button>
    </div>}
    {/* Transcript disclosures follow the native slot so expanding text cannot
        move an already anchored native surface onto the disclosure. */}
    <div className="child-native-media-caption">{assets?.filter(asset => asset.transcript).map(asset => <details key={renderKey + "/" + asset.assetId}>
      <summary>{text.transcript} · {text.language}</summary><p>{asset.transcript}</p>
    </details>)}</div>
    {/* Preserve page height when native decoding finishes, including at the
        document scroll limit; a disappearing status must not move the slot. */}
    <p role="status" aria-hidden={presentationPhase !== "loading" && presentationPhase !== "unavailable"}
      style={{ visibility: presentationPhase === "loading" || presentationPhase === "unavailable" ? "visible" : "hidden" }}>
      {presentationPhase === "unavailable" ? text.unavailable : text.loading}
    </p>
  </section>;
}
