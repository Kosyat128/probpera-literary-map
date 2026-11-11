import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const retryRpcSource = readFileSync(new URL("../../../lib/publication-retry-rpc.ts", import.meta.url), "utf8");
const retryCoordinatorSource = readFileSync(new URL("../../../lib/publication-retry.ts", import.meta.url), "utf8");
const retrySqlSource = readFileSync(new URL("../../../../../supabase/migrations/20261030161000_publication_retry_admission.sql", import.meta.url), "utf8");

describe("publication dashboard", () => {
  it("shows a complete counted outbox catalog with deployment state", () => {
    expect(pageSource).toContain('.from("public_build_outbox")');
    expect(pageSource).toContain('{ count: "exact" }');
    expect(pageSource).toContain("eventsRequest.range(catalog.from, catalog.to)");
    expect(pageSource).toContain("deployment_run_id");
    expect(pageSource).toContain("attempt_count");
    expect(pageSource).toContain("last_error");
  });

  it("supports a durable retry and a full manual rebuild", () => {
    expect(actionsSource).toContain("return requestPublicationRetry({");
    expect(retryRpcSource).toContain('client.rpc("admit_public_build_retry"');
    expect(retryRpcSource).toContain("p_outbox_id: requested.outboxId");
    expect(retryRpcSource).toContain("p_retry_operation_id: requested.operationId");
    expect(retryRpcSource).toContain("p_expected_updated_at: requested.expectedUpdatedAt");
    expect(retryRpcSource).toContain("receipt.observed.retryOfOutboxId !== requested.outboxId");
    expect(retrySqlSource).toContain("retry_operation_id");
    expect(retrySqlSource).toContain("retry_of_outbox_id");
    expect(retryCoordinatorSource).not.toContain('"enqueue_public_build_request"');
    expect(actionsSource).toContain("requestPublicBuild({");
    expect(actionsSource).toContain('entityId: "full-public-build"');
    expect(actionsSource).toContain("published: publication.state");
  });
});
