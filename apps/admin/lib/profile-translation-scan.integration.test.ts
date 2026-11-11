import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const work = path.resolve(root, "../work");
const names = [
  "Original5489 retains six failures under the unchanged eight-target a988 contract",
  "CURRENT exact country and writer membership satisfies all eight original a988 targets",
  ...["country", "writer"].flatMap(kind => [
    `${kind}: eager successors never skip an unfinished window and all501 fixed members are inspected once`,
    `${kind}: only a changed pending source becomes stale while later fixed members continue`,
    `${kind}: deleted pending tuple is skipped once without substituting its former array neighbour`,
    `${kind}: unavailable saved-window GET never resets progress or starts a new scan`,
    `${kind}: twice lost BEGIN acknowledgement preserves one recoverable scan intent`,
    `${kind}: twice lost checkpoint acknowledgement reuses one exact logical transition`,
    `${kind}: raw legacy tokens cannot authorize an unobserved prefix`,
    `${kind}: actual bounded paid batch attaches metadata before dispatch and keeps original cap`,
    `${kind}: accepted unknown child pins before catalog outage and disabled runtime`,
    `${kind}: twice lost attach acknowledgement costs zero calls until confirmed cleanup`,
    `${kind}: cancellation after accepted translation or review retains delivered bodies without repeat expense`,
    `${kind}: actual complete retained responses recover privately before catalog outage and changed runtime`,
    `${kind}: foreign unresolved identity pins a new changed-source scan without private artifact access`,
    `${kind}: historical retained terminal metadata advances once without another paid attempt`,
    `${kind}: exhausted Continue preserves original history and only explicit fresh includes new members`,
    `${kind}: explicit new fresh intent after accepted unknown work observes the same entity before changed or absent source`,
  ]),
  "Writer identical IDs in two countries retain distinct frozen tuples and exact override reads",
];
const environment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
type Report = {
  checks: Array<{ name: string; pass: boolean; error?: string }>;
  archiveSha256: string;
  contractSha256: string;
  traces: Array<{ name: string; same?: { targetFailures: number; target: Array<{ name: string; pass: boolean }> } }>;
};

describe("M07 stable country and writer tuple scan through actual application and installed SDK", () => {
  let report: Report;
  beforeAll(() => {
    mkdirSync(work, { recursive: true });
    const output = mkdtempSync(path.join(work, "profile-scan-maintained-"));
    const result = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/profile-translation-scan-cases.cjs")], {
      cwd: root, env: { ...environment(), PROFILE_SCAN_REPO: root, PROFILE_SCAN_SOURCE_ROOT: root, PROFILE_SCAN_OUTPUT_ROOT: output },
      encoding: "utf8", timeout: 180_000, maxBuffer: 24 * 1024 * 1024,
    });
    writeFileSync(path.join(output, "runner.stdout.log"), result.stdout || "");
    writeFileSync(path.join(output, "runner.stderr.log"), result.stderr || "");
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.stderr).toBe("");
    report = JSON.parse(readFileSync(path.join(output, "profile-scan-cases-report.json"), "utf8"));
    expect(report.archiveSha256).toBe("5489cdc6aa59f823d69357b5b76f9be057300882696569f297632080cb3a261a");
    expect(report.contractSha256).toBe("a988d0df137b66ef6822450d0307fb76222e2c706cc341a2b04a6ee5e5378008");
    expect(report.checks.map(check => check.name)).toEqual(names);
    expect(result.status, JSON.stringify(report.checks.filter(check => !check.pass))).toBe(0);
  }, 185_000);
  it.each(names)("%s", name => {
    const check = report.checks.find(row => row.name === name);
    expect(check, "The named actual scenario must execute").toBeDefined();
    expect(check!.pass, check!.error).toBe(true);
  });
  it.each(["country", "writer"].flatMap(kind => ["move-visited-to-tail", "delete-visited-insert-tail"].flatMap(mutation => [
    `${kind}/${mutation}:all-original-members-seen`, `${kind}/${mutation}:no-repeat-within-sweep`,
  ])))("CURRENT preserves the genuine original SAME assertion: %s", name => {
    const same = report.traces.find(trace => trace.name === names[1])!.same!;
    expect(same.targetFailures).toBe(0);
    expect(same.target).toHaveLength(8);
    expect(same.target).toContainEqual({ name, pass: true });
  });
  it("retains the genuine original six BEFORE failures without treating them as acceptance", () => {
    const same = report.traces.find(trace => trace.name === names[0])!.same!;
    expect(same.target).toHaveLength(8);
    expect(same.targetFailures).toBe(6);
    expect(same.target.filter(target => !target.pass)).toHaveLength(6);
  });
});
