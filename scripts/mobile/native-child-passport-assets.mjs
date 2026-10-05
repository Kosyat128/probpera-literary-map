import fs from "node:fs/promises";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { build } from "esbuild";
import { containedFile } from "./pwa-artifact.mjs";
import { childNativeJson, normalizeChildNativePins, verifyChildReleaseReview, CHILD_NATIVE_PIN_SOURCE } from "./native-child-package-assets.mjs";
import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";

export const CHILD_NATIVE_PASSPORT_PIN_SOURCE = "src/child/childNativePassportProgramReleasePins.json";
export const CHILD_NATIVE_PASSPORT_ASSET_MODULE = "scripts/mobile/native-child-passport-assets.mjs";
export const CHILD_NATIVE_PASSPORT_CATALOG = "child-native/passport/catalog-v1.json";
export const CHILD_NATIVE_PASSPORT_TRANSFORM = "fixed-native-passport-program-pin-projection-v1";
export const CHILD_NATIVE_PASSPORT_REVIEW_DOMAIN = "LP-CHILD-PASSPORT-PROGRAM-REVIEW\0v1\0";
export const CHILD_NATIVE_PASSPORT_REVIEW_FIELDS = ["schemaVersion", "kind", "keyId", "reviewerId", "programId", "programVersion", "programChecksum",
  "packageId", "packageVersion", "packageChecksum", "policyVersion", "policyChecksum", "locale", "exactAge", "platforms", "territories",
  "reviewedAtEpochMs", "validFromEpochMs", "validUntilEpochMs", "signatureHex"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const require = (fact, message) => { if (!fact) throw new Error("Native child passport: " + message); };
const exact = (value, fields) => value && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).sort().join("\0") === fields.slice().sort().join("\0");
const epoch = value => Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 8_640_000_000_000_000;
const window = (value, now) => epoch(value.validFromEpochMs) && epoch(value.validUntilEpochMs)
  && value.validFromEpochMs <= now && now < value.validUntilEpochMs;
const unique = (values, maximum, valid) => Array.isArray(values) && values.length > 0 && values.length <= maximum
  && values.every(valid) && new Set(values).size === values.length;
