import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../.."),work=path.resolve(root,"../work");
const environment=()=>Object.fromEntries(Object.entries(process.env).filter(([key])=>
  /^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
const names=[
  "Viewing a current linked candidate is free and never probes or starts a provider",
  "Rights-only drift keeps the exact preview and discard form while closing approval",
  "Existing manual-ownership denial stays closed without an extra metadata read",
  ...["missing RPC","permission error","transient failure","null response","extra private body","wrong draft version","wrong candidate hash","wrong source hash","wrong textual entity"]
    .map(name=>`Metadata ${name} closes approval without hiding preview or permitting legacy fallback`),
  "A genuinely existing unlinked legacy draft retains the original review branch at zero provider cost",
  "Candidate consumed between initial read and metadata keeps historical preview closed; a fresh read is empty",
  "Historical operation cannot borrow a different current private draft identity",
  "Metadata remains a staff-independent read without actor-owned artifact access",
];
const cases=["library","country"].flatMap(kind=>names.map(name=>({kind,name})));
type Check={kind:string;name:string;pass:boolean;error?:string};

describe("Catalog review full private seed and metadata availability",()=>{
  let report:{checks:Check[];unchanged:boolean};
  beforeAll(()=>{
    mkdirSync(work,{recursive:true});const output=mkdtempSync(path.join(work,"catalog-review-full-seed-"));
    const run=spawnSync(process.execPath,[path.join(root,"apps/admin/lib/fixtures/catalog-review-full-seed-cases.cjs")],{
      cwd:root,env:{...environment(),CATALOG_PREFLIGHT_REPO:root,CATALOG_PREFLIGHT_OUTPUT_ROOT:output,CATALOG_PREFLIGHT_MODE:"current"},encoding:"utf8",timeout:60000,maxBuffer:24*1024*1024});
    expect(run.error,run.stderr).toBeUndefined();
    report=JSON.parse(readFileSync(path.join(output,"review-cases-report.json"),"utf8"));
    expect(report.checks.map(({kind,name})=>({kind,name}))).toEqual(cases);expect(report.unchanged).toBe(true);
    expect(run.status,JSON.stringify(report.checks.filter(item=>!item.pass))).toBe(0);
  },65000);
  it.each(cases)("$kind: $name",({kind,name})=>{
    const value=report.checks.find(item=>item.kind===kind&&item.name===name);expect(value,"Every actual scenario must run").toBeDefined();expect(value!.pass,value!.error).toBe(true);
  });
});

describe.each(["before","current"] as const)("Catalog %s rights drift through the same frozen assertions",mode=>{
  it("preserves original captures and executes a versioned loader with only new SDK metadata transport",()=>{
    mkdirSync(work,{recursive:true});const output=mkdtempSync(path.join(work,`catalog-preflight-same-${mode}-`));
    const contract=path.join(root,"apps/admin/lib/fixtures/catalog-review-preflight.same-contract.cjs");
    expect(createHash("sha256").update(readFileSync(contract)).digest("hex")).toBe("3aa0ccaa251cb9faa45ca7d1c59a374e10d2dd3b667b4f58748b68822664cb8e");
    const env={...environment(),CATALOG_PREFLIGHT_REPO:root,CATALOG_PREFLIGHT_OUTPUT_ROOT:output,CATALOG_PREFLIGHT_MODE:mode};
    const run=spawnSync(process.execPath,[path.join(root,"apps/admin/lib/fixtures/catalog-review-full-seed-runtime.cjs")],{
      cwd:root,env,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    expect(run.error,run.stderr).toBeUndefined();expect(run.status,run.stderr).toBe(0);
    const resultFile=path.join(output,"contract-result.json"),checked=spawnSync(process.execPath,[contract,path.join(output,"paired-report.json"),resultFile],{
      cwd:root,env,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    expect(checked.error,checked.stderr).toBeUndefined();
    const result=JSON.parse(readFileSync(resultFile,"utf8"));expect(result.controlFailures).toBe(0);expect(result.targetFailures).toBe(mode==="before"?2:0);
    expect(checked.status,checked.stderr).toBe(mode==="before"?1:0);
  },65000);
});
