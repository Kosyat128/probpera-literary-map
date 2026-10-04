import fs from "node:fs/promises";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { containedFile } from "./pwa-artifact.mjs";
import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";

export const CHILD_NATIVE_PIN_SOURCE = "src/child/childNativeReleasePins.json";
export const CHILD_NATIVE_ASSET_MODULE = "scripts/mobile/native-child-package-assets.mjs";
export const CHILD_NATIVE_CATALOG = "child-native/catalog-v1.json";
export const CHILD_RELEASE_REVIEW_PREFIX = "LP-CHILD-RELEASE-REVIEW\0v1\0";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const epoch = value => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
const positive = value => Number.isSafeInteger(value) && value > 0;
const check = (value, message) => { if (!value) throw new Error(message); };
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const unique = (values, maximum, valid) => Array.isArray(values) && values.length <= maximum
  && values.every(valid) && new Set(values).size === values.length;
const platforms = ["android-google", "android-rustore", "ios-ipados"];
const readings = [null, "plain", "developing", "fluent"];
const reviewFields = ["schemaVersion", "kind", "keyId", "reviewerId", "packageId", "packageVersion", "packageChecksum",
  "policyVersion", "policyChecksum", "locale", "exactAge", "readingLevels", "platforms", "territories",
  "reviewedAtEpochMs", "validFromEpochMs", "validUntilEpochMs", "entityPolicyChecksums", "signatureHex"];

/** Duplicate escaped spellings, UTF-8 errors and oversized structures must
 * fail before either shared TS validation or a native reader interprets data. */
export function childNativeJson(bytes, maximum) {
  check(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= maximum, "Child material byte bound");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes), value = JSON.parse(source);
  const stack = []; let tokens = 0;
  for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/gu)) {
    check(++tokens <= 600_000, "Child material structure bound");
    const token = match[0], current = stack.at(-1);
    if (token === "{") { stack.push({ keys: new Set(), key: true }); check(stack.length <= 16, "Child material depth"); }
    else if (token === "[") { stack.push(null); check(stack.length <= 16, "Child material depth"); }
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && current) current.key = true;
    else if (token.startsWith('"')) {
      const decoded = JSON.parse(token);
      for (let i = 0; i < decoded.length; i++) {
        const unit = decoded.charCodeAt(i);
        if (unit >= 0xd800 && unit <= 0xdbff) { const low = decoded.charCodeAt(++i);check(low >= 0xdc00 && low <= 0xdfff, "Paired child Unicode scalar"); }
        else check(unit < 0xdc00 || unit > 0xdfff, "Paired child Unicode scalar");
      }
      if (current?.key) { check(!current.keys.has(decoded), "Duplicate child material field"); current.keys.add(decoded); current.key = false; }
    }
    else if (/^-?\d/u.test(token)) check(/^(?:0|-?[1-9]\d*)$/u.test(token) && Number.isSafeInteger(Number(token)), "Canonical safe child integer");
  }
  contentPackageCanonicalJson(value); return value;
}
export function normalizeChildNativePins(bytes) {
  const root = childNativeJson(bytes, 65_536);
  check(exact(root, ["schemaVersion", "kind", "reviewKeys", "packages"]) && root.schemaVersion === 1
    && root.kind === "literary-planet-child-native-release-pins-v1", "Fixed child release pin contract");
  check(Array.isArray(root.reviewKeys) && root.reviewKeys.length <= 16 && Array.isArray(root.packages) && root.packages.length <= 32, "Child pin quota");
  const keyIds = new Set(), points = new Set(), pinIds = new Set(), checksums = new Set();
  for (const key of root.reviewKeys) {
    check(exact(key, ["keyId", "reviewerId", "publicKeyX963Hex"]) && /^child-release-review-[A-Za-z0-9_-]{1,48}$/u.test(key.keyId)
      && id(key.reviewerId) && typeof key.publicKeyX963Hex === "string" && /^04[a-f0-9]{128}$/u.test(key.publicKeyX963Hex)
      && !keyIds.has(key.keyId) && !points.has(key.publicKeyX963Hex), "Independent child review key pin");
    keyIds.add(key.keyId); points.add(key.publicKeyX963Hex);
  }
  for (const pin of root.packages) {
    const key = `${pin.packageId}/${pin.packageVersion}`;
    check(exact(pin, ["packageId", "packageVersion", "packageChecksum", "reviewChecksum"]) && id(pin.packageId)
      && positive(pin.packageVersion) && hash(pin.packageChecksum) && hash(pin.reviewChecksum)
      && !pinIds.has(key) && !checksums.has(pin.packageChecksum), "Exact child package/review release pin");
    pinIds.add(key); checksums.add(pin.packageChecksum);
  }
  return root;
}
/** A dedicated independently pinned human key, its exact reviewer identity,
 * a separately release-pinned review artifact and complete policy/payload
 * closure are all required. A package approval flag/signature is insufficient. */
