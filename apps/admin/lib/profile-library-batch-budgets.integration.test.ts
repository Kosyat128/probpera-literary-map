import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const work = path.resolve(root, "../work");
const fixtureEnvironment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
const fixtures = [
  { domain: "writer", file: "writer-batch-budget-cap.cjs", prefix: "PROFILE_BUDGET", sha256: "42546f807423531e30fdc7491e73f0096f5b7cdb88e5b870152d256d269787f3" },
  { domain: "library", file: "library-batch-budget-cap.cjs", prefix: "LIBRARY_BUDGET", sha256: "2918441e4e14361cc8f4ff7571bf488e2f0876c2000152ef0e64eef57675badf" },
  { domain: "country", file: "country-batch-budget-cap.cjs", prefix: "COUNTRY_BUDGET", sha256: "e067f3c14ec361766c7cd704edbb2104813d3188d22c940470d0360a5167f98d" },
] as const;
type Check = { name: string; category: string; pass: boolean; expected?: unknown; actual?: unknown };
type Report = { sourceRoot: string; unchanged: boolean; checks: Check[]; canonicalMachineWrites: number; publicBuildRequests: number };

describe.each(fixtures)("M07 $domain SAME paid-attempt cap contract", fixture => {
  let report: Report;
  beforeAll(() => {
    mkdirSync(work, { recursive: true });
    const output = path.join(mkdtempSync(path.join(work, `m07-${fixture.domain}-cap-current-`)), "run");
    const script = path.join(root, "apps/admin/lib/fixtures", fixture.file);
    expect(createHash("sha256").update(readFileSync(script)).digest("hex")).toBe(fixture.sha256);
    const env = { ...fixtureEnvironment(), [`${fixture.prefix}_REPO`]: root, [`${fixture.prefix}_SOURCE_ROOT`]: root, [`${fixture.prefix}_OUTPUT_ROOT`]: output };
    const run = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    expect(run.error, run.stderr).toBeUndefined();
    expect(run.stderr).toBe("");
    report = JSON.parse(run.stdout) as Report;
    expect(report.sourceRoot).toBe(root);
    expect(report.unchanged).toBe(true);
    expect(run.status, JSON.stringify(report.checks)).toBe(0);
  }, 35_000);
  it("bounds paid conflicting attempts and provider passes with the original frozen assertions", () => {
    const targets = report.checks.filter(check => check.category === "target");
    expect(targets).toHaveLength(4);
    expect(targets.every(check => check.pass), JSON.stringify(targets)).toBe(true);
  });
  it("executes actual premium and SDK boundaries while preserving authored canonical data", () => {
    expect(report.checks.filter(check => check.category !== "target").every(check => check.pass)).toBe(true);
    expect(report.canonicalMachineWrites).toBe(0);
    expect(report.publicBuildRequests).toBe(0);
  });
});

describe("M07 CURRENT profile and library shared budget integration", () => {
  let current: { sourceRoot: string; currentSourceOnly: boolean; unchanged: boolean; checks: Array<{ domain: string; name: string; pass: boolean; error?: string }> };
  const names = [
    "Budget migration readiness missing fails closed before any paid work",
    "Budget migration readiness false fails closed before any paid work",
    "Budget migration readiness malformed fails closed before any paid work",
    "Cheap manual current and pending records do not consume the paid batch cap",
    "Domain repairs and final admitted attempt use one shared four-call budget",
    "A shared call cap across candidates blocks a repair without staging incomplete output",
    "Explicit helper retry keeps prior request consumption in the same operation",
    "Deadline after attempt admission but before first request retains the candidate cursor",
    "Deadline after a started translation records one partial failure and advances once",
    "Accepted final review persists privately after the deadline and stops the next candidate",
    "Unconfirmed run acknowledgement never claims a saved cursor or erases private output",
  ];
  const writerNameReplacements: Record<string, string> = {
    "Explicit helper retry keeps prior request consumption in the same operation": "Confirmed invalid responses allow a bounded helper retry without repeating unknown requests",
    "Deadline after a started translation records one partial failure and advances once": "Deadline after a confirmed raw translation retains incomplete output and the current cursor",
    "Unconfirmed run acknowledgement never claims a saved cursor or erases private output": "Unconfirmed paid-operation acknowledgement retains private output without committing its cursor",
  };
  // Catalog now uses the same stronger unknown-result semantics; writer names
  // and its existing 11 controls remain exactly as previously accepted.
  const domainNames = (domain: string) => domain === "writer" ? names.map(name => writerNameReplacements[name] || name)
    : names.map(name => writerNameReplacements[name] || name);
  beforeAll(() => {
    mkdirSync(work, { recursive: true });
    const output = mkdtempSync(path.join(work, "m07-profile-budget-current-"));
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/profile-library-budget-controls.cjs")], {
      cwd: root, env: { ...fixtureEnvironment(), PROFILE_LIBRARY_BUDGET_OUTPUT_ROOT: output }, encoding: "utf8", timeout: 45_000, maxBuffer: 32 * 1024 * 1024,
    });
    expect(run.error, run.stderr).toBeUndefined();
    expect(run.stderr).toBe("");
    current = JSON.parse(run.stdout);
    expect(current.sourceRoot).toBe(root);
    expect(current.currentSourceOnly).toBe(true);
    expect(current.unchanged).toBe(true);
    expect(current.checks.map(check => `${check.domain}:${check.name}`)).toEqual(["writer", "library", "country"].flatMap(domain => domainNames(domain).map(name => `${domain}:${name}`)));
    expect(run.status, JSON.stringify(current.checks.filter(check => !check.pass))).toBe(0);
  }, 50_000);
  it.each(["writer", "library", "country"].flatMap(domain => domainNames(domain).map(name => ({ domain, name }))))("$domain: $name", ({ domain, name }) => {
    const result = current.checks.find(check => check.domain === domain && check.name === name);
    expect(result, "Actual current scenario must run").toBeDefined();
    expect(result!.pass, result!.error).toBe(true);
  });
});
