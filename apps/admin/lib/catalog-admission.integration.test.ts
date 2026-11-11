import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."), work = path.resolve(root, "../work");
const { unzipSync } = createRequire(import.meta.url)("fflate") as { unzipSync(input: Uint8Array): Record<string, Uint8Array> };
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const environment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
const names = [
  "Unknown accepted request blocks fresh helper work without a duplicate paid attempt",
  "Unknown entity admission remains exclusive after raw rights change without timestamp change",
  "Unknown batch operation holds a nonzero cursor and creates no posthoc paid aggregate",
  "Zero-call budget closure retains the nonzero current cursor without committing next",
  "Malformed BEGIN receipt cannot authorize an actual provider call",
  "Concurrent actual helpers admit only one provider operation for the same entity",
  "Lost BEGIN acknowledgement confirms zero calls before a safe fresh attempt",
  "Lost dispatch acknowledgement never fabricates a response or repeats a request",
  "Retained raw first response is incomplete and cannot automatically start a new paid pass",
  "Complete paid response survives unavailable acknowledgement and recovers at zero further cost",
  "Lost FINISH acknowledgement reconciles the existing completed private candidate",
  "Cancellation after final accepted review retains complete paid output without claiming success",
  "Completed paid body remains private after source-revision takeover",
  "Completed paid body remains private after manual-English takeover",
  "Completed paid body remains private after rights-without-timestamp takeover",
  "Concurrent pending-slot takeover preserves the old slot and retains the new complete candidate",
  "Consumed completed draft remains historical and is never regenerated or restaged",
  "review=false repair=false preserves existing provider passes, token limit and human-pending completion",
  "review=false repair=true preserves existing provider passes, token limit and human-pending completion",
  "review=true repair=false preserves existing provider passes, token limit and human-pending completion",
  "review=true repair=true preserves existing provider passes, token limit and human-pending completion",
  "Deadline after raw translation holds current cursor and never claims complete output",
  "Full repair batch preserves its original shared attempt and provider-call limits",
  "Acknowledged invalid paid responses stay held without a fresh implicit attempt",
  "Oversize full raw server seed refuses admission before any provider expense",
  "Oversize response cannot receive a false acknowledgement or start reviewer work",
  "Ordinary source save and its durable build request precede optional paid admission",
];
const cases = ["library", "country"].flatMap(kind => names.map(name => ({ kind, name })));
cases.push({ kind: "library", name: "Uppercase work UUID resolves the same canonical entity without changing authored fields or source projection" });
for (const malformed of [null, [], "invalid-map"]) cases.push({ kind: "country", name: `Malformed country translations ${JSON.stringify(malformed)} is rejected before expense` });
type Check = { kind: string; name: string; pass: boolean; error?: string };

describe("M07 book and country durable admission and private completed output", () => {
  let report: { checks: Check[]; unchanged: boolean; boundaryErrors: unknown[] };
  beforeAll(() => {
    mkdirSync(work, { recursive: true }); const output = mkdtempSync(path.join(work, "catalog-admission-maintained-"));
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/catalog-admission-cases.cjs")], {
      cwd: root, env: { ...environment(), CATALOG_ADMISSION_REPO: root, CATALOG_ADMISSION_SOURCE_ROOT: root, CATALOG_ADMISSION_OUTPUT_ROOT: output },
      encoding: "utf8", timeout: 60000, maxBuffer: 16 * 1024 * 1024,
    });
    expect(run.error, run.stderr).toBeUndefined(); expect(run.stderr).toBe("");
    report = JSON.parse(readFileSync(path.join(output, "catalog-admission-cases-report.json"), "utf8"));
    expect(report.checks.map(({ kind, name }) => ({ kind, name }))).toEqual(cases);
    expect(report.unchanged).toBe(true); expect(report.boundaryErrors).toEqual([]);
    expect(run.status, JSON.stringify(report.checks.filter(check => !check.pass))).toBe(0);
  }, 65000);
  it.each(cases)("$kind: $name", ({ kind, name }) => {
    const result = report.checks.find(check => check.kind === kind && check.name === name);
    expect(result, "Actual case must execute").toBeDefined(); expect(result!.pass, result!.error).toBe(true);
  });
});

describe.each(["before", "current"] as const)("M07 catalog %s with original four-target SAME contract", mode => {
  it("executes bound action/helper/premium/SDK algorithms through explicit transport adaptation", () => {
    mkdirSync(work, { recursive: true }); const output = mkdtempSync(path.join(work, `catalog-admission-same-${mode}-`));
    const bytes = readFileSync(path.join(root, "docs/admin-r3-evidence/2026-10-30-writer-admission/next-library-country-admission-before.zip"));
    expect(hash(bytes)).toBe("652bbe1367df8b92f267a418600d55ce76feb9fa1f9a69b969722a02c8f27cef");
    const entries = unzipSync(bytes), beforeRoot = path.join(output, "before-source"), written = new Map<string, string>();
    for (const [file, source] of Object.entries(entries)) {
      const match = /^diagnostic-before\/(?:library|country)\/raw-graph\/sources\/(.+)$/u.exec(file); if (!match) continue;
      const existing = written.get(match[1]); if (existing) { expect(hash(source)).toBe(existing); continue; }
      const destination = path.join(beforeRoot, match[1]); mkdirSync(path.dirname(destination), { recursive: true }); writeFileSync(destination, source, { flag: "wx" });
      written.set(match[1], hash(source));
    }
    expect(written.size).toBeGreaterThan(17);
    const contract = path.join(output, "original-contract.cjs"); writeFileSync(contract, entries["admission-loss.same-contract.cjs"], { flag: "wx" });
    expect(hash(readFileSync(contract))).toBe("1032b8b03fa702b1ab44a22681a5db4630626cf4ac323841191dedc684a20d04");
    const env = { ...environment(), CATALOG_ADMISSION_REPO: root, CATALOG_ADMISSION_SOURCE_ROOT: mode === "before" ? beforeRoot : root,
      CATALOG_ADMISSION_OUTPUT_ROOT: path.join(output, "scenario") };
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/catalog-admission-runtime.cjs")], {
      cwd: root, env, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    });
    expect(run.error, run.stderr).toBeUndefined(); expect(run.status, run.stderr).toBe(0);
    const resultFile = path.join(output, "contract-result.json"), checked = spawnSync(process.execPath, [contract, path.join(output, "scenario/same-scenario-report.json"), resultFile], {
      cwd: root, env, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    });
    expect(checked.error, checked.stderr).toBeUndefined();
    const result = JSON.parse(readFileSync(resultFile, "utf8")); expect(result.controlFailures).toBe(0);
    expect(result.targetFailures).toBe(mode === "before" ? 4 : 0); expect(checked.status, checked.stderr).toBe(mode === "before" ? 1 : 0);
  }, 65000);
});
