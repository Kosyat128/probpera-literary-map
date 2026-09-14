import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contentPackageCanonicalJson, prepareContentPackageManifest } from "./content-package-signature.mjs";
import { verifyPreviousContentExport } from "./content-export-input.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
const sourceCommit = "a".repeat(40);

function fixture() {
  // Synthetic transport records. Full unit hashes are checked later by the
  // canonical dependency comparator, never inferred from this helper's pass.
  const candidate = { schemaVersion: 1, contract: "literary-planet-content-candidate-v1", sourceCommit,
    requiredLocales: ["ru", "en"], namespace: "adult", units: [{ id: "synthetic-ru", locale: "ru", text: "Тест" },
      { id: "synthetic-en", locale: "en", text: "Test" }], held: [], releaseReady: false };
  const dependencies = { schemaVersion: 1, contract: "literary-planet-content-dependencies-v1", sourceCommit,
    currentCandidateHash: "b".repeat(64), staleUnitIds: ["synthetic-en"], releaseReady: false };
  const files = ["ru", "en"].map(locale => ({ path: `${locale}/catalog.json`, bytes: encode({
    schemaVersion: 1, contract: candidate.contract, sourceCommit, namespace: "adult", locale,
    units: candidate.units.filter(unit => unit.locale === locale), releaseReady: false,
  }) })).concat([{ path: "dependency-index.json", bytes: encode(dependencies) }]);
  const manifest = prepareContentPackageManifest({ packageId: "literary-planet-adult-candidate", version: 7, sourceCommit, files });
  const manifestBytes = encode(manifest);
  return { candidate, dependencies, manifest, candidateBytes: encode(candidate), manifestBytes, files, expectedManifestSha256: sha(manifestBytes) };
}

describe("externally pinned previous local content generation", () => {
  it("returns intact adult candidate/dependencies and the exact raw manifest hash plus generation", () => {
    const f = fixture();
    expect(verifyPreviousContentExport(f)).toEqual({ candidate: f.candidate, dependencies: f.dependencies,
      manifestSha256: f.expectedManifestSha256, version: 7 });
    expect(f.expectedManifestSha256).not.toBe(sha(contentPackageCanonicalJson(f.manifest)));
  });

  it("requires an independently supplied pin and rejects canonical or changed raw-manifest digests", () => {
    const f = fixture();
    expect(() => verifyPreviousContentExport({ ...f, expectedManifestSha256: undefined })).toThrow("external exact previous manifest SHA256");
    expect(() => verifyPreviousContentExport({ ...f, expectedManifestSha256: sha(contentPackageCanonicalJson(f.manifest)) })).toThrow("external SHA256 pin");
    expect(() => verifyPreviousContentExport({ ...f, manifestBytes: Buffer.concat([f.manifestBytes, Buffer.from("\n")]) })).toThrow("external SHA256 pin");
  });

  it("rejects prior locale payload corruption even when the candidate file is unchanged", () => {
    const f = fixture();
    f.files[1].bytes = Buffer.from(f.files[1].bytes.toString("utf8").replace('"Test"', '"Changed"'));
    expect(() => verifyPreviousContentExport(f)).toThrow("manifest/file integrity mismatch");
  });

  it("rejects clearing stale IDs and updating the local manifest while the external pin stays fixed", () => {
    const f = fixture();
    f.files[2].bytes = encode({ ...f.dependencies, staleUnitIds: [] });
    expect(() => verifyPreviousContentExport(f)).toThrow("manifest/file integrity mismatch");
    f.manifestBytes = encode(prepareContentPackageManifest({ packageId: f.manifest.packageId, version: 7, sourceCommit, files: f.files }));
    expect(() => verifyPreviousContentExport(f)).toThrow("external SHA256 pin");
  });

  it("rejects missing, additional or wrong canonical package paths", () => {
    const f = fixture();
    expect(() => verifyPreviousContentExport({ ...f, files: f.files.slice(0, 2) })).toThrow("exactly its three canonical data files");
    expect(() => verifyPreviousContentExport({ ...f, files: [...f.files, { path: "extra.json", bytes: encode({}) }] })).toThrow("exactly its three canonical data files");
    expect(() => verifyPreviousContentExport({ ...f, files: f.files.map((file, index) => index === 2 ? { ...file, path: "stale-index.json" } : file) }))
      .toThrow("exactly its three canonical data files");
  });

  it("rejects mismatched source, child namespace, partial locales and production readiness", () => {
    const f = fixture();
    for (const changed of [{ sourceCommit: "c".repeat(40) }, { namespace: "child" }, { requiredLocales: ["en"] }, { releaseReady: true }]) {
      expect(() => verifyPreviousContentExport({ ...f, candidateBytes: encode({ ...f.candidate, ...changed }) })).toThrow();
    }
    const manifestBytes = encode({ ...f.manifest, environment: "production" });
    expect(() => verifyPreviousContentExport({ ...f, manifestBytes, expectedManifestSha256: sha(manifestBytes) })).toThrow("manifest/file integrity mismatch");
  });

  it("rejects an internally rehashed dependency index from another source generation", () => {
    const f = fixture(); f.files[2].bytes = encode({ ...f.dependencies, sourceCommit: "d".repeat(40) });
    f.manifestBytes = encode(prepareContentPackageManifest({ packageId: f.manifest.packageId, version: 7, sourceCommit, files: f.files }));
    f.expectedManifestSha256 = sha(f.manifestBytes);
    expect(() => verifyPreviousContentExport(f)).toThrow("Invalid previous source-bound dependency index");
  });

  it("rejects invalid UTF8, duplicate JSON keys and oversized manifest inputs before reuse", () => {
    const f = fixture();
    expect(() => verifyPreviousContentExport({ ...f, candidateBytes: Uint8Array.from([192, 175]) })).toThrow("candidate UTF8/JSON");
    expect(() => verifyPreviousContentExport({ ...f, candidateBytes: Buffer.from(f.candidateBytes.toString("utf8").replace('"namespace": "adult",', '"namespace": "adult", "namespace": "adult",')) }))
      .toThrow("Ambiguous previous candidate JSON key");
    const manifestBytes = Buffer.alloc(1024 * 1024 + 1, 32);
    expect(() => verifyPreviousContentExport({ ...f, manifestBytes, expectedManifestSha256: sha(manifestBytes) })).toThrow("Invalid previous manifest bytes");
  });
});
