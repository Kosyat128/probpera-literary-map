import { createImageDeliveryResolver, type ImageDeliveryEntry } from "./imageDeliveryModel";

/** Controlled bundles select canonical originals; public responsive renditions
 * are not part of that selection. Keep reverse aliases for existing reader URLs
 * without changing the source, credits or the caller's media-access policy.
 */
export function createControlledImageDeliveryResolver(
  entries: Readonly<Record<string, ImageDeliveryEntry>>,
  base = "/",
) {
  const aliases = createImageDeliveryResolver(entries, base);
  const originals = createImageDeliveryResolver({}, base);
  const attributes = (source: string, _width = 1280, _sizes = "100vw") =>
    originals.attributes(aliases.original(source));
  return {
    attributes,
    original: aliases.original,
    register: aliases.register,
    url: (source: string, width = 1280) => attributes(source, width).src,
  };
}
