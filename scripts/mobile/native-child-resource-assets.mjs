import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { containedFile } from "./pwa-artifact.mjs";
import { childNativeJson } from "./native-child-package-assets.mjs";
import { collectChildNativeMediaOutputs, CHILD_NATIVE_MEDIA_CATALOG } from "./native-child-media-assets.mjs";

export const CHILD_NATIVE_RESOURCE_PIN_SOURCE = "src/child/childNativeResourceReleasePins.json";
export const CHILD_NATIVE_RESOURCE_ASSET_MODULE = "scripts/mobile/native-child-resource-assets.mjs";
export const CHILD_NATIVE_RESOURCE_CATALOG = "child-native/resources/catalog-v2.json";
export const CHILD_NATIVE_RESOURCE_TRANSFORM = "fixed-native-resource-pin-projection-v2";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const require = (fact, message) => { if (!fact) throw new Error("Native child resource: " + message); };
const epoch = n => Number.isSafeInteger(n) && !Object.is(n, -0) && n >= 0 && n <= 8_640_000_000_000_000;
async function ownedSource(root, name, maximum) {
  require(name.startsWith("src/child/") && !/[\\%\u0000-\u0020\u007f]/u.test(name)
    && !name.split("/").some(part => part === ".." || part === ""), "fixed source path");
  let directory = root;
  for (const part of name.split("/")) {
    directory = path.join(directory, part);
    const state = await fs.lstat(directory);
    require(!state.isSymbolicLink() && await fs.realpath(directory) === directory, "unlinked source");
  }
  const file = await containedFile(root, name);
  require(file.size > 0 && file.size <= maximum, "bounded source");
  return file;
}
async function actualSourceSchema(root) {
  // Only the strict fixed-source schema is shared. It has no factory which can
  // issue a native context, permission, deadline, URI or acquisition claim.
  const result = await build({ absWorkingDir: root, entryPoints: ["src/child/childNativeResource.ts"],
    bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
  require(result.outputFiles?.length === 1, "one exact source schema module");
  const schema = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"));
  require(typeof schema.decodeChildNativeResourcePins === "function" && typeof schema.childNativeResourcePath === "function",
    "actual source-owned resource schema");
  return schema;
}
export async function normalizeChildNativeResourcePins(bytes, root) {
  root = await fs.realpath(root);
  const schema = await actualSourceSchema(root);
  const pins = schema.decodeChildNativeResourcePins(childNativeJson(bytes, 524288));
  require(pins, "exact fixed resource pins/schema");
  return pins;
}
export function assertChildNativeResourceMediaClosure(binding, media) {
  // media consists solely of the independently verified current collector's
  // owned output bytes. Caller-supplied flags, profile IDs or URLs grant none.
  const catalogue = media.outputs.find(row => row.output === CHILD_NATIVE_MEDIA_CATALOG);
  require(catalogue, "actual media inventory");
  const pins = childNativeJson(catalogue.bytes, 65536);
  const pin = pins.manifests.find(row => row.manifestChecksum === binding.manifestChecksum
    && row.reviewChecksum === binding.reviewChecksum && row.packageId === binding.packageId
    && row.packageVersion === binding.packageVersion && row.packageChecksum === binding.packageChecksum);
  require(pin, "independently pinned manifest/review/package relation");
  const manifestOutput = media.outputs.find(row => row.output === "child-native/media/manifests/" + binding.manifestChecksum + ".json");
  const reviewOutput = media.outputs.find(row => row.output === "child-native/media/reviews/" + binding.reviewChecksum + ".json");
  require(manifestOutput && reviewOutput && sha(manifestOutput.bytes) === binding.manifestChecksum
    && sha(reviewOutput.bytes) === binding.reviewChecksum, "actual reviewed material bytes");
  const manifest = childNativeJson(manifestOutput.bytes, 524288), review = childNativeJson(reviewOutput.bytes, 524288);
  require(manifest.policyVersion === binding.policyVersion && manifest.policyChecksum === binding.policyChecksum,
    "same native compiled policy");
  const assets = manifest.assets.filter(asset => asset.assetId === binding.assetId);
  require(assets.length === 1, "unique approved media asset");
  const asset = assets[0];
  require(asset.sha256 === binding.assetChecksum && asset.bytes === binding.assetBytes && asset.mime === binding.mime,
    "exact approved binary identity");
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/wav": "wav" }[asset.mime];
  const binary = media.outputs.find(row => row.output === "child-native/media/assets/" + asset.sha256 + "." + ext);
  require(binary && binary.bytes.length === asset.bytes && sha(binary.bytes) === asset.sha256, "actual approved binary output");
  const minimum = Math.max(manifest.validFromEpochMs, review.validFromEpochMs, asset.policy.rights.validFrom);
  const maximum = Math.min(manifest.validUntilEpochMs, review.validUntilEpochMs,
    asset.policy.rights.expiresAt === null ? 8_640_000_000_000_000 : asset.policy.rights.expiresAt);
  require(binding.validFromEpochMs >= minimum && binding.validUntilEpochMs <= maximum,
    "source transport cannot extend reviewed rights lifetime");
}
export async function collectChildNativeResourceOutputs(root, platform, channel, now = Date.now()) {
  root = await fs.realpath(root); require(epoch(now), "explicit current source time");
  const source = await ownedSource(root, CHILD_NATIVE_RESOURCE_PIN_SOURCE, 524288);
  const pins = await normalizeChildNativeResourcePins(source.bytes, root);
  const selected = platform === "ios" && channel === "appStore" ? "ios-ipados"
    : platform === "android" && channel === "googlePlay" ? "android-google"
      : platform === "android" && channel === "ruStore" ? "android-rustore" : null;
  require(selected !== null || (platform === "android" || platform === "ios") && channel === "dev" && pins.origins.length === 0 && pins.resources.length === 0,
    "no unselected remote resource audience");
  // Use the genuine production independent review/signature/binary collector,
  // not an injected caller Boolean, review record or synthetic source port.
  const media = await collectChildNativeMediaOutputs(root, platform, channel, now);
  for (const binding of pins.resources) {
    require(binding.validFromEpochMs <= now && now < binding.validUntilEpochMs, "current fixed source binding");
    assertChildNativeResourceMediaClosure(binding, media);
  }
  const catalog = Buffer.from(JSON.stringify({ schemaVersion: 2, kind: "literary-planet-child-native-resource-catalog-v2",
    platform: selected, resourcePinSourceChecksum: source.sha256, origins: pins.origins, resources: pins.resources }) + "\n");
  require(catalog.length <= 524288, "bounded resource catalog");
  return { pinSource: { path: CHILD_NATIVE_RESOURCE_PIN_SOURCE, sha256: source.sha256 },
    outputs: [{ output: CHILD_NATIVE_RESOURCE_CATALOG, source: CHILD_NATIVE_RESOURCE_PIN_SOURCE,
      sourceSha256: source.sha256, transformation: CHILD_NATIVE_RESOURCE_TRANSFORM,
      outputSha256: sha(catalog), bytes: catalog }] };
}
export async function emitChildNativeResourceAssets(root, staging, platform, channel) {
  require(await fs.realpath(staging) === path.resolve(staging), "owned actual staging");
  const original = await collectChildNativeResourceOutputs(root, platform, channel);
  let directory = staging;
  for (const part of ["child-native", "resources"]) {
    directory = path.join(directory, part);
    try { await fs.mkdir(directory); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const state = await fs.lstat(directory);
    require(state.isDirectory() && !state.isSymbolicLink() && await fs.realpath(directory) === directory,
      "owned resource output directory");
  }
  const output = original.outputs[0];
  await fs.writeFile(path.join(staging, output.output), output.bytes, { flag: "wx" });
  return { pinSource: original.pinSource, outputs: original.outputs.map(({ bytes, ...row }) => row) };
}
