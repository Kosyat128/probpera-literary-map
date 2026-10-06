import fs from "node:fs/promises";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { build } from "esbuild";
import { containedFile } from "./pwa-artifact.mjs";
import { childNativeJson, normalizeChildNativePins, CHILD_NATIVE_PIN_SOURCE, CHILD_RELEASE_REVIEW_PREFIX } from "./native-child-package-assets.mjs";
import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";

export const CHILD_NATIVE_MEDIA_PIN_SOURCE = "src/child/childNativeMediaReleasePins.json";
export const CHILD_NATIVE_MEDIA_ASSET_MODULE = "scripts/mobile/native-child-media-assets.mjs";
export const CHILD_NATIVE_MEDIA_CATALOG = "child-native/media/catalog-v2.json";
export const CHILD_NATIVE_MEDIA_REVIEW_PREFIX = "LP-CHILD-NATIVE-MEDIA-REVIEW\0v2\0";
export const CHILD_NATIVE_MEDIA_TRANSFORM = "fixed-native-media-pin-projection-v2";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => Buffer.from(contentPackageCanonicalJson(value), "utf8");
const checksum = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max;
const epoch = value => integer(value, 0, 8_640_000_000_000_000);
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const require = (value, message) => { if (!value) throw new Error("Native child media: " + message); };
const array = (value, maximum, valid) => Array.isArray(value) && value.length <= maximum && value.every(valid);
const unique = (value, maximum, valid) => array(value, maximum, valid) && new Set(value).size === value.length;
const readings = [null, "plain", "developing", "fluent"];
const platforms = ["android-google", "android-rustore", "ios-ipados"];
const textKinds = ["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz", "search-result", "recommendation", "favorite", "recent", "offline-package", "deep-link"];
const mediaKinds = ["image", "narration", "background", "skin", "stand", "accessory"];
const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/wav": "wav", "model/gltf+json": "gltf", "model/gltf-binary": "glb", "application/octet-stream": "bin" };
const manifestFields = ["schemaVersion", "kind", "manifestId", "manifestVersion", "packageId", "packageVersion", "packageChecksum",
  "policyVersion", "policyChecksum", "locale", "exactAge", "readingLevels", "validFromEpochMs", "validUntilEpochMs", "assets"];
const reviewFields = ["schemaVersion", "kind", "keyId", "reviewerId", "manifestId", "manifestVersion", "manifestChecksum",
  "packageId", "packageVersion", "packageChecksum", "policyVersion", "policyChecksum", "locale", "exactAge", "readingLevels",
  "platforms", "territories", "reviewedAtEpochMs", "validFromEpochMs", "validUntilEpochMs", "assetChecksums", "signatureHex"];
const policyFields = ["id", "kind", "sourceVersion", "policyVersion", "minAge", "maxAge", "reviewStatus", "localizedContent",
  "topics", "topicTagsComplete", "commercialAvailability", "rights"];
export const childNativeMediaSha256 = sha;
export const childNativeMediaCanonical = canonical;
/** The independently signed media payload pins the raw provenance document by
 * qualityChecksum. These factual source fields add no editorial approval. */
