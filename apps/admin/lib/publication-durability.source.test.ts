import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

describe("durable public publication requests", () => {
  it("uses the transactional outbox with a legacy fallback before dispatch", () => {
    const source = readFileSync(
      path.join(root, "apps/admin/lib/publication.ts"),
      "utf8"
    );
    const outbox = source.indexOf('"enqueue_public_build_request"');
    const request = source.indexOf('action: "public_build.requested"');
    const queueGuard = source.indexOf("if (queueError ||");
    const dispatch = source.indexOf("await triggerPublicBuild(reason)");
    expect(outbox).toBeGreaterThan(-1);
    expect(request).toBeGreaterThan(-1);
    expect(request).toBeGreaterThan(outbox);
    expect(queueGuard).toBeGreaterThan(outbox);
    expect(queueGuard).toBeLessThan(dispatch);
    expect(dispatch).toBeGreaterThan(outbox);
    expect(source).toContain('"mark_public_build_dispatched"');
    expect(source).toContain('outboxError.code === "PGRST202"');
    expect(source).not.toContain("/enqueue_public_build_request/iu");
    expect(source).toContain("normalizeOutboxId(outboxId)");
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
      "if: needs.build.outputs.publication_queue_marker != ''"
    );
    expect(workflow).toContain(
      "--finalize=${{ needs.build.outputs.publication_queue_marker }}"
    );
  });
});
