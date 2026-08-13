import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteConfig = readFileSync(
  new URL("../../vite.config.ts", import.meta.url),
  "utf8"
);

describe("Vite data chunking", () => {
  it("keeps the portrait manifest outside the country archive chunk", () => {
    expect(viteConfig).toContain('/writerPortraits.generated.json');
    expect(viteConfig).toContain('return "writer-portraits-data"');
  });
});
