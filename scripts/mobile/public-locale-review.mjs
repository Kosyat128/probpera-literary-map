import { createHash } from "node:crypto";

const ORIGIN = "https://probpera.ru";
const LOCALES = ["ru", "en"];
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_REVIEW_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_INVENTORY_BYTES = 8 * 1024 * 1024 * 1024;
const INPUT_KEYS = ["schemaVersion", "contract", "origin", "locales", "builtHtml", "assets", "content", "copy"];

function fail(code) { throw new Error(code); }
function record(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function keys(value, expected, code) {
  if (!record(value) || Object.keys(value).length !== expected.length ||
      expected.some(key => !Object.hasOwn(value, key))) fail(code);
}
function boundedText(value, maximum, code) {
  if (typeof value !== "string" || !value || value !== value.trim() ||
      value.length > maximum || /[<>\u0000-\u001f\u007f]/u.test(value)) fail(code);
  return value;
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }

/**
 * Canonical JSON record digest, not a raw JSON-file digest or a signature.
 * An expected digest must be supplied independently by the trusted caller;
 * copying a digest from an untrusted review does not establish authorization.
 */
export function publicLocaleReviewDigest(value) {
  let nodes = 0;
  function canonical(item, depth) {
    if (++nodes > 100_000 || depth > 16) fail("review-structure-limit");
    if (typeof item === "string" && item.length > MAX_REVIEW_BYTES) fail("review-byte-limit");
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) {
      if (item.length > 4096 || Object.keys(item).length !== item.length) fail("invalid-review-array");
      return Array.from({ length: item.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(item, index);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) fail("invalid-review-accessor");
        return canonical(descriptor.value, depth + 1);
      });
    }
    if (!record(item)) fail("invalid-review-json");
    const result = Object.create(null);
    for (const key of Object.keys(item).sort()) {
      if (["__proto__", "prototype", "constructor"].includes(key)) fail("invalid-review-key");
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!Object.hasOwn(descriptor, "value")) fail("invalid-review-accessor");
      result[key] = canonical(descriptor.value, depth + 1);
    }
    return result;
  }
  const encoded = JSON.stringify(canonical(value, 0));
  if (Buffer.byteLength(encoded) > MAX_REVIEW_BYTES) fail("review-byte-limit");
  return sha(encoded);
}

function digestRecord(value, withPath, code) {
  keys(value, withPath ? ["path", "sha256", "bytes"] : ["sha256", "bytes"], code);
  if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256) || !Number.isSafeInteger(value.bytes) ||
      value.bytes < 0 || value.bytes > MAX_FILE_BYTES) fail(code);
  if (withPath && (typeof value.path !== "string" || value.path.length > 240 ||
      value.path !== value.path.normalize("NFC") ||
      !/^[\p{L}\p{N}\p{M}._-]+(?:\/[\p{L}\p{N}\p{M}._-]+)*$/u.test(value.path) ||
      value.path.split("/").some(part => part === "." || part.endsWith(".") ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)))) fail(code);
  return withPath ? { path: value.path, sha256: value.sha256, bytes: value.bytes }
    : { sha256: value.sha256, bytes: value.bytes };
}

