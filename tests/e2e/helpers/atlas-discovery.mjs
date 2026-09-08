import { expect } from "@playwright/test";

export async function clickAtlasDiscoveryControl(control) {
  await expect.poll(() => control.evaluate((element) => {
    if (element.closest(".atlas-embedded-discovery")) {
      // Re-measure and align in the same frame as the hit check: closing the
      // country sheet can still change page anchoring between browser calls.
      const stickyBottom = Math.max(0, ...Array.from(
        document.querySelectorAll(".site-header, .mobile-nav"),
        (node) => node.getBoundingClientRect().bottom
      ));
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top - stickyBottom - 16,
        behavior: "instant",
      });
    } else {
      return true;
    }
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(
      box.left + box.width / 2, box.top + box.height / 2
    ));
  })).toBe(true);
  await control.click();
}
