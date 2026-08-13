const CONTENT_RANGE_PATTERN = /^(?:\*|(\d+)-(\d+))\/(\d+|\*)$/u;

export function parsePostgrestContentRange(value) {
  const normalized = String(value || "").trim();
  const match = CONTENT_RANGE_PATTERN.exec(normalized);
  if (!match) {
    throw new Error(`Invalid or missing PostgREST Content-Range: ${normalized || "<empty>"}`);
  }

  return {
    start: match[1] === undefined ? null : Number(match[1]),
    end: match[2] === undefined ? null : Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3]),
  };
}

export async function collectPostgrestPages({
  fetchPage,
  identity,
  pageSize = 500,
  table = "resource",
}) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error(`Invalid PostgREST page size for ${table}: ${pageSize}`);
  }

  const rows = [];
  const identities = new Set();
  let expectedTotal = null;

  for (let pageIndex = 0; ; pageIndex += 1) {
    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;
    const page = await fetchPage({ from, to, pageIndex });
    const pageRows = page.rows;

    if (!Array.isArray(pageRows)) {
      throw new Error(`PostgREST response for ${table} is not an array.`);
    }

    const range = parsePostgrestContentRange(page.contentRange);
    if (range.total === null) {
      throw new Error(`PostgREST did not return an exact row count for ${table}.`);
    }
    if (expectedTotal === null) {
      expectedTotal = range.total;
    } else if (range.total !== expectedTotal) {
      throw new Error(
        `PostgREST row count changed while exporting ${table}: ${expectedTotal} -> ${range.total}.`
      );
    }

    if (pageRows.length === 0) {
      if (expectedTotal !== rows.length) {
        throw new Error(
          `PostgREST export for ${table} stopped at ${rows.length} of ${expectedTotal} rows.`
        );
      }
      break;
    }

    if (range.start !== from || range.end !== from + pageRows.length - 1) {
      throw new Error(
        `Unexpected PostgREST range for ${table}: requested ${from}-${to}, received ${page.contentRange}.`
      );
    }

    for (const row of pageRows) {
      const key = String(identity(row));
      if (!key) {
        throw new Error(`PostgREST export for ${table} returned a row without an identity.`);
      }
      if (identities.has(key)) {
        throw new Error(`PostgREST export for ${table} returned duplicate identity ${key}.`);
      }
      identities.add(key);
      rows.push(row);
    }

    if (rows.length > expectedTotal) {
      throw new Error(
        `PostgREST export for ${table} returned ${rows.length} rows, above declared total ${expectedTotal}.`
      );
    }
    if (rows.length === expectedTotal) break;
  }

  return rows;
}
