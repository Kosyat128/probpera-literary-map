import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readNewsSnapshot } from "./literary-news-snapshot.mjs";
import { NEWS_QUEUE_MAX_BYTES, NEWS_STATE_MAX_BYTES } from "./literary-news-state.mjs";

let directory;
const files = [];
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), "literary-news-snapshot-")); });
afterAll(async () => {
  await Promise.all(files.map((file) => unlink(file)));
  await rmdir(directory);
});
async function fixture(contents) {
  const path = join(directory, `${files.length}.json`);
  files.push(path);
  await writeFile(path, contents);
  return path;
}

describe("bounded previous literary news snapshot", () => {
  it.each([NEWS_STATE_MAX_BYTES, NEWS_QUEUE_MAX_BYTES])("accepts the exact %i-byte production boundary and rejects one byte less", async (limit) => {
    const text = "a".repeat(limit - Buffer.byteLength('{"text":""}'));
    const path = await fixture(JSON.stringify({ text }));
    expect(await readNewsSnapshot(path, limit)).toEqual({ text });
    await expect(readNewsSnapshot(path, limit - 1)).rejects.toThrow("previous_snapshot_too_large");
  });

  it("enforces bytes rather than characters and preserves Unicode across stream chunks", async () => {
    const value = { text: `${"a".repeat(65_535 - Buffer.byteLength('{"text":"'))}📚Русский日本語` };
    const json = JSON.stringify(value);
    const path = await fixture(json);
    expect(await readNewsSnapshot(path, Buffer.byteLength(json))).toEqual(value);
    await expect(readNewsSnapshot(path, json.length)).rejects.toThrow("previous_snapshot_too_large");
  });

  it.each(['{"unfinished":', "null", "[]", '"string"'])("rejects malformed or non-object JSON %s", async (contents) => {
    await expect(readNewsSnapshot(await fixture(contents), NEWS_STATE_MAX_BYTES)).rejects.toThrow("previous_snapshot_invalid");
  });

  it("rejects malformed UTF-8 instead of silently repairing snapshot bytes", async () => {
    const path = await fixture(Buffer.concat([Buffer.from('{"text":"'), Buffer.from([0xc3, 0x28]), Buffer.from('"}')]));
    await expect(readNewsSnapshot(path, NEWS_STATE_MAX_BYTES)).rejects.toThrow("previous_snapshot_invalid");
  });

  it("fails on a missing explicit file but allows an omitted bootstrap snapshot", async () => {
    await expect(readNewsSnapshot(join(directory, "missing.json"), NEWS_STATE_MAX_BYTES)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readNewsSnapshot(undefined, NEWS_STATE_MAX_BYTES)).toBeNull();
  });
});
