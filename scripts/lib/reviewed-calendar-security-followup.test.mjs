import {readFileSync} from 'node:fs';
import {projectReviewedRussianCalendarExpansion} from './reviewed-russian-calendar-expansion.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {calendarSecurityFollowupAttestation as packet,calendarSecurityFollowupSha256 as sha,
  projectReviewedCalendarSecurityFollowup as project} from './reviewed-calendar-security-followup.mjs';
import {checkedPopularCalendarReviewRow} from '../build-popular-calendar-dates-r10.mjs';
import {checkedScopedCalendarReviewRow} from '../build-scoped-calendar-dates-r10.mjs';
const raw=path=>projectReviewedRussianCalendarExpansion(path,readFileSync(path,'utf8').replace(/\r\n?/gu,'\n'));
const historical=path=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`${packet.baselineCommitSha}:${path}`],
  {encoding:'utf8',maxBuffer:50*1024*1024}).replace(/\r\n?/gu,'\n');

describe('Exact additive calendar CodeQL correction without evidence drift',()=>{
  it('pins only the two structural fixes and six new backward-read fragments',()=>{
    expect(sha(JSON.stringify(packet))).toBe('c86230e284819446e28fd806ed65f9d9a01518db724bfb133c2b76c9c4b7331e');
    expect(packet).toMatchObject({baselineCommitSha:'afb2183c60a318d43ccab8fae2f8d10069f25437',historicalPinsChanged:false,
      calendarDataChanged:false,sourceAuthorityBytesChanged:false,calendarFields:25,
      authorization:{packetSpecificHumanApprovalClaim:false,humanReview:false,releaseAccepted:false,productionApplied:false}});
    expect(packet.allowedProjectionPaths).toEqual(['scripts/build-popular-calendar-dates-r10.mjs',
      'scripts/build-scoped-calendar-dates-r10.mjs','scripts/lib/reviewed-r10-source-punctuation.mjs',
      'scripts/build-calendar-followup-attestation-r10.mjs','scripts/lib/r10-exact-source-punctuation.test.mjs']);
    expect(packet.projections).toHaveLength(14);expect(new Set(packet.projections.map(item=>item.id)).size).toBe(14);
    expect(packet.projections.filter(item=>/^(?:calendar-security-forward|calendar-security-builder|calendar-security-test)-/.test(item.id))).toHaveLength(6);
  });
  it.each(packet.allowedProjectionPaths)('restores exact scoped bytes and rejects missing, duplicate and changed fragments: %s',path=>{
    const current=raw(path),before=project(path,current);
    expect(sha(current)).toBe(packet.reviewedSources[path]);expect(sha(before)).toBe(packet.sourceBaselines[path]);
    if(path!=='scripts/lib/r10-exact-source-punctuation.test.mjs')expect(before).toBe(historical(path));
    else expect(packet.sourceBaselineOrigins[path]).toContain('independently reviewed prototype-safe');
    expect(project(path,before)).toBe(before);expect(project(path,current.replaceAll('\n','\r\n'))).toBe(before);
    const outside='\n/* Unattested security changes remain visible. */\n';
    expect(project(path,current+outside)).toBe(before+outside);expect(sha(before+outside)).not.toBe(packet.sourceBaselines[path]);
    for(const delta of packet.projections.filter(item=>item.path===path))for(const changed of [current.replace(delta.after,''),
      current+delta.after,current.replace(delta.after,delta.after.replace(/\S/u,'?'))])
      expect(()=>project(path,changed)).toThrow('Missing or duplicate reviewed calendar security delta');
  });
  it('retains all prior JSON evidence, all seven human-approved fragments and the new helper bytes',()=>{
    for(const entry of packet.foundations){
      expect(sha(raw(entry.path))).toBe(entry.sha256Lf);
      expect(createHash('sha256').update(readFileSync(entry.path)).digest('hex')).toBe(entry.sha256Raw);
      expect(raw(entry.path)).toBe(historical(entry.path));
    }
    for(const entry of packet.additions)expect(sha(raw(entry.path))).toBe(entry.sha256Lf);
    const old=JSON.parse(raw('scripts/governance/calendar-governance-integration-reviewed-20260929.json'));
    expect(old.projections).toHaveLength(7);expect(old.authorization.userInstruction).toBe('Разрешаю применить этот пакет проверки');
    expect(sha(JSON.stringify(old))).toBe('b9272ef022902d570715518424c4c29f69bd90e72a51a62164bb251df53b7fe7');
    for(const path of ['src/data/bookArchive.ts','scripts/governance/calendar-followup-reviewed-20260929.json',
      'scripts/governance/r10-source-punctuation-followup-20260930.json'])
      expect(project(path,'unknown protected bytes\n')).toBe('unknown protected bytes\n');
  });
  it('accepts every pinned institutional row and rejects lookalike authority hosts or substituted dates',()=>{
    const rows=JSON.parse(raw('reports/r10/calendar/popular-source-review.json')).ready;
    expect(rows).toHaveLength(6);for(const row of rows)expect(checkedPopularCalendarReviewRow(row)).toBe(row);
    const keyes=rows.find(row=>row.writerKey==='usa:daniel_keyes');
    for(const changed of [{...keyes,sourceUrl:'https://wwwxorrt.org/keyes/'},
      {...keyes,sourceUrl:'https://www.orrt.org.attacker.invalid/keyes/'},
      {...keyes,proposedValue:'1927-08-08'},{...keyes,field:'__proto__'}, {...keyes,writerKey:'constructor'}])
      expect(()=>checkedPopularCalendarReviewRow(changed)).toThrow('Unapproved popular calendar');
  });
  it('permits only exact scoped literary identities and two literal own date fields',()=>{
    const rows=JSON.parse(raw('reports/r10/calendar/scoped-source-review.json')).ready;
    expect(rows).toHaveLength(5);for(const row of rows)expect(checkedScopedCalendarReviewRow(row)).toBe(row);
    const original=rows[0];
    for(const changed of [{...original,writerKey:'__proto__'},{...original,writerKey:'constructor'},
      {...original,wikidataId:'Q5'},{...original,sourceUrl:'https://unreviewed.invalid/author'}])
      expect(()=>checkedScopedCalendarReviewRow(changed)).toThrow('Unapproved scoped calendar identity');
    for(const field of ['__proto__','prototype','constructor','name'])
      expect(()=>checkedScopedCalendarReviewRow({...original,fields:[{field}]})).toThrow('Unapproved scoped calendar date field');
    expect(()=>checkedScopedCalendarReviewRow({...original,fields:[original.fields[0],original.fields[0]]}))
      .toThrow('Unapproved scoped calendar date field');
    expect({}.wikidataId).toBeUndefined();
  });
});
