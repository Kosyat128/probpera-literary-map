import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

describe("durable public publication requests", () => {
  it("records a request before fast dispatch", () => {
    const source = readFileSync(
      path.join(root, "apps/admin/lib/publication.ts"),
      "utf8"
    );
    const request = source.indexOf('action: "public_build.requested"');
    const queueGuard = source.indexOf("if (queueError)");
    const dispatch = source.indexOf("await triggerPublicBuild(reason)");
    expect(request).toBeGreaterThan(-1);
    expect(queueGuard).toBeGreaterThan(request);
    expect(queueGuard).toBeLessThan(dispatch);
    expect(dispatch).toBeGreaterThan(request);
    expect(source).toContain('error: "durable-queue-unavailable"');
  });

  it("lets dispatched workflows consume and finalize durable requests", () => {
    const workflow = readFileSync(
      path.join(root, ".github/workflows/deploy-pages.yml"),
      "utf8"
    );
    expect(workflow).toContain(
      "if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'"
    );
    expect(workflow).toContain(
      "if: needs.build.outputs.rebuild_max_id != ''"
    );
  });
});
