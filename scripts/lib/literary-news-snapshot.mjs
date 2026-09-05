import { createReadStream } from "node:fs";

/** Read one opened file stream; enforce the byte limit on the bytes actually read. */
export async function readNewsSnapshot(filename, maxBytes) {
  if (filename === undefined) return null;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError("snapshot_limit_invalid");
  const stream = createReadStream(filename, { highWaterMark: Math.min(maxBytes + 1, 64 * 1024) });
  const chunks = [];
  let bytes = 0;
  // Leaving for-await on error destroys the stream and closes its file descriptor.
  for await (const chunk of stream) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) throw new Error("previous_snapshot_too_large");
    chunks.push(chunk);
  }
  let value;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes));
    value = JSON.parse(text);
  } catch {
    throw new Error("previous_snapshot_invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("previous_snapshot_invalid");
  return value;
}
