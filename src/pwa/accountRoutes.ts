/** Pure route recognition keeps account/auth SDK code outside the main entry. */
export type PlanetAccountMode = "access" | "deletion";

export function planetAccountRoute(pathname: string): PlanetAccountMode | null {
  const match = /^\/(?:ru|en)\/(planet-account|delete-account)(?:\/(?:index\.html)?)?$/u.exec(pathname);
  return match ? match[1] === "planet-account" ? "access" : "deletion" : null;
}
