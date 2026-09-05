import { useEffect } from "react";
import { type InterfaceLanguage, useInterfaceLanguage } from "./InterfaceLanguage";
import { canonicalJournalOrigin, isControlledWebEdition } from "../platform/distribution";
import { setHeadMetadataValue, setMetadataAttribute } from "./headMetadata";

// Existing authored interface copy, checked against the generated public shells.
const metadataByLanguage = {
  ru: { title: "Проба Пера", description: "Литературный журнал и энциклопедия", ogLocale: "ru_RU", alternate: "en_US" },
  en: { title: "Proba Pera", description: "Literary journal and encyclopedia", ogLocale: "en_US", alternate: "ru_RU" },
} as const;

function structuredData(language: InterfaceLanguage) {
  const metadata = metadataByLanguage[language];
  const canonical = `${canonicalJournalOrigin}/${language}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${canonicalJournalOrigin}/#website`, url: `${canonicalJournalOrigin}/`, name: metadata.title, inLanguage: language },
      { "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: metadata.title,
        description: metadata.description, inLanguage: language, isPartOf: { "@id": `${canonicalJournalOrigin}/#website` } },
    ],
  };
}

export function syncPublicLocaleMetadata(language: InterfaceLanguage) {
  if (isControlledWebEdition || typeof window === "undefined") return;
  if (language !== "ru" && language !== "en") return;
  const { location, history, document } = window;
  // Existing root, article, CMS and controlled PWA routes retain their owners.
  if (!/^\/(?:ru|en)(?:\/(?:index\.html)?)?$/u.test(location.pathname)) return;
  const route = `/${language}/`;
  const canonical = `${canonicalJournalOrigin}${route}`;
  const metadata = metadataByLanguage[language];
  if (location.pathname !== route) {
    history.replaceState(history.state, "", `${route}${location.search}${location.hash}`);
  }
  setMetadataAttribute(document.documentElement, "lang", language);
  setMetadataAttribute(document.documentElement, "data-route-language", language);
  setMetadataAttribute(document.body, "lang", language);
  if (document.title !== metadata.title) document.title = metadata.title;
  setHeadMetadataValue(document, "link", "rel", "canonical", "href", canonical);
  for (const locale of ["ru", "en"] as const) {
    setHeadMetadataValue(document, "link", "hreflang", locale, "href", `${canonicalJournalOrigin}/${locale}/`);
  }
  setHeadMetadataValue(document, "link", "hreflang", "x-default", "href", `${canonicalJournalOrigin}/`);
  for (const [name, content] of Object.entries({
    description: metadata.description,
    robots: "noindex,follow",
    "twitter:card": "summary",
    "twitter:title": metadata.title,
    "twitter:description": metadata.description,
  })) setHeadMetadataValue(document, "meta", "name", name, "content", content);
  for (const [property, content] of Object.entries({
    "og:type": "website", "og:title": metadata.title,
    "og:description": metadata.description, "og:site_name": metadata.title,
    "og:url": canonical, "og:locale": metadata.ogLocale, "og:locale:alternate": metadata.alternate,
  })) setHeadMetadataValue(document, "meta", "property", property, "content", content);
  // Shared manifest, icons, CSS and image URLs remain exactly build-selected.
  if (document.head.querySelector('meta[property="og:image"]')) {
    setHeadMetadataValue(document, "meta", "property", "og:image:alt", "content", metadata.title);
  }
  if (document.head.querySelector('meta[name="twitter:image"]')) {
    setHeadMetadataValue(document, "meta", "name", "twitter:image:alt", "content", metadata.title);
  }
  const ownedSchemas = [...document.head.querySelectorAll('script[data-public-locale-structured-data]')];
  const schema = ownedSchemas.shift() ?? document.createElement("script");
  for (const duplicate of ownedSchemas) duplicate.remove();
  setMetadataAttribute(schema, "type", "application/ld+json");
  setMetadataAttribute(schema, "data-public-locale-structured-data", "");
  const content = JSON.stringify(structuredData(language), null, 2).replace(/</gu, "\\u003c") + "\n";
  if (schema.textContent !== content) schema.textContent = content;
  if (!schema.parentNode) document.head.appendChild(schema);
}

/** A metadata consumer of the existing provider, never another locale owner. */
export default function PublicLocaleMetadata() {
  const { language } = useInterfaceLanguage();
  useEffect(() => { syncPublicLocaleMetadata(language); }, [language]);
  return null;
}
