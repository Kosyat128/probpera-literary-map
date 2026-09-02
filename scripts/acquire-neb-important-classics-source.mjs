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

import { registryIssues } from "./lib/book-canon-registry.mjs";

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
  "neb-svet-important-classics.html.bin"
);
const metadataPath = path.join(
  snapshotDirectory,
  "neb-svet-important-classics.metadata.json"
);
const snapshotFilename = "neb-svet-important-classics.html.bin";
const maximumSnapshotBytes = 2 * 1024 * 1024;
const allowedResponseHosts = new Set(["svetapp.rusneb.ru"]);

const sourceId = "neb-svet-important-classics-2026-09-02";
const sourceUrl =
  "https://svetapp.rusneb.ru/collections/vazhnaya-klassika";
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
    throw new Error(`NEB snapshot redirected to an unapproved URL: ${value}.`);
  }
  return parsed.href;
}

function assertDeclaredResponseLength(response) {
  const value = response.headers.get("content-length");
  if (value === null) return;
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error(`NEB snapshot has an invalid Content-Length: ${value}.`);
  }
  const declaredBytes = Number(value);
  if (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes > maximumSnapshotBytes
  ) {
    throw new Error(
      `NEB snapshot Content-Length exceeds ${maximumSnapshotBytes} bytes.`
    );
  }
}

async function readResponseBytesWithLimit(response) {
  assertDeclaredResponseLength(response);
  if (!response.body) {
    throw new Error("NEB snapshot response has no body.");
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
          `NEB snapshot exceeded ${maximumSnapshotBytes} actual bytes.`
        );
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    try {
      await reader.cancel("NEB snapshot read failed.");
    } catch {
      // Preserve the original bounded-read error.
    }
    throw error;
  }
  if (totalBytes === 0) {
    throw new Error("NEB snapshot response is empty.");
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
    throw new Error("NEB snapshot destination is not the fixed reviewed path.");
  }
  const resolvedCandidate = path.resolve(candidate);
  const candidateBasename = path.basename(resolvedCandidate);
  const isTemporary =
    path.dirname(resolvedCandidate) === snapshotDirectory &&
    candidateBasename.startsWith(`.${snapshotFilename}.`) &&
    candidateBasename.endsWith(".tmp");
  if (resolvedCandidate !== fixedSnapshotPath && !isTemporary) {
    throw new Error("NEB snapshot write escaped its fixed destination.");
  }

  const dataDirectory = path.resolve(projectRoot, "data");
  await mkdir(snapshotDirectory, { recursive: true });
  for (const [directory, label] of [
    [dataDirectory, "NEB data directory"],
    [snapshotDirectory, "NEB snapshot directory"],
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
    throw new Error("NEB snapshot directory escaped the canonical data root.");
  }

  const entry = await lstatIfExists(resolvedCandidate);
  if (mustNotExist && entry) {
    throw new Error("NEB temporary snapshot already exists.");
  }
  if (entry && (entry.isSymbolicLink() || !entry.isFile())) {
    throw new Error("NEB snapshot leaf must be a regular file.");
  }
  if (entry) {
    const canonicalCandidate = await realpath(resolvedCandidate);
    if (path.dirname(canonicalCandidate) !== canonicalSnapshotDirectory) {
      throw new Error("NEB snapshot leaf escaped its canonical directory.");
    }
  }
  return resolvedCandidate;
}

