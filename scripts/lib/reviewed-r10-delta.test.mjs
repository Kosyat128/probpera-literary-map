import { readFileSync } from "node:fs";
import { projectReviewedCalendarFollowup } from "./reviewed-calendar-followup.mjs";
import { projectReviewedUndiciSecurityFollowup } from "./reviewed-undici-security-followup.mjs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { r10DeltaAttestation as packet, r10DeltaSha256 as sha, projectReviewedR10Delta, isReviewedR10Addition, reviewedR10AdditionPaths } from "./reviewed-r10-delta.mjs";

const read=path=>projectReviewedCalendarFollowup(path,projectReviewedUndiciSecurityFollowup(path,readFileSync(path,"utf8")));
const historical=path=>execFileSync("git",["-c",`safe.directory=${process.cwd()}`,"show",`${packet.baselineSourceCommitSha}:${path}`],{encoding:"utf8",maxBuffer:5*1024*1024}).replace(/\r\n?/gu,"\n");
function beforeCmsExternalIds(value) {
  const {cmsExternalIdFollowUp,...prior}=value;
  const paths=["scripts/export-published-content.mjs","scripts/export-published-content.fixture.test.mjs","src/data/cms/editorialOverrides.ts","src/data/cms/editorialOverrides.test.ts"];
  const additions=["scripts/lib/public-work-external-id-fetch.mjs","scripts/lib/public-work-external-id-fetch.test.mjs"];
  prior.allowedProjectionPaths=prior.allowedProjectionPaths.filter(path=>!paths.includes(path));
  prior.projections=prior.projections.filter(entry=>!paths.includes(entry.path));
  prior.additions=prior.additions.filter(entry=>!additions.includes(entry.path));
  for(const key of ["sourceBaselines","reviewedSources"])prior[key]=Object.fromEntries(Object.entries(prior[key]).filter(([path])=>!paths.includes(path)));
  return prior;
}
function beforeBrowserScroll(value) {
  const {browserScrollFollowUp,...prior}=beforeCmsExternalIds(value);
  const reviewedPath="tests/e2e/public-smoke.spec.mjs";
  prior.allowedProjectionPaths=prior.allowedProjectionPaths.filter(path=>path!==reviewedPath);
  prior.projections=prior.projections.filter(entry=>entry.path!==reviewedPath);
  for(const key of ["sourceBaselines","reviewedSources"])prior[key]=Object.fromEntries(Object.entries(prior[key]).filter(([path])=>path!==reviewedPath));
  return prior;
}
describe("R10 exact additive projection without rewriting historical acceptance",()=>{
  it("pins the bounded agent-reviewed packet and explicitly excludes human/release claims",()=>{
    expect(sha(JSON.stringify(packet))).toBe("7f277e58d5e0a46f7bc12a87e606304e63d05cf8a9c48781331d151cbbafef69");
    expect(packet).toMatchObject({id:"R10-FORWARD-DELTA-20260926",baselineSourceCommitSha:"63ce3112846e3e49f4b15d1cb64b3c29cb98af70",historicalPinsChanged:false,authorization:{humanReview:false,releaseAccepted:false,productionApplied:false}});
    expect(packet.allowedProjectionPaths).toEqual(["src/components/HeaderArticlesMenu.tsx","apps/admin/app/(dashboard)/homepage/page.tsx","src/data/countries/index.ts","src/data/countries/types.ts","package.json","scripts/lib/reviewed-header-library.test.mjs","scripts/lib/reviewed-r49n-package.test.mjs","scripts/lib/reviewed-dependency-security.test.mjs","scripts/lib/reviewed-header-showcase.test.mjs","src/components/stage5Governance.test.ts","scripts/lib/stage5-content-data-lock.test.mjs","scripts/lib/reviewed-cms-source-punctuation.test.mjs","scripts/lib/reviewed-draft-storage.test.mjs","scripts/lib/reviewed-native-archive-read.test.mjs","scripts/lib/reviewed-native-archive-transport.test.mjs","scripts/lib/reviewed-premium-title-evidence.test.mjs","scripts/lib/reviewed-reference-release.test.mjs","tests/e2e/header-hero-polish.spec.mjs","scripts/import-user-supplied-book-covers.mjs","scripts/import-user-supplied-book-covers-2026-08-13.mjs","scripts/import-user-supplied-book-covers-2026-08-20.mjs","tests/e2e/public-smoke.spec.mjs","scripts/export-published-content.mjs","scripts/export-published-content.fixture.test.mjs","src/data/cms/editorialOverrides.ts","src/data/cms/editorialOverrides.test.ts"]);
    expect([...new Set(packet.projections.map(entry=>entry.path))]).toEqual(packet.allowedProjectionPaths);
    expect(new Set(packet.projections.map(entry=>entry.id)).size).toBe(packet.projections.length);
    expect([...reviewedR10AdditionPaths]).toEqual(["src/data/countries/writerDatePatches.ts","src/data/countries/generated/writerDatePatches.r10.json","src/data/countries/generated/writerDatePatches.r10-supplemental.json","scripts/lib/cover-overlay-publication-guard.mjs","scripts/lib/cover-overlay-publication-guard.test.mjs","scripts/database/build-literary-news-schema-plan.mjs","scripts/database/literary-news-schema-plan.test.mjs","scripts/database/check-literary-news-schema-plan.mjs","scripts/lib/public-work-external-id-fetch.mjs","scripts/lib/public-work-external-id-fetch.test.mjs"]);
  });
  it("preserves the entire previously merged packet when removing only the exact release follow-ups",()=>{
    const coverPaths=["scripts/import-user-supplied-book-covers.mjs","scripts/import-user-supplied-book-covers-2026-08-13.mjs","scripts/import-user-supplied-book-covers-2026-08-20.mjs"];
    const coverAdditions=["scripts/lib/cover-overlay-publication-guard.mjs","scripts/lib/cover-overlay-publication-guard.test.mjs"];
    expect(packet.releaseFollowUp).toEqual({"id":"R10-COVER-PUBLIC-IDENTITY-20260927","baselineMainCommitSha":"361da051a5ea1d72ad3d44d84a7dd4eee3130a1f","scope":"Cover-only importers preserve the exact live public identity set instead of the obsolete static public count; no content, rights, historical manifests or older projection fragments change.","humanReview":false,"releaseAccepted":false,"productionApplied":false});
    const {releaseFollowUp,schemaRehearsalFollowUp,...prior}=beforeBrowserScroll(packet);
    prior.allowedProjectionPaths=prior.allowedProjectionPaths.filter(path=>!coverPaths.includes(path));
    prior.projections=prior.projections.filter(entry=>!coverPaths.includes(entry.path));
    prior.additions=prior.additions.filter(entry=>![...coverAdditions,...["scripts/database/build-literary-news-schema-plan.mjs","scripts/database/literary-news-schema-plan.test.mjs","scripts/database/check-literary-news-schema-plan.mjs"]].includes(entry.path));
    for(const key of ["sourceBaselines","reviewedSources"])prior[key]=Object.fromEntries(Object.entries(prior[key]).filter(([path])=>!coverPaths.includes(path)));
    expect(sha(JSON.stringify(prior))).toBe("e4a632dc6bfe7427d27edb20b5a2ef6bc77f9288be7accf2630e54979ea39ca9");
  });
  it("preserves the cover-only packet when removing only the isolated rehearsal follow-up",()=>{
    const rehearsalPaths=["scripts/database/build-literary-news-schema-plan.mjs","scripts/database/literary-news-schema-plan.test.mjs","scripts/database/check-literary-news-schema-plan.mjs"];
    expect(packet.schemaRehearsalFollowUp).toEqual({"id":"R10-ISOLATED-SCHEMA-REHEARSAL-20260927","baselineMainCommitSha":"361da051a5ea1d72ad3d44d84a7dd4eee3130a1f","scope":"Minimal auth fixtures only in the isolated public-only backup rehearsal. Production migration, apply plan, preflight and verification bytes remain unchanged; no production prerequisite is relaxed.","humanReview":false,"releaseAccepted":false,"productionApplied":false});
    const {schemaRehearsalFollowUp,...prior}=beforeBrowserScroll(packet);
    prior.additions=prior.additions.filter(entry=>!rehearsalPaths.includes(entry.path));
    expect(sha(JSON.stringify(prior))).toBe("514e345dde1cbbd40bb77831071ffc29363da0f3139d2817d65954efdacba438");
  });
  it("preserves the exact cover and schema packet before the single browser scroll follow-up",()=>{
    expect(packet.browserScrollFollowUp).toEqual({"id":"R10-UNOBSTRUCTED-BROWSER-CONTROL-20260927","baselineCommitSha":"1d957d5aa3537b4cf531eb1acbb31b6eaea1392d","scope":"After viewport checks, focus and center the edition control through existing browser/UI behavior, require an unobstructed center, and retain the original normal pointer click and every prior assertion. No production UI, timeout, retry or skip change.","humanReview":false,"releaseAccepted":false,"productionApplied":false});
    expect(sha(JSON.stringify(beforeBrowserScroll(packet)))).toBe("0538ab0ed28af63e9256953b260da6e1f681bcc6d0979d42d0516cbbd51d5b3f");
  });
  it("preserves the complete 6ae packet before the exact CMS external-ID follow-up",()=>{
    expect(packet.cmsExternalIdFollowUp).toEqual({"id":"R10-CMS-EXTERNAL-ID-PRESERVATION-20260927","baselineMainCommitSha":"a9bed03ff55c3b0373507de19a8eb272c74a3d1a","scope":"Preserve actual public CMS external identifiers through parent-scoped exact-count export, premium serialization and typed defensive copies. No provenance, publication, rights, historical source or cover guard is relaxed.","humanReview":false,"releaseAccepted":false,"productionApplied":false});
    expect(sha(JSON.stringify(beforeCmsExternalIds(packet)))).toBe("6ae489dee6f819e24225d6ab15813709701067dee52c3657386bef4dd7ef0c4a");
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
  it("recognizes only exact reviewed additions and rejects every altered byte",()=>{
    for(const addition of packet.additions){const source=read(addition.path);expect(isReviewedR10Addition(addition.path,source)).toBe(true);expect(isReviewedR10Addition(addition.path,source.replaceAll("\n","\r\n"))).toBe(true);expect(isReviewedR10Addition(addition.path,source+"\n")).toBe(false);expect(isReviewedR10Addition(addition.path,source.replace(/\S/u,"?"))).toBe(false);expect(isReviewedR10Addition(addition.path+".unreviewed",source)).toBe(false);}
    expect(projectReviewedR10Delta("src/data/bookArchive.ts","unreviewed content\n")).toBe("unreviewed content\n");
  });
  it("keeps old attestations and projection implementations byte-for-byte unchanged",()=>{
    for(const path of ["scripts/governance/header-library-owner-refinement-20260912.json","scripts/governance/header-showcase-owner-refinement-20260914.json","scripts/governance/book-r49n-package-reviewed-20260912.json","scripts/governance/dependency-security-reviewed-20260912.json","scripts/governance/reading-design-owner-refinement-20260906.json","scripts/lib/reviewed-header-library.mjs","scripts/lib/reviewed-header-showcase.mjs","scripts/lib/reviewed-r49n-package.mjs","scripts/lib/reviewed-dependency-security.mjs","scripts/lib/reviewed-reading-design.mjs"]){expect(read(path)).toBe(historical(path));}
  });
});
