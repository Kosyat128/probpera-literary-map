import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Match the actual entry file through existing filesystem aliases/junctions.
 * Missing/unrelated argv and ordinary module imports remain nonexecuting.
 * This helper only resolves two local paths; it never runs a command. */
export function isLocalCliEntry(moduleUrl, argvPath = process.argv[1]) {
  if (typeof moduleUrl !== 'string' || typeof argvPath !== 'string' || !argvPath) return false;
  try { return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath); }
  catch { return false; }
}
