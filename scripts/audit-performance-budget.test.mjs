import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const auditScript = path.resolve("scripts/audit-performance-budget.mjs");
const workspaces = [];

async function fixture({ bookCoverMaximumBytes }) {
  const workspace = await mkdtemp(path.join(tmpdir(), "performance-budget-"));
  workspaces.push(workspace);
  await mkdir(path.join(workspace, "dist", "brand", "book-covers", "thumbs"), {
    recursive: true,
  });
  await mkdir(path.join(workspace, "dist", "assets"), { recursive: true });
  await writeFile(
    path.join(workspace, "dist", "brand", "book-covers", "cover.webp"),
    Buffer.alloc(300)
  );
  await writeFile(
    path.join(workspace, "dist", "brand", "book-covers", "thumbs", "cover.webp"),
    Buffer.alloc(100)
  );
  await writeFile(path.join(workspace, "dist", "assets", "site.png"), Buffer.alloc(200));
  await writeFile(
    path.join(workspace, "performance-budget.json"),
    JSON.stringify({
      distTotalBytes: 1_000,
      distExcludingBookCoversBytes: 200,
      largestJavaScriptBytes: 1_000,
      largestJavaScriptGzipBytes: 1_000,
      mainJavaScriptBytes: 1_000,
      mainJavaScriptGzipBytes: 1_000,
      globeTextureBytes: 1_000,
      writerPortraitTotalBytes: 1_000,
      writerPortraitAverageBytes: 1_000,
      writerPortraitMaximumBytes: 1_000,
      bookCoverCount: 2,
      bookCoverTotalBytes: 400,
      bookCoverAverageBytes: 200,
      bookCoverMaximumBytes,
      individualImageBytes: 1_000,
    })
  );
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true }))
  );
});

describe("performance budget audit", () => {
  it("measures book covers separately from the rest of dist", async () => {
    const cwd = await fixture({ bookCoverMaximumBytes: 300 });
    const { stdout } = await execFileAsync(process.execPath, [auditScript], { cwd });

    expect(stdout).toContain("PASS dist total: 600 / 1000 bytes");
    expect(stdout).toContain("PASS dist excluding book covers: 200 / 200 bytes");
    expect(stdout).toContain("PASS book cover count: 2 / 2 files");
    expect(stdout).toContain("PASS book covers total: 400 / 400 bytes");
    expect(stdout).toContain("PASS book cover average: 200 / 200 bytes");
    expect(stdout).toContain("PASS book cover maximum: 300 / 300 bytes");
  });

  it("fails when one book cover exceeds its dedicated maximum", async () => {
    const cwd = await fixture({ bookCoverMaximumBytes: 299 });

    await expect(
      execFileAsync(process.execPath, [auditScript], {
        cwd,
        env: { ...process.env, GITHUB_ACTIONS: "true" },
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "::error title=Performance budget exceeded::book cover maximum: 300 / 299 bytes"
      ),
    });
  });
});
