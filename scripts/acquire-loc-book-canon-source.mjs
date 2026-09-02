import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cheerio from "cheerio";

import {
  registryIssues,
  registryItemHash,
} from "./lib/book-canon-registry.mjs";
import {
  canonInventoryTranscriptionProjection,
  canonSourceTranscriptionProjection,
  mergeExactCanonItemAdjudications,
  preserveCanonSourceEditorialFields,
  replaceCanonInventoryInSourceOrder,
  sameCanonTranscription,
} from "./lib/book-canon-transcription.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const registryPath = path.join(
  projectRoot,
  "data",
  "book-canon-source-registry.json"
);
const snapshotDirectory = path.join(
  projectRoot,
  "data",
  "book-canon-snapshots"
);
const snapshotPath = path.join(
  snapshotDirectory,
  "loc-books-that-shaped-america.html.bin"
);
const metadataPath = path.join(
  snapshotDirectory,
  "loc-books-that-shaped-america.metadata.json"
);
const snapshotFilename = "loc-books-that-shaped-america.html.bin";
const maximumSnapshotBytes = 2 * 1024 * 1024;
const allowedResponseHosts = new Set(["wwws.loc.gov", "www.loc.gov"]);

const sourceId = "loc-books-that-shaped-america-2012";
const sourceUrl =
  "https://wwws.loc.gov/exhibits/books-that-shaped-america/exhibititems.html";
const refresh = process.argv.includes("--refresh");
const write = process.argv.includes("--write");
const inputPath = process.argv
  .find((argument) => argument.startsWith("--input="))
  ?.slice("--input=".length);
const requestedDate = process.argv
  .find((argument) => argument.startsWith("--date="))
  ?.slice("--date=".length);
const capturedAt = requestedDate || new Date().toISOString().slice(0, 10);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isStrictlyInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function lstatIfExists(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertAllowedFinalResponseUrl(value) {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    !allowedResponseHosts.has(parsed.hostname) ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error(`LoC snapshot redirected to an unapproved URL: ${value}.`);
  }
  return parsed.href;
}

function assertDeclaredResponseLength(response) {
  const value = response.headers.get("content-length");
  if (value === null) return;
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error(`LoC snapshot has an invalid Content-Length: ${value}.`);
  }
  const declaredBytes = Number(value);
  if (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes > maximumSnapshotBytes
  ) {
    throw new Error(
      `LoC snapshot Content-Length exceeds ${maximumSnapshotBytes} bytes.`
    );
  }
}

async function readResponseBytesWithLimit(response) {
  assertDeclaredResponseLength(response);
  if (!response.body) {
    throw new Error("LoC snapshot response has no body.");
  }
  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumSnapshotBytes) {
        throw new Error(
          `LoC snapshot exceeded ${maximumSnapshotBytes} actual bytes.`
        );
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    try {
      await reader.cancel("LoC snapshot read failed.");
    } catch {
      // Preserve the original bounded-read error.
    }
    throw error;
  }
  if (totalBytes === 0) {
    throw new Error("LoC snapshot response is empty.");
  }
  return Buffer.concat(chunks, totalBytes);
}

function assertSnapshotSize(snapshot, label) {
  if (
    !Buffer.isBuffer(snapshot) ||
    snapshot.length === 0 ||
    snapshot.length > maximumSnapshotBytes
  ) {
    throw new Error(
      `${label} must contain 1-${maximumSnapshotBytes} bytes.`
    );
  }
}

async function readSnapshotFromOpenHandle(handle, expectedBytes, label) {
  const stats = await handle.stat();
  if (!stats.isFile() || stats.size !== expectedBytes) {
    throw new Error(`${label} size differs from validated bytes.`);
  }
  const snapshot = Buffer.alloc(expectedBytes);
  let offset = 0;
  while (offset < expectedBytes) {
    const { bytesRead } = await handle.read(
      snapshot,
      offset,
      expectedBytes - offset,
      offset
    );
    if (bytesRead === 0) {
      throw new Error(`${label} ended before all validated bytes were read.`);
    }
    offset += bytesRead;
  }
  return snapshot;
}

