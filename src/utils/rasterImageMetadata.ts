/** Portable container inspection, shared by browser uploads and the Workers-compatible API.
 * Reads declared dimensions and animation without decoding or trusting a filename/MIME header.
 * This is container validation, not a replacement for an image decoder.
 */
export type RasterImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
export type RasterImageMetadata = {
  mime: RasterImageMime;
  extension: "jpg" | "png" | "webp" | "avif";
  width: number;
  height: number;
  animated: boolean;
};

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));
const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const u24le = (bytes: Uint8Array, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);

function orientation(bytes: Uint8Array, start: number, end: number): number {
  if (start + 8 > end) return 1;
  const view = viewOf(bytes);
  const little = ascii(bytes, start, 2) === "II";
  if (!little && ascii(bytes, start, 2) !== "MM") return 1;
  if (view.getUint16(start + 2, little) !== 42) return 1;
  const directory = start + view.getUint32(start + 4, little);
  if (directory < start + 8 || directory + 2 > end) return 1;
  const count = view.getUint16(directory, little);
  if (directory + 2 + count * 12 > end) return 1;
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * 12;
    if (view.getUint16(entry, little) !== 0x0112) continue;
    if (view.getUint16(entry + 2, little) !== 3 || view.getUint32(entry + 4, little) !== 1) return 1;
    const value = view.getUint16(entry + 8, little);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

function oriented(width: number, height: number, exif: number) {
  return exif >= 5 && exif <= 8 ? { width: height, height: width } : { width, height };
}

function jpeg(bytes: Uint8Array): RasterImageMetadata | null {
  const view = viewOf(bytes);
  let offset = 2;
  let width = 0;
  let height = 0;
  let exif = 1;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xda) {
      // Scan data may contain escaped markers; the terminal EOI is unambiguous.
      if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
      return width && height ? { mime: "image/jpeg", extension: "jpg", ...oriented(width, height, exif), animated: false } : null;
    }
    if (marker === 0xd9 || offset + 2 > bytes.length) return null;
    const size = view.getUint16(offset);
    const end = offset + size;
    if (size < 2 || end > bytes.length) return null;
    if (marker === 0xe1 && size >= 16 && ascii(bytes, offset + 2, 6) === "Exif\0\0") {
      exif = orientation(bytes, offset + 8, end);
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (size < 8) return null;
      height = view.getUint16(offset + 3);
      width = view.getUint16(offset + 5);
    }
    offset = end;
  }
  return null;
}

function png(bytes: Uint8Array): RasterImageMetadata | null {
  const view = viewOf(bytes);
  if (bytes.length < 45 || ascii(bytes, 12, 4) !== "IHDR" || view.getUint32(8) !== 13) return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  let animated = false;
  let hasPixels = false;
  let exif = 1;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + size;
    if (end > bytes.length) return null;
    if (type === "acTL") {
      if (size !== 8 || view.getUint32(offset + 8) === 0) return null;
      animated = true;
    }
    if (type === "eXIf") exif = orientation(bytes, offset + 8, end - 4);
    if (type === "IDAT" && size > 0) hasPixels = true;
    if (type === "IEND") return size === 0 && end === bytes.length && hasPixels && width && height
      ? { mime: "image/png", extension: "png", ...oriented(width, height, exif), animated } : null;
    offset = end;
  }
  return null;
}

function webp(bytes: Uint8Array): RasterImageMetadata | null {
  const view = viewOf(bytes);
  if (view.getUint32(4, true) + 8 !== bytes.length) return null;
  let width = 0;
  let height = 0;
  let animated = false;
  let hasPixels = false;
  let exif = 1;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const payload = offset + 8;
    const end = payload + size;
    if (end > bytes.length) return null;
    if (type === "VP8X" && size === 10) {
      width = u24le(bytes, payload + 4) + 1;
      height = u24le(bytes, payload + 7) + 1;
      animated = Boolean(bytes[payload] & 2);
    } else if (type === "VP8L" && size >= 5 && bytes[payload] === 0x2f) {
      hasPixels = true;
      if (!width) {
        width = 1 + bytes[payload + 1] + ((bytes[payload + 2] & 0x3f) << 8);
        height = 1 + (bytes[payload + 2] >> 6) + (bytes[payload + 3] << 2) + ((bytes[payload + 4] & 15) << 10);
      }
    } else if (type === "VP8 " && size >= 10 && bytes[payload + 3] === 0x9d && bytes[payload + 4] === 1 && bytes[payload + 5] === 0x2a) {
      hasPixels = true;
      if (!width) {
        width = view.getUint16(payload + 6, true) & 0x3fff;
        height = view.getUint16(payload + 8, true) & 0x3fff;
      }
    } else if (type === "ANMF" && size > 16) {
      animated = true;
      hasPixels = true;
    } else if (type === "ANIM") {
      animated = true;
    } else if (type === "EXIF") {
      exif = orientation(bytes, payload + (ascii(bytes, payload, 6) === "Exif\0\0" ? 6 : 0), end);
    }
    offset = end + (size % 2);
  }
  return offset === bytes.length && width && height && hasPixels
    ? { mime: "image/webp", extension: "webp", ...oriented(width, height, exif), animated } : null;
}

