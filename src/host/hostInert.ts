const owners = new WeakMap<HTMLElement, { count: number; originallyInert: boolean }>();

/** Launch and an initially requested reading panel may overlap in StrictMode. */
export function acquireHostInert(element: HTMLElement): () => void {
  const state = owners.get(element) ?? { count: 0, originallyInert: element.hasAttribute("inert") };
  state.count += 1;
  owners.set(element, state);
  element.setAttribute("inert", "");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count -= 1;
    if (state.count) return;
    owners.delete(element);
    if (!state.originallyInert) element.removeAttribute("inert");
  };
}
