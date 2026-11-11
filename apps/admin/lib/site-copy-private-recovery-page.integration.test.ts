import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cases = [
  "Deleted canonical master still discovers private candidate and permits safe explicit discard",
  "Recreated canonical master still discovers old private candidate and discards only the orphan",
  "Actual page uses bounded private discovery cursor and distinct candidate panels across pages",
  "Unavailable private discovery keeps canonical editor available without false empty candidate receipt or mutation",
];
let report: { unchanged: boolean; checks: { name: string; pass: boolean }[] };

describe("site-copy orphaned private candidate recovery on actual page", () => {
  beforeAll(() => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", SITE_COPY_REPO: root };
    delete env.SITE_COPY_RECOVERY_OUTPUT_ROOT;
    const run = spawnSync(process.execPath, [path.join(root, "apps/admin/lib/fixtures/site-copy-private-recovery-page.cjs")], {
      cwd: root, env, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    });
    expect(run.error, run.stderr).toBeUndefined();
    expect(run.stderr).toBe("");
    expect(run.status, run.stderr).toBe(0);
    report = JSON.parse(run.stdout);
    expect(report.unchanged).toBe(true);
    expect(report.checks.map(check => check.name)).toEqual(cases);
  }, 35_000);

  it.each(cases)("%s", name => {
    expect(report.checks.find(check => check.name === name)?.pass).toBe(true);
  });
});
