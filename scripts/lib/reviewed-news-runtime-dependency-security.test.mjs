import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { newsRuntimeDependencySecurityAttestation as packet, newsRuntimeDependencySecuritySha256 as sha,
  projectReviewedNewsRuntimeDependencySecurity as project } from './reviewed-news-runtime-dependency-security.mjs';
import { projectReviewedNewsDependencySecurityFollowup } from './reviewed-news-dependency-security-followup.mjs';
import { projectReviewedNextBuilderFollowup } from './reviewed-next-builder-followup.mjs';

// These reads are deliberately raw: no adapter may conceal rollback or drift.
const read = path => readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n');
const historical = (path, commit = packet.baselineCommitSha) => execFileSync('git',
  ['-c', `safe.directory=${process.cwd()}`, 'show', `${commit}:${path}`],
  { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');
const failure = 'Missing or duplicate reviewed news runtime dependency-security delta';
const helper = 'scripts/lib/reviewed-postgres-test-image.mjs';

describe('October 25 runtime security updates retain all historical authority', () => {
  it('pins the exact graph and outer integration without altering prior assertions or audit', () => {
    expect(sha(JSON.stringify(packet))).toBe('3adc05cdd427637af55adf3c1fa4c0c13d828e345eabf54ecdb483408b95ff0c');
    expect(packet).toMatchObject({ schemaVersion: 1, id: 'NEWS-RUNTIME-DEPENDENCY-SECURITY-20261025',
      baselineCommitSha: '7fc141d0600def29625adc4227f13143292312f5',
      historicalPinsChanged: false, historicalAssertionsChanged: false,
      authorization: { userAuthorized: true, packetSpecificHumanApprovalClaim: false,
        humanReview: false, releaseAccepted: false, productionApplied: false },
      auditCommand: 'npm audit --omit=dev --audit-level=high',
      scope: { unrelatedDependenciesChanged: false, mandatoryAuditChanged: false,
        existingTestCommandsChanged: false, productionDatabaseAccessAdded: false } });
    expect(packet.allowedProjectionPaths).toEqual(["package.json","apps/admin/package.json","package-lock.json","scripts/lib/reviewed-postgres-test-image.mjs"]);
    expect(Object.keys(packet.sourceBaselines)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.reviewedSources)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.markers)).toEqual(packet.allowedProjectionPaths);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(packet.projections.length);
    expect([...new Set(packet.projections.map(delta => delta.path))]).toEqual(packet.allowedProjectionPaths);
    for (const delta of packet.projections) {
      expect(delta.before).not.toBe(''); expect(delta.after).not.toBe(''); expect(delta.before).not.toBe(delta.after);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
    }
  });

  it.each(packet.allowedProjectionPaths)('pins raw current bytes and restores exact Git baseline: %s', path => {
    const current = read(path), before = historical(path);
    expect(sha(current)).toBe(packet.reviewedSources[path]); expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(project(path, current)).toBe(before); expect(project(path, before)).toBe(before);
    expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    expect(sha(before)).not.toBe(packet.reviewedSources[path]);
    const outside = '\n/* Unknown drift remains visible to every earlier full-file lock. */\n';
    expect(project(path, current + outside)).toBe(before + outside);
    expect(sha(project(path, current + outside))).not.toBe(packet.sourceBaselines[path]);
    // A marker-free rollback or unknown file is identity, never current approval.
    expect(project(path, before + outside)).toBe(before + outside);
    expect(sha(before + outside)).not.toBe(packet.reviewedSources[path]);
    expect(sha(before + outside)).not.toBe(packet.sourceBaselines[path]);
    expect(project(path, 'unreviewed source\r\n')).toBe('unreviewed source\n');
    expect(sha('unreviewed source\n')).not.toBe(packet.reviewedSources[path]);
    for (const delta of packet.projections.filter(entry => entry.path === path)) {
      for (const changed of [current.replace(delta.after, ''), current + delta.after,
        current.replace(delta.after, delta.after.replace(/\S/u, '?')),
        current.replace(delta.after, delta.before)]) {
        if (packet.markers[path].some(marker => changed.includes(marker.text)))
          expect(() => project(path, changed)).toThrow(failure);
        else {
          expect(project(path, changed)).toBe(changed);
          expect(sha(changed)).not.toBe(packet.reviewedSources[path]);
        }
      }
    }
  });

  it('changes only the reviewed application versions and their exact lock graph', () => {
    const currentManifest = JSON.parse(read('apps/admin/package.json'));
    const previousManifest = JSON.parse(historical('apps/admin/package.json'));
    expect(currentManifest).toEqual({ ...previousManifest, dependencies: {
      ...previousManifest.dependencies, "next": "16.4.3", "sanitize-html": "2.18.1", "zod": "4.6.6" } });
    const current = JSON.parse(read('package-lock.json')), before = JSON.parse(historical('package-lock.json'));
    const changed = [...new Set([...Object.keys(before.packages), ...Object.keys(current.packages)])]
      .filter(path => JSON.stringify(before.packages[path]) !== JSON.stringify(current.packages[path]));
    expect(changed).toEqual(["apps/admin","node_modules/@next/env","node_modules/@next/swc-darwin-arm64","node_modules/@next/swc-darwin-x64","node_modules/@next/swc-linux-arm64-gnu","node_modules/@next/swc-linux-arm64-musl","node_modules/@next/swc-linux-x64-gnu","node_modules/@next/swc-linux-x64-musl","node_modules/@next/swc-win32-arm64-msvc","node_modules/@next/swc-win32-x64-msvc","node_modules/cheerio/node_modules/undici","node_modules/dayjs","node_modules/deepmerge","node_modules/is-plain-object","node_modules/launder","node_modules/nanoid","node_modules/next","node_modules/sanitize-html","node_modules/zod","node_modules/sanitize-html/node_modules/postcss"]); expect(changed).toEqual(packet.changedPackages);
    expect({ ...current, packages: null }).toEqual({ ...before, packages: null });
    expect(current.packages['apps/admin']).toEqual({ ...before.packages['apps/admin'],
      dependencies: { ...before.packages['apps/admin'].dependencies, "next": "16.4.3", "sanitize-html": "2.18.1", "zod": "4.6.6" } });
    for (const [path, version] of Object.entries({"node_modules/@next/env":"16.4.3","node_modules/@next/swc-darwin-arm64":"16.4.3","node_modules/@next/swc-darwin-x64":"16.4.3","node_modules/@next/swc-linux-arm64-gnu":"16.4.3","node_modules/@next/swc-linux-arm64-musl":"16.4.3","node_modules/@next/swc-linux-x64-gnu":"16.4.3","node_modules/@next/swc-linux-x64-musl":"16.4.3","node_modules/@next/swc-win32-arm64-msvc":"16.4.3","node_modules/@next/swc-win32-x64-msvc":"16.4.3","node_modules/cheerio/node_modules/undici":"7.30.1","node_modules/dayjs":"1.11.23","node_modules/is-plain-object":"5.1.0","node_modules/launder":"1.7.2","node_modules/nanoid":"3.3.20","node_modules/next":"16.4.3","node_modules/sanitize-html":"2.18.1","node_modules/zod":"4.6.6","node_modules/sanitize-html/node_modules/postcss":"8.5.31"})) {
      expect(current.packages[path].version, path).toBe(version);
      expect(current.packages[path].resolved, path).toMatch(/^https:\/\/registry\.npmjs\.org\//u);
      expect(current.packages[path].integrity, path).toMatch(/^sha512-/u);
    }
    expect(current.packages['node_modules/undici']).toEqual(before.packages['node_modules/undici']);
    expect(current.packages['node_modules/miniflare']).toEqual(before.packages['node_modules/miniflare']);
    const currentRoot = JSON.parse(read('package.json')), previousRoot = JSON.parse(historical('package.json'));
    expect(currentRoot).toEqual({ ...previousRoot, overrides: { ...previousRoot.overrides,
      cheerio: { undici: '7.30.1' }, 'sanitize-html': { postcss: '8.5.31' } } });
  });

  it('rejects modified tarball provenance and any partially reverted security family', () => {
    const path = 'package-lock.json', current = read(path);
    for (const delta of packet.projections.filter(entry => entry.path === path && entry.after.includes('"integrity"'))) {
      for (const field of ['integrity', 'resolved']) {
        const changed = delta.after.replace(new RegExp(`("${field}": ")[^"]+`, 'u'), '$1unreviewed');
        expect(changed).not.toBe(delta.after);
        expect(() => project(path, current.replace(delta.after, changed))).toThrow(failure);
      }
    }
    const next = packet.projections.filter(entry => entry.path === path && /"(?:node_modules\/@next\/|node_modules\/next")/u.test(entry.after));
    expect(next.length).toBeGreaterThan(1);
    const reverted = next.reduce((source, delta) => source.replace(delta.after, delta.before), current);
    expect(() => project(path, reverted)).toThrow(failure);
  });

  it('keeps unrelated dependency drift visible through every older adapter', () => {
    const path = 'apps/admin/package.json', source = read(path), changed = source.replace('"react": "^18.3.1"', '"react": "999.0.0"');
    expect(changed).not.toBe(source);
    for (const adapter of [project, projectReviewedNewsDependencySecurityFollowup, projectReviewedNextBuilderFollowup]) {
      const expected = adapter(path, source).replace('"react": "^18.3.1"', '"react": "999.0.0"');
      expect(adapter(path, changed)).toBe(expected);
      expect(sha(adapter(path, changed))).not.toBe(sha(adapter(path, source)));
    }
    for (const foundation of packet.foundations) {
      const prior = JSON.parse(read(foundation.path));
      if (!prior.baselineCommitSha) continue;
      for (const path of ['apps/admin/package.json', 'package-lock.json']) {
        const before = historical(path, prior.baselineCommitSha), suffix = '\n/* Older unrelated drift. */\n';
        expect(project(path, before + suffix)).toBe(before + suffix);
      }
    }
  });

  it('restores every prior PostgreSQL test assertion after reversing only its read boundary', () => {
    expect(packet.testReadBoundaries).toHaveLength(1);
    const integration = packet.testReadBoundaries[0];
    expect(integration.path).toBe('scripts/lib/reviewed-postgres-test-image.test.mjs');
    expect(integration.deltas).toHaveLength(2);
    let previous = read(integration.path);
    expect(sha(previous)).toBe(integration.reviewedSource);
    for (const delta of integration.deltas) {
      expect(delta.path).toBe(integration.path); expect(previous.split(delta.after)).toHaveLength(2);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
      previous = previous.replace(delta.after, delta.before);
    }
    expect(previous).toBe(historical(integration.path)); expect(sha(previous)).toBe(integration.sourceBaseline);
    expect(previous).toContain("toBe('9d211f7b8e11c9e61e0bd41081ba8bbeb52e8d8dc672a70cfaf172e7495a9684')");
    const source = read(helper);
    for (const delta of packet.projections.filter(entry => entry.path === helper))
      expect(() => project(helper, source.replace(delta.after, delta.before))).toThrow(failure);
  });

  it('pins the new helper and leaves all prior packets and required audit unchanged', () => {
    expect(packet.additions.map(entry => entry.path)).toEqual(['scripts/lib/reviewed-news-runtime-dependency-security.mjs']);
    for (const entry of packet.additions) expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    expect(packet.foundations).toHaveLength(11);
    for (const entry of packet.foundations) {
      const source = read(entry.path); expect(source).toBe(historical(entry.path));
      expect(sha(source)).toBe(entry.sha256Lf); expect(sha(JSON.stringify(JSON.parse(source)))).toBe(entry.jsonSha256);
      expect(project(entry.path, source)).toBe(source);
    }
    for (const path of ['.github/workflows/quality.yml', '.github/workflows/deploy-pages.yml'])
      expect(read(path)).toBe(historical(path));
    expect(read('.github/workflows/quality.yml').split('run: npm audit --omit=dev --audit-level=high')).toHaveLength(2);
    for (const path of ['src/App.tsx', 'src/data/bookArchive.ts', 'scripts/lib/reviewed-dependency-security.test.mjs', 'unknown.json'])
      expect(project(path, 'unreviewed content\r\n')).toBe('unreviewed content\n');
  });
});
