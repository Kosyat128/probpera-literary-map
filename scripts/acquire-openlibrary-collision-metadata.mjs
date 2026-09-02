import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const auditPath = path.join(repositoryRoot, "reports", "book-database-audit.json");
const outputPath = path.join(
  repositoryRoot,
  "data",
  "book-collision-snapshots",
  "openlibrary-work-metadata-2026-09-02.json"
);
const refresh = process.argv.includes("--refresh");
const unsupported = process.argv.slice(2).filter((value) => value !== "--refresh");
if (unsupported.length > 0) {
  throw new Error(`Unknown arguments: ${unsupported.join(", ")}`);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function workId(externalId) {
  const match = String(externalId).match(/^openlibrary:(OL\d+W)$/u);
  if (!match) throw new Error(`Unsupported collision identity: ${externalId}`);
  return match[1];
}

function compactRecord(id, raw, responseSha256) {
  const authorKeys = Array.isArray(raw.authors)
    ? raw.authors
        .map((entry) => entry?.author?.key || entry?.key || "")
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "en"))
    : [];
  const description =
    typeof raw.description === "string"
      ? raw.description
      : typeof raw.description?.value === "string"
        ? raw.description.value
        : "";
  return {
    workId: id,
    sourceUrl: `https://openlibrary.org/works/${id}.json`,
    responseSha256,
    title: typeof raw.title === "string" ? raw.title : "",
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    authorKeys,
    firstPublishDate:
      typeof raw.first_publish_date === "string" ? raw.first_publish_date : "",
    subjects: Array.isArray(raw.subjects)
      ? raw.subjects.filter((value) => typeof value === "string")
      : [],
    description,
    revision: Number.isInteger(raw.revision) ? raw.revision : null,
    latestRevision: Number.isInteger(raw.latest_revision)
      ? raw.latest_revision
      : null,
    created: raw.created?.value || "",
    lastModified: raw.last_modified?.value || "",
  };
}

async function fetchRecord(id) {
  const response = await fetch(`https://openlibrary.org/works/${id}.json`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ProbperaBookEvidenceAudit/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Open Library ${id}: HTTP ${response.status}`);
  }
  const body = await response.text();
  return compactRecord(id, JSON.parse(body), sha256(body));
}

async function fetchInBatches(ids, size = 5) {
  const records = [];
  for (let index = 0; index < ids.length; index += size) {
    const batch = ids.slice(index, index + size);
    records.push(...(await Promise.all(batch.map(fetchRecord))));
  }
  return records;
}

const audit = JSON.parse(await fs.readFile(auditPath, "utf8"));
const ids = [...new Set(audit.globalExternalIdDuplicates.map((group) => workId(group.externalId)))]
  .sort((left, right) => left.localeCompare(right, "en"));

if (!refresh) {
  const existing = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const existingIds = existing.records.map((record) => record.workId);
  if (JSON.stringify(existingIds) !== JSON.stringify(ids)) {
    throw new Error("Open Library collision snapshot coverage is stale; rerun with --refresh");
  }
  if (
    existing.records.some(
      (record) => !/^[a-f0-9]{64}$/u.test(record.responseSha256)
    )
  ) {
    throw new Error("Open Library collision snapshot contains an invalid response hash");
  }
  console.log(JSON.stringify({ records: existing.records.length, checked: true }, null, 2));
  process.exit(0);
}

const records = (await fetchInBatches(ids)).sort((left, right) =>
  left.workId.localeCompare(right.workId, "en")
);
const payload = {
  schemaVersion: 1,
  provider: "Open Library",
  purpose:
    "Provider metadata snapshot for adjudicating cross-writer reuse of Open Library Work identifiers; not independent proof of authorship or canonical status.",
  retrievedAt: "2026-09-02",
  sourceAudit: "reports/book-database-audit.json",
  recordCount: records.length,
  recordsSha256: sha256(JSON.stringify(records)),
  records,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ records: records.length, outputPath }, null, 2));
