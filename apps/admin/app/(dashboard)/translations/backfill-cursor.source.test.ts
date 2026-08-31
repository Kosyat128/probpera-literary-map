import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("premium translation backfill cursor wiring", () => {
  it("uses the exact cursor names consumed by every server action", () => {
    expect(pageSource).not.toContain('name="backfill_cursor"');
    expect(pageSource).toContain('name="libraryCursor"');
    expect(pageSource).toContain('name="writerCursor"');
    expect(pageSource).toContain('name="countryCursor"');
    expect(pageSource.match(/<BackfillCursorFields query=\{query\} \/>/gu)).toHaveLength(
      5
    );
  });
});
