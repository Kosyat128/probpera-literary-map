import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const transientRenameCodes = new Set(["EPERM", "EBUSY", "EACCES"]);
const defaultRetryDelaysMs = [50, 100, 200, 400, 800, 1000];

/** Retry a locked Windows destination without ever removing its previous contents. */
export async function writeJsonAtomically(filename, value, {
  renameFile = rename,
  wait = delay,
  retryDelaysMs = defaultRetryDelaysMs,
} = {}) {
  const destination = path.resolve(filename);
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  let ownsTemporary = false;
  try {
    const handle = await open(temporary, "wx");
    ownsTemporary = true;
    try { await handle.writeFile(content, "utf8"); }
    finally { await handle.close(); }
    for (let attempt = 0; ; attempt += 1) {
      try {
        await renameFile(temporary, destination);
        ownsTemporary = false;
        return;
      } catch (error) {
        if (!transientRenameCodes.has(error.code) || attempt >= retryDelaysMs.length) throw error;
        await wait(retryDelaysMs[attempt]);
      }
    }
  } catch (error) {
    if (ownsTemporary) {
      try { await unlink(temporary); }
      catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          throw new AggregateError([error, cleanupError], "JSON replacement failed and its temporary file could not be removed", { cause: error });
        }
      }
    }
    throw error;
  }
}

/** Each queued rejection is handled immediately, then propagated by drain(). */
export function createSerialWriteQueue() {
  let tail = Promise.resolve();
  let failed = false;
  let failure;
  return {
    enqueue(write) {
      tail = tail.then(() => {
        if (!failed) return write();
      }).catch(error => {
        failed = true;
        failure = error;
      });
    },
    async drain() {
      await tail;
      if (failed) throw failure;
    },
  };
}
