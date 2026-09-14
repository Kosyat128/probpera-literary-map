import { createHash } from "node:crypto";
import { artifactPath } from "./pwa-artifact.mjs";

export const PWA_PORTRAIT_SELECTION_PATH = "scripts/mobile/native-base-assets.json";
export const PWA_PORTRAIT_PREFIX = "assets/writer-portraits/";
export const PWA_BOOK_COVER_PREFIX = "brand/book-covers/";
const pinFields = ["output", "source", "sourceSha256", "transformation"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const portraitScope = { prefix: PWA_PORTRAIT_PREFIX, label: "portrait" };
const bookCoverScope = { prefix: PWA_BOOK_COVER_PREFIX, label: "book-cover",
  // The canonical selection contains original WebP covers and their WebP
  // thumbnails. It is not an executable, SVG or arbitrary download namespace.
  imagePath: /^(?:thumbs\/)?[A-Za-z0-9][A-Za-z0-9_-]*\.webp$/u };

function selectionPath(value, label) {
  const relative = artifactPath(value);
  if (relative.length > 1024 || /\u007f/u.test(relative) || relative.split("/").some(part => part.endsWith("."))) {
    throw new Error("Invalid canonical " + label + " selection path");
  }
  return relative;
}

function validatePin(record, { prefix, label, imagePath }) {
  if (!object(record)) throw new Error("Invalid canonical " + label + " pin");
  const output = selectionPath(record.output, label), source = selectionPath(record.source, label);
  if (!output.startsWith(prefix) || source !== "public/" + output || record.transformation !== "none"
    || typeof record.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(record.sourceSha256)
    || Object.keys(record).length !== pinFields.length || !pinFields.every(key => Object.hasOwn(record, key))
    || (imagePath && (!imagePath.test(output.slice(prefix.length))
      || output.slice(prefix.length).split("/").some(part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))))) {
    throw new Error("Invalid canonical " + label + " pin: " + output);
  }
}

function selectPinnedAssets(selection, scope) {
  if (!object(selection) || selection.schemaVersion !== 1 || !Array.isArray(selection.files) || selection.files.length > 4096) {
    throw new Error("Missing or invalid canonical asset selection");
  }
  const seen = new Set();
  const selected = [];
  for (const record of selection.files) {
    if (!object(record)) throw new Error("Invalid canonical asset selection record");
    const output = selectionPath(record.output, scope.label);
    const source = selectionPath(record.source, scope.label);
    // Windows packaging must not silently collapse differently cased paths.
    const collisionKey = output.toLowerCase();
    if (seen.has(collisionKey)) throw new Error("Duplicate canonical asset selection: " + output);
    seen.add(collisionKey);
    if (!output.toLowerCase().startsWith(scope.prefix) && !source.toLowerCase().startsWith("public/" + scope.prefix)) continue;
    validatePin(record, scope);
    selected.push({ ...record });
  }
  return selected.sort((a, b) => a.output.localeCompare(b.output));
}

/** Select existing canonical pins; these create no editorial/rights approval. */
export function selectPwaPortraitAssets(selection) {
  return selectPinnedAssets(selection, portraitScope);
}

export function selectPwaBookCoverAssets(selection) {
  return selectPinnedAssets(selection, bookCoverScope);
}

/** Check the source even when an earlier copy already claims this output. */
function assertPinnedCopy(pin, { sourceBytes, outputBytes, provenance } = {}, scope) {
  validatePin(pin, scope);
  if (!(sourceBytes instanceof Uint8Array)) throw new Error("Missing canonical " + scope.label + " source: " + pin.output);
  if (sha(sourceBytes) !== pin.sourceSha256) throw new Error("Stale canonical " + scope.label + " selection: " + pin.source);
  if (outputBytes !== undefined || provenance !== undefined) {
    if (!(outputBytes instanceof Uint8Array) || !object(provenance)
      || Object.keys(provenance).length !== pinFields.length
      || !pinFields.every(key => provenance[key] === pin[key]) || sha(outputBytes) !== pin.sourceSha256) {
      throw new Error("Canonical " + scope.label + " output collision: " + pin.output);
    }
  }
}

export function assertPwaPortraitCopy(pin, evidence) {
  return assertPinnedCopy(pin, evidence, portraitScope);
}

export function assertPwaBookCoverCopy(pin, evidence) {
  return assertPinnedCopy(pin, evidence, bookCoverScope);
}
