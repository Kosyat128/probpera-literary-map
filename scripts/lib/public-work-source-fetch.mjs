const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const BATCH_SIZE = 10;
const CONCURRENCY = 2;

// Parent rows have already passed public RLS. Keep the same RLS on every child
// request, while its exact-count query only visits sources for these parents.
export async function fetchPublicWorkSources(works, fetchSources) {
  if (!Array.isArray(works)) throw new Error("Public literary-work parents are not an array");
  const ids = works.map(work => work?.id);
  if (ids.some(id => typeof id !== "string" || !UUID.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Public literary-work parent identities are invalid or duplicated");
  }
  const result = [];
  const identities = new Set();
  for (let start = 0; start < ids.length; start += BATCH_SIZE * CONCURRENCY) {
    const batches = [];
    for (let offset = start; offset < Math.min(start + BATCH_SIZE * CONCURRENCY, ids.length); offset += BATCH_SIZE) {
      const batch = ids.slice(offset, offset + BATCH_SIZE);
      batches.push((async () => {
        const rows = await fetchSources(`in.(${batch.join(",")})`);
        if (!Array.isArray(rows) || rows.some(row => !batch.includes(row?.work_id))) {
          throw new Error("Public literary-work sources escaped their requested parent scope");
        }
        return rows;
      })());
    }
    for (const rows of await Promise.all(batches)) {
      for (const row of rows) {
        const identity = JSON.stringify([row.work_id, row.provider, row.source_url]);
        if (identities.has(identity)) throw new Error("Public literary-work sources contain a duplicate identity");
        identities.add(identity);
        result.push(row);
      }
    }
  }
  return result;
}
