export type ImageDeliveryVariant = Readonly<{ src: string; width: number; height: number }>;
export type ImageDeliveryEntry = ImageDeliveryVariant & Readonly<{ variants: readonly ImageDeliveryVariant[] }>;
export type PublicImageAttributes = { src: string; width?: number; height?: number; srcSet?: string; sizes?: string };

/** Presentation renditions keep the editorial source and its credits intact. */
export function createImageDeliveryResolver(entries: Readonly<Record<string, ImageDeliveryEntry>>, base = "/") {
  const prefix = `${base.replace(/\/+$/u, "")}/`;
  const localUrl = (value: string) => !value || value.startsWith(prefix) || /^(?:https?:|data:|blob:|#)/iu.test(value)
    ? value : `${prefix}${value.replace(/^\/+/, "")}`;
  let aliases: Map<string, string> | undefined;
  const original = (source: string): string => {
    if (entries[source]) return source;
    if (!aliases) {
      aliases = new Map();
      for (const [url, entry] of Object.entries(entries)) {
        for (const rendition of [entry, ...entry.variants]) {
          aliases.set(rendition.src, url);
          aliases.set(localUrl(rendition.src), url);
        }
      }
    }
    let pathname = source;
    if (/^https?:/iu.test(source)) {
      try { pathname = new URL(source).pathname; } catch { return source; }
    }
    return aliases.get(source) || aliases.get(pathname) || source;
  };
  const attributes = (source: string, width = 1280, sizes = "100vw"): PublicImageAttributes => {
    const entry = entries[original(source)];
    if (!entry) return { src: localUrl(source) };
    const variants = [...new Map(entry.variants.map(variant => [variant.width, variant])).values()].sort((a, b) => a.width - b.width);
    if (!variants.some(value => value.width === entry.width)) variants.push(entry);
    const selected = variants.find(value => value.width >= width) || entry;
    return {
      src: localUrl(selected.src),
      width: entry.width,
      height: entry.height,
      ...(variants.length > 1 ? {
        srcSet: variants.map(value => `${localUrl(value.src)} ${value.width}w`).join(", "),
        sizes,
      } : {}),
    };
  };
  return { attributes, original, url: (source: string, width = 1280) => attributes(source, width).src };
}
