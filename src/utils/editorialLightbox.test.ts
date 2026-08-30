import { describe, expect, it } from "vitest";

import {
  editorialLightboxAllowsImage,
  editorialLightboxMediaItem,
} from "./editorialLightbox";

describe("editorial lightbox policy", () => {
  it("allows an ordinary editorial image", () => {
    expect(
      editorialLightboxAllowsImage({
        linked: false,
      })
    ).toBe(true);
  });

  it.each([
    { decorative: "true", linked: false },
    { lightbox: "false", linked: false },
    { linked: true },
    { galleryLightbox: "false", linked: false },
  ])("excludes non-interactive image context %#", (candidate) => {
    expect(editorialLightboxAllowsImage(candidate)).toBe(false);
  });

  it("normalizes a relative image source into a media item", () => {
    expect(
      editorialLightboxMediaItem({
        rawSource: "../media/illustration.webp",
        baseUrl: "https://probpera.ru/stranitsy/o-proekte/",
        alt: "  Иллюстрация страницы  ",
        caption: "  Подпись  ",
      })
    ).toEqual({
      src: "https://probpera.ru/stranitsy/media/illustration.webp",
      alt: "Иллюстрация страницы",
      caption: "Подпись",
    });
  });

  it("rejects empty and executable media sources", () => {
    expect(
      editorialLightboxMediaItem({
        rawSource: "",
        baseUrl: "https://probpera.ru/",
      })
    ).toBeNull();
    expect(
      editorialLightboxMediaItem({
        rawSource: "javascript:alert(1)",
        baseUrl: "https://probpera.ru/",
      })
    ).toBeNull();
    expect(
      editorialLightboxMediaItem({
        rawSource: "#page-fragment",
        baseUrl: "https://probpera.ru/",
      })
    ).toBeNull();
    expect(
      editorialLightboxMediaItem({
        rawSource: "//untrusted.example/image.webp",
        baseUrl: "https://probpera.ru/",
      })
    ).toBeNull();
  });
});