async function assertSafeSnapshotLeaf(candidate, mustNotExist = false) {
  const fixedSnapshotPath = path.resolve(
    snapshotDirectory,
    snapshotFilename
  );
  if (path.resolve(snapshotPath) !== fixedSnapshotPath) {
    throw new Error("LoC snapshot destination is not the fixed reviewed path.");
  }
  const resolvedCandidate = path.resolve(candidate);
  const candidateBasename = path.basename(resolvedCandidate);
  const isTemporary =
    path.dirname(resolvedCandidate) === snapshotDirectory &&
    candidateBasename.startsWith(`.${snapshotFilename}.`) &&
    candidateBasename.endsWith(".tmp");
  if (resolvedCandidate !== fixedSnapshotPath && !isTemporary) {
    throw new Error("LoC snapshot write escaped its fixed destination.");
  }

  const dataDirectory = path.resolve(projectRoot, "data");
  await mkdir(snapshotDirectory, { recursive: true });
  for (const [directory, label] of [
    [dataDirectory, "LoC data directory"],
    [snapshotDirectory, "LoC snapshot directory"],
  ]) {
    const entry = await lstat(directory);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error(`${label} must be a real directory.`);
    }
  }
  const canonicalDataDirectory = await realpath(dataDirectory);
  const canonicalSnapshotDirectory = await realpath(snapshotDirectory);
  if (
    !isStrictlyInside(
      canonicalDataDirectory,
      canonicalSnapshotDirectory
    )
  ) {
    throw new Error("LoC snapshot directory escaped the canonical data root.");
  }

  const entry = await lstatIfExists(resolvedCandidate);
  if (mustNotExist && entry) {
    throw new Error("LoC temporary snapshot already exists.");
  }
  if (entry && (entry.isSymbolicLink() || !entry.isFile())) {
    throw new Error("LoC snapshot leaf must be a regular file.");
  }
  if (entry) {
    const canonicalCandidate = await realpath(resolvedCandidate);
    if (path.dirname(canonicalCandidate) !== canonicalSnapshotDirectory) {
      throw new Error("LoC snapshot leaf escaped its canonical directory.");
    }
  }
  return resolvedCandidate;
}

async function writeVerifiedSnapshotAtomically(snapshot, validateSnapshot) {
  assertSnapshotSize(snapshot, "Validated LoC snapshot");
  await assertSafeSnapshotLeaf(snapshotPath);
  const temporaryPath = path.join(
    snapshotDirectory,
    `.${snapshotFilename}.${process.pid}.${randomUUID()}.tmp`
  );
  await assertSafeSnapshotLeaf(temporaryPath, true);

  let handle;
  try {
    handle = await open(temporaryPath, "wx+", 0o600);
    await handle.writeFile(snapshot);
    await handle.sync();
    const stagedSnapshot = await readSnapshotFromOpenHandle(
      handle,
      snapshot.length,
      "Staged LoC snapshot"
    );
    assertSnapshotSize(stagedSnapshot, "Staged LoC snapshot");
    if (sha256(stagedSnapshot) !== sha256(snapshot)) {
      throw new Error("Staged LoC snapshot differs from validated bytes.");
    }
    validateSnapshot(stagedSnapshot);
    await assertSafeSnapshotLeaf(snapshotPath);
    await rename(temporaryPath, snapshotPath);
    await handle.close();
    handle = undefined;
    await assertSafeSnapshotLeaf(snapshotPath);
  } finally {
    try {
      if (handle) await handle.close();
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
}

function normalizedText(value) {
  return String(value || "")
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64)
    .replace(/-+$/gu, "");
}

function httpsItemUrl(value) {
  const parsed = new URL(value, sourceUrl);
  parsed.protocol = "https:";
  return parsed.href;
}

function transcribeSnapshot(snapshot) {
  const $ = cheerio.load(snapshot.toString("utf8"));
  const items = [];
  const sectionPattern = /^\d{4}\s+to\s+\d{4}$/u;

  $("h2").each((_sectionIndex, heading) => {
    const section = normalizedText($(heading).text());
    if (!sectionPattern.test(section)) return;
    const list = $(heading).nextAll("ul.plain").first();
    list.children("li").each((_itemIndex, listItem) => {
      const emphasized = $(listItem).find("em").first();
      const link = emphasized.closest("a").length
        ? emphasized.closest("a")
        : $(listItem).find("a").first();
      const titleExact = normalizedText(emphasized.text());
      if (!titleExact || !link.attr("href")) return;
      const linkedText = normalizedText(link.text());
      const titleOffset = linkedText.indexOf(titleExact);
      const contributorExact =
        titleOffset > 0
          ? linkedText
              .slice(0, titleOffset)
              .replace(/[.\s]+$/gu, "")
              .trim()
          : "";
      const ordinal = items.length + 1;
      const itemId = `loc-${String(ordinal).padStart(3, "0")}-${
        slug(titleExact) || sha256(titleExact).slice(0, 16)
      }`;
      const item = {
        ordinal,
        itemId,
        itemUrl: httpsItemUrl(link.attr("href")),
        titleExact,
        contributorExact,
        candidateKind: "unclassified",
        entityKind: "unresolved",
        adjudicationStatus: "pending-review",
        adjudicatedRecordKey: null,
      };
      item.itemHash = registryItemHash(sourceId, item);
      items.push(item);
    });
  });

  if (items.length < 80 || items.length > 150) {
    throw new Error(
      `Unexpected Library of Congress item count ${items.length}; refusing to replace the registry.`
    );
  }
  if (new Set(items.map((item) => item.itemId)).size !== items.length) {
    throw new Error("Library of Congress transcription generated duplicate item IDs.");
  }
  return items;
}

async function downloadSnapshot() {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "ProbPeraBibliographyAudit/1.0 (+https://probpera.ru)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`LoC snapshot request failed: HTTP ${response.status}.`);
  }
  const finalUrl = assertAllowedFinalResponseUrl(response.url);
  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/html(?:;|$)/iu.test(contentType)) {
    throw new Error(`LoC snapshot has unexpected content type: ${contentType}.`);
  }
  const snapshot = await readResponseBytesWithLimit(response);
  const marker = snapshot.toString("utf8");
  if (
    !marker.includes("Books That Shaped America") ||
    !marker.includes("Library of Congress")
  ) {
    throw new Error("LoC snapshot identity markers are missing.");
  }
  return {
    snapshot,
    metadata: {
      schemaVersion: 1,
      sourceUrl,
      finalUrl,
      capturedAt,
      contentType,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      contentSha256: sha256(snapshot),
      byteLength: snapshot.length,
    },
  };
}