export function validateChildNativeNarrationProvenance(bytes, asset, locale, durationMs) {
  require(asset?.mime === "audio/wav" && asset.payload?.role === "narration" && sha(bytes) === asset.payload.qualityChecksum,
    "exact signed narration provenance bytes");
  const value = childNativeJson(bytes, 65536), bounded = (text, max) => typeof text === "string" && text.length > 0
    && text.length <= max && text.trim() === text && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text);
  require(exact(value, ["schemaVersion", "kind", "scriptId", "scriptChecksum", "performerId", "licensorId", "locale", "accent",
    "pronunciationNotes", "durationMs", "loudnessReport", "qualityReport", "reducedAudioFallback", "voiceKind"])
    && value.schemaVersion === 1 && value.kind === "literary-planet-child-narration-provenance-v1"
    && id(value.scriptId) && checksum(value.scriptChecksum) && value.scriptId === asset.payload.scriptId && value.scriptChecksum === asset.payload.scriptChecksum
    && id(value.performerId) && value.performerId === asset.payload.performerId && id(value.licensorId) && value.locale === locale
    && ["ru", "en"].includes(locale) && bounded(value.accent, 96) && !/[\u0000-\u001f\u007f]/u.test(value.accent) && bounded(value.pronunciationNotes, 8192)
    && bounded(value.loudnessReport, 8192) && bounded(value.qualityReport, 8192) && integer(value.durationMs, 1, 60000)
    && typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 60000 && Math.abs(value.durationMs - durationMs) <= 1
    && value.reducedAudioFallback === "same-locale-text" && ["human-original", "human-licensed"].includes(value.voiceKind),
    "complete locale/script/performer/licensor/pronunciation/duration/quality/fallback provenance");
  return value;
}
export function childNativeNarrationDurationMs(bytes) {
  require(Buffer.isBuffer(bytes) && bytes.length >= 44 && bytes.length <= 24 * 1024 * 1024
    && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE", "bounded PCM source");
  let offset = 12, rate = 0, block = 0, data = -1;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(offset + 4), end = offset + 8 + size;
    require(end <= bytes.length, "complete PCM source chunk");
    const tag = bytes.toString("ascii", offset, offset + 4);
    if (tag === "fmt ") { require(size >= 16 && rate === 0, "unique PCM format"); rate = bytes.readUInt32LE(offset + 12); block = bytes.readUInt16LE(offset + 20); }
    if (tag === "data") { require(data === -1, "unique PCM data"); data = size; }
    offset = end + (size % 2);
  }
  require(rate > 0 && block > 0 && data > 0 && data % block === 0 && offset === bytes.length, "whole PCM duration");
  const duration = data / block / rate * 1000; require(Number.isFinite(duration) && duration > 0 && duration <= 60000, "bounded narration duration");
  return duration;
}
export function normalizeChildNativeMediaPins(bytes) {
  const pins = childNativeJson(bytes, 65536);
  require(exact(pins, ["schemaVersion", "kind", "reviewKeys", "manifests"]) && pins.schemaVersion === 2
    && pins.kind === "literary-planet-child-native-media-release-pins-v2", "fixed independent pin schema");
  require(array(pins.reviewKeys, 16, key => exact(key, ["keyId", "reviewerId", "publicKeyX963Hex"])
    && typeof key.keyId === "string" && /^child-media-review-[A-Za-z0-9_-]{1,48}$/u.test(key.keyId)
    && id(key.reviewerId) && /^04[a-f0-9]{128}$/u.test(key.publicKeyX963Hex)), "independent review keys");
  require(new Set(pins.reviewKeys.map(key => key.keyId)).size === pins.reviewKeys.length
    && new Set(pins.reviewKeys.map(key => key.publicKeyX963Hex)).size === pins.reviewKeys.length, "ambiguous review keys");
  require(array(pins.manifests, 32, pin => exact(pin, ["manifestId", "manifestVersion", "manifestChecksum", "reviewChecksum",
    "packageId", "packageVersion", "packageChecksum"]) && id(pin.manifestId) && integer(pin.manifestVersion, 1, Number.MAX_SAFE_INTEGER)
    && id(pin.packageId) && integer(pin.packageVersion, 1, Number.MAX_SAFE_INTEGER) && checksum(pin.manifestChecksum)
    && checksum(pin.reviewChecksum) && checksum(pin.packageChecksum)), "manifest pin schema");
  require(new Set(pins.manifests.map(pin => pin.manifestId + "/" + pin.manifestVersion)).size === pins.manifests.length
    && new Set(pins.manifests.map(pin => pin.manifestChecksum)).size === pins.manifests.length, "ambiguous manifest pins");
  require(!pins.manifests.length || pins.reviewKeys.length > 0, "missing authentic media reviewer");
  return pins;
}
function reference(value, allowed) {
  require(exact(value, ["kind", "id", "contentChecksum"]) && allowed.includes(value.kind) && id(value.id)
    && checksum(value.contentChecksum), "exact owner/media reference"); return value;
}
function actualTextOwner(entry) {
  require(exact(entry, ["policy", "payload"]) && exact(entry.payload, ["title", "text", "terms", "references"])
    && entry.policy && textKinds.includes(entry.policy.kind) && id(entry.policy.id)
    && typeof entry.payload.title === "string" && typeof entry.payload.text === "string"
    && array(entry.payload.terms, 64, value => typeof value === "string")
    && array(entry.payload.references, 64, value => exact(value, ["kind", "id", "contentChecksum"]) && textKinds.includes(value.kind) && id(value.id) && checksum(value.contentChecksum)), "actual compiled owner payload schema");
  const payload = entry.payload;
  const bytes = Buffer.from(JSON.stringify({ title: payload.title, text: payload.text, terms: payload.terms,
    references: payload.references.map(ref => ({ kind: ref.kind, id: ref.id, contentChecksum: ref.contentChecksum })) }));
  return { kind: entry.policy.kind, id: entry.policy.id, contentChecksum: sha(bytes) };
}
function currentWindow(value, now) {
  require(epoch(now) && epoch(value.validFromEpochMs) && epoch(value.validUntilEpochMs)
    && value.validFromEpochMs <= now && now < value.validUntilEpochMs, "current review/rights window");
}
function policy(value, manifest, entity, payloadChecksum, now) {
  require(exact(value, policyFields) && value.id === entity.id && value.kind === entity.kind && id(value.sourceVersion)
    && value.policyVersion === manifest.policyVersion && integer(value.minAge, 3, 17) && integer(value.maxAge, 3, 17)
    && value.minAge <= manifest.exactAge && manifest.exactAge <= value.maxAge && value.reviewStatus === "approved"
    && value.topicTagsComplete === true && value.commercialAvailability === "included-in-base"
    && unique(value.topics, 64, topic => typeof topic === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(topic)), "complete media policy");
  require(Array.isArray(value.localizedContent) && value.localizedContent.length === 1, "exact localized media review");
  const localized = value.localizedContent[0];
  require(exact(localized, ["locale", "contentChecksum", "reviewStatus", "available", "reviewerId", "reviewedAt"])
    && localized.locale === manifest.locale && localized.contentChecksum === payloadChecksum && localized.reviewStatus === "approved"
    && localized.available === true && id(localized.reviewerId) && epoch(localized.reviewedAt) && localized.reviewedAt <= now, "current locale payload review");
  const rights = value.rights;
  require(exact(rights, ["status", "basis", "platforms", "territories", "validFrom", "expiresAt"]) && rights.status === "approved"
    && ["original", "public-domain"].includes(rights.basis)
    && unique(rights.platforms, 4, entry => ["web-pwa", ...platforms].includes(entry))
    && unique(rights.territories, 676, entry => typeof entry === "string" && /^[A-Z]{2}$/u.test(entry))
    && rights.platforms.length && rights.territories.length && epoch(rights.validFrom) && rights.validFrom <= now
    && (rights.expiresAt === null || epoch(rights.expiresAt) && rights.validFrom < rights.expiresAt && now < rights.expiresAt), "independent media rights");
}
export function validateChildNativeMediaManifest(bytes, pin, textPackageBytes, now) {
  require(checksum(pin?.manifestChecksum) && sha(bytes) === pin.manifestChecksum && sha(textPackageBytes) === pin.packageChecksum, "release-pinned manifest/package bytes");
  const manifest = childNativeJson(bytes, 524288), pack = childNativeJson(textPackageBytes, 8388608);
  require(exact(manifest, manifestFields) && manifest.schemaVersion === 2 && manifest.kind === "literary-planet-child-native-media-manifest-v2"
    && manifest.manifestId === pin.manifestId && manifest.manifestVersion === pin.manifestVersion
    && manifest.packageId === pin.packageId && manifest.packageVersion === pin.packageVersion && manifest.packageChecksum === pin.packageChecksum
    && pack.packageId === manifest.packageId && pack.packageVersion === manifest.packageVersion
    && id(manifest.policyVersion) && checksum(manifest.policyChecksum) && pack.policyVersion === manifest.policyVersion
    && pack.policyChecksum === manifest.policyChecksum && ["ru", "en"].includes(manifest.locale) && pack.locale === manifest.locale
    && integer(manifest.exactAge, 3, 17) && pack.exactAge === manifest.exactAge
    && unique(manifest.readingLevels, 4, level => readings.includes(level)) && manifest.readingLevels.length, "fixed manifest/package audience");
  currentWindow(manifest, now);
  require(Array.isArray(pack.entities) && pack.entities.length <= 4096 && Array.isArray(manifest.assets)
    && manifest.assets.length > 0 && manifest.assets.length <= 512, "media/index quota");
  const owners = new Map();
  for (const entry of pack.entities) {
    const owner = actualTextOwner(entry), key = owner.kind + "/" + owner.id;
    require(!owners.has(key), "unique actual compiled owner");
    owners.set(key, owner);
  }
  const ids = new Set(), relations = new Set(), inventory = new Map();
  for (const asset of manifest.assets) {
    require(exact(asset, ["assetId", "owner", "entity", "payload", "policy", "inventoryKey", "sha256", "bytes", "mime"]) && id(asset.assetId)
      && !ids.has(asset.assetId), "complete unique media asset"); ids.add(asset.assetId);
    const owner = reference(asset.owner, textKinds), entity = reference(asset.entity, mediaKinds), known = owners.get(owner.kind + "/" + owner.id);
    require(known && known.contentChecksum === owner.contentChecksum, "owner belongs to current reviewed text package");
    const payload = asset.payload;
    require(exact(payload, ["role", "altText", "transcript", "scriptId", "scriptChecksum", "performerId", "qualityChecksum"])
      && typeof payload.altText === "string" && payload.altText.length > 0 && payload.altText.length <= 240
      && !/[\u0000-\u001f\u007f]/u.test(payload.altText), "bounded media presentation");
    if (entity.kind === "narration") {
      require(payload.role === "narration" && asset.mime === "audio/wav" && typeof payload.transcript === "string"
        && payload.transcript.length > 0 && payload.transcript.length <= 32768 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(payload.transcript)
        && id(payload.scriptId) && id(payload.performerId) && payload.scriptChecksum === sha(Buffer.from(payload.transcript, "utf8"))
        && checksum(payload.qualityChecksum), "reviewed narration script/performer/quality provenance");
    } else require(asset.mime !== "audio/wav" && (asset.mime.startsWith("image/") || ["stand","background"].includes(entity.kind)) && (entity.kind === "image" ? ["image", "portrait"].includes(payload.role) : payload.role === entity.kind)
      && ["transcript", "scriptId", "scriptChecksum", "performerId", "qualityChecksum"].every(key => payload[key] === null), "static image role");
    require(sha(canonical(payload)) === entity.contentChecksum, "media payload pin");
    policy(asset.policy, manifest, entity, entity.contentChecksum, now);
    const ext = extensions[asset.mime];
    require(ext && typeof asset.inventoryKey === "string" && /^[a-z0-9][a-z0-9_-]{0,63}\.(png|jpg|webp|wav|gltf|glb|bin)$/u.test(asset.inventoryKey)
      && asset.inventoryKey.endsWith("." + ext) && checksum(asset.sha256) && integer(asset.bytes, 1, asset.mime === "audio/wav" ? 24 * 1024 * 1024 : 32 * 1024 * 1024), "fixed binary identity/MIME/bounds");
    const relation = owner.kind + "/" + owner.id + "/" + entity.kind + "/" + entity.id;
    require(!relations.has(relation), "ambiguous owner/media relationship"); relations.add(relation);
    const identity = asset.sha256 + "/" + asset.bytes + "/" + asset.mime;
    require(!inventory.has(asset.inventoryKey) || inventory.get(asset.inventoryKey) === identity, "ambiguous inventory identity");
    inventory.set(asset.inventoryKey, identity);
  }
  return manifest;
}
async function verifySignature(review, keys, prefix) {
  const key = keys.find(key => key.keyId === review.keyId && key.reviewerId === review.reviewerId);
  require(key && typeof review.signatureHex === "string" && /^[a-f0-9]{128}$/u.test(review.signatureHex), "independent pinned reviewer/signature");
  const publicKey = await webcrypto.subtle.importKey("raw", Buffer.from(key.publicKeyX963Hex, "hex"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const unsigned = { ...review }; delete unsigned.signatureHex;
  require(await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(review.signatureHex, "hex"),
    Buffer.concat([Buffer.from(prefix, "utf8"), canonical(unsigned)])), "authentic independent signature");
}
export async function verifyChildNativeMediaReview(manifestBytes, reviewBytes, pin, keys, manifest, now) {
  require(sha(manifestBytes) === pin.manifestChecksum && sha(reviewBytes) === pin.reviewChecksum, "exact signed media artifacts");
  const review = childNativeJson(reviewBytes, 524288);
  require(exact(review, reviewFields) && review.schemaVersion === 2 && review.kind === "literary-planet-child-native-media-review-v2", "independent review schema");
  for (const key of ["manifestId", "manifestVersion", "packageId", "packageVersion", "packageChecksum", "policyVersion", "policyChecksum", "locale", "exactAge"])
    require(review[key] === manifest[key], "review binds actual manifest audience " + key);
  require(review.manifestChecksum === pin.manifestChecksum && unique(review.readingLevels, 4, level => readings.includes(level))
    && manifest.readingLevels.every(level => review.readingLevels.includes(level))
    && unique(review.platforms, 3, entry => platforms.includes(entry)) && review.platforms.length
    && unique(review.territories, 676, entry => typeof entry === "string" && /^[A-Z]{2}$/u.test(entry)) && review.territories.length
    && epoch(review.reviewedAtEpochMs) && review.reviewedAtEpochMs <= now, "review audience/territories");
  currentWindow(review, now); await verifySignature(review, keys, CHILD_NATIVE_MEDIA_REVIEW_PREFIX);
  require(Array.isArray(review.assetChecksums) && review.assetChecksums.length === manifest.assets.length, "complete independent media closure");
  const closure = new Map();
  for (const row of review.assetChecksums) {
    require(exact(row, ["assetId", "ownerChecksum", "entityChecksum", "policyChecksum", "binaryChecksum", "bytes", "mime"])
      && id(row.assetId) && !closure.has(row.assetId), "unique signed media relationship"); closure.set(row.assetId, row);
  }
  for (const asset of manifest.assets) {
    const row = closure.get(asset.assetId);
    require(row && row.ownerChecksum === sha(canonical(asset.owner)) && row.entityChecksum === asset.entity.contentChecksum
      && row.policyChecksum === sha(canonical(asset.policy)) && row.binaryChecksum === asset.sha256 && row.bytes === asset.bytes
      && row.mime === asset.mime && review.platforms.every(platform => asset.policy.rights.platforms.includes(platform))
      && review.territories.every(territory => asset.policy.rights.territories.includes(territory)), "reviewed asset/policy/binary/rights closure");
  }
  return { review, validUntilEpochMs: Math.min(manifest.validUntilEpochMs, review.validUntilEpochMs) };
}
async function ownedSource(root, name, maximum) {
  require(name.startsWith("src/child/") && !/[\\%\u0000-\u0020\u007f]/u.test(name) && !name.split("/").includes(".."), "fixed source path");
  let current = root;
  for (const part of name.split("/")) { current = path.join(current, part); require(!(await fs.lstat(current)).isSymbolicLink(), "linked source"); }
  const file = await containedFile(root, name); require(file.size > 0 && file.size <= maximum, "owned source size"); return file;
}
export async function sourceBinaryPreflight(root) {
  // Reuse only the source-owned pure container/resource validator. It mints no
  // challenge, epoch, permit or rights. Native admission and actual decode
  // remain independent on the original LOCAL2 worker.
  const module = await build({ absWorkingDir: root, entryPoints: ["src/child/childMediaDecode.ts"],
    bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
  require(module.outputFiles?.length === 1, "one fixed binary preflight");
  const compiled = await import("data:text/javascript;base64," + Buffer.from(module.outputFiles[0].contents).toString("base64"));
  require(typeof compiled.preflightChildMedia === "function", "actual bounded source binary validator");
  return compiled.preflightChildMedia;
}
export async function collectChildNativeMediaOutputs(root, platform, channel, now = Date.now()) {
  root = await fs.realpath(root);
  const source = await ownedSource(root, CHILD_NATIVE_MEDIA_PIN_SOURCE, 65536), pins = normalizeChildNativeMediaPins(source.bytes);
  const selected = platform === "ios" && channel === "appStore" ? "ios-ipados" : platform === "android" && channel === "googlePlay" ? "android-google"
    : platform === "android" && channel === "ruStore" ? "android-rustore" : null;
  require(selected !== null || channel === "dev" && pins.reviewKeys.length === 0 && pins.manifests.length === 0, "no unselected media release audience");
  const outputs = new Map();
  function add(output, file, transformation = "none") {
    const previous = outputs.get(output);
    const row = { output, source: file.name, sourceSha256: file.sha256, transformation, outputSha256: sha(file.bytes), bytes: Buffer.from(file.bytes) };
    require(!previous || previous.source === row.source && previous.outputSha256 === row.outputSha256, "conflicting fixed media output");
    if (!previous) outputs.set(output, row);
  }
  const catalog = Buffer.from(JSON.stringify({ schemaVersion: 2, kind: "literary-planet-child-native-media-catalog-v2",
    platform: selected, mediaPinSourceChecksum: source.sha256, reviewKeys: pins.reviewKeys, manifests: pins.manifests }) + "\n");
  add(CHILD_NATIVE_MEDIA_CATALOG, { name: CHILD_NATIVE_MEDIA_PIN_SOURCE, sha256: source.sha256, bytes: catalog }, CHILD_NATIVE_MEDIA_TRANSFORM);
  const textSource = await ownedSource(root, CHILD_NATIVE_PIN_SOURCE, 65536), textPins = normalizeChildNativePins(textSource.bytes);
  const allBinaries = new Set(), preflight = pins.manifests.length ? await sourceBinaryPreflight(root) : null;
  for (const pin of pins.manifests) {
    const textPin = textPins.packages.find(row => row.packageId === pin.packageId && row.packageVersion === pin.packageVersion && row.packageChecksum === pin.packageChecksum);
    require(textPin, "actual independently pinned text owner package missing");
    const textPackage = await ownedSource(root, "src/child/release-material/" + pin.packageChecksum + "/package.json", 8388608);
    const textReview = await ownedSource(root, "src/child/release-material/" + textPin.reviewChecksum + "/review.json", 524288);
    require(textPackage.sha256 === pin.packageChecksum && textReview.sha256 === textPin.reviewChecksum, "exact independently pinned text artifacts");
    const review = childNativeJson(textReview.bytes, 524288), pack = childNativeJson(textPackage.bytes, 8388608);
    require(exact(review, ["schemaVersion", "kind", "keyId", "reviewerId", "packageId", "packageVersion", "packageChecksum", "policyVersion", "policyChecksum", "locale", "exactAge", "readingLevels", "platforms", "territories", "reviewedAtEpochMs", "validFromEpochMs", "validUntilEpochMs", "entityPolicyChecksums", "signatureHex"]) && review.schemaVersion === 1 && review.kind === "literary-planet-child-release-review-v1" && review.packageChecksum === pin.packageChecksum
      && review.packageId === pin.packageId && review.packageVersion === pin.packageVersion, "authentic original text review identity");
    require(["policyVersion", "policyChecksum", "locale", "exactAge"].every(key => review[key] === pack[key])
      && unique(review.readingLevels, 4, level => readings.includes(level)) && review.readingLevels.length
      && unique(review.platforms, 3, entry => platforms.includes(entry)) && review.platforms.includes(selected)
      && unique(review.territories, 676, entry => typeof entry === "string" && /^[A-Z]{2}$/u.test(entry)) && review.territories.length
      && epoch(review.reviewedAtEpochMs) && review.reviewedAtEpochMs <= now, "original owner review audience");
    currentWindow(review, now); await verifySignature(review, textPins.reviewKeys, CHILD_RELEASE_REVIEW_PREFIX);
    require(Array.isArray(review.entityPolicyChecksums) && review.entityPolicyChecksums.length === pack.entities.length, "text owner review closure");
    for (const entry of pack.entities) {
      const owner = actualTextOwner(entry);
      const closed = review.entityPolicyChecksums.filter(row => row.kind === owner.kind && row.id === owner.id);
      require(closed.length === 1 && exact(closed[0], ["kind", "id", "payloadChecksum", "policyChecksum"]) && closed[0].payloadChecksum === owner.contentChecksum
        && closed[0].policyChecksum === sha(canonical(entry.policy)), "owner text entity independently reviewed");
    }
    const manifestFile = await ownedSource(root, "src/child/media-release-material/" + pin.manifestChecksum + "/manifest.json", 524288);
    const reviewFile = await ownedSource(root, "src/child/media-release-material/" + pin.reviewChecksum + "/review.json", 524288);
    const manifest = validateChildNativeMediaManifest(manifestFile.bytes, pin, textPackage.bytes, now);
    require(manifest.readingLevels.every(level => review.readingLevels.includes(level)), "media audience belongs to independently reviewed owner audience");
    const authenticated = await verifyChildNativeMediaReview(manifestFile.bytes, reviewFile.bytes, pin, pins.reviewKeys, manifest, now);
    require(authenticated.review.territories.every(territory => review.territories.includes(territory)), "media territories belong to owner review");
    require(authenticated.review.platforms.includes(selected), "current selected media platform");
    add("child-native/media/manifests/" + pin.manifestChecksum + ".json", { ...manifestFile, name: "src/child/media-release-material/" + pin.manifestChecksum + "/manifest.json" });
    add("child-native/media/reviews/" + pin.reviewChecksum + ".json", { ...reviewFile, name: "src/child/media-release-material/" + pin.reviewChecksum + "/review.json" });
    for (const asset of manifest.assets) {
      const ext = extensions[asset.mime], name = "src/child/media-release-material/" + asset.sha256 + "/asset." + ext;
      const binary = await ownedSource(root, name, asset.mime === "audio/wav" ? 24 * 1024 * 1024 : 32 * 1024 * 1024);
      require(binary.sha256 === asset.sha256 && binary.size === asset.bytes, "actual pinned binary bytes");
      if(asset.mime.startsWith("image/")||asset.mime==="audio/wav")require(preflight(new Uint8Array(binary.bytes), asset.mime), "static raster/PCM container and decoded resource bounds");
      // Typed model/buffer decode happens against the complete reviewed scene
      // dependency closure; a container-only MIME probe never admits a model.
      else require(["model/gltf+json","model/gltf-binary","application/octet-stream"].includes(asset.mime)&&["stand","background"].includes(asset.entity.kind),"typed model dependency only");
      if (asset.mime === "audio/wav") {
        const qualityName = "src/child/media-release-material/" + asset.payload.qualityChecksum + "/quality.json";
        const quality = await ownedSource(root, qualityName, 65536);
        validateChildNativeNarrationProvenance(quality.bytes, asset, manifest.locale, childNativeNarrationDurationMs(binary.bytes));
        add("child-native/media/provenance/" + asset.payload.qualityChecksum + ".json", { ...quality, name: qualityName });
      }
      allBinaries.add(asset.sha256 + "." + ext); require(allBinaries.size <= 512, "global binary quota");
      add("child-native/media/assets/" + asset.sha256 + "." + ext, { ...binary, name });
    }
  }
  require(outputs.size <= 1089, "bounded complete media and narration provenance output inventory");
  return { pinSource: { path: CHILD_NATIVE_MEDIA_PIN_SOURCE, sha256: source.sha256 },
    outputs: [...outputs.values()].sort((a, b) => a.output < b.output ? -1 : a.output > b.output ? 1 : 0) };
}
export async function emitChildNativeMediaAssets(root, staging, platform, channel) {
  require(await fs.realpath(staging) === path.resolve(staging), "owned staging");
  const original = await collectChildNativeMediaOutputs(root, platform, channel);
  for (const row of original.outputs) {
    let directory = staging;
    for (const part of row.output.split("/").slice(0, -1)) {
      directory = path.join(directory, part);
      try { await fs.mkdir(directory); } catch (error) { if (error.code !== "EEXIST") throw error; }
      const state = await fs.lstat(directory);
      require(state.isDirectory() && !state.isSymbolicLink() && await fs.realpath(directory) === directory, "owned media output directory");
    }
    await fs.writeFile(path.join(staging, row.output), row.bytes, { flag: "wx" });
  }
  return { pinSource: original.pinSource, outputs: original.outputs.map(({ bytes, ...row }) => row) };
}
