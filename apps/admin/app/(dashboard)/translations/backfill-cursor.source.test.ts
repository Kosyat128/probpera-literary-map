import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("premium translation backfill cursor wiring", () => {
  it("uses each server action's cursor or durable article receipt", () => {
    expect(pageSource).not.toContain('name="backfill_cursor"');
    expect(pageSource).toContain('name="libraryCursor"');
    expect(pageSource).toContain('name="writerCursor"');
    expect(pageSource).toContain('name="countryCursor"');
    expect(pageSource).toContain('name="articleJob"');
    expect(pageSource.match(/<BackfillCursorFields query=\{query\}(?: articleScan)? \/>/gu)).toHaveLength(
      5
    );
  });
});