async function importedSnapshot() {
  const snapshot = await readFile(path.resolve(inputPath));
  assertSnapshotSize(snapshot, "Imported LoC snapshot");
  const marker = snapshot.toString("utf8");
  if (
    !marker.includes("Books That Shaped America") ||
    !marker.includes("Library of Congress")
  ) {
    throw new Error("Imported LoC snapshot identity markers are missing.");
  }
  return {
    snapshot,
    metadata: {
      schemaVersion: 1,
      sourceUrl,
      finalUrl: sourceUrl,
      capturedAt,
      contentType: "text/html; imported response body",
      etag: null,
      lastModified: null,
      contentSha256: sha256(snapshot),
      byteLength: snapshot.length,
    },
  };
}

async function checkedInSnapshot() {
  const snapshot = await readFile(snapshotPath);
  assertSnapshotSize(snapshot, "Checked-in LoC snapshot");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  if (metadata.contentSha256 !== sha256(snapshot)) {
    throw new Error("Checked-in LoC snapshot does not match its metadata hash.");
  }
  return { snapshot, metadata };
}

const { snapshot, metadata } = inputPath
  ? await importedSnapshot()
  : refresh
    ? await downloadSnapshot()
    : await checkedInSnapshot();
const transcribedItems = transcribeSnapshot(snapshot);
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const currentSource = registry.sources.find(
  (candidate) => candidate.id === sourceId
);
const currentInventory = registry.inventories.find(
  (candidate) => candidate.sourceId === sourceId
);
if (!currentSource || !currentInventory) {
  throw new Error(`Registry source or inventory ${sourceId} is missing.`);
}
const freshSource = {
  id: sourceId,
  authorityId: "loc",
  class: "national-library-heritage-collection",
  scope: "national-influence-collection",
  url: sourceUrl,
  snapshot: {
    capturedAt: metadata.capturedAt,
    snapshotStatus: "verified-content-hash",
    contentSha256: metadata.contentSha256,
    extractionMethod: "dom-link-extraction",
    version: "loc-exhibit-items-v1",
  },
  inventoryStatus: "transcribed",
  coverageStatus: "in-progress",
  declaredItemCount: transcribedItems.length,
  notes:
    `The complete current official exhibition-items page was preserved as response-body bytes and deterministically transcribed (${transcribedItems.length} displayed entries). ` +
    "New or changed rows remain unclassified and pending review; exact unchanged rows may preserve their separately recorded adjudication. The Library of Congress explicitly describes this collection as influential books, not a ranking of the best books.",
};
const mergedInventory = mergeExactCanonItemAdjudications(
  sourceId,
  transcribedItems,
  currentInventory
);
const nextSource = preserveCanonSourceEditorialFields(
  freshSource,
  currentSource,
  mergedInventory.allItemsPreserved
);
const nextRegistry = {
  ...registry,
  snapshotDate: metadata.capturedAt,
  sources: registry.sources.map((candidate) =>
    candidate.id === sourceId ? nextSource : candidate
  ),
  inventories: replaceCanonInventoryInSourceOrder(
    registry,
    sourceId,
    mergedInventory.items
  ),
};
const issues = registryIssues(nextRegistry);
if (issues.length > 0) {
  throw new Error(`Invalid updated canon registry:\n${issues.join("\n")}`);
}

if (write) {
  if (!refresh && !inputPath) {
    throw new Error(
      "--write requires --refresh or --input so a stale snapshot is never relabelled."
    );
  }
  await writeVerifiedSnapshotAtomically(snapshot, transcribeSnapshot);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await writeFile(registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, "utf8");
} else {
  if (
    !sameCanonTranscription(
      canonSourceTranscriptionProjection(currentSource),
      canonSourceTranscriptionProjection(freshSource)
    ) ||
    !sameCanonTranscription(
      canonInventoryTranscriptionProjection(currentInventory),
      canonInventoryTranscriptionProjection({
        sourceId,
        items: transcribedItems,
      })
    )
  ) {
    throw new Error("Checked-in LoC registry transcription is stale.");
  }
}

console.log(
  JSON.stringify(
    {
      sourceId,
      capturedAt: metadata.capturedAt,
      contentSha256: metadata.contentSha256,
      bytes: metadata.byteLength,
      items: transcribedItems.length,
      preservedAdjudications: mergedInventory.preservedCount,
      mode: write ? "written" : "checked",
    },
    null,
    2
  )
);
