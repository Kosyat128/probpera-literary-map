import {
  bookDossierProfiles, bookDossierTemplates, BOOK_DOSSIER_LIMITS,
  type BookDossierDraft, type BookDossierIssue,
} from "./bookDossierDocument";

export const BOOK_DOSSIER_SOURCE_HOSTS = Object.freeze([
  "probpera.ru", "rsl.ru", "rusneb.ru", "prlib.ru", "loc.gov", "openlibrary.org",
  "gutenberg.org", "wikidata.org", "britannica.com", "bnf.fr", "bl.uk",
  // Existing reviewed original catalogue descriptions cite these primary sources.
  // A host permits a reference URL; it never grants ownership of its text.
  "orwellfoundation.com", "penguin.co.uk", "simonandschuster.com", "orionbooks.co.uk",
  "cambridge.org", "buddenbrookhaus.de", "goethe.de", "tolstoy.ru", "azbooka.ru",
  "rsc.org.uk", "shakespeare.org.uk", "hodder.co.uk", "davidmitchellbooks.com",
  "univ-rouen.fr", "feb-web.ru", "chekhovmuseum.com", "broadviewpress.com",
  "ox.ac.uk", "thebookerprizes.com", "hachette.co.uk", "kent.ac.uk",
  "penguinrandomhouse.com", "manchester.ac.uk",
]);
const spoilers = ["NONE", "LIGHT", "MAJOR", "ENDING"];
const modes = ["BEFORE_READING", "DURING_READING", "AFTER_READING"];
const kinds = ["metadata", "editorial", "key-points", "timeline", "characters", "relationships", "themes", "related-articles", "sources", "legal-links", "colophon", "quote", "media", "full-text"];
const purposes = ["identity", "why-read", "description", "passport", "journal", "provenance", "legal-reading", "context", "analysis", "navigation", "colophon"];
const rightsClasses = ["EDITORIAL_OWNED", "FACTUAL_METADATA", "PUBLIC_DOMAIN_VERIFIED", "OPEN_LICENSE_VERIFIED", "LICENSED_VERIFIED", "EXTERNAL_LINK_ONLY", "BLOCKED"];
const idPattern = /^[a-z0-9][a-z0-9_.:-]{0,95}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;

