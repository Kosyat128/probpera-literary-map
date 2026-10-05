import { useEffect, useRef, useState } from "react";
import type { ChildEntityReference } from "./childPackage";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import { decodeChildNativeMediaLayout, type ChildNativeMediaAsset } from "./childNativeMedia";

const copy = {
  ru: { title: "Изображения и озвучивание", loading: "Проверяем материал…", unavailable: "Этот материал сейчас недоступен.",
    show: "Открыть изображение", audio: "Открыть озвучивание", close: "Закрыть материал", transcript: "Текст озвучивания",
    play: "Включите воспроизведение кнопкой на устройстве.", image: "Изображение", caption: "Подпись", empty: "Для этого материала пока нет доступных изображений или озвучивания." },
  en: { title: "Images and narration", loading: "Checking the material…", unavailable: "This material is currently unavailable.",
    show: "Open image", audio: "Open narration", close: "Close material", transcript: "Narration transcript",
    play: "Start playback with the control on your device.", image: "Image", caption: "Caption", empty: "No images or narration are currently available for this material." },
} as const;

/** A real native-owned pixel/audio slot. JS owns only accessible captions and
 * geometry. The same native package worker owns bytes, codecs, Play touch and
 * joined retirement; no DOM src, Blob, fetch or second globe renderer exists. */
export function ChildNativeMediaView({ controller, owner, contextToken, language }: {
  controller: ChildNativeAppController; owner: ChildEntityReference; contextToken: string; language: "ru" | "en";
}) {
  const text = copy[language], media = controller.media;
  const [assets, setAssets] = useState<readonly ChildNativeMediaAsset[] | null>(null);
  const [selected, setSelected] = useState<ChildNativeMediaAsset | null>(null);
  const [phase, setPhase] = useState<"sealed" | "loading" | "ready" | "unavailable">("sealed");
  const slot = useRef<HTMLDivElement>(null), sequence = useRef(0), live = useRef(false), token = useRef<string | null>(null);
  const ownerKey = owner.kind + "/" + owner.id + "/" + owner.contentChecksum;
  const current = () => live.current && controller.getSnapshot().status === "child"
    && controller.getSnapshot().context?.token === contextToken;

  useEffect(() => {
    live.current = true; const attempt = ++sequence.current;
    setAssets(null); setSelected(null); setPhase("loading"); token.current = null;
    void (async () => {
      if (!media) { if (current() && sequence.current === attempt) setPhase("unavailable"); return; }
      const values = await media.list(owner);
      if (!current() || sequence.current !== attempt) return;
      setAssets(values); setPhase(values ? "ready" : "unavailable");
    })();
    return () => {
      live.current = false; ++sequence.current;
      token.current = null;
      // The old decoder may not have returned a token yet. Revoke the actual
      // native media epoch before an unmounted slot can receive its pixels.
      if (controller.getSnapshot().context?.token === contextToken) void media?.releaseAll();
    };
  }, [controller, media, ownerKey, contextToken]);
  useEffect(() => {
    const hide = () => {
      if (!current() || !selected || !media) return;
      const attempt = ++sequence.current; token.current = null; setSelected(null); setPhase("loading");
      void media.releaseAll().then(ok => { if (current() && sequence.current === attempt) setPhase(ok ? "ready" : "unavailable"); });
    };
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => { window.removeEventListener("resize", hide); window.removeEventListener("scroll", hide, true); };
  }, [controller, media, selected, contextToken]);

  async function close() {
    if (!current() || !media) return;
    const attempt = ++sequence.current;
    token.current = null; setPhase("loading"); setSelected(null);
    const ok = await media.releaseAll();
    if (current() && sequence.current === attempt) setPhase(ok ? "ready" : "unavailable");
  }
  async function present(asset: ChildNativeMediaAsset) {
    if (!current() || !media) return;
    const attempt = ++sequence.current; setPhase("loading"); token.current = null;
    if (!await media.releaseAll() || !current() || sequence.current !== attempt) { if (current() && sequence.current === attempt) setPhase("unavailable"); return; }
    setSelected(asset);
    // The native surface anchors to an actual bounded visible slot. Wait for
    // the committed layout, then send geometry only; never a permission flag.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!current() || sequence.current !== attempt || !slot.current) return;
    const rect = slot.current.getBoundingClientRect(), viewportWidth = Math.floor(window.innerWidth), viewportHeight = Math.floor(window.innerHeight);
    const x = Math.max(0, Math.ceil(rect.left)), y = Math.max(0, Math.ceil(rect.top));
    const width = Math.floor(Math.min(rect.right, viewportWidth) - x), height = Math.floor(Math.min(rect.bottom, viewportHeight) - y);
    const layout = decodeChildNativeMediaLayout({ x, y, width, height, viewportWidth, viewportHeight });
    if (!layout) { setSelected(null); setPhase("unavailable"); return; }
    const result = await media.present(asset, layout);
    if (!current() || sequence.current !== attempt) {
      if (result?.presentationToken && controller.getSnapshot().context?.token === contextToken) await media.release(result.presentationToken);
      return;
    }
    if (result?.status === "presented") { token.current = result.presentationToken; setPhase("ready"); }
    else { setSelected(null); setPhase("unavailable"); }
  }
  return <section className="child-native-media" aria-label={text.title} data-child-native-media-phase={phase}>
    <h3>{text.title}</h3>
    {phase === "loading" && <p role="status">{text.loading}</p>}
    {phase === "unavailable" && <p role="status">{text.unavailable}</p>}
    {assets?.length === 0 && <p>{text.empty}</p>}
    {!!assets?.length && <ul className="child-native-media-list">{assets.map(asset => <li key={asset.assetId}>
      <button type="button" disabled={phase === "loading"} onClick={() => { void present(asset); }}>
        {asset.role === "narration" ? text.audio : text.show}: {asset.altText}
      </button>
    </li>)}</ul>}
    <div ref={slot} hidden={!selected} className="child-native-media-slot" role={selected?.role === "narration" ? "group" : "img"}
      aria-label={selected?.altText ?? text.image} data-child-native-media-slot="owned-native">
      {selected?.role === "narration" && <p>{text.play}</p>}
    </div>
    {selected && <div className="child-native-media-caption">
      <p>{selected.altText}</p>
      {selected.transcript && <details open><summary>{text.transcript}</summary><p>{selected.transcript}</p></details>}
      <button type="button" onClick={() => { void close(); }}>{text.close}</button>
    </div>}
  </section>;
}
