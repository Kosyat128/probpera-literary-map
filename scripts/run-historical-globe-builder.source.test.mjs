import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./run-historical-globe-builder.mjs", import.meta.url),
  "utf8"
);

describe("historical globe builder command boundary", () => {
  it("selects only repository-defined interpreter commands", () => {
    expect(source).not.toContain("PROBPERA_PYTHON");
    expect(source).toContain('{ command: "python3", prefix: [] }');
    expect(source).toContain('{ command: "python", prefix: [] }');
    expect(source).toContain('{ command: "py", prefix: ["-3.12"] }');
  });

  it("passes user arguments as an argv array without a shell", () => {
    expect(source).toContain("...process.argv.slice(2)");
    expect(source).toContain('stdio: "inherit"');
    expect(source).not.toMatch(/shell\s*:\s*true/u);
  });
});
