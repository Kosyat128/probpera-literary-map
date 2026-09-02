import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const acquisitionSource = readFileSync(
  new URL("./acquire-historical-globe-sources.mjs", import.meta.url),
  "utf8"
);
const manifest = JSON.parse(
  readFileSync(
    new URL("./globe-editions/historical-runtime-sources.json", import.meta.url),
    "utf8"
  )
);
const bookAcquisitionSources = [
  {
    id: "bnf",
    hosts: ["gallica.bnf.fr"],
    source: readFileSync(
      new URL(
        "./acquire-bnf-education-book-canon-source.mjs",
        import.meta.url
      ),
      "utf8"
    ),
  },
  {
    id: "loc",
    hosts: ["wwws.loc.gov", "www.loc.gov"],
    source: readFileSync(
      new URL("./acquire-loc-book-canon-source.mjs", import.meta.url),
      "utf8"
    ),
  },
  {
    id: "neb",
    hosts: ["svetapp.rusneb.ru"],
    source: readFileSync(
      new URL(
        "./acquire-neb-important-classics-source.mjs",
        import.meta.url
      ),
      "utf8"
    ),
  },
];

describe("historical source acquisition boundary", () => {
  it("pins every reviewed manifest request in executable code", () => {
    const sources = manifest.editions.flatMap((edition) => edition.sources);
    for (const source of sources) {
      expect(acquisitionSource).toContain(JSON.stringify(source.filename));
      expect(acquisitionSource).toContain(JSON.stringify(source.url));
      if (source.referer) {
        expect(acquisitionSource).toContain(JSON.stringify(source.referer));
      }
    }
  });

  it("never sends manifest-provided request metadata directly", () => {
    expect(acquisitionSource).toContain("pinnedSourceRequest(source)");
    expect(acquisitionSource).toContain("source.url !== url");
    expect(acquisitionSource).toContain("source.referer ?? null");
    expect(acquisitionSource).toContain("fetch(request.url");
    expect(acquisitionSource).toContain('redirect: "error"');
    expect(acquisitionSource).not.toContain("fetch(source.url");
    expect(acquisitionSource).not.toContain("referer: source.referer");
  });
});

describe("book canon source acquisition boundary", () => {
  it("accepts redirects only on reviewed HTTPS hosts and bounds headers and streamed bytes", () => {
    for (const acquisition of bookAcquisitionSources) {
      const hostDeclaration = acquisition.source.match(
        /const allowedResponseHosts = new Set\(\[([^\]]+)\]\);/u
      )?.[1];
      expect(hostDeclaration, acquisition.id).toBeDefined();
      expect(
        [...(hostDeclaration || "").matchAll(/"([^"]+)"/gu)].map(
          (match) => match[1]
        )
      ).toEqual(acquisition.hosts);
      expect(acquisition.source).toContain(
        "assertAllowedFinalResponseUrl(response.url)"
      );
      expect(acquisition.source).toContain('parsed.protocol !== "https:"');
      expect(acquisition.source).toContain("parsed.port !== \"\"");
      expect(acquisition.source).toContain(
        'response.headers.get("content-length")'
      );
      expect(acquisition.source).toContain(
        "declaredBytes > maximumSnapshotBytes"
      );
      expect(acquisition.source).toContain("response.body.getReader()");
      expect(acquisition.source).toContain(
        "totalBytes > maximumSnapshotBytes"
      );
      expect(acquisition.source).toContain("await reader.cancel(");
      expect(acquisition.source).not.toContain("response.arrayBuffer()");
      const downloadSnapshot = acquisition.source.slice(
        acquisition.source.indexOf("async function downloadSnapshot()"),
        acquisition.source.indexOf("async function importedSnapshot()")
      );
      expect(
        downloadSnapshot.indexOf(
          "assertAllowedFinalResponseUrl(response.url)"
        )
      ).toBeLessThan(
        downloadSnapshot.indexOf("readResponseBytesWithLimit(response)")
      );
    }
  });

  it("writes only to a fixed non-linked leaf through fsynced same-directory rename", () => {
    for (const acquisition of bookAcquisitionSources) {
      for (const guard of [
        "path.resolve(snapshotPath)",
        "entry.isSymbolicLink()",
        "canonicalSnapshotDirectory",
        "await realpath(snapshotDirectory)",
        'await open(temporaryPath, "wx+", 0o600)',
        "await handle.read(",
        "await handle.sync()",
        "await rename(temporaryPath, snapshotPath)",
        "await rm(temporaryPath, { force: true })",
      ]) {
        expect(acquisition.source, `${acquisition.id}:${guard}`).toContain(
          guard
        );
      }
      expect(acquisition.source).not.toContain(
        "await writeFile(snapshotPath, snapshot)"
      );
      const atomicWriter = acquisition.source.slice(
        acquisition.source.indexOf(
          "async function writeVerifiedSnapshotAtomically"
        ),
        acquisition.source.indexOf("function normalizedText")
      );
      expect(atomicWriter).not.toContain("readFile(temporaryPath)");
      expect(atomicWriter).not.toContain("readFile(snapshotPath)");
      expect(atomicWriter.indexOf("await rename(temporaryPath, snapshotPath)"))
        .toBeLessThan(atomicWriter.indexOf("await handle.close()"));
      const registryValidation = acquisition.source.indexOf(
        "const issues = registryIssues"
      );
      const atomicWrite = acquisition.source.lastIndexOf(
        "await writeVerifiedSnapshotAtomically"
      );
      expect(registryValidation, acquisition.id).toBeGreaterThan(-1);
      expect(atomicWrite, acquisition.id).toBeGreaterThan(registryValidation);
    }
  });

  it("keeps default checks offline and makes network acquisition opt-in", () => {
    for (const acquisition of bookAcquisitionSources) {
      expect(acquisition.source).toContain(
        "? await importedSnapshot()\n  : refresh\n    ? await downloadSnapshot()\n    : await checkedInSnapshot()"
      );
      expect(acquisition.source.indexOf("async function downloadSnapshot()"))
        .toBeLessThan(acquisition.source.indexOf("await fetch(sourceUrl"));
    }
  });
});