function normalizeSnapshot(value) {
  keys(value, INPUT_KEYS, "invalid-input-snapshot");
  if (value.schemaVersion !== 1 || value.contract !== "public-locale-inputs-v1" ||
      value.origin !== ORIGIN || !Array.isArray(value.locales) ||
      value.locales.length !== 2 || value.locales.some((locale, index) => locale !== LOCALES[index])) {
    fail("invalid-input-snapshot");
  }
  const builtHtml = digestRecord(value.builtHtml, false, "invalid-built-html-digest");
  if (builtHtml.bytes === 0 || builtHtml.bytes > 2_000_000) fail("invalid-built-html-digest");
  const seenPaths = new Set();
  let totalBytes = builtHtml.bytes;
  const inventories = {};
  for (const group of ["assets", "content", "copy"]) {
    if (!Array.isArray(value[group]) || !value[group].length ||
        value[group].length > (group === "copy" ? 256 : 4096)) fail(`invalid-${group}-inventory`);
    inventories[group] = value[group].map(item => {
      const entry = digestRecord(item, true, `invalid-${group}-record`);
      // Windows paths are case-insensitive. Two spellings of the same input
      // must not become independent claimed evidence records.
      const key = entry.path.toLowerCase();
      if (seenPaths.has(key)) fail("duplicate-input-path");
      seenPaths.add(key);
      totalBytes += entry.bytes;
      if (totalBytes > MAX_INVENTORY_BYTES) fail("input-byte-limit");
      return entry;
    }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  }
  return {
    schemaVersion: 1, contract: "public-locale-inputs-v1", origin: ORIGIN,
    locales: [...LOCALES], builtHtml, ...inventories,
  };
}

/**
 * The build caller supplies inventories hashed from actual contained files.
 * This pure helper cannot prove that a declared inventory is complete or that
 * its bytes were read; the build integration must independently enforce that.
 */
export function createPublicLocaleReviewSnapshot({ builtHtml, assets, content, copy }) {
  if (typeof builtHtml !== "string" || !builtHtml.trim() || Buffer.byteLength(builtHtml) > 2_000_000) {
    fail("invalid-built-html");
  }
  return normalizeSnapshot({
    schemaVersion: 1, contract: "public-locale-inputs-v1", origin: ORIGIN, locales: [...LOCALES],
    builtHtml: { sha256: sha(builtHtml), bytes: Buffer.byteLength(builtHtml) }, assets, content, copy,
  });
}

function validateReviewIdentity(value, role) {
  keys(value, ["status", "identity", "reviewedAt", "evidenceRef"], `invalid-${role}-review`);
  if (value.status !== "approved") fail(`${role}-review-not-approved`);
  boundedText(value.identity, 240, `invalid-${role}-identity`);
  boundedText(value.evidenceRef, 500, `invalid-${role}-evidence`);
  if (typeof value.reviewedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/u.test(value.reviewedAt)) {
    fail(`invalid-${role}-date`);
  }
  const parsed = new Date(value.reviewedAt);
  if (!Number.isFinite(parsed.valueOf()) || !parsed.toISOString().startsWith(value.reviewedAt.replace(/Z$/u, ""))) {
    fail(`invalid-${role}-date`);
  }
}

function validateBody(value, locale) {
  keys(value, ["heading", "paragraphs", "navigationLabel", "links"], `invalid-${locale}-body`);
  const heading = boundedText(value.heading, 200, `invalid-${locale}-heading`);
  const navigationLabel = boundedText(value.navigationLabel, 160, `invalid-${locale}-navigation`);
  if (!Array.isArray(value.paragraphs) || value.paragraphs.length < 1 || value.paragraphs.length > 12) {
    fail(`invalid-${locale}-paragraphs`);
  }
  const paragraphs = value.paragraphs.map(text => boundedText(text, 2000, `invalid-${locale}-paragraph`));
  if (!Array.isArray(value.links) || value.links.length < 1 || value.links.length > 3) fail(`invalid-${locale}-links`);
  const allowedPaths = new Set([`/${locale}/`, `/${locale}/#atlas`, `/${locale}/#books`]);
  const seenPaths = new Set();
  const links = value.links.map(link => {
    keys(link, ["path", "label"], `invalid-${locale}-link`);
    if (!allowedPaths.has(link.path) || seenPaths.has(link.path)) fail(`invalid-${locale}-link-path`);
    seenPaths.add(link.path);
    return { path: link.path, label: boundedText(link.label, 160, `invalid-${locale}-link-label`) };
  });
  const text = [heading, navigationLabel, ...paragraphs, ...links.map(link => link.label)].join(" ");
  if ((locale === "en" && (!/[A-Za-z]/u.test(text) || /\p{Script=Cyrillic}/u.test(text))) ||
      (locale === "ru" && !/\p{Script=Cyrillic}/u.test(text))) fail(`invalid-${locale}-body-language`);
  return { heading, paragraphs, navigationLabel, links };
}

/**
 * Source/copy consistency and explicit provision only, NOT reviewer identity
 * authentication. No approval can be inferred from an artifact's own boolean
 * or digest. The pin is an independent trusted build input, never copied from
 * review JSON automatically. No result here authorizes product/store release.
 */
export function evaluatePublicLocaleReview({ snapshot, review, provisionedReviewSha256 } = {}) {
  const result = {
    scope: "public-localized-homepages-only", indexingAllowed: false,
    robots: "noindex,follow", reviewerAuthentication: "not-performed",
    provision: "absent", inputsSha256: null, reviewSha256: null, bodies: null, diagnostics: [],
  };
  try {
    // Validate plain JSON before touching nested fields, including accessors.
    publicLocaleReviewDigest(snapshot);
    const current = normalizeSnapshot(snapshot);
    result.inputsSha256 = publicLocaleReviewDigest(current);
    if (review === undefined || review === null) fail("review-missing");
    result.reviewSha256 = publicLocaleReviewDigest(review);
    if (typeof provisionedReviewSha256 !== "string" || !SHA256.test(provisionedReviewSha256)) {
      fail("independent-review-pin-missing");
    }
    if (provisionedReviewSha256 !== result.reviewSha256) fail("review-pin-mismatch");
    result.provision = "independent-review-digest-pin";
    keys(review, ["schemaVersion", "contract", "inputs", "inputsSha256", "ownerReview", "locales"], "invalid-review-schema");
    if (review.schemaVersion !== 1 || review.contract !== "public-locale-review-v1") fail("invalid-review-schema");
    const reviewedInputs = normalizeSnapshot(review.inputs);
    if (review.inputsSha256 !== publicLocaleReviewDigest(reviewedInputs)) fail("review-input-digest-mismatch");
    if (review.inputsSha256 !== result.inputsSha256) fail("review-inputs-stale");
    validateReviewIdentity(review.ownerReview, "owner");
    keys(review.locales, LOCALES, "bilingual-review-incomplete");
    const bodies = {};
    for (const locale of LOCALES) {
      keys(review.locales[locale], ["editorialReview", "body"], `invalid-${locale}-review`);
      validateReviewIdentity(review.locales[locale].editorialReview, `${locale}-editorial`);
      bodies[locale] = validateBody(review.locales[locale].body, locale);
    }
    result.indexingAllowed = true;
    result.robots = "index,follow";
    result.bodies = bodies;
  } catch (error) {
    result.diagnostics.push(error instanceof Error ? error.message : "invalid-review-input");
  }
  return result;
}
