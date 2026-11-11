import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {beforeAll,describe,expect,it} from "vitest";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../.."),work=path.resolve(root,"../work");
const names=[
  "Originalcf1 preserves two site-copy failures, nine other-domain guards and eleven preservation controls",
  "CURRENT executes all11 original triggers through the exact unchanged a63 oracle",
  "Actual helper completes privately with raw per-call response retention and no aggregate journal",
  "Confirmed BEGIN and private seed precede admission callback, attempt and provider",
  "Refused parent admission starts zero attempts and zero provider calls",
  ...["same","source","keys","missing","recreated","config-disabled","foreign"].map(mode=>`Accepted unknown work holds logical scope after ${mode}`),
  ...["outage","recreated","manual"].map(mode=>`Complete original bodies recover without expense after ${mode} and disabled changed runtime`),
  ...["translation","review"].map(pass=>`Cancellation during accepted ${pass} retains its body and prevents another request`),
  "Expired original45s deadline retains accepted translation before stopping review",
  "Actual51-key source selects original first50 and retains12000-token request bound",
  ...[false,true].map(repair=>`Optional final review=false retains existing repair=${repair} semantics`),
  "Actual translation repair review repair stays inside four durable reservations",
  "Default helper budget remains one attempt four calls45000ms",
  "Actual source save and ordinary publication precede optional durable translation",
  "Actual explicit batch uses durable journal without duplicate posthoc paid run",
  "Lost new BEGIN ACK grants no attempt or provider authority",
  "Retained source hash forgery cannot become a confirmed historical result",
  "Addressed unknown operation is recovery-only and never starts a new expense",
  "Exact fresh command replay after completion and discard never becomes another BEGIN",
  "Distinct fresh command after unknown accepted work holds the original logical operation",
  ...[false,true].map(foreign=>`Actual discard and changedRU permits explicit new intent with foreignHistory=${foreign}`),
  ...[false,true].map(during=>`Feature flag denies new expense duringAcceptedTranslation=${during}`),
  ...["unavailable","malformed-ack"].map(mode=>`Initial logical metadata ${mode} never falls back to a new operation`),
  "First raw body is durably retained before the actual reviewer begins",
  "Actual helper rethrows native Next signals instead of returning a false failure",
  "Revision-only automatic observation is free while explicit new intent may regenerate a discarded same-source candidate",
  "Actual POST forms carry distinct fresh intents and fresh command wins over an old selected operation",
  "Actual addressed batch preserves unknown receipt before disabled runtime and missing source",
  "Actual review inspector closes linked promotion on opaque full-row drift despite unchanged settings and CAS",
  ...["unavailable","malformed"].map(issue=>`Actual review inspector fails closed on freshness metadata ${issue} while keeping private candidate`),
  "Actual repeated RU saves preserve source and prior EN while one unknown paid operation remains held",
];
const environment=()=>Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
type Check={name:string;pass:boolean;error?:string};
type Oracle={summary:{checks:number;pass:number;fail:number;targetFail:number;controlFail:number;preservationFail:number};checks:Array<Check&{category:string}>};
type Report={archiveSha256:string;oracleSha256:string;checks:Check[];traces:Array<{name:string;same?:Oracle}>};

describe("site-copy durable admission through actual application and installed SDK",()=>{
  let report:Report;
  beforeAll(()=>{
    mkdirSync(work,{recursive:true});const output=mkdtempSync(path.join(work,"site-copy-admission-maintained-"));
    const run=spawnSync(process.execPath,[path.join(root,"apps/admin/lib/fixtures/site-copy-admission-cases.cjs")],{
      cwd:root,env:{...environment(),SITE_COPY_ADMISSION_REPO:root,SITE_COPY_ADMISSION_SOURCE_ROOT:root,SITE_COPY_ADMISSION_OUTPUT_ROOT:output},
      encoding:"utf8",timeout:180_000,maxBuffer:24*1024*1024});
    writeFileSync(path.join(output,"runner.stdout.log"),run.stdout||"");writeFileSync(path.join(output,"runner.stderr.log"),run.stderr||"");
    expect(run.error,run.stderr).toBeUndefined();expect(run.stderr).toBe("");
    report=JSON.parse(readFileSync(path.join(output,"site-copy-admission-cases-report.json"),"utf8"));
    expect(report.archiveSha256).toBe("cf1a17f1033b1ab3bec07cf484c6d0ad1bec9a5dadfd800199d397bd58805b3b");
    expect(report.oracleSha256).toBe("a63a42d6b2870cd78dfb45cdf23683fac1ccc19079281fed6caa9595502bff45");
    expect(report.checks.map(row=>row.name)).toEqual(names);
    expect(run.status,JSON.stringify(report.checks.filter(row=>!row.pass))).toBe(0);
  },185_000);
  it.each(names)("%s",name=>{const check=report.checks.find(row=>row.name===name);expect(check).toBeDefined();expect(check!.pass,check!.error).toBe(true);});
  const oracleNames=[...(["writer","library","country"] as const).flatMap(kind=>["confirmed-partial","unknown","complete-recovery"].flatMap(mode=>[
    `${kind}/${mode}:canonical-and-publication-preserved`,`${kind}/${mode}:existing-safety-control`])),
    ...["confirmed-partial","unknown"].flatMap(mode=>[`site_copy/${mode}:canonical-and-publication-preserved`,`site_copy/${mode}:no-regeneration-of-same-source`])];
  it.each(oracleNames)("exact original CURRENT oracle: %s",name=>{
    const oracle=report.traces.find(row=>row.name===names[1])!.same!;expect(oracle.summary).toEqual({checks:22,pass:22,fail:0,targetFail:0,preservationFail:0,controlFail:0});
    expect(oracle.checks.find(row=>row.name===name)?.pass).toBe(true);
  });
});
