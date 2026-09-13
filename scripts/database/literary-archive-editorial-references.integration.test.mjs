import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildLiteraryArchiveReferenceFixture, referenceMigration } from "./fixtures/build-literary-archive-reference-fixture.mjs";
import { canonicalLiteraryArchiveReleasePayload } from "../lib/literary-archive-atomic-release.mjs";

const probe = spawnSync("docker",["info","--format","{{.ServerVersion}}"],{encoding:"utf8"});
const integrationTest = probe.status === 0 || process.env.CI ? it : it.skip;
const fixture = buildLiteraryArchiveReferenceFixture({fullScale:true});
const read = file => readFileSync(file,"utf8").replace(/\r\n?/gu,"\n");
const sha = value => createHash("sha256").update(value).digest("hex");
const docker = (args,input) => {
  const result=spawnSync("docker",args,{encoding:"utf8",input,timeout:150_000,maxBuffer:2_000_000});
  if(result.status!==0)throw new Error(result.error?.message||result.stderr||"Isolated reference PostgreSQL command failed.");
  return result.stdout;
};

describe("atomic editorial reference initialization",()=>{
  it("pins only minimal reviewed reference text and retains immutable migrations36/37",()=>{
    const artifact=JSON.parse(read("reports/literary-archive-reference-catalog-20260914.json"));
    const payloadSha=sha(canonicalLiteraryArchiveReleasePayload(artifact.payload));
    expect(referenceMigration).toContain(`payload_sha constant text := '${payloadSha}'`);
    expect(payloadSha).toBe("df634b2a54d67df1fbd46b5cda33ddff926a337630bb6246290ff06e33b25c0b");
    expect(sha(read("supabase/migrations/20260912_literary_work_evidence_v2_registry_rotation.sql"))).toBe("2fbcba184a4f7f7eb8e0ab49737540c42614d3f1d0755914f485bd5c0e04f525");
    expect(sha(read("supabase/migrations/20260913_wells_editorial_evidence_repair.sql"))).toBe("769353bbf60790b6a5113a5d76ee23cb7ce0e84e3100a7d3eac86c7113d09c70");
    expect(referenceMigration).not.toMatch(/(?:update|delete from) public\.editorial_(?:countries|writers)|on conflict[^;]+do update/iu);
    expect(referenceMigration).not.toMatch(/grant execute|set\s+enforcement_enabled\s*=|insert into public\.literary_works/iu);
  });
  it("keeps initialization private, staged-only and before unchanged special proof gates",()=>{
    expect(referenceMigration).toContain("lock table public.editorial_countries, public.editorial_writers\n    in share row exclusive mode nowait");
    expect(referenceMigration).toContain("current_setting('probpera.literary_archive_atomic_release', true) is distinct from 'on'");
    expect(referenceMigration).toContain("cross join lateral jsonb_array_elements(item.payload -> 'authors') author");
    expect(referenceMigration).toContain("writer_key in ('harriet_beecher_stowe','louisa_may_alcott') then continue");
    expect(referenceMigration).toContain("execute replace(definition,anchor,hook || E'\\n' || anchor)");
    expect(fixture).not.toMatch(/-- __[A-Z0-9_]+__/u);
    // Two real installations plus the quoted installer used for negative tests.
    expect(fixture.match(/do \$literary_archive_editorial_reference_hook_20260914\$/gu)).toHaveLength(3);
    expect(fixture.match(/do \$literary_archive_registry_rotation_hooks\$/gu)).toHaveLength(2);
    expect(fixture.match(/do \$wells_description_origin_contract_20260913\$/gu)).toHaveLength(2);
    expect(fixture).toContain("generate_series(1,9762)");
  });
  integrationTest("executes replay36/37/38, exact proof gates, preservation, rollback and full-scale needed references",async()=>{
    if(probe.status!==0)throw new Error("Docker is required for the CI editorial reference contract.");
    const name=`probpera-editorial-references-${process.pid}-${randomUUID().slice(0,8)}`;
    let started=false;
    try {
      docker(["run","--detach","--rm","--name",name,"--network","none","--env","POSTGRES_PASSWORD=fixture-only",
        "--env","POSTGRES_DB=editorial_references",process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE||"postgres:17-alpine"]);
      started=true;
      let consecutive=0;
      for(let attempt=0;attempt<80;attempt+=1){
        const ready=spawnSync("docker",["exec",name,"pg_isready","-U","postgres","-d","editorial_references"],{encoding:"utf8",timeout:2000});
        consecutive=ready.status===0?consecutive+1:0;
        if(consecutive>=3)break;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      if(consecutive<3)throw new Error("Isolated editorial reference PostgreSQL did not become ready.");
      const result=docker(["exec","--interactive",name,"psql","-U","postgres","-d","editorial_references",
        "--no-psqlrc","--tuples-only","--no-align","--set=ON_ERROR_STOP=1"],fixture);
      expect(result).toContain("EDITORIAL_REFERENCE_CONTRACT_OK");
      expect(result).toContain('"fullScaleItems": 9762');
      expect(docker(["exec",name,"psql","-U","postgres","-d","editorial_references","-Atc",
        "select to_regclass('public.editorial_countries') is null"]).trim()).toBe("t");
    } finally {if(started)docker(["rm","--force",name]);}
  },210_000);
});
