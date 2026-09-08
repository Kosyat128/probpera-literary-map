type ReaderTrigger = { element: HTMLElement; href: string | null; surfaceId: string | null };
let pendingTrigger: ReaderTrigger | null = null;

export function rememberReaderTrigger(element: HTMLElement) {
  pendingTrigger = {
    element,
    href: element.closest("a[href]")?.getAttribute("href") || null,
    surfaceId: element.closest("section[id]")?.id || null,
  };
}

export function readReaderTrigger() {
  return pendingTrigger;
}

/** The archive can remount after history.back(); restore to its live link, once. */
export function restoreReaderTrigger(trigger: ReaderTrigger | null, fallback: HTMLElement | null) {
  requestAnimationFrame(() => {
    if (document.querySelector(".article-reader")) return;
    if (pendingTrigger === trigger) pendingTrigger = null;
    const tryFocus = () => {
      const surface = trigger?.surfaceId ? document.getElementById(trigger.surfaceId) : document;
      const element = trigger?.element.isConnected ? trigger.element
        : trigger?.href ? [...(surface?.querySelectorAll<HTMLAnchorElement>("a[href]") || [])]
          .find(link => link.getAttribute("href") === trigger.href)
        : fallback?.isConnected ? fallback : null;
      if (!element) return false;
      element.focus({ preventScroll: true });
      return document.activeElement === element;
    };
    if (tryFocus()) return;
    let scrolled = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector(".article-reader")) { observer.disconnect(); clearTimeout(timeout); return; }
      if (tryFocus()) { observer.disconnect(); clearTimeout(timeout); return; }
      const surface = trigger?.surfaceId ? document.getElementById(trigger.surfaceId) : null;
      if (surface && !scrolled) { scrolled = true; surface.scrollIntoView({ block: "start" }); }
    });
    const timeout = setTimeout(() => observer.disconnect(), 3000);
    observer.observe(document.body, { childList: true, subtree: true });
    const surface = trigger?.surfaceId ? document.getElementById(trigger.surfaceId) : null;
    if (surface) { scrolled = true; surface.scrollIntoView({ block: "start" }); }
  });
}
