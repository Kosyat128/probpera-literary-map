import { describe, expect, it } from "vitest";

import { getCommunitySessionId } from "./sessionIdentity";

describe("community session identity", () => {
  it("keeps one stable in-memory id when browser storage is unavailable", () => {
    const first = getCommunitySessionId();
    const second = getCommunitySessionId();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );
    expect(second).toBe(first);
  });
});
