import { expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { contentPackageCanonicalJson } from "../../../src/planet/contentPackageProtocol.mjs";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export const sourceCommit = "89cf558d7be310503672420568b1c7a045bd8325";
const evidenceRoot = "docs/mobile/evidence/S08/content-export-20260914";
const exportRoot = process.env.S11_CONTENT_EXPORT_ROOT ?? ".tmp/content-exports";

export async function preservedFixture(version) {
  const name = "a" + version, evidence = evidenceRoot + "/export-" + name;
  const inspectionBytes = await fs.readFile(evidence + "/inspection.json");
  const inspection = JSON.parse(inspectionBytes), checked = [];
  async function pinned(relative, fromEvidence = false) {
    const pin = inspection.actualPreservedFiles.find(file => file.path === relative);
    expect(pin, "Preserved S08 pin for " + relative).toBeTruthy();
    const path = fromEvidence ? evidence + "/" + relative : exportRoot + "/s08-20260914-" + name + "/" + relative;
    const bytes = await fs.readFile(path);
    expect({ bytes: bytes.length, sha256: sha(bytes) }).toEqual({ bytes: pin.bytes, sha256: pin.sha256 });
    checked.push({ path, bytes: bytes.length, sha256: sha(bytes) });
    return bytes;
  }
  // Independent saved QA pins, never a public-key URL from downloaded content.
  const trustedKey = JSON.parse(await pinned("qa-public-key.json", true));
  const envelope = JSON.parse(await pinned("signature.json"));
  const rawManifest = await pinned("manifest.json");
  expect(JSON.parse(rawManifest)).toEqual(envelope.manifest);
  const files = [];
  for (const file of envelope.manifest.files) files.push({ path: file.path, bytes: (await pinned("package/" + file.path)).toString("utf8") });
  expect(envelope.manifest).toMatchObject({ sourceCommit, version, environment: "local-qa", releaseReady: false, namespace: "adult", locales: ["ru", "en"] });
  return { fixture: { envelope, files, manifestSha256: sha(contentPackageCanonicalJson(envelope.manifest)), expected: {
    packageId: "literary-planet-adult-candidate", sourceCommit, version, namespace: "adult", childPolicy: null, readerVersion: 1,
  } }, trustedKey, evidence: { version, inspection: { path: evidence + "/inspection.json", sha256: sha(inspectionBytes) },
    canonicalManifestSha256: sha(contentPackageCanonicalJson(envelope.manifest)), rawManifestSha256: sha(rawManifest), checked } };
}
