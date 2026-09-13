import { readFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
export const wellsRepairMigrationPath = "supabase/migrations/20260913_wells_editorial_evidence_repair.sql";
export const wellsRepairMigration = readFileSync(new URL(wellsRepairMigrationPath, root), "utf8").replace(/\r\n?/gu, "\n");
function extractFunction(source, name) {
  const marker = `create or replace function public.${name}(\n`;
  const starts = source.split(marker);
  if (starts.length !== 2) throw new Error(`Expected one unchanged ${name} function.`);
  const end = starts[1].indexOf("\n$$;");
  if (end === -1) throw new Error(`Missing ${name} terminator.`);
  return marker + starts[1].slice(0, end + 4);
}
export function buildWellsEditorialRepairFixture() {
  const historical = readFileSync(new URL("supabase/migrations/20260902_literary_work_evidence_v2_attestations.sql", root), "utf8").replace(/\r\n?/gu, "\n");
  const packet = JSON.parse(readFileSync(new URL("reports/wells-editorial-repair-20260913.json", root), "utf8"));
  const literal = JSON.stringify(packet).replace(/'/gu, "''");
  return readFileSync(new URL("scripts/database/fixtures/wells-editorial-evidence-repair.sql", root), "utf8")
    .replace("-- __REAL_ATTESTATION_FUNCTION__", () => extractFunction(historical, "attest_literary_work_evidence_v2"))
    .replace("-- __REAL_IS_ATTESTED_FUNCTION__", () => extractFunction(historical, "is_literary_work_evidence_v2_attested"))
    .replaceAll("-- __WELLS_REPAIR_MIGRATION__", () => wellsRepairMigration)
    .replace("-- __REVIEWED_PACKET_INSERT__", () => `insert into public.fixture_packet(value) values('${literal}'::jsonb);`);
}