export async function verifyChildReleaseReview(packageBytes, reviewBytes, pin, keys, compiled, profile, platform, territory, now) {
  check(hash(pin?.packageChecksum) && sha(packageBytes) === pin.packageChecksum && hash(pin.reviewChecksum)
    && sha(reviewBytes) === pin.reviewChecksum, "Exact release-pinned child bytes");
  const review = childNativeJson(reviewBytes, 512 * 1024);
  check(exact(review, reviewFields) && review.schemaVersion === 1 && review.kind === "literary-planet-child-release-review-v1"
    && review.packageId === pin.packageId && review.packageVersion === pin.packageVersion && review.packageChecksum === pin.packageChecksum
    && review.policyVersion === compiled.scope.policyVersion && review.policyChecksum === compiled.scope.policyChecksum
    && review.locale === compiled.scope.locale && review.exactAge === compiled.scope.exactAge
    && unique(review.readingLevels, 4, value => readings.includes(value)) && review.readingLevels.includes(profile.readingLevel)
    && unique(review.platforms, 3, value => platforms.includes(value)) && review.platforms.includes(platform)
    && unique(review.territories, 676, value => typeof value === "string" && /^[A-Z]{2}$/u.test(value)) && review.territories.includes(territory)
    && epoch(now) && epoch(review.reviewedAtEpochMs) && review.reviewedAtEpochMs <= now
    && epoch(review.validFromEpochMs) && epoch(review.validUntilEpochMs) && review.validFromEpochMs <= now && now < review.validUntilEpochMs
    && review.validFromEpochMs < review.validUntilEpochMs && typeof review.signatureHex === "string" && /^[a-f0-9]{128}$/u.test(review.signatureHex), "Current child audience/review contract");
  const key = keys.find(key => key.keyId === review.keyId && key.reviewerId === review.reviewerId);
  check(key, "Independent release-pinned reviewer unavailable");
  const publicKey = await webcrypto.subtle.importKey("raw", Buffer.from(key.publicKeyX963Hex, "hex"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const unsigned = { ...review }; delete unsigned.signatureHex;
  const message = Buffer.from(CHILD_RELEASE_REVIEW_PREFIX + contentPackageCanonicalJson(unsigned), "utf8");
  check(await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(review.signatureHex, "hex"), message), "Independent human review signature");
  check(Array.isArray(review.entityPolicyChecksums) && review.entityPolicyChecksums.length === compiled.entities.length, "Complete child review closure");
  const entries = new Map();
  for (const row of review.entityPolicyChecksums) {
    const name = `${row.kind}/${row.id}`;
    check(exact(row, ["kind", "id", "payloadChecksum", "policyChecksum"]) && typeof row.kind === "string" && id(row.id)
      && hash(row.payloadChecksum) && hash(row.policyChecksum) && !entries.has(name), "Child review entity pin"); entries.set(name, row);
  }
  for (const entity of compiled.entities) {
    const row = entries.get(`${entity.reference.kind}/${entity.reference.id}`);
    check(row?.payloadChecksum === entity.reference.contentChecksum && row.policyChecksum === sha(Buffer.from(contentPackageCanonicalJson(entity.policy))), "Reviewed child policy/rights bytes");
    // The current package contract is text/reference only. Media bytes need
    // their separate manifest, inventory and independent media review producer.
    check(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz",
      "search-result", "recommendation", "favorite", "recent", "offline-package", "deep-link"].includes(entity.reference.kind), "Separate child media/URL admission required");
  }
  return { validUntilEpochMs: Math.min(compiled.validUntilEpochMs, review.validUntilEpochMs), reviewChecksum: pin.reviewChecksum };
}
async function fixedSource(root, relative, maximum) {
  let current = root;
  for (const part of relative.split("/")) { current = path.join(current, part); check(!(await fs.lstat(current)).isSymbolicLink(), "Linked child release material"); }
  const source = await containedFile(root, relative); check(source.size > 0 && source.size <= maximum, "Child release material bound"); return source;
}
async function sharedCompiler(root) {
  // Compile the EXISTING shared validator with the already pinned esbuild;
  // no runtime server, transport, arbitrary module or injected approval port.
  const output = await build({ absWorkingDir: root, entryPoints: ["src/child/childPackage.ts"], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
  check(output.outputFiles?.length === 1, "One shared child compiler module required");
  return import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"));
}
export async function emitChildNativeAssets(root, staging, platform, channel) {
  root = await fs.realpath(root); check(await fs.realpath(staging) === path.resolve(staging), "Owned native staging required");
  const source = await fixedSource(root, CHILD_NATIVE_PIN_SOURCE, 65_536), pins = normalizeChildNativePins(source.bytes);
  // Actual current download definitions are read from their source-owned
  // module. Their S08 QA keys/catalog are never imported into child trust.
  const downloads = await import(pathToFileURL(path.join(root, "src/planet/contentDownloadCatalog.ts")));
  check(Array.isArray(downloads.contentDownloadCatalog) && Array.isArray(downloads.contentDownloadTrust), "Actual download catalog definitions required");
  const selected = platform === "ios" && channel === "appStore" ? "ios-ipados" : platform === "android" && channel === "googlePlay" ? "android-google"
    : platform === "android" && channel === "ruStore" ? "android-rustore" : null;
  const compiler = pins.packages.length ? await sharedCompiler(root) : null, outputs = [];
  async function emit(relative, bytes, provenance, sourceSha256, transformation = "none") {
    let directory = staging;
    for (const component of relative.split("/").slice(0, -1)) {
      directory = path.join(directory, component);
      try { await fs.mkdir(directory); } catch (error) { if (error.code !== "EEXIST") throw error; }
      const stat = await fs.lstat(directory); check(stat.isDirectory() && !stat.isSymbolicLink() && await fs.realpath(directory) === directory, "Owned child output directory");
    }
    const destination = path.join(staging, relative);
    await fs.writeFile(destination, bytes, { flag: "wx" });
    outputs.push({ output: relative, source: provenance, sourceSha256, transformation, outputSha256: sha(bytes) });
  }
  for (const pin of pins.packages) {
    const packagePath = `src/child/release-material/${pin.packageChecksum}/package.json`, reviewPath = `src/child/release-material/${pin.reviewChecksum}/review.json`;
    const packageFile = await fixedSource(root, packagePath, 8 * 1024 * 1024), reviewFile = await fixedSource(root, reviewPath, 512 * 1024);
    check(packageFile.sha256 === pin.packageChecksum && reviewFile.sha256 === pin.reviewChecksum, "Stale child release pins");
    const raw = childNativeJson(packageFile.bytes, 8 * 1024 * 1024), review = childNativeJson(reviewFile.bytes, 512 * 1024);
    const now = Date.now();
    check(raw.packageId === pin.packageId && raw.packageVersion === pin.packageVersion && id(raw.policyVersion) && hash(raw.policyChecksum)
      && ["ru", "en"].includes(raw.locale) && Number.isInteger(raw.exactAge) && raw.exactAge >= 3 && raw.exactAge <= 17, "Child source audience");
    check(unique(review.readingLevels, 4, value => readings.includes(value)) && review.readingLevels.length > 0
      && unique(review.platforms, 3, value => platforms.includes(value)) && review.platforms.length > 0
      && unique(review.territories, 676, value => typeof value === "string" && /^[A-Z]{2}$/u.test(value)) && review.territories.length > 0, "Explicit independently reviewed audience");
    const profile = { id: "build-format-validation", label: "Build validation", exactAge: raw.exactAge,
      ageBand: raw.exactAge <= 5 ? "3-5" : raw.exactAge <= 8 ? "6-8" : raw.exactAge <= 11 ? "9-11" : raw.exactAge <= 14 ? "12-14" : "15-17",
      locale: raw.locale, ageConfirmedAt: new Date(now).toISOString(), readingLevel: review.readingLevels[0], allowedTopics: null, blockedTopics: [], soundEnabled: false, motion: "calm", narrationEnabled: false };
    // This build-only synthetic profile validates format/closure for approved
    // source bytes. Native production derives its actual saved full profile.
    const challenge = { generation: 1, request: { locale: raw.locale, route: { kind: "home", entityId: null } }, profile,
      selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: profile.id, profileRevision: 1,
        profileChecksum: sha(Buffer.from(JSON.stringify(profile))), policyVersion: raw.policyVersion, policyChecksum: raw.policyChecksum } };
    for (const audience of review.platforms) for (const territory of review.territories) {
      const compiled = await compiler.compileChildPackage(new Uint8Array(packageFile.bytes), { challenge, platform: audience, territory, nowEpochMs: now,
        signal: new AbortController().signal, digest: { async sha256(bytes) { return sha(bytes); } } });
      check(compiled, "Shared strict child package validation"); await verifyChildReleaseReview(packageFile.bytes, reviewFile.bytes, pin, pins.reviewKeys, compiled, profile, audience, territory, now);
    }
    await emit(`child-native/packages/${pin.packageChecksum}.json`, packageFile.bytes, packagePath, packageFile.sha256);
    await emit(`child-native/reviews/${pin.reviewChecksum}.json`, reviewFile.bytes, reviewPath, reviewFile.sha256);
  }
  const catalog = { schemaVersion: 1, kind: "literary-planet-child-native-assets-v1", platform: selected, pinSourceChecksum: source.sha256,
    reviewKeys: pins.reviewKeys, packages: pins.packages };
  await emit(CHILD_NATIVE_CATALOG, Buffer.from(JSON.stringify(catalog) + "\n"), CHILD_NATIVE_PIN_SOURCE, source.sha256, "fixed-native-pin-projection-v1");
  return { pinSource: { path: CHILD_NATIVE_PIN_SOURCE, sha256: source.sha256 }, outputs };
}
