import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe,expect,it} from "vitest";
import {validateRetainedSiteCopyTranslation} from "./auto-translate-site-copy";
import {SiteCopyTranslationParameterError,validateSiteCopyTranslationParameters} from "./site-copy-parameters";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const definitions=JSON.parse(readFileSync(path.join(root,"apps/admin/catalog-assets/interface-copy-catalog.json"),"utf8")) as Array<{key:string;defaultRu:string;defaultEn:string}>;
const countKeys=definitions.filter(row=>row.defaultRu.includes("{count}"));

describe("actual managed site-copy count parameters",()=>{
 it("binds all nine real count keys to their existing source and English defaults",()=>{
  expect(countKeys).toHaveLength(9);
  for(const row of countKeys){
   expect(()=>validateSiteCopyTranslationParameters({key:row.key,text:row.defaultRu},row.defaultEn)).not.toThrow();
   expect(()=>validateSiteCopyTranslationParameters({key:row.key,text:row.defaultRu},"Profiles ready")).toThrow(SiteCopyTranslationParameterError);
  }
 });
 it.each(["Profiles ready","{total} profiles ready","{count} profiles of {count}","{count} profiles and {other}"])("rejects lost, renamed, duplicated or additional parameters: %s",text=>{
  const row=countKeys[0];expect(()=>validateRetainedSiteCopyTranslation([{key:row.key,text:row.defaultRu}],{items:[{key:row.key,text}]})).toThrow(SiteCopyTranslationParameterError);
 });
 it("also rejects a missing source count and keeps plain/custom text free of invented grammars",()=>{
  expect(()=>validateSiteCopyTranslationParameters({key:countKeys[0].key,text:"Портреты"},"{count} portraits")).toThrow(SiteCopyTranslationParameterError);
  for(const key of ["interface.Поиск","interface.custom-example","interface.Страница {page} из {total}"]){
   expect(()=>validateSiteCopyTranslationParameters({key,text:"Plain {example}"},"Plain {literal} <tag>")).not.toThrow();
  }
 });
 it("executes current helpers and exact genuine historical candidates through installed SDK boundaries",()=>{
  const output=mkdtempSync(path.resolve(root,"../work/site-copy-parameters-regression-"));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(?:PATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key))) as NodeJS.ProcessEnv;
  const result=spawnSync(process.execPath,[path.join(root,"apps/admin/lib/fixtures/site-copy-parameters.cjs")],{cwd:root,env:{...env,CI:"1",SITE_COPY_ADMISSION_REPO:root,SITE_COPY_ADMISSION_SOURCE_ROOT:root,SITE_COPY_ADMISSION_OUTPUT_ROOT:output},encoding:"utf8",timeout:120_000,maxBuffer:8*1024*1024});
  expect(result.error,result.stderr).toBeUndefined();expect(result.status,result.stderr).toBe(0);
  const report=JSON.parse(readFileSync(path.join(output,"parameters-report.json"),"utf8"));
  expect(report.checks).toHaveLength(12);expect(report.checks.every((row:{pass:boolean})=>row.pass)).toBe(true);
 },125_000);
});