async function writeVerifiedSnapshotAtomically(snapshot, validateSnapshot) {
  assertSnapshotSize(snapshot, "Validated NEB snapshot");
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
      "Staged NEB snapshot"
    );
    assertSnapshotSize(stagedSnapshot, "Staged NEB snapshot");
    if (sha256(stagedSnapshot) !== sha256(snapshot)) {
      throw new Error("Staged NEB snapshot differs from validated bytes.");
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
    .normalize("NFKC")
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function comparisonText(value) {
  return normalizedText(value)
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function canonicalItemUrl(value) {
  const parsed = new URL(value, sourceUrl);
  parsed.protocol = "https:";
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/gu, "");
  return parsed.href;
}

function assertSnapshotIdentity(snapshot) {
  const html = snapshot.toString("utf8");
  for (const marker of ["Важная классика", "Москва и москвичи", "Лето Господне"] ) {
    if (!html.includes(marker)) {
      throw new Error(`NEB snapshot identity marker is missing: ${marker}.`);
    }
  }
}

function verifyInventorySnapshot(snapshot, expectedItems) {
  assertSnapshotIdentity(snapshot);
  const $ = cheerio.load(snapshot.toString("utf8"));
  const expectedUrls = new Set(
    expectedItems.map((item) => canonicalItemUrl(item.itemUrl))
  );
  const observed = [];

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href") || "";
    let itemUrl;
    try {
      itemUrl = canonicalItemUrl(href);
    } catch {
      return;
    }
    if (!expectedUrls.has(itemUrl)) return;
    observed.push({ itemUrl, text: normalizedText($(element).text()) });
  });

  if (observed.length !== expectedItems.length) {
    throw new Error(
      `NEB snapshot exposes ${observed.length}/${expectedItems.length} expected collection links.`
    );
  }
  if (new Set(observed.map((item) => item.itemUrl)).size !== observed.length) {
    throw new Error("NEB snapshot repeats an expected collection link.");
  }

  for (const [index, expected] of expectedItems.entries()) {
    const actual = observed[index];
    const expectedUrl = canonicalItemUrl(expected.itemUrl);
    if (actual.itemUrl !== expectedUrl) {
      throw new Error(
        `NEB collection order changed at ordinal ${index + 1}: ${actual.itemUrl}.`
      );
    }
    const actualText = comparisonText(actual.text);
    for (const exactField of [expected.titleExact, expected.contributorExact]) {
      if (!actualText.includes(comparisonText(exactField))) {
        throw new Error(
          `NEB link ${expected.itemId} no longer contains the exact transcribed title/contributor.`
        );
      }
    }
  }
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
    throw new Error(`NEB snapshot request failed: HTTP ${response.status}.`);
  }
  const finalUrl = assertAllowedFinalResponseUrl(response.url);
  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/html(?:;|$)/iu.test(contentType)) {
    throw new Error(`NEB snapshot has unexpected content type: ${contentType}.`);
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
  assertSnapshotSize(snapshot, "Imported NEB snapshot");
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
  assertSnapshotSize(snapshot, "Checked-in NEB snapshot");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  if (metadata.contentSha256 !== sha256(snapshot)) {
    throw new Error("Checked-in NEB snapshot does not match its metadata hash.");
  }
  return { snapshot, metadata };
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const inventory = registry.inventories.find(
  (candidate) => candidate.sourceId === sourceId
);
if (!inventory) throw new Error(`Registry inventory ${sourceId} is missing.`);
const source = registry.sources.find((candidate) => candidate.id === sourceId);
if (!source) throw new Error(`Registry source ${sourceId} is missing.`);

const { snapshot, metadata } = inputPath
  ? await importedSnapshot()
  : refresh
    ? await downloadSnapshot()
    : await checkedInSnapshot();
verifyInventorySnapshot(snapshot, inventory.items);

const nextSource = {
  ...source,
  url: sourceUrl,
  snapshot: {
    capturedAt: metadata.capturedAt,
    snapshotStatus: "verified-content-hash",
    contentSha256: metadata.contentSha256,
    extractionMethod: "dom-link-extraction",
    version: "neb-svet-expected-link-verification-v1",
  },
  declaredItemCount: inventory.items.length,
  notes:
    `The complete official collection page was preserved as response-body bytes. All ${inventory.items.length} expected links, their order, titles and contributors were checked against the retained snapshot; editorial Work/manifestation classifications remain separately reviewable. ` +
    "The list is one candidate canon signal only, and every accepted Work still requires a second source from an independent controlled group.",
};
const nextRegistry = {
  ...registry,
  snapshotDate: metadata.capturedAt,
  sources: registry.sources.map((candidate) =>
    candidate.id === sourceId ? nextSource : candidate
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
  await writeVerifiedSnapshotAtomically(snapshot, (candidate) =>
    verifyInventorySnapshot(candidate, inventory.items)
  );
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await writeFile(registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, "utf8");
} else if (JSON.stringify(source) !== JSON.stringify(nextSource)) {
  throw new Error("Checked-in NEB snapshot metadata is stale.");
}

console.log(
  JSON.stringify(
    {
      sourceId,
      capturedAt: metadata.capturedAt,
      contentSha256: metadata.contentSha256,
      bytes: metadata.byteLength,
      items: inventory.items.length,
      mode: write ? "written" : "checked",
    },
    null,
    2
  )
);
