import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { commitAtomicFileSet } from "./atomic-file-set.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true })
    )
  );
});

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "probpera-atomic-files-"));
  temporaryRoots.push(root);
  return root;
}

describe("atomic generated file set", () => {
  it("promotes staged files and withdraws obsolete files as one transaction", async () => {
    const root = await fixtureRoot();
    const current = path.join(root, "cms", "current.json");
    const withdrawn = path.join(root, "cms", "withdrawn.json");
    const created = path.join(root, "generated", "catalog.ts");
    await fs.mkdir(path.dirname(current), { recursive: true });
    await fs.writeFile(current, "old", "utf8");
    await fs.writeFile(withdrawn, "obsolete", "utf8");

    await commitAtomicFileSet({
      root,
      writes: [
        { path: current, content: "new" },
        { path: created, content: "catalog" },
      ],
      deletes: [withdrawn],
    });

    await expect(fs.readFile(current, "utf8")).resolves.toBe("new");
    await expect(fs.readFile(created, "utf8")).resolves.toBe("catalog");
    await expect(fs.access(withdrawn)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await fs.readdir(root)).some((name) => name.startsWith(".cms-export-"))).toBe(false);
  });

  it("rejects duplicate destinations before replacing the current snapshot", async () => {
    const root = await fixtureRoot();
    const current = path.join(root, "current.json");
    await fs.writeFile(current, "old", "utf8");

    await expect(
      commitAtomicFileSet({
        root,
        writes: [{ path: current, content: "new" }],
        deletes: [current],
      })
    ).rejects.toThrow("duplicate targets");
    await expect(fs.readFile(current, "utf8")).resolves.toBe("old");
  });

  it("rejects destinations outside the isolated repository transaction root", async () => {
    const root = await fixtureRoot();
    const outside = path.join(path.dirname(root), "outside.json");
    await expect(
      commitAtomicFileSet({
        root,
        writes: [{ path: outside, content: "unsafe" }],
      })
    ).rejects.toThrow("outside its transaction root");
  });
});