async function source(root, name, maximum = 524288) {
  require(typeof name === "string" && !/[\\%\u0000-\u0020\u007f]/u.test(name) && name.split("/").every(part => part && part !== "." && part !== ".."), "closed source path");
  let current = root;
  for (const part of name.split("/")) {
    current = path.join(current, part); const info = await fs.lstat(current);
    require(!info.isSymbolicLink() && await fs.realpath(current) === current, "unlinked original material");
  }
  const file = await containedFile(root, name); require(file.size > 0 && file.size <= maximum, "bounded original material");
  return { name, ...file };
}
async function schemas(root) {
  const compiled = await build({ absWorkingDir: root, entryPoints: ["src/child/childNativePassportProgram.ts"], bundle: true,
    write: false, format: "esm", platform: "node", logLevel: "silent" });
  require(compiled.outputFiles?.length === 1, "one actual passport schema");
  const schema = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"));
  return schema;
}
export async function normalizeChildNativePassportPins(bytes, root) {
  const schema = await schemas(await fs.realpath(root)), pins = schema.decodeChildNativePassportProgramPins(childNativeJson(bytes, 65536));
  require(pins, "closed independent source-owned program pins"); return pins;
}
export async function verifyChildNativePassportReview(program, review, pin, keys, now) {
  require(epoch(now) && exact(review, CHILD_NATIVE_PASSPORT_REVIEW_FIELDS) && review.schemaVersion === 1
    && review.kind === "literary-planet-child-passport-program-review-v1" && window(review, now) && window(program, now)
    && epoch(review.reviewedAtEpochMs) && review.reviewedAtEpochMs <= now && review.programChecksum === pin.programChecksum,
  "current independent program review");
  for (const field of ["programId", "programVersion", "packageId", "packageVersion", "packageChecksum", "policyVersion", "policyChecksum", "locale", "exactAge"])
    require(review[field] === program[field], "exact reviewed " + field);
  require(review.validFromEpochMs >= program.validFromEpochMs && review.validUntilEpochMs <= program.validUntilEpochMs,
    "review cannot extend program lifetime");
  require(unique(review.platforms, 3, value => ["android-google", "android-rustore", "ios-ipados"].includes(value))
    && unique(review.territories, 676, value => typeof value === "string" && /^[A-Z]{2}$/u.test(value)), "explicit reviewed audience");
  const key = keys.find(value => value.keyId === review.keyId && value.reviewerId === review.reviewerId);
  require(key && typeof review.signatureHex === "string" && /^[a-f0-9]{128}$/u.test(review.signatureHex), "independent pinned program signer");
  const publicKey = await webcrypto.subtle.importKey("raw", Buffer.from(key.publicKeyX963Hex, "hex"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const unsigned = { ...review }; delete unsigned.signatureHex;
  require(await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(review.signatureHex, "hex"),
    Buffer.from(CHILD_NATIVE_PASSPORT_REVIEW_DOMAIN + contentPackageCanonicalJson(unsigned), "utf8")), "authentic independent program signature");
}
/** Complete source closure against the existing reviewed native child package.
 * Build profiles validate format only; installed native uses its current saved
 * profile, exact age, blocked topics and rights on every award/projection. */
async function packageClosure(root, program, review, selected, now) {
  const pinFile = await source(root, CHILD_NATIVE_PIN_SOURCE, 65536), pins = normalizeChildNativePins(pinFile.bytes);
  const matching = pins.packages.filter(pin => pin.packageId === program.packageId && pin.packageVersion === program.packageVersion && pin.packageChecksum === program.packageChecksum);
  require(matching.length === 1, "original independently reviewed package pin");
  const packagePin = matching[0], packageFile = await source(root, "src/child/release-material/" + program.packageChecksum + "/package.json", 8 * 1024 * 1024),
    packageReviewFile = await source(root, "src/child/release-material/" + packagePin.reviewChecksum + "/review.json", 524288);
  require(packageFile.sha256 === program.packageChecksum && packageReviewFile.sha256 === packagePin.reviewChecksum, "original package and review bytes");
  const raw = childNativeJson(packageFile.bytes, 8 * 1024 * 1024), packageReview = childNativeJson(packageReviewFile.bytes, 524288);
  for (const field of ["packageId", "packageVersion", "policyVersion", "policyChecksum", "locale", "exactAge"])
    require(raw[field] === program[field], "original package " + field);
  require(review.platforms.includes(selected) && review.platforms.every(value => packageReview.platforms.includes(value))
    && review.territories.every(value => packageReview.territories.includes(value))
    && program.validFromEpochMs >= packageReview.validFromEpochMs && program.validUntilEpochMs <= packageReview.validUntilEpochMs,
  "program cannot expand reviewed package audience or lifetime");
  const output = await build({ absWorkingDir: root, entryPoints: ["src/child/childPackage.ts"], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
  require(output.outputFiles?.length === 1, "existing actual package compiler");
  const compiler = await import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"));
  for (const audience of review.platforms) for (const territory of review.territories) for (const readingLevel of packageReview.readingLevels) {
    const profile = { id: "build-passport-format-validation", label: "Build format validation", exactAge: raw.exactAge,
      ageBand: raw.exactAge <= 5 ? "3-5" : raw.exactAge <= 8 ? "6-8" : raw.exactAge <= 11 ? "9-11" : raw.exactAge <= 14 ? "12-14" : "15-17",
      locale: raw.locale, ageConfirmedAt: new Date(now).toISOString(), readingLevel, allowedTopics: null, blockedTopics: [],
      soundEnabled: false, motion: "calm", narrationEnabled: false };
    // Use the same full original schema that the existing package exporter uses.
    const challenge = { generation: 1, request: { locale: raw.locale, route: { kind: "home", entityId: null } }, profile,
      selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: profile.id, profileRevision: 1,
        profileChecksum: sha(Buffer.from(JSON.stringify(profile))), policyVersion: raw.policyVersion, policyChecksum: raw.policyChecksum } };
    const compiled = await compiler.compileChildPackage(new Uint8Array(packageFile.bytes), { challenge, platform: audience, territory, nowEpochMs: now,
      signal: new AbortController().signal, digest: { async sha256(bytes) { return sha(bytes); } } });
    require(compiled, "actual strict child package compiler");
    await verifyChildReleaseReview(packageFile.bytes, packageReviewFile.bytes, packagePin, pins.reviewKeys, compiled, profile, audience, territory, now);
  }
  require(Array.isArray(raw.entities), "original package entity closure");
  const entity = ref => {
    const matches = raw.entities.filter(value => value.policy.kind === ref.kind && value.policy.id === ref.id);
    require(matches.length === 1 && sha(Buffer.from(contentPackageCanonicalJson(matches[0].payload))) === ref.contentChecksum, "exact native reference/payload closure");
    return matches[0];
  };
  for (const rule of program.awardRules) {
    entity(rule.displayReference);
    const roots = raw.entities.filter(value => value.policy.kind === "activity" && value.policy.id === rule.journeyId);
    require(roots.length === 1, "one current native journey root");
    const nodes = roots[0].payload.references;
    require(Array.isArray(nodes) && nodes.length > 0 && nodes.length <= 64 && new Set(nodes.map(value => value.id)).size === nodes.length,
      "whole ordered native journey graph");
    const closure = new Map(), queue = [...nodes];
    while (queue.length) {
      const ref = queue.shift(), key = ref.kind + "/" + ref.id;
      require(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz"].includes(ref.kind)
        && ref.id !== rule.journeyId, "only complete required text/reference route content");
      if (closure.has(key)) { require(closure.get(key) === ref.contentChecksum, "unambiguous nested route reference"); continue; }
      require(closure.size < 2048, "bounded full required route closure"); closure.set(key, ref.contentChecksum);
      const admitted = entity(ref); require(Array.isArray(admitted.payload.references), "full nested text payload"); queue.push(...admitted.payload.references);
    }
    require(rule.nodeIds.every(node => nodes.some(value => value.id === node)), "rule requires real graph nodes");
    if (rule.trigger === "completed-journey") require(JSON.stringify(rule.nodeIds) === JSON.stringify(nodes.map(value => value.id)), "complete journey rule covers its exact ordered graph");
    else require(rule.nodeIds.every(node => nodes.some(value => value.id === node && ["writer", "work"].includes(value.kind))), "learning rule requires typed native learning receipts");
  }
}
export async function collectChildNativePassportOutputs(root, platform, channel, now = Date.now()) {
  root = await fs.realpath(root); require(epoch(now), "explicit source time");
  const pinFile = await source(root, CHILD_NATIVE_PASSPORT_PIN_SOURCE, 65536), schema = await schemas(root), pins = await normalizeChildNativePassportPins(pinFile.bytes, root);
  const selected = platform === "ios" && channel === "appStore" ? "ios-ipados" : platform === "android" && channel === "googlePlay" ? "android-google"
    : platform === "android" && channel === "ruStore" ? "android-rustore" : null;
  require(selected !== null || (platform === "android" || platform === "ios") && channel === "dev" && !pins.reviewKeys.length && !pins.programs.length,
    "no unselected program review audience");
  const outputs = [], add = (output, file, transformation = "none") => outputs.push({ output, source: file.name, sourceSha256: file.sha256,
    transformation, outputSha256: sha(file.bytes), bytes: Buffer.from(file.bytes) });
  const catalog = Buffer.from(JSON.stringify({ schemaVersion: 1, kind: "literary-planet-child-passport-program-catalog-v1", platform: selected,
    programPinSourceChecksum: pinFile.sha256, reviewKeys: pins.reviewKeys, programs: pins.programs }) + "\n");
  add(CHILD_NATIVE_PASSPORT_CATALOG, { name: CHILD_NATIVE_PASSPORT_PIN_SOURCE, sha256: pinFile.sha256, bytes: catalog }, CHILD_NATIVE_PASSPORT_TRANSFORM);
  for (const pin of pins.programs) {
    const file = await source(root, "src/child/passport-release-material/" + pin.programChecksum + "/program.json"),
      reviewFile = await source(root, "src/child/passport-release-material/" + pin.reviewChecksum + "/review.json");
    require(file.sha256 === pin.programChecksum && reviewFile.sha256 === pin.reviewChecksum, "exact original reviewed program bytes");
    const program = schema.decodeChildNativePassportProgram(childNativeJson(file.bytes, 524288)), review = childNativeJson(reviewFile.bytes, 524288);
    require(program && program.programId === pin.programId && program.programVersion === pin.programVersion, "closed pinned program identity");
    await verifyChildNativePassportReview(program, review, pin, pins.reviewKeys, now);
    await packageClosure(root, program, review, selected, now);
    add("child-native/passport/" + pin.programChecksum + "/program.json", file);
    add("child-native/passport/" + pin.reviewChecksum + "/review.json", reviewFile);
  }
  require(new Set(outputs.map(value => value.output)).size === outputs.length, "no program inventory ambiguity");
  return { pinSource: { path: CHILD_NATIVE_PASSPORT_PIN_SOURCE, sha256: pinFile.sha256 }, outputs };
}
export async function emitChildNativePassportAssets(root, staging, platform, channel) {
  require(await fs.realpath(staging) === path.resolve(staging), "owned native staging");
  const original = await collectChildNativePassportOutputs(root, platform, channel);
  for (const output of original.outputs) {
    let current = staging;
    for (const part of output.output.split("/").slice(0, -1)) {
      current = path.join(current, part); try { await fs.mkdir(current); } catch (error) { if (error.code !== "EEXIST") throw error; }
      const stat = await fs.lstat(current); require(stat.isDirectory() && !stat.isSymbolicLink() && await fs.realpath(current) === current, "unlinked staging");
    }
    await fs.writeFile(path.join(staging, output.output), output.bytes, { flag: "wx" });
  }
  return { pinSource: original.pinSource, outputs: original.outputs.map(({ bytes, ...row }) => row) };
}
