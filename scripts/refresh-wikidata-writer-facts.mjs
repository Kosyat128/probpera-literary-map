import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");

export const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
export const WIKIDATA_LICENSE_URL =
  "https://www.wikidata.org/wiki/Wikidata:Licensing";
export const SELECTED_PROPERTIES = Object.freeze([
  "P31",
  "P569",
  "P570",
  "P106",
  "P27",
  "P800",
]);
export const SELECTED_LABEL_LANGUAGES = Object.freeze(["en", "ru"]);
export const SELECTED_DESCRIPTION_LANGUAGES = Object.freeze(["en", "ru"]);

const TIME_PROPERTIES = new Set(["P569", "P570"]);
const ENTITY_PROPERTIES = new Set(["P31", "P106", "P27", "P800"]);
const INPUT_PATH = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "curatedWriterQids.generated.json"
);
const OUTPUT_PATH = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerFacts.wikidata.json"
);
const INPUT_PATH_FOR_METADATA =
  "src/data/countries/generated/curatedWriterQids.generated.json";
const USER_AGENT =
  "ProbPeraWriterFactsSnapshot/1.0 (https://probpera.ru; probperasite@yandex.ru)";
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 30_000;

function qidNumber(qid) {
  if (!/^Q[1-9]\d*$/u.test(qid)) {
    throw new Error(`Invalid Wikidata item ID: ${qid}`);
  }
  return BigInt(qid.slice(1));
}

export function compareQids(first, second) {
  const firstNumber = qidNumber(first);
  const secondNumber = qidNumber(second);
  return firstNumber < secondNumber ? -1 : firstNumber > secondNumber ? 1 : 0;
}

function compactReferenceMetadata(statement) {
  const referenceCount = Array.isArray(statement.references)
    ? statement.references.length
    : 0;
  return {
    referenced: referenceCount > 0,
    referenceCount,
  };
}

export function normalizeStatement(property, statement) {
  if (!statement || statement.rank === "deprecated") return null;

  const claimId = statement.id;
  if (typeof claimId !== "string" || claimId.length === 0) {
    throw new Error(`Missing claim ID for ${property}`);
  }

  const rank = statement.rank || "normal";
  const referenceMetadata = compactReferenceMetadata(statement);
  const snak = statement.mainsnak || {};
  const snaktype = snak.snaktype || "value";
  const base = {
    claimId,
    rank,
    ...referenceMetadata,
  };

  if (snaktype !== "value") {
    return {
      ...base,
      snaktype,
    };
  }

  const datavalue = snak.datavalue;
  if (TIME_PROPERTIES.has(property)) {
    const value = datavalue?.value;
    if (
      datavalue?.type !== "time" ||
      typeof value?.time !== "string" ||
      !Number.isInteger(value?.precision) ||
      typeof value?.calendarmodel !== "string"
    ) {
      throw new Error(`Unexpected time value in ${claimId}`);
    }
    return {
      ...base,
      time: value.time,
      precision: value.precision,
      calendarmodel: value.calendarmodel,
    };
  }

  if (ENTITY_PROPERTIES.has(property)) {
    const entityId = datavalue?.value?.id;
    if (datavalue?.type !== "wikibase-entityid" || typeof entityId !== "string") {
      throw new Error(`Unexpected entity value in ${claimId}`);
    }
    return {
      ...base,
      entityId,
    };
  }

  throw new Error(`Unsupported selected property: ${property}`);
}

function compareClaims(first, second) {
  return first.claimId.localeCompare(second.claimId, "en");
}

