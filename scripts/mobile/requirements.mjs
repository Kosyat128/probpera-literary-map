import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const V12_INPUT_PIN = Object.freeze({
  archiveSha256: "1035e6482b51586275ff9eba7a182f405915322c97e9c7349b56664e1ea7e174",
  checksumFileSha256: "a3cfdba220ee667886d193c3fffc9a9eb144d3611a4ec65f106d519534166732",
});

export function safeRelativeName(name) {
  if (typeof name !== "string" || !name || name.includes("\\") ||
      path.posix.isAbsolute(name) || /^[A-Za-z]:/.test(name) ||
      name.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid requirement path: ${String(name)}`);
  }
  return name;
}

export function parseChecksums(source) {
  const seen = new Set();
  return source.trim().split(/\r?\n/).map((line) => {
    const match = /^([a-f0-9]{64}) [ *](.+)$/i.exec(line);
    if (!match) throw new Error("Malformed SHA256SUMS entry");
    const name = safeRelativeName(match[2]);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate checksum: ${name}`);
    seen.add(key);
    return { name, sha256: match[1].toLowerCase() };
  });
}

async function readRegularFile(root, name) {
  safeRelativeName(name);
  const filename = path.resolve(root, name);
  const resolved = await realpath(filename);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Requirement escapes input root: ${name}`);
  }
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular file: ${name}`);
  return readFile(filename);
}

export async function verifyRequirements(inputRoot, expected = {}) {
  const root = await realpath(inputRoot);
  const checksumBytes = await readRegularFile(root, "SHA256SUMS.txt");
  const checksums = parseChecksums(checksumBytes.toString("utf8"));
  const manifestBytes = await readRegularFile(root, "MANIFEST.json");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const failures = [];
  if (expected.checksumFileSha256 && sha256(checksumBytes) !== expected.checksumFileSha256) {
    failures.push({ name: "SHA256SUMS.txt", reason: "input-pin-mismatch" });
  }
  const checked = new Map();
  for (const entry of checksums) {
    try {
      const bytes = await readRegularFile(root, entry.name);
      const actual = sha256(bytes);
      checked.set(entry.name, { sha256: actual, bytes: bytes.length });
      if (actual !== entry.sha256) failures.push({ name: entry.name, reason: "checksum-mismatch" });
    } catch (error) {
      failures.push({ name: entry.name, reason: error.code === "ENOENT" ? "missing" : error.message });
    }
  }
  if (!checked.has("MANIFEST.json")) failures.push({ name: "MANIFEST.json", reason: "not-checksummed" });
  const names = new Set();
  for (const entry of manifest.files ?? []) {
    safeRelativeName(entry.name);
    if (names.has(entry.name.toLowerCase())) failures.push({ name: entry.name, reason: "duplicate-manifest-entry" });
    names.add(entry.name.toLowerCase());
    const actual = checked.get(entry.name);
    if (!actual || actual.sha256 !== entry.sha256 || actual.bytes !== entry.bytes) {
      failures.push({ name: entry.name, reason: "manifest-mismatch" });
    }
  }
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name !== "SHA256SUMS.txt" && !checked.has(entry.name)) {
      failures.push({ name: entry.name, reason: "unregistered-input" });
    }
  }
  return {
    package: manifest.package, version: manifest.version,
    manifestSha256: sha256(manifestBytes), checksumFileSha256: sha256(checksumBytes),
    checksumCount: checksums.length, manifestFileCount: (manifest.files ?? []).length,
    bindingDocumentCount: (manifest.files ?? []).filter((entry) => entry.binding).length,
    pass: failures.length === 0, failures,
  };
}

export function routeStage(routing, stage) {
  if (!/^S(?:[0-3][0-9]|40)$/.test(stage)) throw new Error(`Unsupported stage: ${stage}`);
  const number = Number(stage.slice(1));
  const matches = Object.entries(routing.stages).filter(([key]) => {
    if (key === stage) return true;
    const range = /^S(\d{2})-S(\d{2})$/.exec(key);
    return range && number >= Number(range[1]) && number <= Number(range[2]);
  });
  if (matches.length !== 1) throw new Error(`Expected exactly one route for ${stage}`);
  const documents = [...new Set([...routing.sharedAlways, ...matches[0][1]])];
  documents.forEach(safeRelativeName);
  return { stage, route: matches[0][0], documents };
}
