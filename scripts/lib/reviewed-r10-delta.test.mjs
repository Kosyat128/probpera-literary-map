import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { r10DeltaAttestation as packet, r10DeltaSha256 as sha, projectReviewedR10Delta, isReviewedR10Addition, reviewedR10AdditionPaths } from "./reviewed-r10-delta.mjs";

const read=path=>readFileSync(path,"utf8").replace(/\r\n?/gu,"\n");
const historical=path=>execFileSync("git",["-c",`safe.directory=${process.cwd()}`,"show",`${packet.baselineSourceCommitSha}:${path}`],{encoding:"utf8",maxBuffer:5*1024*1024}).replace(/\r\n?/gu,"\n");
describe("R10 exact additive projection without rewriting historical acceptance",()=>{
  it("pins the bounded agent-reviewed packet and explicitly excludes human/release claims",()=>{
    expect(sha(JSON.stringify(packet))).toBe("0338172f956f2a3e8f0f0a5b58b69dd08ee6f4e9b98232b8b07f6b3786ad5d5d");
    expect(packet).toMatchObject({id:"R10-FORWARD-DELTA-20260926",baselineSourceCommitSha:"63ce3112846e3e49f4b15d1cb64b3c29cb98af70",historicalPinsChanged:false,authorization:{humanReview:false,releaseAccepted:false,productionApplied:false}});
    expect(packet.allowedProjectionPaths).toEqual(["src/components/HeaderArticlesMenu.tsx","apps/admin/app/(dashboard)/homepage/page.tsx","src/data/countries/index.ts","src/data/countries/types.ts","package.json","scripts/lib/reviewed-header-library.test.mjs","scripts/lib/reviewed-r49n-package.test.mjs","scripts/lib/reviewed-dependency-security.test.mjs","scripts/lib/reviewed-header-showcase.test.mjs","src/components/stage5Governance.test.ts","scripts/lib/stage5-content-data-lock.test.mjs","scripts/lib/reviewed-cms-source-punctuation.test.mjs","scripts/lib/reviewed-draft-storage.test.mjs","scripts/lib/reviewed-native-archive-read.test.mjs","scripts/lib/reviewed-native-archive-transport.test.mjs","scripts/lib/reviewed-premium-title-evidence.test.mjs","scripts/lib/reviewed-reference-release.test.mjs","tests/e2e/header-hero-polish.spec.mjs"]);
    expect([...new Set(packet.projections.map(entry=>entry.path))]).toEqual(packet.allowedProjectionPaths);
    expect(new Set(packet.projections.map(entry=>entry.id)).size).toBe(packet.projections.length);
    expect([...reviewedR10AdditionPaths]).toEqual(["src/data/countries/writerDatePatches.ts","src/data/countries/generated/writerDatePatches.r10.json"]);
  });
  it.each(packet.allowedProjectionPaths)("restores exact pre-R10 Git bytes with no drift allowance: %s",path=>{
    const current=read(path),before=projectReviewedR10Delta(path,current);
    expect(sha(current)).toBe(packet.reviewedSources[path]);expect(sha(before)).toBe(packet.sourceBaselines[path]);expect(before).toBe(historical(path));
    expect(projectReviewedR10Delta(path,current.replaceAll("\n","\r\n"))).toBe(before);
    const outside="\n/* Unrelated bytes must reach the historical lock. */\n";
    expect(projectReviewedR10Delta(path,current+outside)).toBe(before+outside);expect(sha(before+outside)).not.toBe(packet.sourceBaselines[path]);
    for(const delta of packet.projections.filter(item=>item.path===path)) {
      expect(delta.before).not.toBe(delta.after);expect(delta.after).not.toBe("");
      for(const changed of [current.replace(delta.after,""),current+delta.after,current.replace(delta.after,delta.after.replace(/\S/u,"?"))])expect(()=>projectReviewedR10Delta(path,changed)).toThrow("Missing or duplicate R10 delta");
    }
  });
  it("excludes only exact new date evidence modules and lets every altered byte fail old data locks",()=>{
    for(const addition of packet.additions){const source=read(addition.path);expect(isReviewedR10Addition(addition.path,source)).toBe(true);expect(isReviewedR10Addition(addition.path,source.replaceAll("\n","\r\n"))).toBe(true);expect(isReviewedR10Addition(addition.path,source+"\n")).toBe(false);expect(isReviewedR10Addition(addition.path,source.replace(/\S/u,"?"))).toBe(false);expect(isReviewedR10Addition(addition.path+".unreviewed",source)).toBe(false);}
    expect(projectReviewedR10Delta("src/data/bookArchive.ts","unreviewed content\n")).toBe("unreviewed content\n");
  });
  it("keeps old attestations and projection implementations byte-for-byte unchanged",()=>{
    for(const path of ["scripts/governance/header-library-owner-refinement-20260912.json","scripts/governance/header-showcase-owner-refinement-20260914.json","scripts/governance/book-r49n-package-reviewed-20260912.json","scripts/governance/dependency-security-reviewed-20260912.json","scripts/governance/reading-design-owner-refinement-20260906.json","scripts/lib/reviewed-header-library.mjs","scripts/lib/reviewed-header-showcase.mjs","scripts/lib/reviewed-r49n-package.mjs","scripts/lib/reviewed-dependency-security.mjs","scripts/lib/reviewed-reading-design.mjs"]){expect(read(path)).toBe(historical(path));}
  });
});
