import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
type Check = { name: string; category: string; pass: boolean; expected: unknown; actual: unknown };
type Report = { sourceRoot: string; unchanged: boolean; checks: Check[]; summary: { fail: number; executionFail: number } };
let report: Report;

const cases = [
  "Actual batch executes two premium provider passes",
  "Actual batch technical success preserves canonical settings and does not request publication",
  "Actual exporter retains accepted EN after machine completion",
  "Actual batch stores explicit pending private machine output",
  "Actual ordinary save invokes two premium passes after accepted RU save",
  "Ordinary save publishes accepted RU with prior canonical EN only",
  "Ordinary save preserves other locales and raw unrelated settings",
  "Stale form with expected revision cannot recreate a missing canonical block",
  "Ordinary RU-only save preserves unchanged raw manual EN neighbour locales and tombstone ownership",
  "Ordinary EN-only save preserves unchanged raw RU and removes only explicitly edited EN ownership",
  "Ordinary accepted RU save survives runtime disabled with only ordinary publication",
  "Ordinary accepted RU save survives provider failure with only ordinary publication",
  "Ordinary accepted RU save survives optional helper transport throw with only ordinary publication",
  "Duplicate canonical rows fail closed in actual batch before provider or write expense",
  "Duplicate canonical rows fail closed in actual save before provider or write expense",
  "Duplicate canonical rows fail closed in direct helper before provider expense",
  "Helper has explicit technical success with pending human review and unchanged publication",
  "Private candidate binds full raw settings and exact block revisions",
  "Pending candidate repeats with zero additional provider or canonical expense",
  "Helper forwards shared budget so reviewer cannot exceed admitted provider call cap",
  "Raw RU EN whitespace CRLF dashes and authored JSON remain exact outside private candidate",
  "Manual existing EN stays exact without provider or canonical writes",
  "Present blank manual EN stays exact without provider or canonical writes",
  "Present null manual EN stays exact without provider or canonical writes",
  "Malformed marker cannot own EN stays exact without provider or canonical writes",
  "Non-string EN with machine marker stays exact without provider or canonical writes",
  "Malformed top locale map stays exact without provider or canonical writes",
  "Malformed premium metadata stays exact without provider or canonical writes",
  "Null top premium metadata stays exact without provider or canonical writes",
  "Current admitted machine EN stays exact without provider or canonical writes",
  "Legacy current hash with raw whitespace CRLF and long dash stays exact without provider or canonical writes",
  "Absent EN with incomplete historical marker stages privately while preserving raw metadata",
  "Blank machine EN with matching source hash stages privately instead of claiming current",
  "Whitespace machine EN with matching source hash stages privately instead of claiming current",
  "Cyrillic machine EN with matching source hash stages privately instead of claiming current",
  "Private read unavailable fails closed before provider expense",
  "Private read missing fails closed before provider expense",
  "Private read null fails closed before provider expense",
  "Private read malformed fails closed before provider expense",
  "Stage lost-ack stays unconfirmed then recovers candidate without regeneration",
  "Stage malformed-ack stays unconfirmed then recovers candidate without regeneration",
  "Changed RU source during provider retains stale private output without canonical mutation or repeat calls",
  "Manual takeover during provider retains stale private output without canonical mutation or repeat calls",
  "Latest source read unavailable retains received result with unknown freshness and zero regeneration",
  "Latest source read malformed retains received result with unknown freshness and zero regeneration",
  "Latest source read null retains received result with unknown freshness and zero regeneration",
  "Initial source read unavailable fails closed before provider expense",
  "Initial source read malformed fails closed before provider expense",
  "Initial source read null fails closed before provider expense",
  "Changed RU source keeps candidate visible but unapprovable without regeneration",
  "Changed raw authored settings keeps candidate visible but unapprovable without regeneration",
  "Changed block CAS keeps candidate visible but unapprovable without regeneration",
  "Concurrent manual takeover keeps candidate visible but unapprovable without regeneration",
  "Actual review panel separates RU canonical EN and candidate with required human confirmation",
  "Approval without human checkbox cannot promote or request publication",
  "Candidate receipt mismatch is rejected before promotion or publication",
  "Explicit approval promotes trusted stored candidate before one public request",
  "Explicit promotion preserves other locales and raw authored settings",
  "Explicit stale discard removes only private candidate without publication",
  "Promotion lost-ack never requests a build or blindly repeats consumed candidate",
  "Promotion wrong-target never requests a build or blindly repeats consumed candidate",
  "Promotion wrong-actor never requests a build or blindly repeats consumed candidate",
  "Changed key candidate is rejected by actual contract",
  "Duplicate key candidate is rejected by actual contract",
  "Non-English payload candidate is rejected by actual contract",
  "Changed item order is rejected by actual contract",
];

describe("M07-T05 site-copy machine completion requires explicit human review", () => {
  beforeAll(() => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", SITE_COPY_REPO: root, SITE_COPY_SOURCE_ROOT: root };
    delete env.SITE_COPY_OUTPUT_ROOT;
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/site-copy-machine-review.cjs")], {
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
    expect(result, "Actual runtime scenario must exist").toBeDefined();
    expect(result!.pass, JSON.stringify({ expected: result!.expected, actual: result!.actual })).toBe(true);
  });
});
