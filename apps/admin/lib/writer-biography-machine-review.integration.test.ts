import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
type Check = { name: string; category: string; pass: boolean; expected: unknown; actual: unknown };
type Report = { head: string; sourceRoot: string; unchanged: boolean; checks: Check[]; summary: { fail: number; executionFail: number }; limitations: string[] };
let report: Report;

const cases = [
  "Helper correct machine output executes two actual premium passes",
  "Technical machine success leaves canonical writer row exact",
  "Technical machine success has explicit pending private outcome",
  "New machine EN is outside actual public writer admission",
  "Actual writer batch has no machine-triggered public enqueue or dispatch",
  "Actual biography save executes accepted RU save then helper",
  "Accepted RU biography save queues only its ordinary publication",
  "Biography-save machine candidate stays outside actual public admission",
  "Actual generic profile save invokes premium helper",
  "Generic-profile machine candidate stays outside actual public admission",
  "manual reviewed stays exact and has zero provider/write/build expense",
  "manual draft stays exact and has zero provider/write/build expense",
  "admitted machine stays exact and has zero provider/write/build expense",
  "Already admitted machine remains publicly selected",
  "Malformed authored EN fails closed without provider expense or canonical writes",
  "Raw machine translation metadata null is preserved without provider or write expense",
  "Raw machine translation metadata array is preserved without provider or write expense",
  "Raw machine translation metadata text is preserved without provider or write expense",
  "Explicit catalog English null never grants generation or canonical replacement",
  "Pending writer candidate repeats with zero additional provider or canonical expense",
  "Private candidate binds full raw Russian and catalog rights with unrelated locales",
  "Private read missing fails closed before provider expense",
  "Private read null fails closed before provider expense",
  "Private read malformed fails closed before provider expense",
  "Private stage lost-ack is unconfirmed and recovers exact pending candidate without regeneration",
  "Private stage malformed-ack is unconfirmed and recovers exact pending candidate without regeneration",
  "Changed Russian source keeps candidate visible but unapprovable without regeneration",
  "Explicit stale discard removes only private candidate and preserves canonical rights/locales",
  "Changed catalog metadata outside provider source projection prevents approval and regeneration",
  "Changed raw Russian rights outside provider source projection prevents approval and regeneration",
  "Changed writer target CAS retains private candidate and blocks repeat expense",
  "Concurrent authored English takeover prevents approval and remains exact without generation",
  "Actual review panel separates RU canonical EN and candidate with required human confirmation",
  "Approval without human checkbox performs no promotion or public build",
  "Candidate receipt mismatch is rejected before promote or public build",
  "Explicit approval uses trusted stored candidate and actor receipt before one public build",
  "Approval reloads uncached writer catalog and submits exact full catalog binding",
  "Promotion lost-ack never queues a build or blindly repeats the consumed candidate",
  "Promotion wrong-target never queues a build or blindly repeats the consumed candidate",
  "Promotion wrong-actor never queues a build or blindly repeats the consumed candidate",
];

describe("M07-T05 writer machine completion requires explicit human review", () => {
  beforeAll(() => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", WRITER_REPO: root, WRITER_SOURCE_ROOT: root };
    delete env.WRITER_OUTPUT_ROOT;
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/writer-biography-machine-review.cjs")], {
      cwd: root, env, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    });
    expect(run.error, run.stderr).toBeUndefined();
    expect(run.stderr).toBe("");
    report = JSON.parse(run.stdout) as Report;
    expect(report.sourceRoot).toBe(root);
    expect(report.unchanged).toBe(true);
    expect(report.summary.executionFail).toBe(0);
    expect(run.status).toBe(report.summary.fail ? 1 : 0);
    expect(report.checks.map(check => check.name)).toEqual(cases);
  }, 35_000);

  it.each(cases)("%s", name => {
    const result = report.checks.find(check => check.name === name);
    expect(result, "Actual runtime check must exist").toBeDefined();
    expect(result!.pass, JSON.stringify({ expected: result!.expected, actual: result!.actual })).toBe(true);
  });
});
