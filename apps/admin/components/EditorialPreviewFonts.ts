import localFont from "next/font/local";

// These are the public site's exact WOFF2 assets. Next bundles them under the
// admin base path, so previews do not depend on the public host or Google Fonts.
// Keep the character subsets separate so both Cyrillic and Latin remain available.
const sansCyrillic = localFont({
  src: [
    { path: "../../../public/fonts/editorial/source-sans-3-cyrillic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/editorial/source-sans-3-cyrillic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../../public/fonts/editorial/source-sans-3-cyrillic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--preview-sans-cyrillic", display: "swap", preload: false, adjustFontFallback: false,
});
const sansLatin = localFont({
  src: [
    { path: "../../../public/fonts/editorial/source-sans-3-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/editorial/source-sans-3-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../../public/fonts/editorial/source-sans-3-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--preview-sans-latin", display: "swap", preload: false, adjustFontFallback: false,
});
const serifCyrillic = localFont({
  src: [
    { path: "../../../public/fonts/editorial/source-serif-4-cyrillic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/editorial/source-serif-4-cyrillic-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../../../public/fonts/editorial/source-serif-4-cyrillic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../../public/fonts/editorial/source-serif-4-cyrillic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--preview-serif-cyrillic", display: "swap", preload: false, adjustFontFallback: false,
});
const serifLatin = localFont({
  src: [
    { path: "../../../public/fonts/editorial/source-serif-4-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/editorial/source-serif-4-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../../../public/fonts/editorial/source-serif-4-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../../public/fonts/editorial/source-serif-4-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--preview-serif-latin", display: "swap", preload: false, adjustFontFallback: false,
});

export const editorialPreviewFonts = [
  sansCyrillic.variable, sansLatin.variable, serifCyrillic.variable, serifLatin.variable,
].join(" ");

// Canvas measurement uses the same exact local bytes under Next's bundled names.
export const editorialPreviewFontFamilies = {
  sans: `${sansCyrillic.style.fontFamily}, ${sansLatin.style.fontFamily}`,
  serif: `${serifCyrillic.style.fontFamily}, ${serifLatin.style.fontFamily}`,
} as const;
