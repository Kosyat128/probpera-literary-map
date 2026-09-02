const authorshipKinds = new Set([
  "single",
  "multiple",
  "anonymous",
  "collective",
  "traditional",
  "disputed",
]);

const attributionStatuses = new Set([
  "credited",
  "attributed",
  "disputed",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedKind(value) {
  const kind = text(value);
  return authorshipKinds.has(kind) ? kind : null;
}

function assertComposition(kind, authors, identity) {
  if (!kind) throw new Error(`${identity}: unsupported authorship kind`);
  if (!Array.isArray(authors)) {
    throw new Error(`${identity}: authorship authors must be an array`);
  }
  if (["anonymous", "traditional"].includes(kind) && authors.length !== 0) {
    throw new Error(`${identity}: ${kind} authorship must have no authors`);
  }
  if (kind === "single" && authors.length !== 1) {
    throw new Error(`${identity}: single authorship must have exactly one author`);
  }
  if (kind === "multiple" && authors.length < 2) {
    throw new Error(`${identity}: multiple authorship must have at least two authors`);
  }
  if (
    ["collective", "disputed"].includes(kind) &&
    authors.length < 1
  ) {
    throw new Error(`${identity}: ${kind} authorship must have a credit`);
  }
}

/**
 * Converts explicit static authorship into normalized database rows. Legacy
 * works deliberately produce no rows and continue to use writer_id as their
 * implicit single author.
 */
export function authorshipRowsFromArchive(archive, workIds) {
  return archive.flatMap((book) => {
    if (!book.authorship) return [];
    const legacyId = `${book.countryId}:${book.writerId}:${book.id}`;
    const workId = workIds.get(legacyId);
    if (!workId) return [];
    const kind = normalizedKind(book.authorship.kind);
    const authors = book.authorship.authors;
    assertComposition(kind, authors, legacyId);

    return authors.map((author, position) => {
      const writerId = text(author?.writerId) || null;
      const writerCountryId = writerId
        ? text(author?.countryId) || text(book.countryId) || null
        : null;
      const creditNameRu = text(author?.creditNames?.ru) || null;
      const creditNameEn = text(author?.creditNames?.en) || null;
      if (!writerId && !creditNameRu && !creditNameEn) {
        throw new Error(`${legacyId}: author ${position} has no identity`);
      }
      const requestedAttribution = text(author?.attribution) || "credited";
      if (!attributionStatuses.has(requestedAttribution)) {
        throw new Error(
          `${legacyId}: author ${position} has invalid attribution`
        );
      }
      return {
        work_id: workId,
        position,
        writer_country_id: writerCountryId,
        writer_id: writerId,
        credit_name_ru: creditNameRu,
        credit_name_en: creditNameEn,
        attribution_status: requestedAttribution,
        metadata: {},
      };
    });
  });
}

/**
 * Builds the lossless payload consumed by the service-only batch RPC. Every
 * unlocked work is represented, including legacy implicit-single works, so a
 * removed static authorship object clears an earlier synchronized composition.
 */
export function authorshipReplacementPayloadsFromArchive(
  archive,
  workStates
) {
  return archive.flatMap((book) => {
    const legacyId = `${book.countryId}:${book.writerId}:${book.id}`;
    const state = workStates.get(legacyId);
    if (!state?.id || !state?.updatedAt) return [];
    if (!book.authorship) {
      return [{
        workId: state.id,
        expectedUpdatedAt: state.updatedAt,
        kind: null,
        authors: [],
      }];
    }

    const kind = normalizedKind(book.authorship.kind);
    const authors = book.authorship.authors;
    assertComposition(kind, authors, legacyId);
    return [{
      workId: state.id,
      expectedUpdatedAt: state.updatedAt,
      kind,
      authors: authors.map((author, position) => {
        const writerId = text(author?.writerId);
        const countryId = writerId
          ? text(author?.countryId) || text(book.countryId)
          : "";
        const ru = text(author?.creditNames?.ru);
        const en = text(author?.creditNames?.en);
        if (!writerId && !ru && !en) {
          throw new Error(`${legacyId}: author ${position} has no identity`);
        }
        const attribution = text(author?.attribution) || "credited";
        if (!attributionStatuses.has(attribution)) {
          throw new Error(
            `${legacyId}: author ${position} has invalid attribution`
          );
        }
        return {
          ...(writerId ? { countryId, writerId } : {}),
          ...((ru || en) && {
            creditNames: {
              ...(ru ? { ru } : {}),
              ...(en ? { en } : {}),
            },
          }),
          attribution,
        };
      }),
    }];
  });
}

export function groupPublishedAuthorRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const workId = text(row?.work_id);
    if (!workId) continue;
    if (!grouped.has(workId)) grouped.set(workId, []);
    grouped.get(workId).push(row);
  }
  for (const authors of grouped.values()) {
    authors.sort(
      (left, right) =>
        Number(left.position || 0) - Number(right.position || 0) ||
        text(left.writer_id).localeCompare(text(right.writer_id), "en")
    );
  }
  return grouped;
}

/** Restores the exact optional CMS authorship payload from public DB rows. */
export function publishedWorkAuthorship(work, authorsByWorkId) {
  const kind = normalizedKind(work?.authorship_kind);
  if (!kind) return undefined;
  if (["anonymous", "traditional"].includes(kind)) {
    return { kind, authors: [] };
  }

  const rows = authorsByWorkId.get(text(work?.id)) || [];
  const authors = rows.map((row) => {
    const writerId = text(row.writer_id);
    const countryId = text(row.writer_country_id);
    const ru = text(row.credit_name_ru);
    const en = text(row.credit_name_en);
    return {
      ...(writerId && countryId ? { countryId, writerId } : {}),
      ...((ru || en) && {
        creditNames: {
          ...(ru ? { ru } : {}),
          ...(en ? { en } : {}),
        },
      }),
      attribution: attributionStatuses.has(text(row.attribution_status))
        ? text(row.attribution_status)
        : "credited",
    };
  });
  assertComposition(kind, authors, text(work?.legacy_id) || text(work?.id));
  return { kind, authors };
}

export const supportedWorkAuthorshipKinds = Object.freeze([
  ...authorshipKinds,
]);