export function normalizeEntity(requestedQid, entity) {
  if (!entity || Object.hasOwn(entity, "missing")) {
    return {
      qid: requestedQid,
      missing: true,
    };
  }

  if (entity.id !== requestedQid) {
    throw new Error(
      `Wikidata returned ${entity.id || "an entity without an ID"} for ${requestedQid}`
    );
  }

  const claims = {};
  for (const property of SELECTED_PROPERTIES) {
    const normalized = (entity.claims?.[property] || [])
      .map((statement) => normalizeStatement(property, statement))
      .filter(Boolean)
      .sort(compareClaims);
    if (normalized.length > 0) claims[property] = normalized;
  }

  const result = {
    qid: requestedQid,
  };
  if (Number.isInteger(entity.lastrevid)) result.lastrevid = entity.lastrevid;
  if (typeof entity.modified === "string") result.modified = entity.modified;
  const labels = Object.fromEntries(
    SELECTED_LABEL_LANGUAGES.map((language) => [
      language,
      entity.labels?.[language]?.value,
    ]).filter(([, value]) => typeof value === "string" && value.trim())
  );
  if (Object.keys(labels).length) result.labels = labels;
  const descriptions = Object.fromEntries(
    SELECTED_DESCRIPTION_LANGUAGES.map((language) => [
      language,
      entity.descriptions?.[language]?.value,
    ]).filter(([, value]) => typeof value === "string" && value.trim())
  );
  if (Object.keys(descriptions).length) result.descriptions = descriptions;
  result.claims = claims;
  return result;
}

function countClaims(entities) {
  return Object.fromEntries(
    SELECTED_PROPERTIES.map((property) => [
      property,
      entities.reduce(
        (total, entity) => total + (entity.claims?.[property]?.length || 0),
        0
      ),
    ])
  );
}

export function buildSnapshot({
  curatedWriterKeys,
  qids,
  entitiesByQid,
  retrievedAt,
}) {
  const sortedQids = [...qids].sort(compareQids);
  const entities = sortedQids.map((qid) =>
    normalizeEntity(qid, entitiesByQid[qid])
  );
  const missingQids = entities
    .filter((entity) => entity.missing)
    .map((entity) => entity.qid);
  const qidSetSha256 = createHash("sha256")
    .update(`${sortedQids.join("\n")}\n`, "utf8")
    .digest("hex");

  return {
    version: 1,
    retrievedAt,
    source: {
      name: "Wikidata",
      endpoint: WIKIDATA_ENDPOINT,
      action: "wbgetentities",
      license: "CC0-1.0",
      licenseUrl: WIKIDATA_LICENSE_URL,
      qidRegistry: INPUT_PATH_FOR_METADATA,
      qidSetSha256,
      properties: [...SELECTED_PROPERTIES],
      labelLanguages: [...SELECTED_LABEL_LANGUAGES],
      descriptionLanguages: [...SELECTED_DESCRIPTION_LANGUAGES],
    },
    counts: {
      curatedWriterKeys,
      requestedQids: sortedQids.length,
      returnedEntities: entities.length - missingQids.length,
      missingEntities: missingQids.length,
      claims: countClaims(entities),
    },
    missingQids,
    entities,
  };
}

export function serializeSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function isRetryableStatus(status) {
  return status === 429 || status === 408 || status >= 500;
}

function isRetryableApiError(error) {
  return ["maxlag", "ratelimited", "readonly", "internal_api_error_DBQueryError"].includes(
    error?.code
  );
}

