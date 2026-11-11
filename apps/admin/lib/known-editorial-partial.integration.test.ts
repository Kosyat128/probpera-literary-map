import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const repo = path.resolve(import.meta.dirname, "../../.."), work = path.resolve(repo, "../work");
const fixture = path.join(repo, "apps/admin/lib/fixtures/known-editorial-partial.cjs");
const oracle = path.join(repo, "apps/admin/lib/fixtures/known-editorial-partial.same-contract.cjs");
const oracleSha = "69d4a92ab61ce40218da726f71f0f8b6fdbdece0b52125035ce70bf33f873c80";
type Row = Record<string, any>;
let report: Row, oracleReport: Row;
const kinds = ["writer", "library", "country", "site_copy"];
const originalNames = kinds.flatMap(kind => [
  `${kind} ordinary repeat does not regenerate acknowledged valid translator output`,
  `${kind} actual trigger retained valid translation then known invalid review and repair`,
  `${kind} canonical manual data and publication remain exact`,
  `${kind} original accepted raw bodies and identities remain retained`,
]);

describe("known editorial paid partial keeps its original admission", () => {
  beforeAll(() => {
    mkdirSync(work, { recursive: true });
    const output = path.join(mkdtempSync(path.join(work, "known-editorial-partial-maintained-")), "cases");
    const allowed = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(name)));
    const env = { ...allowed, NODE_ENV: "production", KNOWN_EDITORIAL_PARTIAL_REPO: repo,
      KNOWN_EDITORIAL_PARTIAL_SOURCE_ROOT: repo, KNOWN_EDITORIAL_PARTIAL_OUTPUT_ROOT: output } as unknown as NodeJS.ProcessEnv;
    const current = spawnSync(process.execPath, [fixture], { cwd: repo, env, encoding: "utf8", timeout: 55_000, maxBuffer: 24 * 1024 * 1024 });
    expect(current.error, current.stderr).toBeUndefined(); expect(current.status, current.stderr).toBe(0);
    expect(current.stderr).toBe("");
    report = JSON.parse(readFileSync(path.join(output, "report.json"), "utf8"));
    const original = spawnSync(process.execPath, [oracle, path.join(output, "report.json")], {
      cwd: repo, env, encoding: "utf8", timeout: 10_000, maxBuffer: 4 * 1024 * 1024,
    });
    expect(original.error, original.stderr).toBeUndefined(); expect(original.stderr).toBe("");
    expect([0, 1]).toContain(original.status);
    oracleReport = JSON.parse(original.stdout);
    expect(oracleReport.checks.map((row: Row) => row.name)).toEqual(originalNames);
  }, 60_000);

  it.each(originalNames)("unchanged original oracle: %s", name => {
    const check = oracleReport.checks.find((row: Row) => row.name === name);
    expect(check?.pass, JSON.stringify(check)).toBe(true);
  });

  it("uses the exact genuine BEFORE oracle bytes", () => {
    expect(createHash("sha256").update(readFileSync(oracle)).digest("hex")).toBe(oracleSha);
    expect(report.oracleSha256).toBe(oracleSha);
  });

  it.each(kinds.slice(0, 3))("%s keeps unfinished known paid work and original default policy", kind => {
    const row = report.cases.find((row: Row) => row.kind === kind), old = row.firstOperations[0];
    expect(old.phase).not.toBe("finished"); expect(old.result).toBeNull(); expect(old.candidate).toBeNull();
    expect(row.firstBudgets[0].input).toEqual({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
    expect(row.firstProviderCalls.map((call: Row) => call.pass)).toEqual(["translation", "review", "repair"]);
    const current = row.finalOperations.find((op: Row) => op.operationId === old.operationId);
    for (const key of ["sourceHash", "rawSeedHash", "rawSeed", "sourceSnapshot", "sourceRevision", "targetRevision",
      "expectedState", "expectedOverrideFields", "configuration", "configurationHash", "intentHash", "calls"]) {
      expect(current[key], key).toEqual(old[key]);
    }
    expect(row.newLogicalOperationIds).toEqual([]); expect(row.newDispatchCallIds).toEqual([]);
  });

  it.each(kinds.slice(0, 3))("%s preserves a supplied 45-second budget without paid continuation", kind => {
    const row = report.suppliedBudgets.find((row: Row) => row.kind === kind);
    expect(row.firstBudget).toMatchObject({ attempts: 1, providerCalls: 3, maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 45000 });
    expect(row.lastBudget).toEqual(row.firstBudget);
    expect(row.firstProviderCount).toBe(3); expect(row.lastProviderCount).toBe(3);
    expect(row.finalOperations).toEqual(row.firstOperations);
  });

  it.each(kinds.slice(0, 3))("%s still closes a free refused admission and permits a fresh legitimate attempt", kind => {
    const row = report.zeroCallClosures.find((row: Row) => row.kind === kind);
    expect(row.firstProviderCount).toBe(0); expect(row.firstOperations).toHaveLength(1);
    expect(row.firstOperations[0]).toMatchObject({ phase: "finished", calls: [] });
    expect(row.firstOperations[0].result).toMatchObject({ state: "skipped" });
    expect(row.finalOperations).toHaveLength(2); expect(row.lastProviderCount).toBe(2);
  });

  it.each(kinds.slice(0, 3))("%s observes genuine historical finished paid failure without another operation", kind => {
    const row = report.legacyHistoricalCases.find((row: Row) => row.kind === kind);
    expect(row.firstOperations[0]).toEqual(row.seededOperation);
    expect(row.observedNativeReceipt).toMatchObject({ phase: "finished", providerCalls: 3, result: { candidateHash: null } });
    expect(row.providerCalls).toEqual([]); expect(row.finalOperations).toEqual(row.firstOperations);
    expect(row.ordinaryWire.filter((call: Row) => /\/(?:begin|record_.*dispatch)/u.test(call.path || ""))).toEqual([]);
  });
});
