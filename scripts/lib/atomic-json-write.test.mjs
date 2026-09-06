import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSerialWriteQueue, writeJsonAtomically } from "./atomic-json-write.mjs";

const directories = [];
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "probpera-atomic-json-"));
  directories.push(directory);
  const filename = path.join(directory, "report.json");
  await writeFile(filename, '{"complete":true,"previous":true}\n');
  return { directory, filename };
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    for (const file of await readdir(directory)) await unlink(path.join(directory, file));
    await rmdir(directory);
  }
});

describe("atomic JSON replacement", () => {
  it.each(["EPERM", "EBUSY", "EACCES"])("retries transient %s without removing the old destination", async code => {
    const { directory, filename } = await fixture();
    const previous = await readFile(filename, "utf8");
    const waits = [];
    let attempts = 0;
    await writeJsonAtomically(filename, { complete: true, title: "Иллюстрация", outputs: [1, 2] }, {
      retryDelaysMs: [1, 2],
      wait: async duration => { waits.push(duration); },
      renameFile: async (source, destination) => {
        expect(await readFile(destination, "utf8")).toBe(previous);
        if (++attempts < 3) throw Object.assign(new Error("Destination is briefly locked"), { code });
        await rename(source, destination);
      },
    });
    expect(attempts).toBe(3);
    expect(waits).toEqual([1, 2]);
    expect(await readFile(filename, "utf8")).toBe(`${JSON.stringify({ complete: true, title: "Иллюстрация", outputs: [1, 2] }, null, 2)}\n`);
    expect(await readdir(directory)).toEqual(["report.json"]);
  });

  it("stops after bounded retries, preserves the old report and cleans only its own temporary", async () => {
    const { directory, filename } = await fixture();
    const previous = await readFile(filename, "utf8");
    await writeFile(path.join(directory, "another-writer.tmp"), "leave intact");
    const failure = Object.assign(new Error("Still locked"), { code: "EPERM" });
    let attempts = 0;
    await expect(writeJsonAtomically(filename, { complete: false }, {
      retryDelaysMs: [0, 0], wait: async () => {},
      renameFile: async () => { attempts += 1; throw failure; },
    })).rejects.toBe(failure);
    expect(attempts).toBe(3);
    expect(await readFile(filename, "utf8")).toBe(previous);
    expect(await readFile(path.join(directory, "another-writer.tmp"), "utf8")).toBe("leave intact");
    expect((await readdir(directory)).sort()).toEqual(["another-writer.tmp", "report.json"]);
  });

  it("does not retry permanent failures and preserves the old destination", async () => {
    const { directory, filename } = await fixture();
    const previous = await readFile(filename, "utf8");
    const failure = Object.assign(new Error("Invalid replacement"), { code: "EINVAL" });
    let waits = 0;
    await expect(writeJsonAtomically(filename, { replaced: true }, {
      wait: async () => { waits += 1; }, renameFile: async () => { throw failure; },
    })).rejects.toBe(failure);
    expect(waits).toBe(0);
    expect(await readFile(filename, "utf8")).toBe(previous);
    expect(await readdir(directory)).toEqual(["report.json"]);
  });

  it("uses distinct temporary files for concurrent writes to the same destination", async () => {
    const { directory, filename } = await fixture();
    const temporaries = [];
    const renameFile = async (source, destination) => {
      temporaries.push(source);
      await rename(source, destination);
    };
    await Promise.all([
      writeJsonAtomically(filename, { writer: 1 }, { renameFile }),
      writeJsonAtomically(filename, { writer: 2 }, { renameFile }),
    ]);
    expect(new Set(temporaries).size).toBe(2);
    expect([1, 2]).toContain(JSON.parse(await readFile(filename, "utf8")).writer);
    expect(await readdir(directory)).toEqual(["report.json"]);
  });
});

describe("serial report writes", () => {
  it("waits for each snapshot before starting the next", async () => {
    const queue = createSerialWriteQueue();
    const events = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    queue.enqueue(async () => { events.push("first:start"); await gate; events.push("first:end"); });
    queue.enqueue(async () => { events.push("second"); });
    await new Promise(resolve => setImmediate(resolve));
    expect(events).toEqual(["first:start"]);
    release();
    await queue.drain();
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("handles rejection before a delayed drain and prevents later writes", async () => {
    const queue = createSerialWriteQueue();
    const failure = new Error("Report replacement failed");
    const writes = [];
    queue.enqueue(async () => { writes.push(1); throw failure; });
    await new Promise(resolve => setImmediate(resolve));
    queue.enqueue(async () => { writes.push(2); });
    await new Promise(resolve => setImmediate(resolve));
    await expect(queue.drain()).rejects.toBe(failure);
    expect(writes).toEqual([1]);
  });
});
