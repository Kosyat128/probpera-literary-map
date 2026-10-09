import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { postgresTestImageAttestation as packet, postgresTestImageSha256 as sha,
  projectReviewedPostgresTestImage as project } from './reviewed-postgres-test-image.mjs';
import { projectReviewedNewsDependencySecurityFollowup } from './reviewed-news-dependency-security-followup.mjs';
import { projectReviewedNextBuilderFollowup } from './reviewed-next-builder-followup.mjs';

// Current source is read directly here; no projection may conceal a rollback
// or an unreviewed expansion of the newly permitted workflow/helper changes.
const read = path => readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n');
const historical = path => execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'show',
  `${packet.baselineCommitSha}:${path}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');
const failure = 'Missing or duplicate reviewed PostgreSQL test-image delta';
const workflows = ['.github/workflows/quality.yml', '.github/workflows/deploy-pages.yml'];
const helper = 'scripts/lib/reviewed-news-dependency-security-followup.mjs';
const currentWorkflowTest = 'scripts/lib/quality-browser-matrix.test.mjs';

describe('Exact PostgreSQL image bootstrap preserves historical CI authority', () => {
  it('pins only the two additive steps and the outer reader integration', () => {
    expect(sha(JSON.stringify(packet))).toBe('dc9cdd5a67ad062f68a22ae3deaf70c5c642b2bee3316eb4d9340eb61304f173');
    expect(packet).toMatchObject({schemaVersion: 1, id: 'POSTGRES-TEST-IMAGE-RESILIENCE-20261010',
      baselineCommitSha: 'e2a712a4707fcf70c7561691c89c5c2bb512113e', historicalPinsChanged: false,
      historicalAssertionsChanged: false,
      authorization: {userAuthorized: true, humanReview: false, releaseAccepted: false, productionApplied: false},
      scope: {workflowBootstrapOnly: true, postgresMajor: 17, sqlFixturesChanged: false,
        migrationFilesChanged: false, mandatoryAuditChanged: false, existingTestCommandsChanged: false,
        productionDatabaseAccessAdded: false, currentBootstrapAssertionsAdded: true,
        currentPreflightStepCountDelta: 1}});
    expect(packet.allowedProjectionPaths).toEqual([...workflows, helper, currentWorkflowTest]);
    expect(Object.keys(packet.sourceBaselines)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.reviewedSources)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.markers)).toEqual(packet.allowedProjectionPaths);
    expect(packet.projections).toHaveLength(5);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(5);
    expect(packet.testReadBoundaries.map(entry => entry.path)).toEqual([
      'scripts/lib/reviewed-news-dependency-security-followup.test.mjs',
      'scripts/lib/reviewed-live-ui-followup.test.mjs',
    ]);
    expect([...new Set(packet.projections.map(delta => delta.path))]).toEqual(packet.allowedProjectionPaths);
    for (const delta of packet.projections) {
      expect(delta.before).not.toBe(''); expect(delta.after).not.toBe(''); expect(delta.before).not.toBe(delta.after);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
    }
  });

  it.each(packet.allowedProjectionPaths)('pins current bytes and restores exact Git predecessor bytes: %s', path => {
    const current = read(path), before = project(path, current);
    expect(sha(current)).toBe(packet.reviewedSources[path]);
    expect(sha(before)).toBe(packet.sourceBaselines[path]); expect(before).toBe(historical(path));
    expect(project(path, before)).toBe(before); expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    // Idempotent historical input is not approval to remove the new delta.
    // Its current-source hash remains different and cannot satisfy this lock.
    expect(sha(before)).not.toBe(packet.reviewedSources[path]);
    const outside = '\n# Unreviewed changes must remain visible to prior full-file locks.\n';
    expect(project(path, current + outside)).toBe(before + outside);
    expect(sha(project(path, current + outside))).not.toBe(packet.sourceBaselines[path]);
    for (const delta of packet.projections.filter(entry => entry.path === path)) {
      for (const changed of [current.replace(delta.after, ''), current + delta.after,
        current.replace(delta.after, delta.after.replace(/\S/u, '?'))])
        expect(() => project(path, changed)).toThrow(failure);
    }
  });

  it.each(workflows)('rejects edited, moved, duplicated and weakened bootstrap steps: %s', path => {
    const source = read(path), delta = packet.projections.find(entry => entry.path === path);
    const step = delta.after.slice(0, -delta.before.length);
    expect(step).toContain('        timeout-minutes: 5\n');
    expect(step).toContain('        run: node scripts/database/prepare-postgres-test-image.mjs\n');
    const variants = [
      source.replace(step, step.replace('timeout-minutes: 5', 'timeout-minutes: 30')),
      source.replace(step, step.replace('prepare-postgres-test-image.mjs', 'unreviewed-image.mjs')),
      source.replace(step, step.replace('        run:', '        continue-on-error: true\n        run:')),
      source.replace(step, step.replace('        run:', '        env:\n          SKIP_DATABASE_TESTS: true\n        run:')),
      source + step,
      source + step.replace('Prepare PostgreSQL integration test image', 'Another PostgreSQL image'),
      source + step.replace('prepare-postgres-test-image.mjs', 'another-image.mjs'),
      source.replace(step, '') + step,
    ];
    if (path.endsWith('deploy-pages.yml')) variants.push(
      source.replace(step, step.replace(/        if: [^\n]+\n/u, '        if: always()\n')),
      source.replace(step, step.replace(/        if: [^\n]+\n/u, '')),
    );
    else variants.push(source.replace(step, step.replace('        timeout-minutes:', '        if: false\n        timeout-minutes:')));
    for (const changed of variants) expect(() => project(path, changed)).toThrow(failure);
  });

  it('rejects partially downgraded outer integration and preserves unrelated workflow bytes through older adapters', () => {
    const source = read(helper);
    for (const delta of packet.projections.filter(entry => entry.path === helper))
      expect(() => project(helper, source.replace(delta.after, delta.before))).toThrow(failure);
    for (const path of workflows) {
      const suffix = '\n# Unreviewed workflow alteration\n';
      const current = read(path), expected = historical(path) + suffix;
      expect(projectReviewedNewsDependencySecurityFollowup(path, current + suffix)).toBe(expected);
      expect(projectReviewedNextBuilderFollowup(path, current + suffix)).toBe(expected);
      expect(sha(expected)).not.toBe(packet.sourceBaselines[path]);
    }
  });

  it.each(packet.testReadBoundaries)('retains every prior assertion byte for byte behind the exact read boundary: $path', integration => {
    expect(integration.deltas).toHaveLength(2);
    const current = read(integration.path); expect(sha(current)).toBe(integration.reviewedSource);
    let previous = current;
    for (const delta of integration.deltas) {
      expect(delta.path).toBe(integration.path); expect(previous.split(delta.after)).toHaveLength(2);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
      previous = previous.replace(delta.after, delta.before);
    }
    expect(sha(previous)).toBe(integration.sourceBaseline); expect(previous).toBe(historical(integration.path));
  });

  it('pins the new implementation and leaves all earlier authority packets unchanged', () => {
    expect(packet.additions.map(entry => entry.path)).toEqual([
      'scripts/database/prepare-postgres-test-image.mjs',
      'scripts/database/prepare-postgres-test-image.test.mjs',
      'scripts/lib/reviewed-postgres-test-image.mjs',
    ]);
    for (const entry of packet.additions) expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    expect(packet.foundations).toHaveLength(10);
    for (const entry of packet.foundations) {
      const source = read(entry.path); expect(source).toBe(historical(entry.path));
      expect(sha(source)).toBe(entry.sha256Lf); expect(sha(JSON.stringify(JSON.parse(source)))).toBe(entry.jsonSha256);
      expect(project(entry.path, source)).toBe(source);
    }
    for (const path of ['package.json', 'package-lock.json', 'src/App.tsx', 'src/data/bookArchive.ts',
      'scripts/database/production-migration-plan.test.mjs', 'supabase/migrations/unreviewed.sql', 'unknown.yml']) {
      expect(project(path, 'unreviewed source\n')).toBe('unreviewed source\n');
    }
  });
});
