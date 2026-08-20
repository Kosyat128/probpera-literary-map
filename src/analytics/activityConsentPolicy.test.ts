import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const trackerSource = readFileSync(
  new URL("../community/ActivityTracker.tsx", import.meta.url),
  "utf8"
);

describe("first-party analytics consent policy", () => {
  it("mounts page-view tracking only after explicit analytics consent", () => {
    expect(mainSource).toContain("function ConsentAwareActivityTracker()");
    expect(mainSource).toContain("consent === 'granted' ? <ActivityTracker /> : null");
    expect(mainSource).toContain("<ConsentAwareActivityTracker />");
    expect(mainSource).not.toContain("!cmsEditMode && <ActivityTracker />");
  });

  it("rechecks consent and aborts first-party requests on unmount", () => {
    expect(trackerSource).toContain(
      'readAnalyticsConsent() !== "granted"'
    );
    expect(trackerSource).toContain(".abortSignal(requestController.signal)");
    expect(trackerSource).toContain("requestController.abort()");
  });

  it("keeps essential client diagnostics outside the optional gate", () => {
    expect(mainSource).toContain("<ClientDiagnostics />");
    expect(mainSource).not.toMatch(
      /consent\s*===\s*['"]granted['"][\s\S]{0,120}<ClientDiagnostics/u
    );
  });
});
