const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SCHEMES = new Set(["wikidata", "openlibrary", "isbn-10", "isbn-13", "other"]);

// Only request children of parents already visible through public RLS. The
// callback retains exact-count pagination and the same public credentials.
export async function fetchPublicWorkExternalIds(works, fetchRows) {
  if (!Array.isArray(works)) throw new Error("Public literary-work parents are not an array");
  const ids = works.map(work => work?.id);
  if (ids.some(id => typeof id !== "string" || !UUID.test(id)) || new Set(ids).size !== ids.length)
    throw new Error("Public literary-work parent identities are invalid or duplicated");
  const result = [], identities = new Set();
  for (let start = 0; start < ids.length; start += 20) {
    const batches = [];
    for (let offset = start; offset < Math.min(start + 20, ids.length); offset += 10) {
      const batch = ids.slice(offset, offset + 10);
      batches.push((async () => {
        const rows = await fetchRows(`in.(${batch.join(",")})`);
        if (!Array.isArray(rows) || rows.some(row => !batch.includes(row?.work_id)))
          throw new Error("Public literary-work external IDs escaped their requested parent scope");
        return rows;
      })());
    }
    for (const rows of await Promise.all(batches)) {
      for (const row of rows) {
        if (!SCHEMES.has(row.scheme) || typeof row.external_id !== "string" || !row.external_id.trim()
          || row.external_id.length > 180 || typeof row.source_url !== "string")
          throw new Error("Public literary-work external ID is invalid");
        let url;
        try { url = new URL(row.source_url); } catch { throw new Error("Public literary-work external ID source is invalid"); }
        if (url.protocol !== "https:" || url.username || url.password)
          throw new Error("Public literary-work external ID source is invalid");
        const identity = JSON.stringify([row.scheme, row.external_id]);
        if (identities.has(identity)) throw new Error("Public literary-work external IDs contain a duplicate identity");
        identities.add(identity);
        result.push({ work_id: row.work_id, scheme: row.scheme, value: row.external_id, sourceUrl: row.source_url });
      }
    }
  }
  return result;
}
