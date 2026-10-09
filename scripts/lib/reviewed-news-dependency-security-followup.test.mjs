import { readFileSync } from 'node:fs';
import { projectReviewedPostgresTestImage } from './reviewed-postgres-test-image.mjs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { newsDependencySecurityFollowupAttestation as packet, newsDependencySecurityFollowupSha256 as sha,
  projectReviewedNewsDependencySecurityFollowup as project } from './reviewed-news-dependency-security-followup.mjs';
import { projectReviewedLiveUiFollowup } from './reviewed-live-ui-followup.mjs';
import { projectReviewedNextBuilderFollowup } from './reviewed-next-builder-followup.mjs';

const read = path => projectReviewedPostgresTestImage(path, readFileSync(path, 'utf8'));
const historical = path => execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'show',
  `${packet.baselineCommitSha}:${path}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');
const failure = 'Missing or duplicate reviewed news dependency-security delta';

describe('October 9 security patches preserve every historical dependency lock', () => {
  it('pins only the exact security graph and its outer read integration', () => {
    expect(sha(JSON.stringify(packet))).toBe('262db8c61f772fa04f9ad0e8045109f913d9a599ba29f7a67f847a414e8f64cb');
    expect(packet).toMatchObject({schemaVersion: 1, id: 'NEWS-DEPENDENCY-SECURITY-FOLLOWUP-20261009',
      baselineCommitSha: '7d155f8e32d51c6a3756c104988fda2c4295072d', historicalPinsChanged: false,
      authorization: {userAuthorized: true, humanReview: false, releaseAccepted: false, productionApplied: false},
      auditCommand: 'npm audit --omit=dev --audit-level=high',
      scope: {unrelatedDependenciesChanged: false, historicalAssertionsChanged: false}});
    expect(packet.allowedProjectionPaths).toEqual(['package.json', 'package-lock.json', 'scripts/lib/reviewed-live-ui-followup.mjs']);
    expect(packet.projections).toHaveLength(34);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(34);
    expect([...new Set(packet.projections.map(delta => delta.path))]).toEqual(packet.allowedProjectionPaths);
    for (const delta of packet.projections) {
      expect(delta.before).not.toBe(''); expect(delta.after).not.toBe(''); expect(delta.before).not.toBe(delta.after);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
    }
  });

  it.each(packet.allowedProjectionPaths)('pins raw current bytes and restores only the complete predecessor: %s', path => {
    const current = read(path), before = project(path, current);
    // Read raw files here: reverting a complete file to its predecessor must fail this current-source lock.
    expect(sha(current)).toBe(packet.reviewedSources[path]); expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(before).toBe(historical(path)); expect(sha(before)).not.toBe(packet.reviewedSources[path]);
    expect(project(path, before)).toBe(before); expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    const outside = '\n/* Other changes remain exposed to historical full-file hashes. */\n';
    expect(project(path, current + outside)).toBe(before + outside);
    expect(sha(project(path, current + outside))).not.toBe(packet.sourceBaselines[path]);
    for (const delta of packet.projections.filter(entry => entry.path === path)) {
      for (const changed of [current.replace(delta.after, ''), current + delta.after,
        current.replace(delta.after, delta.after.replace(/\S/u, '?')),
        current.replace(delta.after, delta.before)]) expect(() => project(path, changed)).toThrow(failure);
    }
  });

  it('updates only sharp and the two explicit editor/build overrides', () => {
    const current = JSON.parse(read('package.json')), before = JSON.parse(historical('package.json'));
    expect(current).toEqual({...before, overrides: {...before.overrides, 'prosemirror-view': '1.42.3', 'source-map-js': '1.2.2'},
      devDependencies: {...before.devDependencies, sharp: '0.35.5'}});
    expect(packet.scope).toMatchObject({rootSharp: {before: '0.35.4', after: '0.35.5'},
      prosemirrorView: {before: '1.42.2', after: '1.42.3'}, sourceMapJs: {before: '1.2.1', after: '1.2.2'}});
  });

  it('retains every unrelated dependency, metadata field and development-only sharp copy', () => {
    const current = JSON.parse(read('package-lock.json')), before = JSON.parse(historical('package-lock.json'));
    const changed = [...new Set([...Object.keys(before.packages), ...Object.keys(current.packages)])]
      .filter(path => JSON.stringify(before.packages[path]) !== JSON.stringify(current.packages[path]));
    expect(changed).toEqual(packet.changedPackages); expect(changed).toHaveLength(30);
    expect(changed.every(path => path === '' || /^node_modules\/(?:@img\/sharp[^/]*|sharp|prosemirror-view|source-map-js)$/u.test(path))).toBe(true);
    expect({...current, packages: null}).toEqual({...before, packages: null});
    expect(current.packages[''].devDependencies).toEqual({...before.packages[''].devDependencies, sharp: '0.35.5'});
    expect({...current.packages[''], devDependencies: null}).toEqual({...before.packages[''], devDependencies: null});
    for (const path of changed.filter(path => path !== '')) {
      const entry = current.packages[path];
      const version = path === 'node_modules/prosemirror-view' ? '1.42.3' : path === 'node_modules/source-map-js' ? '1.2.2'
        : path.includes('sharp-libvips-') ? '1.3.4' : '0.35.5';
      expect(entry.version, path).toBe(version);
      expect(entry.resolved, path).toMatch(/^https:\/\/registry\.npmjs\.org\//u); expect(entry.integrity, path).toMatch(/^sha512-/u);
    }
    expect(current.packages['node_modules/miniflare/node_modules/sharp']).toEqual(before.packages['node_modules/miniflare/node_modules/sharp']);
  });

  it('rejects changed tarball URLs/integrities and a partially downgraded dependency family', () => {
    const source = read('package-lock.json');
    for (const delta of packet.projections.filter(entry => entry.path === 'package-lock.json' && entry.after.includes('"integrity"'))) {
      for (const field of ['integrity', 'resolved']) {
        const changed = delta.after.replace(new RegExp(`("${field}": ")[^"]+`, 'u'), '$1unreviewed');
        expect(() => project('package-lock.json', source.replace(delta.after, changed))).toThrow(failure);
      }
    }
    const downgradedSharp = packet.projections.filter(entry => entry.path === 'package-lock.json'
      && entry.after.includes('"node_modules/@img/')).reduce((text, delta) => text.replace(delta.after, delta.before), source);
    expect(() => project('package-lock.json', downgradedSharp)).toThrow(failure);
  });

  it('leaves unrelated dependency drift visible through the complete outer chain', () => {
    const path = 'package.json', before = historical(path), source = read(path);
    const changed = source.replace('"gsap": "^3.13.0"', '"gsap": "999.0.0"');
    expect(changed).not.toBe(source);
    const expected = before.replace('"gsap": "^3.13.0"', '"gsap": "999.0.0"');
    expect(project(path, changed)).toBe(expected);
    expect(projectReviewedLiveUiFollowup(path, changed)).toBe(expected);
    expect(projectReviewedNextBuilderFollowup(path, changed)).toBe(expected);
    expect(sha(projectReviewedNextBuilderFollowup(path, changed))).not.toBe(packet.sourceBaselines[path]);
  });

  it('pins the new helper and keeps previous authority packets and mandatory audit untouched', () => {
    expect(packet.additions).toHaveLength(1);
    expect(packet.additions[0].path).toBe('scripts/lib/reviewed-news-dependency-security-followup.mjs');
    for (const entry of packet.additions) expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    expect(packet.foundations).toHaveLength(9);
    for (const entry of packet.foundations) {
      expect(read(entry.path)).toBe(historical(entry.path)); expect(sha(read(entry.path))).toBe(entry.sha256Lf);
      expect(sha(JSON.stringify(JSON.parse(read(entry.path))))).toBe(entry.jsonSha256);
      expect(project(entry.path, read(entry.path))).toBe(read(entry.path));
    }
    const quality = read('.github/workflows/quality.yml'); expect(quality).toBe(historical('.github/workflows/quality.yml'));
    expect(quality).toContain('run: npm audit --omit=dev --audit-level=high');
    for (const path of ['src/App.tsx', 'src/data/bookArchive.ts', 'scripts/lib/reviewed-dependency-security.test.mjs', 'unknown.json'])
      expect(project(path, 'unreviewed content\r\n')).toBe('unreviewed content\n');
  });
});
