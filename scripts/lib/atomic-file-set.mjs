import { promises as fs } from "node:fs";
import path from "node:path";

function uniqueTargets(writes, deletes) {
  const targets = [...writes.map((entry) => entry.path), ...deletes].map((target) =>
    path.resolve(target)
  );
  if (new Set(targets).size !== targets.length) {
    throw new Error("Atomic file-set transaction contains duplicate targets.");
  }
  return targets;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Stages a related set of generated files before touching any destination.
 * Existing destinations are moved into a transaction backup and restored if
 * a later promotion fails. Each promotion is a same-volume atomic rename.
 */
export async function commitAtomicFileSet({ root, writes, deletes = [] }) {
  const transactionBase = path.resolve(root);
  const normalizedWrites = writes.map((entry) => ({
    ...entry,
    path: path.resolve(entry.path),
  }));
  const normalizedDeletes = deletes.map((target) => path.resolve(target));
  uniqueTargets(normalizedWrites, normalizedDeletes);
  for (const target of [
    ...normalizedWrites.map((entry) => entry.path),
    ...normalizedDeletes,
  ]) {
    if (!target.startsWith(`${transactionBase}${path.sep}`)) {
      throw new Error(`Atomic file-set target is outside its transaction root: ${target}`);
    }
  }
  const transactionRoot = await fs.mkdtemp(
    path.join(transactionBase, ".cms-export-transaction-")
  );
  const stagedDirectory = path.join(transactionRoot, "staged");
  const backupDirectory = path.join(transactionRoot, "backup");

  const promoted = [];
  const backedUp = [];
  let preserveTransaction = false;
  try {
    await Promise.all(
      normalizedWrites.map(async (entry, index) => {
        const stagedPath = path.join(stagedDirectory, String(index));
        await fs.mkdir(path.dirname(stagedPath), { recursive: true });
        await fs.writeFile(stagedPath, entry.content, entry.encoding || "utf8");
      })
    );

    const operations = [
      ...normalizedWrites.map((entry, index) => ({
        target: entry.path,
        stagedPath: path.join(stagedDirectory, String(index)),
      })),
      ...normalizedDeletes.map((target) => ({ target, stagedPath: null })),
    ];

    for (const [index, operation] of operations.entries()) {
      await fs.mkdir(path.dirname(operation.target), { recursive: true });
      if (await pathExists(operation.target)) {
        const backupPath = path.join(backupDirectory, String(index));
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.rename(operation.target, backupPath);
        backedUp.push({ target: operation.target, backupPath });
      }
      if (operation.stagedPath) {
        await fs.rename(operation.stagedPath, operation.target);
        promoted.push(operation.target);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const target of promoted.reverse()) {
      try {
        await fs.rm(target, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const entry of backedUp.reverse()) {
      try {
        await fs.mkdir(path.dirname(entry.target), { recursive: true });
        await fs.rename(entry.backupPath, entry.target);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      preserveTransaction = true;
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Atomic file-set promotion and rollback failed; recovery data is preserved at ${transactionRoot}.`
      );
    }
    throw error;
  } finally {
    if (!preserveTransaction) {
      await fs.rm(transactionRoot, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      });
    }
  }
}
