import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { calendarFollowupAttestation as packet, calendarIntegrationAttestation as integration, calendarFollowupSha256 as sha, projectReviewedCalendarFollowup as project, isReviewedCalendarAddition as addition, reviewedCalendarAdditionPaths } from './reviewed-calendar-followup.mjs';
import { r10DeltaAttestation, projectReviewedR10Delta, isReviewedR10Addition } from './reviewed-r10-delta.mjs';
const read=path=>readFileSync(path,'utf8').replace(/\r\n?/gu,'\n');
const historical=(commit,path)=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`${commit}:${path}`],{encoding:'utf8',maxBuffer:20*1024*1024}).replace(/\r\n?/gu,'\n');

describe('User-authorized exact calendar follow-up review',()=>{
  it('pins the bounded packet and retains all explicit non-acceptance flags',()=>{
    expect(sha(JSON.stringify(packet))).toBe('686317fc56832427bf3226d6013bd37c08186164a03ea3f8772a7809f915c2d7');
    expect(packet).toMatchObject({id:'R10-CALENDAR-FOLLOWUP-20260929',baselineCommitSha:'439bb70954d3773279f2d342ba1d2df2b5d17ccf',historicalPinsChanged:false,authorization:{humanReview:false,releaseAccepted:false,productionApplied:false},integration:{applied:true,status:'user-authorized',userAuthorizedAt:'2026-09-29'},calendar:{preservedRussianFields:13,newFields:12,packetFields:25,annualEventsBefore:2314,annualEventsAfter:2339}});
    expect(packet.allowedProjectionPaths).toEqual(['src/data/countries/types.ts','src/data/countries/writerDatePatches.ts','src/components/LiteraryCalendar.tsx']);
    expect([...new Set(packet.projections.map(item=>item.path))]).toEqual(packet.allowedProjectionPaths);
    expect(packet.projections).toHaveLength(8);
    expect(new Set(packet.projections.map(item=>item.id)).size).toBe(packet.projections.length);
  });
  it.each(packet.allowedProjectionPaths)('restores only calendar bytes to the accepted Git HEAD: %s',path=>{
    const current=read(path),before=project(path,current);
    expect(sha(current)).toBe(packet.reviewedSources[path]);
    expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(before).toBe(historical(packet.baselineCommitSha,path));
    expect(project(path,current.replaceAll('\n','\r\n'))).toBe(before);
    expect(project(path,before)).toBe(before);
    const outside='\n/* Unreviewed bytes remain visible to historical locks. */\n';
    expect(project(path,current+outside)).toBe(before+outside);
    expect(sha(project(path,current+outside))).not.toBe(packet.sourceBaselines[path]);
    for(const delta of packet.projections.filter(item=>item.path===path)){
      for(const changed of [current.replace(delta.after,''),current+delta.after,current.replace(delta.after,delta.after.replace(/\S/u,'?'))]){
        expect(()=>project(path,changed)).toThrow('Missing or duplicate R10 delta');
      }
    }
  });
  it('pins every new overlay, adapter and supporting source and rejects altered addition bytes',()=>{
    expect([...reviewedCalendarAdditionPaths]).toEqual(packet.additions.map(item=>item.path));
    for(const entry of packet.additions){
      const source=read(entry.path);
      expect(addition(entry.path,source)).toBe(true);
      expect(addition(entry.path,source.replaceAll('\n','\r\n'))).toBe(true);
      expect(addition(entry.path,source+'\n')).toBe(false);
      expect(addition(entry.path,source.replace(/\S/u,'?'))).toBe(false);
      expect(addition(entry.path+'.unreviewed',source)).toBe(false);
    }
    for(const entry of packet.supportingSources)expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    expect(project('src/data/bookArchive.ts','unreviewed content\n')).toBe('unreviewed content\n');
  });
  it('restores approved integration bytes and retains every historical foundation hash',()=>{
    expect(sha(JSON.stringify(r10DeltaAttestation))).toBe('7f277e58d5e0a46f7bc12a87e606304e63d05cf8a9c48781331d151cbbafef69');
    for(const entry of packet.foundations){
      expect(sha(project(entry.path,read(entry.path)))).toBe(entry.sha256Lf);
      expect(project(entry.path,read(entry.path))).toBe(historical(packet.baselineCommitSha,entry.path));
    }
  });
  it('uses the approved integration with the original acceptance hashes and no mock',()=>{
    const typePath='src/data/countries/types.ts';
    const accepted=project(typePath,read(typePath));
    expect(sha(accepted)).toBe(r10DeltaAttestation.reviewedSources[typePath]);
    expect(projectReviewedR10Delta(typePath,accepted)).toBe(historical(r10DeltaAttestation.baselineSourceCommitSha,typePath));
    const additionPath='src/data/countries/writerDatePatches.ts';
    expect(isReviewedR10Addition(additionPath,read(additionPath))).toBe(true);
    expect(isReviewedR10Addition(additionPath,project(additionPath,read(additionPath)))).toBe(true);
  });
});

describe('Exactly approved governance integration',()=>{
  it('pins the seven fragments and the separate user authorization without granting release acceptance',()=>{
    expect(sha(JSON.stringify(integration))).toBe('b9272ef022902d570715518424c4c29f69bd90e72a51a62164bb251df53b7fe7');
    expect(integration.authorization).toEqual({userAuthorized:true,userAuthorizedAt:'2026-09-29',userInstruction:'Разрешаю применить этот пакет проверки',humanReview:false,releaseAccepted:false,productionApplied:false});
    expect(integration.historicalPinsChanged).toBe(false);
    expect(integration.projections).toHaveLength(7);
    expect(integration.allowedProjectionPaths).toEqual(['scripts/lib/reviewed-r10-delta.mjs','scripts/lib/reviewed-r10-delta.test.mjs','scripts/lib/stage5-content-data-lock.test.mjs']);
  });
  it.each(integration.allowedProjectionPaths)('reverses only the approved read-boundary fragments and retains all unknown bytes: %s',path=>{
    const current=read(path),before=project(path,current);
    expect(sha(current)).toBe(integration.reviewedSources[path]);
    expect(sha(before)).toBe(integration.sourceBaselines[path]);
    expect(before).toBe(historical(integration.baselineCommitSha,path));
    expect(project(path,current.replaceAll('\n','\r\n'))).toBe(before);
    const outside='\n/* Unknown integration drift must remain visible. */\n';
    expect(project(path,current+outside)).toBe(before+outside);
    expect(sha(project(path,current+outside))).not.toBe(integration.sourceBaselines[path]);
    for(const delta of integration.projections.filter(item=>item.path===path))for(const changed of [current.replace(delta.after,''),current+delta.after,current.replace(delta.after,delta.after.replace(/\S/u,'?'))])expect(()=>project(path,changed)).toThrow('Missing or duplicate R10 delta');
  });
});
