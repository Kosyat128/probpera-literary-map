import { createHash } from "node:crypto";
import { artifactPath } from "./pwa-artifact.mjs";

export const PWA_PORTRAIT_SELECTION_PATH = "scripts/mobile/native-base-assets.json";
export const PWA_PORTRAIT_PREFIX = "assets/writer-portraits/";
const pinFields = ["output", "source", "sourceSha256", "transformation"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

function selectionPath(value) {
  const relative = artifactPath(value);
  if (relative.length > 1024 || /\u007f/u.test(relative) || relative.split("/").some(part => part.endsWith("."))) {
    throw new Error("Invalid canonical portrait selection path");
  }
  return relative;
}

/** Select existing canonical portrait pins; this creates no editorial/rights approval. */
export function selectPwaPortraitAssets(selection) {
  if (!object(selection) || selection.schemaVersion !== 1 || !Array.isArray(selection.files) || selection.files.length > 4096) {
    throw new Error("Missing or invalid canonical asset selection");
  }
  const seen = new Set();
  const portraits = [];
  for (const record of selection.files) {
    if (!object(record)) throw new Error("Invalid canonical asset selection record");
    const output = selectionPath(record.output);
    const source = selectionPath(record.source);
    // Windows packaging must not silently collapse differently cased paths.
    const collisionKey = output.toLowerCase();
    if (seen.has(collisionKey)) throw new Error("Duplicate canonical asset selection: " + output);
    seen.add(collisionKey);
    const isPortrait = output.startsWith(PWA_PORTRAIT_PREFIX);
    if (!output.toLowerCase().startsWith(PWA_PORTRAIT_PREFIX) && !source.toLowerCase().startsWith("public/" + PWA_PORTRAIT_PREFIX)) continue;
    if (!isPortrait || source !== "public/" + output || record.transformation !== "none"
      || !/^[a-f0-9]{64}$/u.test(record.sourceSha256)
      || Object.keys(record).length !== pinFields.length || !pinFields.every(key => Object.hasOwn(record, key))) {
      throw new Error("Invalid canonical portrait pin: " + output);
    }
    portraits.push({ ...record });
  }
  return portraits.sort((a, b) => a.output.localeCompare(b.output));
}

/** Check the source even when an earlier copy already claims this output. */
export function assertPwaPortraitCopy(pin, { sourceBytes, outputBytes, provenance } = {}) {
  if (!(sourceBytes instanceof Uint8Array)) throw new Error("Missing canonical portrait source: " + pin.output);
  if (sha(sourceBytes) !== pin.sourceSha256) throw new Error("Stale canonical portrait selection: " + pin.source);
  if (outputBytes !== undefined || provenance !== undefined) {
    if (!(outputBytes instanceof Uint8Array) || !object(provenance)
      || Object.keys(provenance).length !== pinFields.length
      || !pinFields.every(key => provenance[key] === pin[key]) || sha(outputBytes) !== pin.sourceSha256) {
      throw new Error("Canonical portrait output collision: " + pin.output);
    }
  }
}