async function fetchBatch(qids, batchNumber, batchCount) {
  const query = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    formatversion: "2",
    props: "claims|info|labels|descriptions",
    languages: SELECTED_LABEL_LANGUAGES.join("|"),
    ids: qids.join("|"),
    // Keep the endpoint protected without failing a full snapshot refresh for
    // the normal 5–6 second replication lag periodically reported by Wikidata.
    maxlag: "10",
  });
  const url = `${WIKIDATA_ENDPOINT}?${query.toString()}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Api-User-Agent": USER_AGENT,
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      const delay = Math.min(800 * 2 ** (attempt - 1), 8_000);
      console.error(
        `Wikidata batch ${batchNumber}/${batchCount}: network retry ${attempt}/${MAX_ATTEMPTS} in ${delay} ms`
      );
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Wikidata batch ${batchNumber}/${batchCount} returned HTTP ${response.status}`
        );
      }
      const delay = Math.min(
        retryAfterMilliseconds(response) ??
          Math.min(800 * 2 ** (attempt - 1), 8_000),
        MAX_RETRY_DELAY_MS
      );
      console.error(
        `Wikidata batch ${batchNumber}/${batchCount}: HTTP ${response.status}, retry ${attempt}/${MAX_ATTEMPTS} in ${delay} ms`
      );
      await sleep(delay);
      continue;
    }

    const payload = await response.json();
    if (payload.error) {
      if (!isRetryableApiError(payload.error) || attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Wikidata API error ${payload.error.code || "unknown"}: ${
            payload.error.info || "no details"
          }`
        );
      }
      const lagSeconds = Number(payload.error.lag);
      const delay = Math.min(
        Number.isFinite(lagSeconds)
          ? Math.max(1_000, Math.ceil(lagSeconds * 1_000))
          : Math.min(800 * 2 ** (attempt - 1), 8_000),
        MAX_RETRY_DELAY_MS
      );
      console.error(
        `Wikidata batch ${batchNumber}/${batchCount}: ${payload.error.code}, retry ${attempt}/${MAX_ATTEMPTS} in ${delay} ms`
      );
      await sleep(delay);
      continue;
    }

    if (!payload.entities || typeof payload.entities !== "object") {
      throw new Error(
        `Wikidata batch ${batchNumber}/${batchCount} did not return entities`
      );
    }
    return payload.entities;
  }

  throw new Error(`Wikidata batch ${batchNumber}/${batchCount} exhausted retries`);
}

async function fetchEntities(qids) {
  const entitiesByQid = {};
  const batchCount = Math.ceil(qids.length / BATCH_SIZE);
  for (let offset = 0; offset < qids.length; offset += BATCH_SIZE) {
    const batch = qids.slice(offset, offset + BATCH_SIZE);
    const batchNumber = offset / BATCH_SIZE + 1;
    const entities = await fetchBatch(batch, batchNumber, batchCount);
    for (const qid of batch) {
      entitiesByQid[qid] = entities[qid];
    }
    console.error(
      `Wikidata batch ${batchNumber}/${batchCount}: fetched ${batch.length} QIDs (${Math.min(
        offset + batch.length,
        qids.length
      )}/${qids.length})`
    );
  }
  return entitiesByQid;
}

async function readCuratedQids() {
  const registry = JSON.parse(await readFile(INPUT_PATH, "utf8"));
  const writers = registry.writers;
  if (!writers || typeof writers !== "object" || Array.isArray(writers)) {
    throw new Error(`Invalid curated QID registry: ${INPUT_PATH_FOR_METADATA}`);
  }
  const qids = [...new Set(Object.values(writers).map((entry) => entry?.wikidataId))];
  for (const qid of qids) qidNumber(qid);
  return {
    curatedWriterKeys: Object.keys(writers).length,
    qids: qids.sort(compareQids),
  };
}

async function main() {
  const writeSnapshot = process.argv.includes("--write");
  const checkSnapshot = process.argv.includes("--check");
  if (writeSnapshot && checkSnapshot) {
    throw new Error("Choose either --write or --check, not both");
  }

  const { curatedWriterKeys, qids } = await readCuratedQids();
  const entitiesByQid = await fetchEntities(qids);

  let retrievedAt = new Date().toISOString();
  let checkedInSnapshot = null;
  if (checkSnapshot) {
    checkedInSnapshot = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    if (typeof checkedInSnapshot.retrievedAt !== "string") {
      throw new Error("Checked-in Wikidata snapshot has no retrievedAt timestamp");
    }
    retrievedAt = checkedInSnapshot.retrievedAt;
  }

  const snapshot = buildSnapshot({
    curatedWriterKeys,
    qids,
    entitiesByQid,
    retrievedAt,
  });
  const content = serializeSnapshot(snapshot);

  if (writeSnapshot) {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, content, "utf8");
  }
  if (checkSnapshot) {
    const currentContent = serializeSnapshot(checkedInSnapshot);
    if (currentContent !== content) {
      throw new Error(
        `Wikidata writer-facts snapshot is stale: ${path.relative(
          projectRoot,
          OUTPUT_PATH
        )}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: writeSnapshot ? "write" : checkSnapshot ? "check" : "preview",
        curatedWriterKeys,
        requestedQids: qids.length,
        returnedEntities: snapshot.counts.returnedEntities,
        missingEntities: snapshot.counts.missingEntities,
        claims: snapshot.counts.claims,
        output:
          writeSnapshot || checkSnapshot
            ? path.relative(projectRoot, OUTPUT_PATH)
            : null,
      },
      null,
      2
    )
  );
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
