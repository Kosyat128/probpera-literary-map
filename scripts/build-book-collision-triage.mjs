import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCollisionTriage, validateCollisionTriage } from "./lib/book-external-collision-adjudication.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = path.join(root, "reports", "book-database-audit.json");
const snapshotPath = path.join(root, "data", "book-collision-snapshots", "openlibrary-work-metadata-2026-09-02.json");
const outputPath = path.join(root, "data", "book-external-collision-triage.json");
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const unsupported = process.argv.slice(2).filter((argument) => argument !== "--write" && argument !== "--check");
if (unsupported.length > 0 || (write && check)) {
  throw new Error("Use exactly one of --write or --check");
}

const [audit, snapshot] = await Promise.all(
  [auditPath, snapshotPath].map(async (file) => JSON.parse(await readFile(file, "utf8")))
);

if (check) {
  const triage = JSON.parse(await readFile(outputPath, "utf8"));
  const issues = validateCollisionTriage({ audit, snapshot, triage });
  if (issues.length > 0) throw new Error(`Collision triage failed: ${issues.join(", ")}`);
  console.log(JSON.stringify({ decisions: triage.decisionCount, productionActions: 0, checked: true }, null, 2));
  process.exit(0);
}

const triage = buildCollisionTriage({ audit, snapshot, reviewedAt: "2026-09-02" });
if (write) await writeFile(outputPath, `${JSON.stringify(triage, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ decisions: triage.decisionCount, classifications: triage.classifications, productionActions: 0, wrote: write }, null, 2));
