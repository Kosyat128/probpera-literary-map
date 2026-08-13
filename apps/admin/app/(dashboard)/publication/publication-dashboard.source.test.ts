import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

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
    expect(actionsSource).toContain("retry_of_outbox_id");
    expect(actionsSource).toContain("requestPublicBuild({");
    expect(actionsSource).toContain('entityId: "full-public-build"');
    expect(actionsSource).toContain("published: publication.state");
  });
});
