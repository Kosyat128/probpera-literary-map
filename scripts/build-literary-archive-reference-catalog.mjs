import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  deriveEditorialReferencePayload, referenceItemsFromArchive, referenceCatalogSha256,
  LITERARY_ARCHIVE_REFERENCE_CONTRACT, LITERARY_ARCHIVE_REFERENCE_ARTIFACT,
  LITERARY_ARCHIVE_REFERENCE_ARTIFACT_SHA256,
} from "./lib/literary-archive-reference-catalog.mjs";
import { canonicalLiteraryArchiveReleasePayload } from "./lib/literary-archive-atomic-release.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogPath = "apps/admin/catalog-assets/editorial-catalog.json";
const read = async file => (await readFile(path.join(root, file), "utf8")).replace(/\r\n?/gu, "\n");
const bundle = path.join(root, ".tmp", "editorial-reference-generator-source-20260914.mjs");
await mkdir(path.dirname(bundle), { recursive: true });
const compilation = await build({
  absWorkingDir: root,
  stdin: {
    contents: `import { bookArchiveCountries } from "./src/data/countries/index.ts";
      import { buildBookArchive } from "./src/data/bookArchive.ts";
      export const archive = buildBookArchive(bookArchiveCountries).map(({country,writer,...book})=>book);
      export const fallbackCatalog = { countries: bookArchiveCountries.map(country=>({
        id:country.id,label:country.name,fields:{nameEn:country.nameEn,code:country.code},
        writers:country.writers.map(writer=>({id:writer.id,label:writer.name||writer.fullName,
          fields:{fullName:writer.fullName}}))
      })) };`,
    resolveDir: root, loader: "ts", sourcefile: "editorial-reference-generator-source.ts",
  },
  bundle: true, platform: "node", packages: "external", format: "esm", target: "node22",
  outfile: bundle, logLevel: "silent", metafile: true,
});
const { archive, fallbackCatalog } = await import(pathToFileURL(bundle).href);
const catalogText = await read(catalogPath);
const items = referenceItemsFromArchive(archive);
const { payload, fallbackWriters } = deriveEditorialReferencePayload({ catalog: JSON.parse(catalogText), fallbackCatalog, items });
assert.equal(items.length, 9763, "Fixed full-catalogue reference target changed");
assert.equal(payload.countries.length, 191);
assert.equal(payload.writers.length, 1681);
assert.equal(fallbackWriters.length, 47);
const sourceFiles = [];
for (const file of Object.keys(compilation.metafile.inputs).sort()) {
  if (file === "editorial-reference-generator-source.ts") continue;
  const relative = file.replaceAll("\\", "/");
  assert.ok(!relative.startsWith("../") && !path.isAbsolute(relative));
  sourceFiles.push({ path: relative, sha256Lf: referenceCatalogSha256(await read(relative)) });
}
const artifact = {
  contract: LITERARY_ARCHIVE_REFERENCE_CONTRACT,
  sourceCommitSha: "3cf9060888cb95cfe900cf695bf2666f4c93590a",
  sourceCatalog: { path: catalogPath, sha256Lf: referenceCatalogSha256(catalogText) },
  sourceFiles,
  target: { works: items.length, workKeysSha256: referenceCatalogSha256(items.map(item => item.legacyId).sort().join("\n")),
    countries: payload.countries.length, writers: payload.writers.length, linkedAuthorRows: items.reduce((sum, item) => sum + item.authors.length, 0) },
  fallbackWriters,
  scope: "Existing structural identity labels only; no biography, editorial verification, status change, alias correction or new factual claim. Reserved Stowe and Alcott writer inserts remain owned by their unchanged exact staged-proof helpers.",
  payload,
  payloadSha256: referenceCatalogSha256(canonicalLiteraryArchiveReleasePayload(payload)),
};
const output = `${JSON.stringify(artifact, null, 2)}\n`.replace(/[\u2013\u2014]/gu, char => `\\u${char.charCodeAt(0).toString(16)}`);
if (process.argv.includes("--check")) {
  const frozenText = await read(LITERARY_ARCHIVE_REFERENCE_ARTIFACT);
  assert.equal(referenceCatalogSha256(frozenText), LITERARY_ARCHIVE_REFERENCE_ARTIFACT_SHA256, "Frozen editorial reference artifact checksum changed");
  const frozen = JSON.parse(frozenText);
  // Source-file hashes describe the immutable main3cf snapshot. Later biography
  // edits do not change this narrow reference contract when identities agree.
  for (const key of ["contract", "target", "fallbackWriters", "payload", "payloadSha256"])
    assert.deepEqual(artifact[key], frozen[key], `Current reference identity projection changed: ${key}`);
}
else {
  const existing = await read(LITERARY_ARCHIVE_REFERENCE_ARTIFACT).catch(() => null);
  assert.ok(existing === null || existing === output, "Refusing to overwrite a frozen reference artifact with different content");
  await writeFile(path.join(root, LITERARY_ARCHIVE_REFERENCE_ARTIFACT), output);
}
console.log(JSON.stringify({ path: LITERARY_ARCHIVE_REFERENCE_ARTIFACT, payloadSha256: artifact.payloadSha256,
  artifactSha256Lf: referenceCatalogSha256(await read(LITERARY_ARCHIVE_REFERENCE_ARTIFACT)), sourceFiles: sourceFiles.length,
  ...artifact.target, archiveFallbackWriters: fallbackWriters.length }, null, 2));
