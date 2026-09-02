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
  "bnf-dne-education-epub-selection.html.bin"
);
const metadataPath = path.join(
  snapshotDirectory,
  "bnf-dne-education-epub-selection.metadata.json"
);
const snapshotFilename = "bnf-dne-education-epub-selection.html.bin";
const maximumSnapshotBytes = 2 * 1024 * 1024;
const allowedResponseHosts = new Set(["gallica.bnf.fr"]);

const sourceId = "bnf-dne-education-epub-selection-2018";
const sourceUrl =
  "https://gallica.bnf.fr/blog/18012018/150-epub-gallica-selectionnes-par-le-ministere-de-leducation-nationale?mode=desktop";
const authority = {
  authorityId: "bnf",
  provider: "bibliotheque-nationale-de-france",
  authorityCountryId: "france",
  independenceGroup: "french-national-library",
  tier: "A",
  allowedRoles: [
    "canon-selection",
    "title-national-record",
    "description-fact",
  ],
  domains: ["bnf.fr"],
  markets: ["FR"],
};
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
    throw new Error(`BnF snapshot redirected to an unapproved URL: ${value}.`);
  }
  return parsed.href;
}

function assertDeclaredResponseLength(response) {
  const value = response.headers.get("content-length");
  if (value === null) return;
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error(`BnF snapshot has an invalid Content-Length: ${value}.`);
  }
  const declaredBytes = Number(value);
  if (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes > maximumSnapshotBytes
  ) {
    throw new Error(
      `BnF snapshot Content-Length exceeds ${maximumSnapshotBytes} bytes.`
    );
  }
}

async function readResponseBytesWithLimit(response) {
  assertDeclaredResponseLength(response);
  if (!response.body) {
    throw new Error("BnF snapshot response has no body.");
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
          `BnF snapshot exceeded ${maximumSnapshotBytes} actual bytes.`
        );
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    try {
      await reader.cancel("BnF snapshot read failed.");
    } catch {
      // Preserve the original bounded-read error.
    }
    throw error;
  }
  if (totalBytes === 0) {
    throw new Error("BnF snapshot response is empty.");
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
    throw new Error("BnF snapshot destination is not the fixed reviewed path.");
  }
  const resolvedCandidate = path.resolve(candidate);
  const candidateBasename = path.basename(resolvedCandidate);
  const isTemporary =
    path.dirname(resolvedCandidate) === snapshotDirectory &&
    candidateBasename.startsWith(`.${snapshotFilename}.`) &&
    candidateBasename.endsWith(".tmp");
  if (resolvedCandidate !== fixedSnapshotPath && !isTemporary) {
    throw new Error("BnF snapshot write escaped its fixed destination.");
  }

  const dataDirectory = path.resolve(projectRoot, "data");
  await mkdir(snapshotDirectory, { recursive: true });
  for (const [directory, label] of [
    [dataDirectory, "BnF data directory"],
    [snapshotDirectory, "BnF snapshot directory"],
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
    throw new Error("BnF snapshot directory escaped the canonical data root.");
  }

  const entry = await lstatIfExists(resolvedCandidate);
  if (mustNotExist && entry) {
    throw new Error("BnF temporary snapshot already exists.");
  }
  if (entry && (entry.isSymbolicLink() || !entry.isFile())) {
    throw new Error("BnF snapshot leaf must be a regular file.");
  }
  if (entry) {
    const canonicalCandidate = await realpath(resolvedCandidate);
    if (path.dirname(canonicalCandidate) !== canonicalSnapshotDirectory) {
      throw new Error("BnF snapshot leaf escaped its canonical directory.");
    }
  }
  return resolvedCandidate;
}

