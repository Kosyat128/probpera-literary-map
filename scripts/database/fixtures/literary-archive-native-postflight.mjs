import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNativeArchiveReadSql, parseNativeArchiveReadOutput, readNativeArchiveEvidenceIdentity }
  from "../../lib/literary-archive-native-postflight.mjs";

export const postflightIdentity = readNativeArchiveEvidenceIdentity();
export const postflightChild = { schemaVersion: "literary-archive-child-edit-preservation-v1",
  evidenceEvents: 0, evidenceSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  protectedWorks: 0, auditHighWaterId: "866", outboxHighWaterId: "450" };
export const postflightReceipt = { schemaVersion: "literary-archive-workflow-receipt-v2",
  releaseId: "10000000-0000-4000-8000-000000000001", childEditPreservation: postflightChild,
  committedManifestSha256: "a".repeat(64), logicalTargetManifestSha256: "b".repeat(64),
  expectedItems: 1, expectedPredecessorPublic: 69, expectedPredecessorPublicManifestSha256: "c".repeat(64) };
export const postflightResult = { releaseId: postflightReceipt.releaseId,
  committedManifestSha256: postflightReceipt.committedManifestSha256, unlockedWorks: 1,
  childEditPreservation: postflightChild, liveTargetManifestSha256: "d".repeat(64),
  predecessorPublic: 69, predecessorPublicManifestSha256: "c".repeat(64) };
export const postflightHealth = { attestationsRlsForced: true, canonRegistryVersion: postflightIdentity.canonRegistryVersion,
  contractVersion: postflightIdentity.contractVersion, controlsRlsForced: true, enforcementEnabled: true,
  invalidAttestationCount: 0, invalidationTriggerCount: 7, manifestSha256: "e".repeat(64), ok: true,
  policyCount: 7, predecessorPublicCount: 69, rpcOnlyEvidenceWrites: true,
  schemaVersion: "20260902_literary_work_evidence_v2_attestations", validatorVersion: postflightIdentity.validatorVersion };
export const postflightContext = { readOnly: true, isolation: "repeatable read", role: "service_role",
  authRole: "service_role", uid: null, statementTimeoutMs: 300000, lockTimeoutMs: 15000 };
export const postflightEnvelope = { transport: "native-postgres-read-only", operation: "postflight",
  context: postflightContext, elapsedMs: 25, result: postflightResult, health: postflightHealth };
export const postflightPrecondition = { unlockedWorks: 1, unlockedScopeSha256: "f".repeat(64),
  childEditPreservation: postflightChild, predecessorPublic: 69,
  predecessorLegacyManifestSha256: "c".repeat(64), cmsLockedPredecessorLegacyIds: [],
  cmsLockedUnattestedPredecessorLegacyIds: [] };
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${quote(JSON.stringify(value))}::jsonb`;

export function nativePostflightFixtureSetup() {
  const source = readFileSync(new URL("../../../supabase/migrations/20260902_zz_literary_archive_atomic_release.sql", import.meta.url), "utf8");
  const start = source.indexOf("create or replace function public.assert_literary_archive_live_target(");
  const end = source.indexOf("create or replace function public.create_literary_archive_release(", start);
  assert.ok(start >= 0 && end > start);
  // Use the real published assertion. Minimal deterministic backing helpers keep
  // this transport test independent of the separate full archive SQL fixtures.
  return `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; grant usage on schema auth to anon,authenticated,service_role;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create table public.native_postflight_fixture(child jsonb,health jsonb,identity jsonb,precondition jsonb);
insert into public.native_postflight_fixture values(${json(postflightChild)},${json(postflightHealth)},${json(postflightIdentity)},${json(postflightPrecondition)});
grant select,insert on public.native_postflight_fixture to service_role;
create table public.literary_works(id uuid primary key,legacy_id text,is_cms_locked boolean,content jsonb);
insert into public.literary_works select md5(i::text)::uuid,'fixture:writer:work-'||i,i<>1,jsonb_build_object('title','Fixture '||i) from generate_series(1,69)i;
create table public.literary_archive_releases(id uuid primary key,status text,committed_manifest_sha256 text,commit_receipt jsonb,expected_item_count integer,expected_child_edit_preservation jsonb,expected_predecessor_public_count integer,expected_predecessor_public_manifest_sha256 text,metadata jsonb);
insert into public.literary_archive_releases values('${postflightReceipt.releaseId}','committed',repeat('a',64),jsonb_build_object('manifestSha256',repeat('a',64),'childEditPreservation',${json(postflightChild)}),1,${json(postflightChild)},69,repeat('c',64),jsonb_build_object('logicalTargetManifestSha256',repeat('b',64)));
grant select on public.literary_archive_releases to service_role;
create table public.literary_archive_release_items(release_id uuid,legacy_id text,payload jsonb);
insert into public.literary_archive_release_items select '${postflightReceipt.releaseId}',legacy_id,jsonb_build_object('expectedContent',content,'attestation',null) from public.literary_works where not is_cms_locked;
create table public.literary_work_evidence_v2_attestations(work_id uuid,contract_version text,work_content_sha256 text,evidence_sha256 text,reviewer text,reviewed_at date);
create function public.literary_work_evidence_v2_sha256(text) returns text language sql immutable as $$select encode(sha256(convert_to($1,'UTF8')),'hex')$$;
create function public.literary_archive_release_manifest_sha256(uuid) returns text language sql stable as $$select repeat('a',64)$$;
create function public.literary_archive_child_edit_preservation_receipt() returns jsonb language sql stable security definer as $$select child from public.native_postflight_fixture$$;
create function public.literary_work_evidence_v2_content(uuid) returns jsonb language sql stable security definer as $$select content from public.literary_works where id=$1$$;
create function public.literary_archive_live_target_manifest_sha256() returns text language sql stable as $$select repeat('d',64)$$;
create function public.is_publishable_literary_work_pre_evidence_v2(uuid) returns boolean language sql stable as $$select true$$;
create function public.literary_archive_release_predecessor_legacy_manifest_sha256() returns text language sql stable as $$select repeat('c',64)$$;
create function public.get_literary_archive_release_precondition() returns jsonb language sql stable security definer as $$select precondition from public.native_postflight_fixture$$;
create function public.assert_literary_work_evidence_v2_health(text,text,text,text,text) returns jsonb language plpgsql stable as $$
declare fixture public.native_postflight_fixture%rowtype;
begin
  select * into fixture from public.native_postflight_fixture;
  if $1<>fixture.identity->>'contractVersion' or $2<>fixture.identity->>'validatorVersion' or $3<>fixture.identity->>'validatorSha256' or $4<>fixture.identity->>'canonRegistryVersion' or $5<>fixture.identity->>'canonRegistrySha256' then raise exception 'Fixture identity mismatch' using errcode='40001'; end if;
  return fixture.health;
