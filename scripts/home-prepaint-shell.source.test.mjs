import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const template = readFileSync(path.join(root, "index.html"), "utf8");
const entrypoint = readFileSync(path.join(root, "src", "main.tsx"), "utf8");

describe("homepage prepaint shell", () => {
  it("ships the fallback guard in the HTML head before any first paint", () => {
    const headEnd = template.indexOf("</head>");
    const bodyStart = template.indexOf("<body>");
    const guard = template.indexOf("data-home-prepaint");
    const module = template.indexOf('script type="module"');

    expect(template).toContain('<html lang="ru" data-react-shell>');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(headEnd);
    expect(module).toBeGreaterThan(guard);
    expect(module).toBeLessThan(headEnd);
    expect(bodyStart).toBeGreaterThan(headEnd);
    expect(template).toContain("data-home-prepaint-noscript");
    expect(template).toContain("#root > [data-static-seo]");
  });

  it("does not depend on a stylesheet that loads with the React graph", () => {
    expect(entrypoint).not.toContain("prepaint.css");
    expect(template).not.toContain('<script type="module" src="/src/main.tsx"></script>\n</body>');
  });

  it("restores the accessible fallback when the application cannot boot", () => {
    expect(template).toContain("probpera-home-fallback-rescue");
    expect(template).toContain("8s forwards");
    expect(template).toContain("animation: none !important");
  });
});