async function writeVerifiedSnapshotAtomically(snapshot, validateSnapshot) {
  assertSnapshotSize(snapshot, "Validated BnF snapshot");
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
      "Staged BnF snapshot"
    );
    assertSnapshotSize(stagedSnapshot, "Staged BnF snapshot");
    if (sha256(stagedSnapshot) !== sha256(snapshot)) {
      throw new Error("Staged BnF snapshot differs from validated bytes.");
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

function httpsUrl(value) {
  const parsed = new URL(value, sourceUrl);
  parsed.protocol = "https:";
  parsed.hash = "";
  return parsed.href;
}

function arkIdentity(value) {
  const parsed = new URL(value, sourceUrl);
  const match = parsed.pathname.match(/\/ark:\/12148\/([^/]+)/u);
  return match?.[1] || "";
}

function assertSnapshotIdentity(snapshot) {
  const html = snapshot.toString("utf8");
  for (const marker of [
    "150 EPUB Gallica",
    "Direction du Numérique pour l’Éducation",
    "Liste des EPUB Gallica sélectionnés",
  ]) {
    if (!html.includes(marker)) {
      throw new Error(`BnF snapshot identity marker is missing: ${marker}.`);
    }
  }
}

function transcribeSnapshot(snapshot) {
  const html = snapshot.toString("utf8");
  const listMarker = "Liste des EPUB Gallica sélectionnés";
  const listOffset = html.indexOf(listMarker);
  if (listOffset < 0) throw new Error("BnF inventory marker is missing.");

  const $ = cheerio.load(html.slice(listOffset));
  const titleLinks = [];
  const epubArkCounts = new Map();
  let contributorExact = "";

  $("strong, a").each((_index, element) => {
    const label = normalizedText($(element).text());
    if (element.tagName === "strong") {
      contributorExact = label;
      return;
    }

    const href = $(element).attr("href") || "";
    const ark = arkIdentity(href);
    if (!ark) return;
    if (/\.epub$/iu.test(ark)) {
      const baseArk = ark.replace(/\.epub$/iu, "");
      epubArkCounts.set(baseArk, (epubArkCounts.get(baseArk) || 0) + 1);
      return;
    }
    titleLinks.push({
      itemUrl: httpsUrl(href),
      titleExact: label,
      contributorExact,
      ark,
    });
  });

  if (titleLinks.length < 140 || titleLinks.length > 160) {
    throw new Error(
      `Unexpected BnF title-link count ${titleLinks.length}; refusing to replace the registry.`
    );
  }
  const epubLinkCount = [...epubArkCounts.values()].reduce(
    (total, count) => total + count,
    0
  );
  if (epubLinkCount !== titleLinks.length) {
    throw new Error(
      `BnF title/EPUB count mismatch: ${titleLinks.length}/${epubLinkCount}.`
    );
  }
  const titleArkCounts = new Map();
  for (const item of titleLinks) {
    titleArkCounts.set(item.ark, (titleArkCounts.get(item.ark) || 0) + 1);
  }
  for (const item of titleLinks) {
    if (!item.titleExact || !item.contributorExact) {
      throw new Error(`Incomplete BnF transcription for ${item.ark}.`);
    }
    if (epubArkCounts.get(item.ark) !== titleArkCounts.get(item.ark)) {
      throw new Error(
        `BnF title ${item.ark} has mismatched title/EPUB multiplicity.`
      );
    }
  }

  const items = titleLinks.map((sourceItem, index) => {
    const ordinal = index + 1;
    const item = {
      ordinal,
      itemId: `bnf-${String(ordinal).padStart(3, "0")}-${sourceItem.ark.toLocaleLowerCase("en")}`,
      itemUrl: sourceItem.itemUrl,
      titleExact: sourceItem.titleExact,
      contributorExact: sourceItem.contributorExact,
      candidateKind: "unclassified",
      entityKind: "unresolved",
      adjudicationStatus: "pending-review",
      adjudicatedRecordKey: null,
    };
    item.itemHash = registryItemHash(sourceId, item);
    return item;
  });

  if (new Set(items.map((item) => item.itemId)).size !== items.length) {
    throw new Error("BnF transcription generated duplicate item IDs.");
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
    throw new Error(`BnF snapshot request failed: HTTP ${response.status}.`);
  }
  const finalUrl = assertAllowedFinalResponseUrl(response.url);
  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/html(?:;|$)/iu.test(contentType)) {
    throw new Error(`BnF snapshot has unexpected content type: ${contentType}.`);
  }
  const snapshot = await readResponseBytesWithLimit(response);
  assertSnapshotIdentity(snapshot);
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
  assertSnapshotSize(snapshot, "Imported BnF snapshot");
  assertSnapshotIdentity(snapshot);
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
  assertSnapshotSize(snapshot, "Checked-in BnF snapshot");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  assertSnapshotIdentity(snapshot);
  if (metadata.contentSha256 !== sha256(snapshot)) {
    throw new Error("Checked-in BnF snapshot does not match its metadata hash.");
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
const currentAuthority = registry.authorities.find(
  (candidate) => candidate.authorityId === authority.authorityId
);
const currentSource = registry.sources.find(
  (candidate) => candidate.id === sourceId
);
const currentInventory = registry.inventories.find(
  (candidate) => candidate.sourceId === sourceId
);
if (!currentAuthority || !currentSource || !currentInventory) {
  throw new Error(`Registry authority, source, or inventory ${sourceId} is missing.`);
}
const freshSource = {
  id: sourceId,
  authorityId: authority.authorityId,
  class: "official-curriculum",
  scope: "global-curated-collection",
  url: sourceUrl,
  snapshot: {
    capturedAt: metadata.capturedAt,
    snapshotStatus: "verified-content-hash",
    contentSha256: metadata.contentSha256,
    extractionMethod: "dom-link-extraction",
    version: "bnf-gallica-dne-title-epub-pairs-v1",
  },
  inventoryStatus: "transcribed",
  coverageStatus: "in-progress",
  declaredItemCount: transcribedItems.length,
  notes:
    "The French Ministry of Education DNE selected these Gallica EPUBs for literature teachers and pupils in connection with school curricula. The preserved page labels the selection as 150 EPUBs but exposes 149 complete title/EPUB link pairs; the registry transcribes only those observable pairs and invents no missing item. New or changed rows remain unclassified and pending Work-level review; exact unchanged rows may preserve their separately recorded adjudication.",
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
  authorities: [
    ...registry.authorities.filter(
      (candidate) => candidate.authorityId !== authority.authorityId
    ),
    authority,
  ],
  sources: [
    ...registry.sources.filter((candidate) => candidate.id !== sourceId),
    nextSource,
  ],
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
  await writeFile(
    registryPath,
    `${JSON.stringify(nextRegistry, null, 2)}\n`,
    "utf8"
  );
} else {
  if (
    JSON.stringify(currentAuthority) !== JSON.stringify(authority) ||
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
    throw new Error("Checked-in BnF registry transcription is stale.");
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
