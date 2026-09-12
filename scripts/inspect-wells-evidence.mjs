import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { evidenceV2DatabaseContentProjection } from "./lib/book-evidence-v2-attestations.mjs";
import { collectPostgrestPages } from "./lib/postgrest-pagination.mjs";

export const WELLS_LEGACY_ID = "england:h_g_wells:when-the-sleeper-wakes";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "reconciliation", "wells-evidence-inspection");
const WORK_COLUMNS = "id,legacy_id,country_id,writer_id,title,slug,original_title,first_published,original_language,genres,tags,description,source_url,editorial_status,reviewed_at,metadata,authorship_kind,is_cms_locked,updated_at";
const CONTROL_COLUMNS = "singleton,enforcement_enabled,contract_version,validator_id,validator_version,validator_sha256,canon_registry_version,canon_registry_sha256,updated_at";
const ATTESTATION_COLUMNS = "work_id,contract_version,work_content_sha256,evidence,evidence_sha256,reviewer,reviewed_at,created_at,updated_at";
// These columns mirror the existing DB content projection, not a general export.
const CHILDREN = [
  ["literary_work_translations", "translationRows", "id", "locale", "locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,metadata"],
  ["literary_work_sources", "sourceRows", "id", "provider,source_url", "provider,source_url,field_names,license_name,usage,retrieved_at,metadata"],
  ["literary_work_external_ids", "externalIdRows", "id", "scheme,external_id", "scheme,external_id,source_url"],
  ["literary_work_authors", "authorRows", "position", "position", "position,writer_country_id,writer_id,credit_name_ru,credit_name_en,attribution_status,metadata"],
  ["book_editions", "editionRows", "id", "legacy_id", "legacy_id,title,isbn_10,isbn_13,publisher,publication_year,language,format,page_count,cover_url,cover_source_url,cover_rights_status,license_name,license_url,creator,rights_holder,rights_checked_at,source_url,is_primary,metadata"],
  ["literary_work_cover_artworks", "artworkRows", "id", "source_archive_sha256,source_image_sha256", "cover_url,thumbnail_url,cover_width,cover_height,thumbnail_width,thumbnail_height,rights_status,cover_source_url,rights_checked_at,source_archive_sha256,source_image_sha256,source_filename,source_relative_path,source_index,is_primary,provenance"],
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateWork(work) {
  requireCondition(
    work?.legacy_id === WELLS_LEGACY_ID && UUID.test(work.id || "") &&
    work.country_id === "england" && work.writer_id === "h_g_wells" &&
    typeof work.is_cms_locked === "boolean" && typeof work.updated_at === "string",
    "The work response does not match the fixed Wells inspection scope."
  );
  return work;
}

export function serializeWellsInspection(snapshot, serviceRoleKey) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  requireCondition(
    typeof serviceRoleKey === "string" && serviceRoleKey.length >= 20 &&
    !serialized.includes(serviceRoleKey) &&
    !/"(?:authorization|apikey|api_key|service_role_key|supabase_service_role_key|password|secret|access_token|refresh_token)"\s*:/iu.test(serialized),
    "Credential-shaped data was found; no inspection artifact will be written."
  );
  return serialized;
}

