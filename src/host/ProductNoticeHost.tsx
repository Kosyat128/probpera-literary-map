import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type Placement = "fallback" | "root" | "panel";
type Slot = { element: HTMLElement; placement: Placement; reserveSpaceRef?: RefObject<HTMLElement> };
type NoticeHost = { register: (element: HTMLElement, placement: Placement, reserveSpaceRef?: RefObject<HTMLElement>) => () => void };
const priority: Record<Placement, number> = { fallback: 0, root: 1, panel: 2 };
const Context = createContext<NoticeHost | null>(null);

/** One portal container moves between presentation slots without remounting its
 * contents. This layer has no authorization or worker state. */
export function ProductNoticeHost({ children, notices }: { children: ReactNode; notices: ReactNode }) {
  const [container] = useState<HTMLElement | null>(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    element.className = "product-notice-host";
    return element;
  });
  const slots = useRef(new Map<symbol, Slot>());
  const updateSpace = useCallback(() => {
    if (!container) return;
    let selected: Slot | undefined;
    for (const slot of slots.current.values()) {
      if (!selected || priority[slot.placement] > priority[selected.placement]) selected = slot;
    }
    const rect = container.getBoundingClientRect();
    const footprint = selected?.placement === "root" && rect.height > 0
      ? Math.max(0, Math.ceil(window.innerHeight - rect.top) + 8) : 0;
    for (const slot of slots.current.values()) {
      const space = slot.reserveSpaceRef?.current;
      if (!space) continue;
      const occupied = selected === slot && footprint > 0;
      const value = occupied ? String(footprint) + "px" : "0px";
      if (space.style.getPropertyValue("--product-notice-bottom-space") !== value) {
        space.style.setProperty("--product-notice-bottom-space", value);
      }
      space.setAttribute("data-product-notice-space", occupied ? "occupied" : "clear");
    }
  }, [container]);
  useLayoutEffect(() => {
    if (!container) return;
    const observer = new ResizeObserver(updateSpace);
    observer.observe(container);
    window.addEventListener("resize", updateSpace);
    window.visualViewport?.addEventListener("resize", updateSpace);
    updateSpace();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSpace);
      window.visualViewport?.removeEventListener("resize", updateSpace);
    };
  }, [container, updateSpace]);
  const register = useCallback((element: HTMLElement, placement: Placement, reserveSpaceRef?: RefObject<HTMLElement>) => {
    if (!container) return () => {};
    const token = Symbol("notice-slot");
    const relocate = () => {
      let selected: Slot | undefined;
      for (const slot of slots.current.values()) {
        if (!selected || priority[slot.placement] > priority[selected.placement]) selected = slot;
      }
      if (selected) {
        if (container.parentElement !== selected.element) selected.element.appendChild(container);
      } else container.remove();
      updateSpace();
    };
    slots.current.set(token, { element, placement, reserveSpaceRef });
    relocate();
    let released = false;
    // Parent refs attach after child layout effects. A later authorized mount
    // can also relocate an already observed host without changing its size.
    const frame = requestAnimationFrame(() => { if (!released) updateSpace(); });
    return () => {
      if (released) return;
      released = true;
      cancelAnimationFrame(frame);
      slots.current.delete(token);
      reserveSpaceRef?.current?.style.removeProperty("--product-notice-bottom-space");
      reserveSpaceRef?.current?.removeAttribute("data-product-notice-space");
      relocate();
    };
  }, [container, updateSpace]);
  const context = useMemo(() => ({ register }), [register]);
  return <Context.Provider value={context}>
    {children}
    {container && createPortal(notices, container)}
  </Context.Provider>;
}

/** Without a host, native/public callers render no extra interface. */
export function ProductNoticeSlot({ placement, active = true, reserveSpaceRef }: { placement: Placement; active?: boolean; reserveSpaceRef?: RefObject<HTMLElement> }) {
  const host = useContext(Context);
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!host || !active || !element.current) return;
    return host.register(element.current, placement, reserveSpaceRef);
  }, [host, active, placement, reserveSpaceRef]);
  if (!host) return null;
  return <div ref={element} className="product-notice-slot" data-product-notice-placement={placement} />;
}
