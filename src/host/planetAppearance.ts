import type { GlobeEditionId } from "../components/globeEditions";

// The authored edition-rail colors in index.css are the palette authority.
// Derive interface surfaces from them; never tint historical maps or portraits.
const EDITION_COLORS = {
  "behaim-1492": ["#80461d", "#462116", "#dd9d51", "#ffe8bf"],
  "hondius-1615": ["#1c675c", "#243543", "#65d2b8", "#dcfff5"],
  "coronelli-1697": ["#8b3641", "#4d1f35", "#eb8b77", "#fff0e7"],
  "scherer-1700": ["#693d8b", "#4e254c", "#b985da", "#f8e9ff"],
  "cassini-1790": ["#304f7e", "#332856", "#77a2dc", "#edf5ff"],
  "rand-mcnally-1887": ["#715e29", "#5b3021", "#e2bb60", "#fff5d2"],
  "us-army-general-reference-1943": ["#697036", "#9f4122", "#fad074", "#fff4cf"],
  "nasa-blue-marble": ["#195699", "#122b65", "#53b7f1", "#e4f7ff"],
  "natural-earth-2026": ["#176d53", "#19425c", "#4ed6a2", "#ddfff2"],
} as const satisfies Record<GlobeEditionId, readonly [string, string, string, string]>;

function channels(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function mix(first: string, second: string, secondWeight: number) {
  const right = channels(second);
  return `#${channels(first).map((value, index) =>
    Math.round(value * (1 - secondWeight) + right[index] * secondWeight).toString(16).padStart(2, "0")
  ).join("")}`;
}

export function planetAppearanceVariables(edition: GlobeEditionId) {
  const [start, end, accent, onDark] = EDITION_COLORS[edition];
  const ink = mix(end, "#100e16", 0.55);
  const surface = mix(onDark, "#fffaf2", 0.55);
  const chrome = mix(end, "#07080d", 0.62);
  return {
    "--planet-space": mix(end, "#020308", 0.8),
    "--planet-chrome": chrome,
    "--planet-chrome-raised": mix(start, "#07080d", 0.5),
    "--planet-on-dark": onDark,
    "--planet-muted-dark": mix(onDark, chrome, 0.22),
    "--planet-surface": surface,
    "--planet-card": mix(onDark, "#ffffff", 0.7),
    "--planet-ink": ink,
    "--planet-muted": mix(ink, surface, 0.29),
    "--planet-line": mix(ink, surface, 0.72),
    "--planet-accent": accent,
    "--planet-accent-rgb": channels(accent).join(", "),
    "--planet-accent-strong": mix(start, "#000000", 0.22),
  } as const;
}

function projectAppearance(target: HTMLElement, attribute: string, edition: GlobeEditionId) {
  const previousAttribute = target.getAttribute(attribute);
  const properties = Object.entries(planetAppearanceVariables(edition)).map(([name, value]) => {
    const previous = target.style.getPropertyValue(name);
    const priority = target.style.getPropertyPriority(name);
    target.style.setProperty(name, value);
    return { name, previous, priority, written: target.style.getPropertyValue(name) };
  });
  target.setAttribute(attribute, edition);
  return () => {
    // A host manager may have replaced a property since this projection.
    // Cleanup must never overwrite that newer value.
    for (const { name, previous, priority, written } of properties) {
      if (target.style.getPropertyValue(name) !== written || target.style.getPropertyPriority(name)) continue;
      if (previous) target.style.setProperty(name, previous, priority);
      else target.style.removeProperty(name);
    }
    if (target.getAttribute(attribute) === edition) {
      if (previousAttribute === null) target.removeAttribute(attribute);
      else target.setAttribute(attribute, previousAttribute);
    }
  };
}

/** A read-only visual projection of the canonical globe's committed edition. */
export function installPlanetAppearance(globe: HTMLElement, edition: GlobeEditionId) {
  const application = globe.closest<HTMLElement>(".native-planet-app");
  if (!application) return undefined;
  const restoreApplication = projectAppearance(application, "data-planet-edition", edition);
  // The canonical advanced-filter drawer uses a body portal. Only --planet-*
  // variables reach body; aliases/styles below are scoped to that app's portals.
  const restorePortals = projectAppearance(globe.ownerDocument.body, "data-planet-portal-edition", edition);
  return () => { restorePortals(); restoreApplication(); };
}