end;$$;
${source.slice(start,end)}
`;
}

/** Shared with actual Docker PostgreSQL in CI and in-memory PostgreSQL locally. */
export async function exerciseNativePostflight(run) {
  await run(nativePostflightFixtureSetup());
  const sql = buildNativeArchiveReadSql("postflight", postflightReceipt, postflightIdentity);
  const [envelope] = await run(`begin;\n${sql}\ncommit;`);
  const parsed = parseNativeArchiveReadOutput(JSON.stringify(envelope), "postflight", postflightReceipt, postflightIdentity);
  assert.deepEqual(parsed.result, postflightResult);
  const wrongLogicalReceipt = { ...postflightReceipt, logicalTargetManifestSha256: "0".repeat(64) };
  const [wrongLogicalEnvelope] = await run(`begin;\n${buildNativeArchiveReadSql("postflight", wrongLogicalReceipt, postflightIdentity)}\ncommit;`);
  assert.equal(wrongLogicalEnvelope.result, null);
  assert.throws(() => parseNativeArchiveReadOutput(JSON.stringify(wrongLogicalEnvelope),
    "postflight", wrongLogicalReceipt, postflightIdentity), /differs from the committed workflow receipt/u);
  await run("update public.literary_archive_releases set metadata='{}'::jsonb;");
  const [missingLogicalEnvelope] = await run(`begin;\n${sql}\ncommit;`);
  assert.equal(missingLogicalEnvelope.result, null);
  assert.throws(() => parseNativeArchiveReadOutput(JSON.stringify(missingLogicalEnvelope),
    "postflight", postflightReceipt, postflightIdentity), /differs from the committed workflow receipt/u);
  await run("update public.literary_archive_releases set metadata=jsonb_build_object('logicalTargetManifestSha256',repeat('b',64));");
  const [precondition] = await run(`begin;\n${buildNativeArchiveReadSql("precondition", {})}\ncommit;`);
  assert.deepEqual(parseNativeArchiveReadOutput(JSON.stringify(precondition), "precondition", {}).result, postflightPrecondition);
  async function rejects(sqlText, state) {
    try { await run(sqlText); assert.fail(`Expected SQLSTATE ${state}`); }
    catch (error) { assert.equal(error.code, state); }
    finally { await run("rollback;"); }
  }
  await rejects(`begin;\n${sql}\ninsert into public.native_postflight_fixture select * from public.native_postflight_fixture; commit;`, "25006");
  await rejects(`begin;\n${buildNativeArchiveReadSql("postflight", postflightReceipt,
    { ...postflightIdentity, validatorSha256: "0".repeat(64) })}\ncommit;`, "40001");
  await rejects(`begin; set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000099';\n${sql}\ncommit;`, "42501");
  for (const role of ["anon", "authenticated"]) {
    await rejects(`begin; set local role ${role}; select public.assert_literary_archive_live_target('${postflightReceipt.releaseId}',repeat('a',64)); commit;`, "42501");
  }
  await run("update public.literary_works set content='{}'::jsonb where not is_cms_locked;");
  await rejects(`begin;\n${sql}\ncommit;`, "40001");
  await run("update public.literary_works set content=jsonb_build_object('title','Fixture 1') where not is_cms_locked;");
  await run(`update public.native_postflight_fixture set child=jsonb_set(child,'{auditHighWaterId}','"867"');`);
  await rejects(`begin;\n${sql}\ncommit;`, "40001");
  await run(`update public.native_postflight_fixture set child=${json(postflightChild)};`);
  const [restored] = await run("select jsonb_build_object('role',current_user,'readOnly',current_setting('transaction_read_only'),'rows',(select count(*) from public.native_postflight_fixture));");
  assert.equal(restored.readOnly, "off"); assert.notEqual(restored.role, "service_role"); assert.equal(restored.rows, 1);
  return { realPublishedAssertion: true, readOnly: true, repeatableRead: true, serviceOnly: true,
    nullUid: true, writeRejected: true, contentDriftRejected: true, childDriftRejected: true,
    evidenceIdentityRejected: true, logicalReceiptDriftRejected: true, logicalMetadataMissingRejected: true,
    preconditionNative: true, sessionRestored: true };
}
