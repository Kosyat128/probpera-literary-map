import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WriterProfile } from "../data/countries/types";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import WriterPortrait, {
  approvedWriterPortraitUrl,
  writerHasApprovedPortrait,
} from "./WriterPortrait";

const approvedWriter: WriterProfile = {
  id: "approved-writer",
  name: "Проверенный Автор",
  portrait: "assets/writer-portraits/approved.webp",
  portraitAlt: "Проверенный Автор, фотография",
  portraitSourceUrl: "https://example.org/approved-writer",
  portraitRights: {
    status: "licensed",
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    creator: "Documented photographer",
    sourceUrl: "https://example.org/approved-writer",
    checkedAt: "2026-08-31",
  },
};

function renderPortrait(
  writer: WriterProfile,
  props: Partial<ComponentProps<typeof WriterPortrait>> = {}
) {
  return renderToStaticMarkup(
    <InterfaceLanguageProvider>
      <WriterPortrait writer={writer} {...props} />
    </InterfaceLanguageProvider>
  );
}

describe("WriterPortrait", () => {
  it("renders an approved image with useful alt text and no initials", () => {
    const markup = renderPortrait(approvedWriter);

    expect(writerHasApprovedPortrait(approvedWriter)).toBe(true);
    expect(approvedWriterPortraitUrl(approvedWriter)).toContain(
      "assets/writer-portraits/approved.webp"
    );
    expect(markup).toContain("writer-portrait-media has-image");
    expect(markup).toContain("<img");
    expect(markup).toContain('alt="Проверенный Автор, фотография"');
    expect(markup).not.toContain("writer-portrait-initials");
  });

  it("keeps an empty layout slot without inventing a visual or image semantics", () => {
    const markup = renderPortrait({
      id: "no-photo",
      name: "Автор Без Фотографии",
    });

    expect(markup).toContain("writer-portrait-media is-empty");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain("aria-label");
    expect(markup).not.toContain("АБ");
    expect(markup).not.toContain("заглуш");
  });

  it("fails closed for a bare URL, unverified rights and incomplete approval", () => {
    const bareUrlWriter: WriterProfile = {
      id: "bare-url",
      name: "Bare URL",
      portrait: "https://example.org/image.jpg",
    };
    const unverifiedWriter: WriterProfile = {
      ...approvedWriter,
      id: "unverified",
      portraitRights: {
        ...approvedWriter.portraitRights!,
        status: "unverified",
      },
    };
    const mismatchedSourceWriter: WriterProfile = {
      ...approvedWriter,
      id: "source-mismatch",
      portraitRights: {
        ...approvedWriter.portraitRights!,
        sourceUrl: "https://example.org/different-source",
      },
    };

    expect(writerHasApprovedPortrait(bareUrlWriter)).toBe(false);
    expect(writerHasApprovedPortrait(unverifiedWriter)).toBe(false);
    expect(writerHasApprovedPortrait(mismatchedSourceWriter)).toBe(false);
    expect(renderPortrait(unverifiedWriter)).not.toContain("<img");
  });

  it("keeps approved decorative images silent", () => {
    const markup = renderPortrait(approvedWriter, { decorative: true });

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('alt=""');
    expect(markup).not.toContain('role="img"');
  });

  it("hides the empty slot in CSS while preserving its box in layout", () => {
    const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
    const emptyRule = css.match(
      /\.writer-portrait-media\.is-empty\s*\{(?<body>[^}]+)\}/u
    )?.groups?.body;
    const writerRule = css.match(
      /\.writer-portrait\s*\{(?<body>[^}]+)\}/u
    )?.groups?.body;
    const searchRule = css.match(
      /\.global-search-writer-portrait\s*\{(?<body>[^}]+)\}/u
    )?.groups?.body;
    const emptyShowcaseRule = css.match(
      /\.author-showcase button:has\(\.author-showcase-portrait\.is-empty\)::after\s*\{(?<body>[^}]+)\}/u
    )?.groups?.body;

    expect(emptyRule).toContain("visibility: hidden");
    expect(emptyRule).toContain("background: none");
    expect(emptyRule).not.toContain("display: none");
    expect(writerRule).toContain("background: transparent");
    expect(writerRule).not.toContain("gradient");
    expect(searchRule).toContain("background: transparent");
    expect(searchRule).not.toContain("gradient");
    expect(emptyShowcaseRule).toContain("background: rgba(");
    expect(emptyShowcaseRule).not.toContain("gradient");
  });
});
