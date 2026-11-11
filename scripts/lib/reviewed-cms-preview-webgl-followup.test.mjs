import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { cmsPreviewWebglFollowupAttestation as packet, cmsPreviewWebglFollowupSha256 as sha,
  projectReviewedCmsPreviewWebglFollowup as project } from './reviewed-cms-preview-webgl-followup.mjs';
import { projectReviewedAdminWorkerCompatibility } from './reviewed-admin-worker-compatibility.mjs';
import { projectReviewedLiveUiFollowup } from './reviewed-live-ui-followup.mjs';

// New approval checks use raw current bytes; projection cannot approve rollback.
const read = path => readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n');
const historical = (path, commit = packet.baselineCommitSha) => execFileSync('git',
  ['-c', `safe.directory=${process.cwd()}`, 'show', `${commit}:${path}`],
  { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');
const failure = 'Missing or duplicate reviewed CMS preview WebGL delta';
const config = 'playwright.config.mjs';
const helper = 'scripts/lib/reviewed-admin-worker-compatibility.mjs';
const integrationTest = 'scripts/lib/reviewed-admin-worker-compatibility.test.mjs';

describe('Exact CMS preview serial WebGL followup preserves historical browser authority', () => {
  it('pins only the two config lines and their exact outer read boundaries', () => {
    expect(sha(JSON.stringify(packet))).toBe('acff5b20da742744660a5cab92204036dc2ce7b02dee66423ab02dc117e38dab');
    expect(packet).toMatchObject({ schemaVersion: 1, id: 'CMS-PREVIEW-WEBGL-FOLLOWUP-20261111',
      baselineCommitSha: '5e086d92680fe15864f379f5fc81b831b9ac6ade',
      historicalPinsChanged: false, historicalAssertionsChanged: false,
      authorization: { userAuthorized: true, packetSpecificHumanApprovalClaim: false,
        humanReview: false, releaseAccepted: false, productionApplied: false },
      scope: { serialWebglClassificationOnly: true, configAddedLines: 2,
        testSpec: 'tests/e2e/cms-direct-edit.spec.mjs', testAssertionsChanged: false,
        testTimeoutsChanged: false, testRetriesChanged: false, testSkipsAdded: false,
        workflowCommandsChanged: false, productionCodeChanged: false,
        existingSerialWebglWorkerLimitChanged: false, outerReadBoundaryOnly: true } });
    expect(packet.allowedProjectionPaths).toEqual([config, helper, integrationTest]);
    expect(Object.keys(packet.sourceBaselines)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.reviewedSources)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.markers)).toEqual(packet.allowedProjectionPaths);
    expect(packet.projections).toHaveLength(3);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(3);
    expect(packet.projections.map(delta => delta.path)).toEqual(packet.allowedProjectionPaths);
    for (const delta of packet.projections) {
      expect(delta.before).not.toBe(''); expect(delta.after).not.toBe(''); expect(delta.before).not.toBe(delta.after);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
    }
  });

  it.each(packet.allowedProjectionPaths)('pins current bytes and restores only the exact predecessor: %s', path => {
    const current = read(path), before = historical(path);
    expect(sha(current)).toBe(packet.reviewedSources[path]); expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(project(path, current)).toBe(before); expect(project(path, before)).toBe(before);
    expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    expect(sha(before)).not.toBe(packet.reviewedSources[path]);
    const outside = '\n/* Unknown appended bytes remain visible to historical locks. */\n';
    expect(project(path, current + outside)).toBe(before + outside);
    expect(project(path, before + outside)).toBe(before + outside);
    expect(sha(project(path, current + outside))).not.toBe(packet.sourceBaselines[path]);
    expect(sha(current + outside)).not.toBe(packet.reviewedSources[path]);
    const delta = packet.projections.find(entry => entry.path === path);
    for (const changed of [current.replace(delta.after, ''), current + delta.after,
      current.replace(delta.after, delta.after.replace(/\S/u, '?')), current.replace(delta.after, delta.before)]) {
      if (packet.markers[path].some(marker => changed.includes(marker.text)))
        expect(() => project(path, changed)).toThrow(failure);
      else {
        expect(project(path, changed)).toBe(changed);
        expect(sha(changed)).not.toBe(packet.reviewedSources[path]);
      }
    }
    for (const marker of packet.markers[path]) {
      expect(current.split(marker.text).length - 1).toBe(marker.count);
      expect(() => project(path, current.replace(marker.text, 'unreviewed partial delta'))).toThrow(failure);
      expect(() => project(path, current + marker.text)).toThrow(failure);
    }
  });

  it('adds exactly one existing CMS spec to the existing lane without changing any other config byte', () => {
    const current = read(config), before = historical(config);
    const addition = '  // The CMS preview opens the real homepage in an iframe, including its globe.\n'
      + '  "**/cms-direct-edit.spec.mjs",\n';
    expect(current.split(addition)).toHaveLength(2); expect(current.replace(addition, '')).toBe(before);
    expect(addition.split('\n').filter(Boolean)).toHaveLength(2);
    for (const changed of [current.replace(addition, '') + addition,
      current.replace(addition, addition.replace('including its globe.', 'without a globe.')),
      current.replace(addition, addition.replace('cms-direct-edit', 'unreviewed-test')),
      current.replace(addition, addition.replace('  "**/cms-direct-edit.spec.mjs",\n', '')),
      current.replace(addition, addition.split('\n').slice(1).join('\n')),
      current + addition]) expect(() => project(config, changed)).toThrow(failure);
    for (const [original, replacement] of [['timeout: 45_000', 'timeout: 450_000'],
      ['retries: process.env.CI ? 1 : 0', 'retries: process.env.CI ? 5 : 0'],
      ['fullyParallel: true', 'fullyParallel: false']]) {
      const changed = current.replace(original, replacement); expect(changed).not.toBe(current);
      expect(project(config, changed)).toBe(before.replace(original, replacement));
      expect(sha(project(config, changed))).not.toBe(packet.sourceBaselines[config]);
    }
  });

  it('restores earlier live UI and browser quality config locks through the complete existing chain', () => {
    const current = read(config), pinned = historical(config, 'cfbd444b279c4aa7a5abe44a661cf16815253b5d');
    expect(projectReviewedAdminWorkerCompatibility(config, current)).toBe(historical(config));
    expect(projectReviewedLiveUiFollowup(config, current)).toBe(pinned);
    expect(projectReviewedLiveUiFollowup(config, current.replaceAll('\n', '\r\n'))).toBe(pinned);
    const outside = '\n/* Unreviewed downstream drift. */\n';
    expect(projectReviewedLiveUiFollowup(config, current + outside)).toBe(pinned + outside);
    expect(sha(pinned + outside)).not.toBe(sha(pinned));
    expect(project(integrationTest, read(integrationTest))).toBe(historical(integrationTest));
    expect(project(integrationTest, read(integrationTest))).toContain(
      "toBe('371c26e0e66b06cef6b7a62ff5692ac4bb91ea32082efde9017f4c0dc2fb3ead')");
  });

  it('pins the new helper and retains every earlier packet and browser assertion byte for byte', () => {
    expect(packet.additions.map(entry => entry.path)).toEqual(['scripts/lib/reviewed-cms-preview-webgl-followup.mjs']);
    for (const entry of packet.additions) expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    expect(packet.foundations).toHaveLength(13);
    for (const entry of packet.foundations) {
      const source = read(entry.path); expect(source).toBe(historical(entry.path));
      expect(sha(source)).toBe(entry.sha256Lf); expect(sha(JSON.stringify(JSON.parse(source)))).toBe(entry.jsonSha256);
      expect(project(entry.path, source)).toBe(source);
    }
    expect(packet.supportingSources.map(entry => entry.path)).toEqual([
      'scripts/lib/quality-browser-matrix.test.mjs', 'scripts/lib/reviewed-live-ui-followup.test.mjs',
      '.github/workflows/quality.yml', '.github/workflows/deploy-pages.yml']);
    for (const entry of packet.supportingSources) {
      expect(read(entry.path)).toBe(historical(entry.path)); expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    }
    for (const path of ['src/App.tsx', 'src/data/bookArchive.ts', 'unknown.json'])
      expect(project(path, 'unreviewed source\r\n')).toBe('unreviewed source\n');
  });
});
