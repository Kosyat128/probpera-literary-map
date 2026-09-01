import { describe, expect, it } from "vitest";

import {
  CLIENT_IMAGE_ACCEPT_ATTRIBUTE,
  isAcceptedClientImageType,
} from "./client-image-upload";

describe("safe client image source formats", () => {
  it.each([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/heic",
    "image/heif",
    "image/jxl",
  ])("accepts raster source %s for browser decoding and WebP conversion", (type) => {
    expect(isAcceptedClientImageType(type)).toBe(true);
    expect(CLIENT_IMAGE_ACCEPT_ATTRIBUTE).toContain(type);
  });

  it.each(["image/svg+xml", "text/html", "application/pdf", "application/postscript"])(
    "rejects executable or document source %s",
    (type) => expect(isAcceptedClientImageType(type)).toBe(false)
  );
});