type Box = { type: string; payload: number; end: number };
function boxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const result: Box[] = [];
  const view = viewOf(bytes);
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end) throw new Error("Invalid image box");
    let size = view.getUint32(offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end || view.getUint32(offset + 8) !== 0) throw new Error("Invalid image box");
      size = view.getUint32(offset + 12);
      header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) throw new Error("Invalid image box");
    result.push({ type: ascii(bytes, offset + 4, 4), payload: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}

function avif(bytes: Uint8Array): RasterImageMetadata | null {
  const view = viewOf(bytes);
  const top = boxes(bytes, 0, bytes.length);
  const ftyp = top.find((box) => box.type === "ftyp");
  if (!ftyp || ftyp.end - ftyp.payload < 8) return null;
  const brands = [ascii(bytes, ftyp.payload, 4)];
  for (let offset = ftyp.payload + 8; offset + 4 <= ftyp.end; offset += 4) brands.push(ascii(bytes, offset, 4));
  if (!brands.includes("avif") && !brands.includes("avis")) return null;
  const animated = brands.includes("avis");
  if (!top.some((box) => box.type === "mdat" && box.end > box.payload)) return null;
  const meta = top.find((box) => box.type === "meta");
  if (meta) {
    const children = boxes(bytes, meta.payload + 4, meta.end);
    const pitm = children.find((box) => box.type === "pitm");
    const iprp = children.find((box) => box.type === "iprp");
    if (!pitm || !iprp || pitm.end - pitm.payload < 6) return null;
    const primary = bytes[pitm.payload] === 0 ? view.getUint16(pitm.payload + 4) : view.getUint32(pitm.payload + 4);
    const properties = boxes(bytes, iprp.payload, iprp.end);
    const ipco = properties.find((box) => box.type === "ipco");
    if (!ipco) return null;
    const definitions = boxes(bytes, ipco.payload, ipco.end);
    const selected: Box[] = [];
    for (const ipma of properties.filter((box) => box.type === "ipma")) {
      const version = bytes[ipma.payload];
      const wide = Boolean(bytes[ipma.payload + 3] & 1);
      let cursor = ipma.payload + 8;
      const entries = view.getUint32(ipma.payload + 4);
      for (let entry = 0; entry < entries; entry += 1) {
        const idSize = version < 1 ? 2 : 4;
        if (cursor + idSize + 1 > ipma.end) return null;
        const id = idSize === 2 ? view.getUint16(cursor) : view.getUint32(cursor);
        cursor += idSize;
        const count = bytes[cursor++];
        for (let index = 0; index < count; index += 1) {
          if (cursor + (wide ? 2 : 1) > ipma.end) return null;
          const property = wide ? view.getUint16(cursor) & 0x7fff : bytes[cursor] & 0x7f;
          cursor += wide ? 2 : 1;
          if (id === primary && property) {
            if (!definitions[property - 1]) return null;
            selected.push(definitions[property - 1]);
          }
        }
      }
      if (cursor !== ipma.end) return null;
    }
    const size = selected.find((box) => box.type === "ispe");
    if (!size || size.end - size.payload < 12) return null;
    let width = view.getUint32(size.payload + 4);
    let height = view.getUint32(size.payload + 8);
    const clap = selected.find((box) => box.type === "clap");
    if (clap) {
      if (clap.end - clap.payload < 32) return null;
      width = view.getUint32(clap.payload) / view.getUint32(clap.payload + 4);
      height = view.getUint32(clap.payload + 8) / view.getUint32(clap.payload + 12);
    }
    const rotation = selected.find((box) => box.type === "irot");
    if (rotation && (bytes[rotation.payload] & 1)) [width, height] = [height, width];
    return { mime: "image/avif", extension: "avif", width, height, animated };
  }
  // Sequence-only AVIF stores its display dimensions in the AV1 visual sample entry.
  if (animated) {
    const walk = (list: Box[], depth: number): RasterImageMetadata | null => {
      if (depth > 6) return null;
      for (const box of list) {
        if (box.type === "av01" && box.end - box.payload >= 78) {
          return { mime: "image/avif", extension: "avif", width: view.getUint16(box.payload + 24), height: view.getUint16(box.payload + 26), animated: true };
        }
        if (["moov", "trak", "mdia", "minf", "stbl", "stsd"].includes(box.type)) {
          const result = walk(boxes(bytes, box.payload + (box.type === "stsd" ? 8 : 0), box.end), depth + 1);
          if (result) return result;
        }
      }
      return null;
    };
    return walk(top, 0);
  }
  return null;
}

export function inspectRasterImage(bytes: Uint8Array): RasterImageMetadata | null {
  try {
    let result: RasterImageMetadata | null = null;
    if (bytes[0] === 0xff && bytes[1] === 0xd8) result = jpeg(bytes);
    else if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") result = png(bytes);
    else if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") result = webp(bytes);
    else if (ascii(bytes, 4, 4) === "ftyp") result = avif(bytes);
    return result && Number.isSafeInteger(result.width) && Number.isSafeInteger(result.height) && result.width > 0 && result.height > 0 ? result : null;
  } catch {
    return null;
  }
}

export function isGifImage(bytes: Uint8Array) {
  return ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6));
}
