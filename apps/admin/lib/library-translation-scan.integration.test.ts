import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."), work = path.resolve(root, "../work");
const names = [
  "Original55b native BEFORE retains4 target failures under unchanged six-assertion contract",
  "CURRENT stable library scan satisfies the original six mutation and no-repeat assertions",
  "More than500 manual members use two immutable successor windows and60-per-request bounds",
  "Deleted pending ID receives one terminal observation without shifting the next member",
  "Exhausted Continue preserves history while an explicit fresh intent scans new members",
  "Unavailable saved-window GET cannot reset position or create a fresh scan",
  "Malformed checkpoint ACK replays the exact transition and advances each free member once",
  "Transport-lost BEGIN ACK twice retains one recoverable scan identity without provider calls",
  "Transport-lost checkpoint ACK reuses its UUID and never repeats an inspected manual member",
  "Accepted unknown child pins identity before manual-and-rights and never repeats expense",
  "Accepted unknown child pins identity before source-deleted and never repeats expense",
  "Accepted unknown child pins identity before feature-off and never repeats expense",
  "Duplicate fresh intent observes an accepted child before changed runtime flags",
  "Zero-call admitted child holds and unlinks before a later confirmed paid attempt",
  "Completed accepted body recovers privately after manual takeover and feature disable",
  "Cancelled scan stops before another source read or paid admission",
  "Nonzero legacy cursor is stale while an explicit fresh intent is an independent command",
  "Inserts behind the fixed set and beyond high-water appear only in an explicit fresh scan",
  "Concurrent actual continuations share one paid child and one confirmed position",
  "A persisted observed child resolves once before feature or eligibility checks without borrowed payment",
  "Lost attach ACK twice never dispatches and later releases the actual zero-call child",
  "Paid terminal checkpoint ACK loss retains one candidate and one logical advance",
  "Cancellation after accepted translation retains delivered private data and blocks new expense",
  "Cancellation after accepted review retains delivered private data and blocks new expense",
  "Historical retained-only FINISH resolves once without attaching or repeating the paid operation",
  "Real metadata read failure remains dead-letter and Continue scans remaining IDs without retry",
];
const environment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
type Report = { checks: Array<{ name: string; pass: boolean; error?: string }>; unchanged: boolean; archiveSha256: string; contractSha256: string;
  traces: Array<{ name: string; same?: { targetFailures: number; target: Array<{ name: string; pass: boolean }> } }> };

describe("M07 library-only bounded stable scan through actual application and installed SDK", () => {
  let report: Report;
  beforeAll(() => {
    mkdirSync(work, { recursive: true }); const output = mkdtempSync(path.join(work, "library-scan-maintained-"));
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/library-translation-scan-cases.cjs")], {
      cwd: root, env: { ...environment(), LIBRARY_SCAN_REPO: root, LIBRARY_SCAN_SOURCE_ROOT: root, LIBRARY_SCAN_OUTPUT_ROOT: output },
      encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(path.join(output, "runner.stdout.log"), run.stdout || ""); writeFileSync(path.join(output, "runner.stderr.log"), run.stderr || "");
    expect(run.error, run.stderr).toBeUndefined(); expect(run.stderr).toBe("");
    report = JSON.parse(readFileSync(path.join(output, "library-scan-cases-report.json"), "utf8"));
    expect(report.checks.map(check => check.name)).toEqual(names); expect(report.unchanged).toBe(true);
    expect(report.archiveSha256).toBe("55b10dade79c6cf88ea429a17e58b12f23e108e8f9d7c0445716447273cbb356");
    expect(report.contractSha256).toBe("a988d0df137b66ef6822450d0307fb76222e2c706cc341a2b04a6ee5e5378008");
    expect(run.status, JSON.stringify(report.checks.filter(check => !check.pass))).toBe(0);
  }, 125_000);
  it.each(names)("%s", name => {
    const result = report.checks.find(check => check.name === name); expect(result, "Actual case must execute").toBeDefined(); expect(result!.pass, result!.error).toBe(true);
  });
  it.each(["update-visited", "delete-visited", "insert-before-cursor"].flatMap(kind => [
    `${kind}:all-original-members-seen`, `${kind}:no-repeat-within-sweep`,
  ]))("CURRENT keeps the original SAME assertion: %s", name => {
    const current = report.traces.find(trace => trace.name === names[1])!.same!;
    expect(current.targetFailures).toBe(0); expect(current.target).toContainEqual({ name, pass: true });
  });
  it("retains the genuine original BEFORE target failure instead of relabeling it acceptance", () => {
    const before = report.traces.find(trace => trace.name === names[0])!.same!;
    expect(before.target).toHaveLength(6); expect(before.targetFailures).toBe(4); expect(before.target.filter(check => !check.pass)).toHaveLength(4);
  });
});
