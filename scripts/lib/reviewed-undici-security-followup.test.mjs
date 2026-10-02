import {readFileSync} from 'node:fs';
import {projectReviewedNextSecurityFollowup} from './reviewed-next-security-followup.mjs';
import {projectReviewedRussianCalendarExpansion} from './reviewed-russian-calendar-expansion.mjs';
import {projectReviewedR10SourcePunctuation} from './reviewed-r10-source-punctuation.mjs';
import {execFileSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';
import {undiciSecurityFollowupAttestation as packet,undiciSecurityFollowupSha256 as sha,
  projectReviewedUndiciSecurityFollowup as project} from './reviewed-undici-security-followup.mjs';
import {projectReviewedDependencySecurity} from './reviewed-dependency-security.mjs';

const read=path=>projectReviewedR10SourcePunctuation(path,projectReviewedRussianCalendarExpansion(path,projectReviewedNextSecurityFollowup(path,readFileSync(path,'utf8'))));
const historical=path=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`${packet.baselineCommitSha}:${path}`],
  {encoding:'utf8',maxBuffer:20*1024*1024}).replace(/\r\n?/gu,'\n');

describe('Exact production Undici patch and historical read boundaries',()=>{
  it('pins two lock entries, six integration fragments and the actual owner authorization scope',()=>{
    expect(sha(JSON.stringify(packet))).toBe('bdfa16eeae3719d13585559b56f693bd50e44b15cedb84c19b19242456daa997');
    expect(packet.authorization).toMatchObject({packetSpecificHumanApprovalClaim:false,humanReview:false,releaseAccepted:false,productionApplied:false});
    expect(packet.allowedProjectionPaths).toEqual(['package-lock.json','scripts/lib/reviewed-r10-delta.mjs','scripts/lib/reviewed-calendar-followup.test.mjs','scripts/lib/reviewed-r10-delta.test.mjs']);
    expect(packet.projections).toHaveLength(8);
    expect(packet.projections.filter(delta=>delta.path==='package-lock.json')).toHaveLength(2);
    expect(new Set(packet.projections.map(delta=>delta.id)).size).toBe(8);
  });

  it.each(packet.allowedProjectionPaths)('restores exact accepted bytes and rejects missing/changed/duplicate fragments: %s',path=>{
    const source=read(path),before=project(path,source);
    expect(sha(source)).toBe(packet.reviewedSources[path]);
    expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(before).toBe(historical(path));expect(project(path,before)).toBe(before);
    expect(project(path,source.replaceAll('\n','\r\n'))).toBe(before);
    const outside='\n/* Unknown changes remain visible to the historical source hash. */\n';
    expect(project(path,source+outside)).toBe(before+outside);
    expect(sha(before+outside)).not.toBe(packet.sourceBaselines[path]);
    for(const delta of packet.projections.filter(item=>item.path===path))for(const changed of [
      source.replace(delta.after,''),source+delta.after,source.replace(delta.after,delta.after.replace(/\S/u,'?'))
    ])expect(()=>project(path,changed)).toThrow('Missing or duplicate reviewed Undici security delta');
  });

  it('retains every unrelated locked package and preserves the exact Miniflare development pin',()=>{
    const previous=JSON.parse(project('package-lock.json',read('package-lock.json'))),current=JSON.parse(read('package-lock.json'));
    const changed=[...new Set([...Object.keys(previous.packages),...Object.keys(current.packages)])]
      .filter(path=>JSON.stringify(previous.packages[path])!==JSON.stringify(current.packages[path])).sort();
    expect(changed).toEqual(['node_modules/cheerio/node_modules/undici','node_modules/undici']);
    expect(current.packages['node_modules/undici']).toEqual({...previous.packages['node_modules/undici'],dev:true});
    expect(current.packages['node_modules/miniflare'].dependencies.undici).toBe('7.29.0');
    expect(current.packages['node_modules/cheerio/node_modules/undici']).toEqual({version:'7.29.1',
      resolved:'https://registry.npmjs.org/undici/-/undici-7.29.1.tgz',
      integrity:'sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==',
      license:'MIT',engines:{node:'>=20.18.1'}});
    expect({...current,packages:null}).toEqual({...previous,packages:null});
    expect(read('package.json')).toBe(historical('package.json'));
    expect(read('apps/admin/package.json')).toBe(historical('apps/admin/package.json'));
    expect(sha(projectReviewedDependencySecurity('package-lock.json',project('package-lock.json',read('package-lock.json')))))
      .toBe('0d48b76e7291c1d3fa2fdd78185b2fa8dbcd0415a38da376ce6b6c37d7294aa4');
  });

  it('pins the successful audit evidence and leaves the mandatory preflight command unchanged',()=>{
    expect(sha(read(packet.evidence.path))).toBe(packet.evidence.sha256Lf);
    const evidence=JSON.parse(read(packet.evidence.path));
    expect(evidence).toMatchObject({applicationManifestsUnchanged:true,noApplicationOverride:true,lifecycleScriptsExecuted:false,
      nodeModulesCreated:false,offlineRevalidation:{exitCode:0,lockfileByteIdentical:true},
      productionAudit:{command:'npm audit --omit=dev --audit-level=high',before:{exitCode:1},after:{exitCode:0}}});
    expect(evidence.productionAudit.before.result.metadata.vulnerabilities.high).toBe(1);
    expect(evidence.productionAudit.after.result.metadata.vulnerabilities.total).toBe(0);
    const workflow=read('.github/workflows/quality.yml');
    expect(workflow.split('run: npm audit --omit=dev --audit-level=high')).toHaveLength(2);
    expect(workflow.indexOf('run: npm ci')).toBeLessThan(workflow.indexOf('run: npm audit --omit=dev --audit-level=high'));
  });

  it('retains all old attestation hashes, seven calendar integration fragments and non-target bytes',()=>{
    for(const entry of packet.foundations){
      expect(sha(read(entry.path))).toBe(entry.sha256Lf);
      expect(sha(JSON.stringify(JSON.parse(read(entry.path))))).toBe(entry.jsonSha256);
    }
    const integration=JSON.parse(read('scripts/governance/calendar-governance-integration-reviewed-20260929.json'));
    expect(integration.projections).toHaveLength(7);
    expect(sha(JSON.stringify(integration))).toBe('b9272ef022902d570715518424c4c29f69bd90e72a51a62164bb251df53b7fe7');
    for(const entry of [...packet.additions,...packet.supportingSources]){expect(sha(read(entry.path))).toBe(entry.sha256Lf);}
    for(const path of ['src/data/bookArchive.ts','scripts/governance/r10-forward-delta-20260926.json',
      'scripts/lib/reviewed-dependency-security.test.mjs'])expect(project(path,'protected bytes\n')).toBe('protected bytes\n');
  });
});
