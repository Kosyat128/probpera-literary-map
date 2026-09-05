import { useEffect } from "react";
import { type InterfaceLanguage, useInterfaceLanguage } from "../planet/localization";
import { canonicalJournalOrigin, isControlledWebEdition } from "../platform/distribution";
import {
  setHeadMetadataValue as setHeadValue,
  setMetadataAttribute as setAttribute,
} from "../i18n/headMetadata";

// Existing canonical interface strings; parity with generated shells is tested.
const localeMetadata = {
  ru: { title: "Литературная планета", ogLocale: "ru_RU", alternate: "en_US" },
  en: { title: "Literary Planet", ogLocale: "en_US", alternate: "ru_RU" },
} as const;

function isPwaEntryPath(pathname: string) {
  return /^\/planet(?:\/(?:index\.html|(?:ru|en)(?:\/(?:index\.html)?)?)?)?$/u.test(pathname);
}

/** Side effects are restricted to the current entry URL and document metadata. */
export function syncPwaLocaleMetadata(language: InterfaceLanguage) {
  if (!isControlledWebEdition || typeof window === "undefined") return;
  if (language !== "ru" && language !== "en") return;
  const { location, history, document } = window;
  if (!isPwaEntryPath(location.pathname)) return;
  const route = `/planet/${language}/`;
  const canonical = `${canonicalJournalOrigin}${route}`;
  const metadata = localeMetadata[language];
  if (location.pathname !== route) {
    // Keep semantic selection parameters, fragment and immersive history marker.
    history.replaceState(history.state, "", `${route}${location.search}${location.hash}`);
  }
  setAttribute(document.documentElement, "lang", language);
  setAttribute(document.documentElement, "data-route-language", language);
  document.documentElement.removeAttribute("data-pwa-neutral-entry");
  if (document.title !== metadata.title) document.title = metadata.title;
  setHeadValue(document, "link", "rel", "canonical", "href", canonical);
  setHeadValue(document, "link", "rel", "manifest", "href", `${route}manifest.webmanifest`);
  for (const locale of ["ru", "en"] as const) {
    setHeadValue(document, "link", "hreflang", locale, "href", `${canonicalJournalOrigin}/planet/${locale}/`);
  }
  setHeadValue(document, "link", "hreflang", "x-default", "href", `${canonicalJournalOrigin}/planet/`);
  for (const [name, content] of Object.entries({
    description: metadata.title,
    robots: "noindex,nofollow",
    "theme-color": "#f67518",
    "twitter:card": "summary",
    "twitter:title": metadata.title,
    "twitter:description": metadata.title,
    "twitter:image:alt": metadata.title,
  })) setHeadValue(document, "meta", "name", name, "content", content);
  for (const [property, content] of Object.entries({
    "og:type": "website",
    "og:title": metadata.title,
    "og:description": metadata.title,
    "og:site_name": metadata.title,
    "og:url": canonical,
    "og:locale": metadata.ogLocale,
    "og:locale:alternate": metadata.alternate,
    "og:image:alt": metadata.title,
  })) setHeadValue(document, "meta", "property", property, "content", content);
  // Image URLs and favicon assets remain the exact values supplied by the build.
}

/** Mount once inside the existing language provider, outside scene ownership. */
export default function PwaLocaleMetadata() {
  const { language } = useInterfaceLanguage();
  useEffect(() => { syncPwaLocaleMetadata(language); }, [language]);
  return null;
}