export function isBookDossierUrl(value: unknown, hosts: readonly string[] = BOOK_DOSSIER_SOURCE_HOSTS) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\\]/u.test(value)) return false;
  if (/^\/(?:en\/)?stati\/[a-z0-9/_-]+\/?$/u.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export function validateBookDossierDraft(value: unknown, hosts: readonly string[] = BOOK_DOSSIER_SOURCE_HOSTS, allowIncomplete = false): { draft: BookDossierDraft | null; issues: BookDossierIssue[] } {
  const issues: BookDossierIssue[] = [];
  const fail = (code: string, path: string) => { issues.push({ code, path }); };
  const object = (entry: unknown, path: string, keys: readonly string[]) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(entry))) {
      fail("object-required", path); return {} as Record<string, unknown>;
    }
    const result = entry as Record<string, unknown>;
    for (const key of Object.keys(result)) if (!keys.includes(key)) fail("unknown-field", `${path}.${key}`);
    return result;
  };
  const text = (entry: unknown, path: string, maximum = 240, optional = false) => {
    if (optional && entry === undefined) return;
    if (allowIncomplete && entry === "") return;
    if (typeof entry !== "string" || !entry.trim() || entry.length > maximum || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(entry)) fail("plain-text-required", path);
  };
  const choice = (entry: unknown, path: string, values: readonly string[]) => {
    if (typeof entry !== "string" || !values.includes(entry)) fail("invalid-choice", path);
  };
  const id = (entry: unknown, path: string) => { if (typeof entry !== "string" || !idPattern.test(entry)) fail("invalid-id", path); };
  const digest = (entry: unknown, path: string) => { if (typeof entry !== "string" || !digestPattern.test(entry)) fail("invalid-checksum", path); };
  const date = (entry: unknown, path: string, nullable = false) => {
    if (nullable && entry === null) return;
    if (allowIncomplete && entry === "") return;
    if (typeof entry !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/u.test(entry) || !Number.isFinite(Date.parse(entry)) ||
      new Date(entry).toISOString().slice(0, 19) !== entry.slice(0, 19)) fail("invalid-date", path);
  };
  const list = (entry: unknown, path: string, maximum: number, minimum = 0): unknown[] => {
    if (!Array.isArray(entry) || entry.length < (allowIncomplete ? 0 : minimum) || entry.length > maximum) { fail("finite-list-required", path); return []; }
    return entry;
  };
  const ids = (entry: unknown, path: string, maximum = 24) => {
    const entries = list(entry, path, maximum);
    entries.forEach((item, index) => id(item, `${path}.${index}`));
    if (new Set(entries).size !== entries.length) fail("duplicate-reference", path);
  };
  const url = (entry: unknown, path: string) => { if (!(allowIncomplete && entry === "") && !isBookDossierUrl(entry, hosts)) fail("url-not-allowlisted", path); };
  const root = object(value, "dossier", ["schemaVersion", "bookKey", "locale", "dossierVersion", "title", "writer", "profile", "tier", "requiredLocales", "translationReadyLocales", "sections", "blocks", "sources", "rights"]);
  if (root.schemaVersion !== 2) fail("schema-version", "schemaVersion");
  if (typeof root.bookKey !== "string" || root.bookKey.length > 240 || !/^[^\s<>/?#\\:]+:[^\s<>/?#\\:]+:[^\s<>/?#\\]+$/u.test(root.bookKey)) fail("invalid-book-key", "bookKey");
  choice(root.locale, "locale", ["ru", "en"]);
  id(root.dossierVersion, "dossierVersion"); text(root.title, "title"); text(root.writer, "writer");
  choice(root.profile, "profile", bookDossierProfiles); choice(root.tier, "tier", Object.keys(BOOK_DOSSIER_LIMITS));
  for (const field of ["requiredLocales", "translationReadyLocales"]) list(root[field], field, 2, 1).forEach(locale => choice(locale, field, ["ru", "en"]));
  const sections = list(root.sections, "sections", 18, 1);
  sections.forEach((entry, index) => {
    const path = `sections.${index}`, section = object(entry, path, ["id", "title", "template", "purpose", "blockIds", "spoiler"]);
    id(section.id, `${path}.id`); text(section.title, `${path}.title`);
    choice(section.template, `${path}.template`, bookDossierTemplates); choice(section.purpose, `${path}.purpose`, purposes);
    choice(section.spoiler, `${path}.spoiler`, spoilers);
    ids(section.blockIds, `${path}.blockIds`, 8);
  });
  const blocks = list(root.blocks, "blocks", 72, 1);
  blocks.forEach((entry, index) => {
    const path = `blocks.${index}`, block = object(entry, path, ["id", "sectionId", "kind", "title", "paragraphs", "items", "sourceIds", "rightsId", "spoiler", "readingModes", "availableAfterItemId", "translationId", "articleReuse"]);
    id(block.id, `${path}.id`); id(block.sectionId, `${path}.sectionId`); id(block.rightsId, `${path}.rightsId`);
    choice(block.kind, `${path}.kind`, kinds); text(block.title, `${path}.title`);
    list(block.paragraphs, `${path}.paragraphs`, 3).forEach((paragraph, i) => text(paragraph, `${path}.paragraphs.${i}`, 1200));
    const items = list(block.items, `${path}.items`, block.kind === "themes" ? 8 : block.kind === "timeline" || block.kind === "related-articles" ? 12 : 24);
    items.forEach((entry, i) => {
      const itemPath = `${path}.items.${i}`, item = object(entry, itemPath, ["id", "label", "text", "value", "href", "sourceIds", "spoiler", "fromId", "toId"]);
      id(item.id, `${itemPath}.id`); text(item.label, `${itemPath}.label`);
      text(item.text, `${itemPath}.text`, 480, true); text(item.value, `${itemPath}.value`, 240, true);
      if (item.href !== undefined) url(item.href, `${itemPath}.href`);
      for (const field of ["fromId", "toId"]) if (item[field] !== undefined) id(item[field], `${itemPath}.${field}`);
      ids(item.sourceIds, `${itemPath}.sourceIds`); choice(item.spoiler, `${itemPath}.spoiler`, spoilers);
    });
    ids(block.sourceIds, `${path}.sourceIds`); choice(block.spoiler, `${path}.spoiler`, spoilers);
    list(block.readingModes, `${path}.readingModes`, 3, 1).forEach(mode => choice(mode, `${path}.readingModes`, modes));
    for (const field of ["availableAfterItemId", "translationId"]) if (block[field] !== undefined) id(block[field], `${path}.${field}`);
    if (block.articleReuse !== undefined) {
      const reuse = object(block.articleReuse, `${path}.articleReuse`, ["reuseInBookDossier", "articleId", "sourceBlockId", "sourceVersion", "approvedExcerpt", "checksum", "approvedBy", "approvedAt"]);
      if (reuse.reuseInBookDossier !== true) fail("reuse-not-approved", path);
      for (const field of ["articleId", "sourceBlockId", "approvedBy"]) id(reuse[field], `${path}.articleReuse.${field}`);
      text(reuse.sourceVersion, `${path}.articleReuse.sourceVersion`, 160);
      text(reuse.approvedExcerpt, `${path}.articleReuse.approvedExcerpt`, 1200);
      digest(reuse.checksum, `${path}.articleReuse.checksum`); date(reuse.approvedAt, `${path}.articleReuse.approvedAt`);
    }
  });
  const sources = list(root.sources, "sources", 24, 1);
  sources.forEach((entry, index) => {
    const path = `sources.${index}`, source = object(entry, path, ["id", "provider", "title", "url", "kind", "reviewedAt", "reviewedBy", "attribution"]);
    id(source.id, `${path}.id`); if (source.reviewedBy !== null) id(source.reviewedBy, `${path}.reviewedBy`);
    for (const field of ["provider", "title", "attribution"]) text(source[field], `${path}.${field}`);
    url(source.url, `${path}.url`); date(source.reviewedAt, `${path}.reviewedAt`, true);
    choice(source.kind, `${path}.kind`, ["editorial", "library", "publisher", "rightsholder", "reference"]);
  });
  const rights = list(root.rights, "rights", 72, 1);
  rights.forEach((entry, index) => {
    const path = `rights.${index}`, grant = object(entry, path, ["id", "classification", "contentType", "author", "rightsBasis", "rightsHolder", "sourceIds", "territories", "allowedSurfaces", "allow3D", "allowHTML", "allowIndexing", "allowDownload", "allowOfflineCache", "startsAt", "expiresAt", "revokedAt", "recheckAt", "attribution", "evidenceIds", "reviewedBy", "reviewedAt", "reviewKind", "contentChecksum", "originalWork", "originalAuthor", "sourceLanguage", "translation"]);
    id(grant.id, `${path}.id`); if (grant.reviewedBy !== null) id(grant.reviewedBy, `${path}.reviewedBy`);
    for (const field of ["author", "rightsBasis", "rightsHolder", "attribution", "originalWork", "originalAuthor", "sourceLanguage"]) text(grant[field], `${path}.${field}`);
    choice(grant.classification, `${path}.classification`, rightsClasses);
    choice(grant.contentType, `${path}.contentType`, ["editorial", "metadata", "external-link", "quote", "media", "full-text"]);
    choice(grant.reviewKind, `${path}.reviewKind`, ["HUMAN", "UNREVIEWED"]);
    ids(grant.sourceIds, `${path}.sourceIds`); ids(grant.evidenceIds, `${path}.evidenceIds`);
    list(grant.territories, `${path}.territories`, 16, 1).forEach(territory => text(territory, `${path}.territories`, 80));
    list(grant.allowedSurfaces, `${path}.allowedSurfaces`, 5, 1).forEach(surface => choice(surface, `${path}.allowedSurfaces`, ["HTML", "3D", "INDEX", "DOWNLOAD", "OFFLINE"]));
    for (const field of ["allow3D", "allowHTML", "allowIndexing", "allowDownload", "allowOfflineCache"]) if (typeof grant[field] !== "boolean") fail("boolean-required", `${path}.${field}`);
    for (const field of ["startsAt", "recheckAt"]) date(grant[field], `${path}.${field}`);
    date(grant.reviewedAt, `${path}.reviewedAt`, true);
    date(grant.expiresAt, `${path}.expiresAt`, true); date(grant.revokedAt, `${path}.revokedAt`, true);
    digest(grant.contentChecksum, `${path}.contentChecksum`);
    if (grant.translation !== undefined) {
      const translation = object(grant.translation, `${path}.translation`, ["id", "translator", "publication", "rightsBasis", "evidenceIds", "approvedTextChecksum", "reviewedBy", "reviewedAt"]);
      id(translation.id, `${path}.translation.id`); if (translation.reviewedBy !== null) id(translation.reviewedBy, `${path}.translation.reviewedBy`);
      for (const field of ["translator", "publication", "rightsBasis"]) text(translation[field], `${path}.translation.${field}`);
      ids(translation.evidenceIds, `${path}.translation.evidenceIds`); digest(translation.approvedTextChecksum, `${path}.translation.approvedTextChecksum`); date(translation.reviewedAt, `${path}.translation.reviewedAt`, true);
    }
  });
  for (const [name, entries] of [["sections", sections], ["blocks", blocks], ["sources", sources], ["rights", rights]] as const) {
    const entryIds = entries.map(entry => entry && typeof entry === "object" ? (entry as Record<string, unknown>).id : undefined);
    if (new Set(entryIds).size !== entryIds.length) fail("duplicate-id", name);
  }
  return { draft: issues.length ? null : value as BookDossierDraft, issues };
}
