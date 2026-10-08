import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { decodeChildEntityPayload, type ChildEntityPayload, type ChildEntityReference } from "./childPackage";
import { resolveChildReadingPosition } from "./childReadingPosition";
import { createChildReadingSession, type ChildReadingHost } from "./childReadingSession";
import "./ChildNativeReadingView.css";

export const childReadingLabels = {
  ru: { checking: "Проверяем сохранённое место…", saving: "Сохраняем место…", remember: "Запомнить этот фрагмент",
    continue: "К сохранённому фрагменту", saved: "Сохранённое место доступно.",
    unknown: "Сохранённый фрагмент сейчас недоступен в этом тексте. Он не изменён.",
    readError: "Не удалось проверить сохранённое место.", saveError: "Не удалось подтвердить сохранение места.",
    retry: "Проверить сохранённое место снова", passages: "Фрагменты текста" },
  en: { checking: "Checking the saved passage…", saving: "Saving the passage…", remember: "Remember this passage",
    continue: "Go to saved passage", saved: "The saved passage is available.",
    unknown: "The saved passage is currently unavailable in this text. It has not been changed.",
    readError: "The saved passage could not be checked.", saveError: "The passage save could not be confirmed.",
    retry: "Check the saved passage again", passages: "Text passages" },
} as const;

/** Actual reader hook. Passage selection is an explicit child action, not
 * scroll tracking. Native ACK supplies the bookmark; DOM focus grants nothing.
 * This view never claims an audio seek or uses localized character offsets. */
export function ChildNativeReadingView({ controller, reference, payload, contextToken, language }: {
  controller: ChildReadingHost; reference: ChildEntityReference; payload: ChildEntityPayload;
  contextToken: string; language: "ru" | "en";
}) {
  const content = useMemo(() => decodeChildEntityPayload(payload), [payload]);
  const session = useMemo(() => createChildReadingSession({ controller, reference, payload, contextToken, language }),
    [controller, reference, payload, contextToken, language]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const native = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const passages = useRef(new Map<string, HTMLParagraphElement>()), copy = childReadingLabels[language];
  useEffect(() => { void session.activate(); return () => session.deactivate(); }, [session]);
  const admitted = native.phase === "ready" && native.status === "child" && native.context?.mode === "child"
    && !!native.context.profileId && !!native.context.package && native.context.token === contextToken
    && native.context.locale === language && native.context.remainingLifetimeMs > 0 && session.isCurrentContext();
  if (!admitted || !content) return null;
  if (!content.readingAnchors || !controller.reading) return <p className="child-native-text">{content.text}</p>;
  const anchors = content.readingAnchors, saved = state.saved?.position;
  const restored = saved && resolveChildReadingPosition(saved, anchors, reference);
  const ready = state.phase === "ready" && !state.saving && (!saved || !!restored);
  function resume() {
    if (!ready || !restored || !session.isCurrent()) return;
    const paragraph = passages.current.get(restored.anchorId);
    if (paragraph?.isConnected) { paragraph.focus({ preventScroll: true }); paragraph.scrollIntoView({ block: "center", inline: "nearest" }); }
  }
  const message = state.saving ? copy.saving : state.failure === "save" ? copy.saveError
    : state.failure === "read" ? copy.readError : state.phase === "loading" || state.phase === "sealed" ? copy.checking
      : saved && !restored ? copy.unknown : restored ? copy.saved : null;
  return <section className="child-native-reading" data-child-native-reading="anchored" aria-label={copy.passages}
    aria-busy={state.phase === "loading" || state.saving}>
    {message && <p role={state.failure ? "alert" : "status"}>{message}</p>}
    {restored && <button type="button" disabled={!ready} onClick={resume}>{copy.continue}</button>}
    {state.failure && <button type="button" disabled={state.saving} onClick={() => { void session.refresh(); }}>{copy.retry}</button>}
    {anchors.segments.map(segment => <div className="child-native-reading-passage" key={segment.anchorId}>
      <p className="child-native-text child-native-reading-target" tabIndex={-1}
        ref={element => { if (element) passages.current.set(segment.anchorId, element); else passages.current.delete(segment.anchorId); }}>
        {segment.text}</p>
      <button type="button" disabled={!ready} onClick={() => { void session.remember(segment.anchorId); }}>{copy.remember}</button>
    </div>)}
  </section>;
}
