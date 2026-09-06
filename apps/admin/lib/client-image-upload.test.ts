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
  ])("accepts storage-supported raster source %s", (type) => {
    expect(isAcceptedClientImageType(type)).toBe(true);
    expect(CLIENT_IMAGE_ACCEPT_ATTRIBUTE).toContain(type);
  });

  it.each(["image/svg+xml", "text/html", "application/pdf", "application/postscript", "image/gif", "image/tiff", "image/heic", "image/jxl"])(
    "rejects executable or document source %s",
    (type) => expect(isAcceptedClientImageType(type)).toBe(false)
  );
});