/** GET-only, fixed-work inspection. This never attests, edits or publishes. */
export async function inspectWellsEvidence({
  supabaseUrl,
  serviceRoleKey,
  expectedMainSha,
  fetchImpl = fetch,
}) {
  requireCondition(/^[0-9a-f]{40}$/u.test(expectedMainSha || ""), "An exact main SHA is required.");
  requireCondition(typeof serviceRoleKey === "string" && serviceRoleKey.length >= 20, "The service credential is missing.");
  let origin;
  try {
    origin = new URL(supabaseUrl);
  } catch {
    throw new Error("The Supabase HTTPS origin is invalid.");
  }
  requireCondition(
    origin.protocol === "https:" && origin.hostname.endsWith(".supabase.co") &&
    !origin.username && !origin.password && !origin.port &&
    origin.pathname === "/" && !origin.search && !origin.hash,
    "The Supabase HTTPS origin is invalid."
  );
  const startedAt = new Date().toISOString();
  const deadline = AbortSignal.timeout(120_000);
  async function get(resource, parameters, range) {
    const url = new URL(`/rest/v1/${resource}`, origin);
    url.search = new URLSearchParams(parameters).toString();
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.any([deadline, AbortSignal.timeout(15_000)]),
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
          ...(range ? { Prefer: "count=exact", "Range-Unit": "items", Range: range } : {}),
        },
      });
      requireCondition(response.ok, "Inspection read was rejected.");
      return { data: await response.json(), contentRange: response.headers.get("content-range") };
    } catch {
      // Never print a raw URL, response body, fetch exception or credential.
      throw new Error("A bounded read failed; no inspection artifact will be written.");
    }
  }
  async function one(resource, parameters, optional = false) {
    const { data } = await get(resource, { ...parameters, limit: "2" });
    requireCondition(Array.isArray(data) && data.length <= 1 && (optional || data.length === 1), "Expected one scoped database record.");
    return data[0] ?? null;
  }
  async function readWork() {
    return validateWork(await one("literary_works", {
      select: WORK_COLUMNS, legacy_id: `eq.${WELLS_LEGACY_ID}`,
    }));
  }
  const initialWork = await readWork();
  const workId = initialWork.id;
  async function readHash() {
    const { data } = await get("rpc/literary_work_evidence_v2_content_sha256", { target_work_id: workId });
    requireCondition(SHA256.test(data || ""), "The work hash RPC returned an invalid hash.");
    return data;
  }
  async function readBundle() {
    const work = await readWork();
    requireCondition(isDeepStrictEqual(work, initialWork), "The Wells work changed during inspection.");
    const controls = await one("literary_work_evidence_v2_controls", {
      select: CONTROL_COLUMNS, singleton: "eq.true",
    });
    requireCondition(
      controls.singleton === true && typeof controls.enforcement_enabled === "boolean" &&
      controls.contract_version === "book-evidence-v2" &&
      controls.validator_id === "src/data/bookEvidence.ts#bookEvidenceV2Issues" &&
      typeof controls.validator_version === "string" &&
      typeof controls.canon_registry_version === "string" &&
      SHA256.test(controls.validator_sha256 || "") && SHA256.test(controls.canon_registry_sha256 || ""),
      "The current Evidence V2 control identity is invalid."
    );
    const attestation = await one("literary_work_evidence_v2_attestations", {
      select: ATTESTATION_COLUMNS, work_id: `eq.${workId}`,
    }, true);
    requireCondition(!attestation || attestation.work_id === workId, "Attestation escaped the fixed work scope.");
    const projected = { workRow: work, authorshipKind: work.authorship_kind };
    for (const [table, projectionKey, identity, order, columns] of CHILDREN) {
      projected[projectionKey] = await collectPostgrestPages({
        table,
        pageSize: 100,
        identity: (row) => row[identity] ?? "",
        fetchPage: async ({ from, to, pageIndex }) => {
          requireCondition(pageIndex < 100, "The single-work child row limit was exceeded.");
          const selectedColumns = [...new Set(["work_id", identity, ...columns.split(",")])].join(",");
          const { data, contentRange } = await get(table, {
            select: selectedColumns, work_id: `eq.${workId}`, order,
          }, `${from}-${to}`);
          requireCondition(Array.isArray(data) && data.every((row) => row.work_id === workId), "A child row escaped the fixed work scope.");
          return { rows: data, contentRange };
        },
      });
    }
    return {
      workIdentity: { id: workId, legacyId: WELLS_LEGACY_ID, isCmsLocked: work.is_cms_locked, updatedAt: work.updated_at },
      controls,
      storedAttestation: attestation,
      content: evidenceV2DatabaseContentProjection(projected),
    };
  }
  const hashBefore = await readHash();
  const first = await readBundle();
  const hashBetween = await readHash();
  const second = await readBundle();
  const hashAfter = await readHash();
  requireCondition(
    hashBefore === hashBetween && hashBefore === hashAfter && isDeepStrictEqual(first, second),
    "Evidence changed during inspection; the snapshot must be read again."
  );
  const snapshot = {
    schemaVersion: "wells-evidence-inspection-v1",
    expectedMainSha,
    startedAt,
    completedAt: new Date().toISOString(),
    readOnly: true,
    consistency: "two-identical-projections-with-three-identical-db-hashes",
    // GETs are not one DB transaction. A future attestation must still compare
    // this exact content and hash inside the existing transactional RPC.
    attestationPerformed: false,
    databaseContentSha256: hashAfter,
    ...second,
  };
  serializeWellsInspection(snapshot, serviceRoleKey);
  return snapshot;
}

async function main() {
  requireCondition(process.argv.length === 4 && process.argv[2] === "--expected-main-sha", "Usage: inspect-wells-evidence.mjs --expected-main-sha <40-character SHA>");
  const expectedMainSha = process.argv[3];
  requireCondition(/^[0-9a-f]{40}$/u.test(expectedMainSha), "An exact main SHA is required.");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  requireCondition(head === expectedMainSha, "The checkout differs from the expected main SHA.");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const snapshot = await inspectWellsEvidence({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey,
    expectedMainSha,
  });
  const content = serializeWellsInspection(snapshot, serviceRoleKey);
  await mkdir(OUTPUT, { recursive: true });
  const filename = "wells-evidence.json";
  await writeFile(path.join(OUTPUT, filename), content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const checksum = createHash("sha256").update(content, "utf8").digest("hex");
  await writeFile(path.join(OUTPUT, "SHA256SUMS"), `${checksum}  ${filename}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log("Read-only Wells inspection saved with SHA256SUMS; no database writes performed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Wells evidence inspection failed. No database writes were attempted; do not use an incomplete artifact.");
    process.exitCode = 1;
  });
}
