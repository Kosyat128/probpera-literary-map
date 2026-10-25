import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { adminWorkerCompatibilityAttestation as packet, adminWorkerCompatibilitySha256 as sha,
  projectReviewedAdminWorkerCompatibility as project } from './reviewed-admin-worker-compatibility.mjs';
import { projectReviewedNewsRuntimeDependencySecurity } from './reviewed-news-runtime-dependency-security.mjs';
import { projectReviewedNextBuilderFollowup } from './reviewed-next-builder-followup.mjs';

// Raw current reads independently reject rollback, missing gates and hidden drift.
const read = path => readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n');
const historical = (path, commit = packet.baselineCommitSha) => execFileSync('git',
  ['-c', `safe.directory=${process.cwd()}`, 'show', `${commit}:${path}`],
  { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');
const failure = 'Missing or duplicate reviewed admin worker compatibility delta';
const workflow = '.github/workflows/deploy-admin.yml';
const helper = 'scripts/lib/reviewed-news-runtime-dependency-security.mjs';

describe('Supported admin Worker runtime retains all previous release authority', () => {
  it('pins the supported adapter graph and a mandatory predeploy workerd gate', () => {
    expect(sha(JSON.stringify(packet))).toBe('371c26e0e66b06cef6b7a62ff5692ac4bb91ea32082efde9017f4c0dc2fb3ead');
    expect(packet).toMatchObject({ schemaVersion: 1, id: 'ADMIN-WORKER-COMPATIBILITY-20261025',
      baselineCommitSha: '21789b646ecfa35b5e6e05eafb42badf6b419c8a',
      historicalPinsChanged: false, historicalAssertionsChanged: false,
      authorization: { userAuthorized: true, packetSpecificHumanApprovalClaim: false,
        humanReview: false, releaseAccepted: false, productionApplied: false },
      scope: { adapter: '1.20.13', wrangler: '4.152.0', next: '16.4.3',
        existingSecurityFixesRetained: true, mandatoryAuditChanged: false,
        actualWorkerdGateAdded: true, productionDatabaseAccessAdded: false } });
    expect(packet.allowedProjectionPaths).toEqual(["package.json","apps/admin/package.json","package-lock.json",".github/workflows/deploy-admin.yml","scripts/lib/reviewed-news-runtime-dependency-security.mjs"]);
    expect(Object.keys(packet.sourceBaselines)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.reviewedSources)).toEqual(packet.allowedProjectionPaths);
    expect(Object.keys(packet.markers)).toEqual(packet.allowedProjectionPaths);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(packet.projections.length);
    expect([...new Set(packet.projections.map(delta => delta.path))]).toEqual(packet.allowedProjectionPaths);
    expect(packet.sources).toContain('https://github.com/opennextjs/opennextjs-cloudflare/pull/1356');
    for (const delta of packet.projections) {
      expect(delta.before).not.toBe(''); expect(delta.after).not.toBe(''); expect(delta.before).not.toBe(delta.after);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
    }
  });

  it.each(packet.allowedProjectionPaths)('pins raw current source and restores exact Git217 predecessor: %s', path => {
    const current = read(path), before = historical(path);
    expect(sha(current)).toBe(packet.reviewedSources[path]); expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(project(path, current)).toBe(before); expect(project(path, before)).toBe(before);
    expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    expect(sha(before)).not.toBe(packet.reviewedSources[path]);
    const drift = '\n/* Unreviewed bytes remain exposed to historical locks. */\n';
    expect(project(path, current + drift)).toBe(before + drift);
    expect(project(path, before + drift)).toBe(before + drift);
    expect(sha(before + drift)).not.toBe(packet.sourceBaselines[path]);
    expect(sha(before + drift)).not.toBe(packet.reviewedSources[path]);
    expect(project(path, 'unknown source\r\n')).toBe('unknown source\n');
    for (const delta of packet.projections.filter(entry => entry.path === path)) {
      for (const changed of [current.replace(delta.after, ''), current + delta.after,
        current.replace(delta.after, delta.after.replace(/\S/u, '?')), current.replace(delta.after, delta.before)]) {
        if (packet.markers[path].some(marker => changed.includes(marker.text)))
          expect(() => project(path, changed)).toThrow(failure);
        else {
          expect(project(path, changed)).toBe(changed);
          expect(sha(changed)).not.toBe(packet.reviewedSources[path]);
        }
      }
    }
  });

  it('retains all production security fixes and only changes the reviewed adapter dependency graph', () => {
    const currentApp = JSON.parse(read('apps/admin/package.json')), oldApp = JSON.parse(historical('apps/admin/package.json'));
    expect(currentApp).toEqual({ ...oldApp, devDependencies: { ...oldApp.devDependencies,
      '@opennextjs/cloudflare': '1.20.13', wrangler: '4.152.0' } });
    expect(currentApp.dependencies).toEqual(oldApp.dependencies);
    expect(currentApp.dependencies).toMatchObject({ next: '16.4.3', zod: '4.6.6', 'sanitize-html': '2.18.1' });
    const currentRoot = JSON.parse(read('package.json')), oldRoot = JSON.parse(historical('package.json'));
    expect(currentRoot).toEqual({ ...oldRoot, allowScripts: { ...oldRoot.allowScripts,
      'workerd@1.20261019.1': true } });
    const current = JSON.parse(read('package-lock.json')), before = JSON.parse(historical('package-lock.json'));
    const changed = [...new Set([...Object.keys(before.packages), ...Object.keys(current.packages)])]
      .filter(path => JSON.stringify(before.packages[path]) !== JSON.stringify(current.packages[path]));
    expect(changed).toEqual(["apps/admin","node_modules/@ast-grep/napi","node_modules/@ast-grep/napi-darwin-arm64","node_modules/@ast-grep/napi-darwin-x64","node_modules/@ast-grep/napi-linux-arm64-gnu","node_modules/@ast-grep/napi-linux-arm64-musl","node_modules/@ast-grep/napi-linux-x64-gnu","node_modules/@ast-grep/napi-linux-x64-musl","node_modules/@ast-grep/napi-win32-arm64-msvc","node_modules/@ast-grep/napi-win32-ia32-msvc","node_modules/@ast-grep/napi-win32-x64-msvc","node_modules/@cloudflare/unenv-preset","node_modules/@cloudflare/workerd-darwin-64","node_modules/@cloudflare/workerd-darwin-arm64","node_modules/@cloudflare/workerd-linux-64","node_modules/@cloudflare/workerd-linux-arm64","node_modules/@cloudflare/workerd-windows-64","node_modules/@cloudflare/workers-types","node_modules/@dotenvx/dotenvx","node_modules/@dotenvx/dotenvx/node_modules/isexe","node_modules/@dotenvx/dotenvx/node_modules/which","node_modules/@ecies/ciphers","node_modules/@isaacs/cliui","node_modules/@noble/ciphers","node_modules/@noble/curves","node_modules/@noble/hashes","node_modules/@node-minify/core","node_modules/@node-minify/core/node_modules/brace-expansion","node_modules/@node-minify/core/node_modules/glob","node_modules/@node-minify/core/node_modules/minimatch","node_modules/@node-minify/core/node_modules/minipass","node_modules/@node-minify/core/node_modules/path-scurry/node_modules/minipass","node_modules/@node-minify/terser","node_modules/@node-minify/utils","node_modules/@opennextjs/aws","node_modules/@opennextjs/aws/node_modules/@esbuild/aix-ppc64","node_modules/@opennextjs/aws/node_modules/@esbuild/android-arm","node_modules/@opennextjs/aws/node_modules/@esbuild/android-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/android-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/darwin-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/darwin-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/freebsd-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/freebsd-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-arm","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-ia32","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-loong64","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-mips64el","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-ppc64","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-riscv64","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-s390x","node_modules/@opennextjs/aws/node_modules/@esbuild/linux-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/netbsd-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/netbsd-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/openbsd-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/openbsd-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/sunos-x64","node_modules/@opennextjs/aws/node_modules/@esbuild/win32-arm64","node_modules/@opennextjs/aws/node_modules/@esbuild/win32-ia32","node_modules/@opennextjs/aws/node_modules/@esbuild/win32-x64","node_modules/@opennextjs/aws/node_modules/esbuild","node_modules/@opennextjs/cloudflare","node_modules/@tsconfig/node18","node_modules/body-parser","node_modules/body-parser/node_modules/content-type","node_modules/brace-expansion","node_modules/cliui/node_modules/ansi-regex","node_modules/commander","node_modules/content-disposition","node_modules/content-type","node_modules/dotenv","node_modules/eciesjs","node_modules/emoji-regex","node_modules/execa","node_modules/express","node_modules/foreground-child/node_modules/signal-exit","node_modules/fs.realpath","node_modules/get-east-asian-width","node_modules/get-stream","node_modules/glob","node_modules/human-signals","node_modules/ignore","node_modules/is-stream","node_modules/jackspeak","node_modules/merge-stream","node_modules/mimic-fn","node_modules/miniflare","node_modules/miniflare/node_modules/@img/sharp-darwin-arm64","node_modules/miniflare/node_modules/@img/sharp-darwin-x64","node_modules/miniflare/node_modules/@img/sharp-freebsd-wasm32","node_modules/miniflare/node_modules/@img/sharp-libvips-darwin-arm64","node_modules/miniflare/node_modules/@img/sharp-libvips-darwin-x64","node_modules/miniflare/node_modules/@img/sharp-libvips-linux-arm","node_modules/miniflare/node_modules/@img/sharp-libvips-linux-arm64","node_modules/miniflare/node_modules/@img/sharp-libvips-linux-ppc64","node_modules/miniflare/node_modules/@img/sharp-libvips-linux-riscv64","node_modules/miniflare/node_modules/@img/sharp-libvips-linux-s390x","node_modules/miniflare/node_modules/@img/sharp-libvips-linux-x64","node_modules/miniflare/node_modules/@img/sharp-libvips-linuxmusl-arm64","node_modules/miniflare/node_modules/@img/sharp-libvips-linuxmusl-x64","node_modules/miniflare/node_modules/@img/sharp-linux-arm","node_modules/miniflare/node_modules/@img/sharp-linux-arm64","node_modules/miniflare/node_modules/@img/sharp-linux-ppc64","node_modules/miniflare/node_modules/@img/sharp-linux-riscv64","node_modules/miniflare/node_modules/@img/sharp-linux-s390x","node_modules/miniflare/node_modules/@img/sharp-linux-x64","node_modules/miniflare/node_modules/@img/sharp-linuxmusl-arm64","node_modules/miniflare/node_modules/@img/sharp-linuxmusl-x64","node_modules/miniflare/node_modules/@img/sharp-wasm32","node_modules/miniflare/node_modules/@img/sharp-webcontainers-wasm32","node_modules/miniflare/node_modules/@img/sharp-win32-arm64","node_modules/miniflare/node_modules/@img/sharp-win32-ia32","node_modules/miniflare/node_modules/@img/sharp-win32-x64","node_modules/miniflare/node_modules/semver","node_modules/miniflare/node_modules/sharp","node_modules/mkdirp","node_modules/negotiator","node_modules/npm-run-path","node_modules/object-treeify","node_modules/on-finished","node_modules/onetime","node_modules/package-json-from-dist","node_modules/path-scurry/node_modules/lru-cache","node_modules/proxy-addr","node_modules/qs","node_modules/signal-exit","node_modules/string-width","node_modules/string-width/node_modules/ansi-regex","node_modules/strip-final-newline","node_modules/terser","node_modules/type-is/node_modules/content-type","node_modules/undici","node_modules/workerd","node_modules/wrangler","node_modules/wrangler/node_modules/@esbuild/aix-ppc64","node_modules/wrangler/node_modules/@esbuild/android-arm","node_modules/wrangler/node_modules/@esbuild/android-arm64","node_modules/wrangler/node_modules/@esbuild/android-x64","node_modules/wrangler/node_modules/@esbuild/darwin-arm64","node_modules/wrangler/node_modules/@esbuild/darwin-x64","node_modules/wrangler/node_modules/@esbuild/freebsd-arm64","node_modules/wrangler/node_modules/@esbuild/freebsd-x64","node_modules/wrangler/node_modules/@esbuild/linux-arm","node_modules/wrangler/node_modules/@esbuild/linux-arm64","node_modules/wrangler/node_modules/@esbuild/linux-ia32","node_modules/wrangler/node_modules/@esbuild/linux-loong64","node_modules/wrangler/node_modules/@esbuild/linux-mips64el","node_modules/wrangler/node_modules/@esbuild/linux-ppc64","node_modules/wrangler/node_modules/@esbuild/linux-riscv64","node_modules/wrangler/node_modules/@esbuild/linux-s390x","node_modules/wrangler/node_modules/@esbuild/linux-x64","node_modules/wrangler/node_modules/@esbuild/netbsd-arm64","node_modules/wrangler/node_modules/@esbuild/netbsd-x64","node_modules/wrangler/node_modules/@esbuild/openbsd-arm64","node_modules/wrangler/node_modules/@esbuild/openbsd-x64","node_modules/wrangler/node_modules/@esbuild/openharmony-arm64","node_modules/wrangler/node_modules/@esbuild/sunos-x64","node_modules/wrangler/node_modules/@esbuild/win32-arm64","node_modules/wrangler/node_modules/@esbuild/win32-ia32","node_modules/wrangler/node_modules/@esbuild/win32-x64","node_modules/wrangler/node_modules/esbuild","node_modules/wrap-ansi/node_modules/ansi-regex","node_modules/yaml","node_modules/yargs","node_modules/@dotenvx/primitives","node_modules/@dotenvx/providers","node_modules/@dotenvx/tooling","node_modules/@isaacs/cliui/node_modules/ansi-regex","node_modules/@isaacs/cliui/node_modules/emoji-regex","node_modules/@isaacs/cliui/node_modules/string-width","node_modules/@isaacs/cliui/node_modules/strip-ansi","node_modules/@isaacs/cliui/node_modules/wrap-ansi","node_modules/@pkgjs/parseargs","node_modules/cliui/node_modules/emoji-regex","node_modules/color-convert","node_modules/color-name","node_modules/eastasianwidth","node_modules/imurmurhash","node_modules/is-fullwidth-code-point","node_modules/miniflare/node_modules/undici","node_modules/string-width-cjs","node_modules/strip-ansi-cjs","node_modules/wrap-ansi-cjs","node_modules/wrap-ansi-cjs/node_modules/ansi-styles","node_modules/wrap-ansi-cjs/node_modules/string-width","node_modules/wrap-ansi/node_modules/emoji-regex","node_modules/write-file-atomic","node_modules/yocto-spinner","node_modules/yoctocolors"]); expect(changed).toEqual(packet.changedPackages);
    expect({ ...current, packages: null }).toEqual({ ...before, packages: null });
    expect(current.packages['apps/admin']).toEqual({ ...before.packages['apps/admin'],
      devDependencies: { ...before.packages['apps/admin'].devDependencies,
        '@opennextjs/cloudflare': '1.20.13', wrangler: '4.152.0' } });
    for (const path of ['node_modules/next', 'node_modules/zod', 'node_modules/sanitize-html',
      'node_modules/sanitize-html/node_modules/postcss', 'node_modules/cheerio/node_modules/undici'])
      expect(current.packages[path]).toEqual(before.packages[path]);
    for (const [path, version] of Object.entries({"node_modules/@ast-grep/napi":"0.45.3","node_modules/@ast-grep/napi-darwin-arm64":"0.45.3","node_modules/@ast-grep/napi-darwin-x64":"0.45.3","node_modules/@ast-grep/napi-linux-arm64-gnu":"0.45.3","node_modules/@ast-grep/napi-linux-arm64-musl":"0.45.3","node_modules/@ast-grep/napi-linux-x64-gnu":"0.45.3","node_modules/@ast-grep/napi-linux-x64-musl":"0.45.3","node_modules/@ast-grep/napi-win32-arm64-msvc":"0.45.3","node_modules/@ast-grep/napi-win32-ia32-msvc":"0.45.3","node_modules/@ast-grep/napi-win32-x64-msvc":"0.45.3","node_modules/@cloudflare/unenv-preset":"2.16.2","node_modules/@cloudflare/workerd-darwin-64":"1.20261019.1","node_modules/@cloudflare/workerd-darwin-arm64":"1.20261019.1","node_modules/@cloudflare/workerd-linux-64":"1.20261019.1","node_modules/@cloudflare/workerd-linux-arm64":"1.20261019.1","node_modules/@cloudflare/workerd-windows-64":"1.20261019.1","node_modules/@cloudflare/workers-types":"5.20261025.1","node_modules/@dotenvx/dotenvx":"2.38.2","node_modules/@isaacs/cliui":"8.0.2","node_modules/@node-minify/core":"9.0.2","node_modules/@node-minify/core/node_modules/brace-expansion":"2.1.7","node_modules/@node-minify/core/node_modules/glob":"10.3.3","node_modules/@node-minify/core/node_modules/minimatch":"9.0.9","node_modules/@node-minify/terser":"9.0.1","node_modules/@node-minify/utils":"9.0.1","node_modules/@opennextjs/aws":"4.1.12","node_modules/@opennextjs/cloudflare":"1.20.13","node_modules/@tsconfig/node18":"18.2.7","node_modules/body-parser":"2.4.0","node_modules/brace-expansion":"5.0.12","node_modules/cliui/node_modules/ansi-regex":"6.4.0","node_modules/content-disposition":"2.0.1","node_modules/content-type":"2.1.0","node_modules/emoji-regex":"8.0.0","node_modules/express":"5.3.0","node_modules/get-east-asian-width":"1.7.0","node_modules/glob":"13.0.6","node_modules/jackspeak":"2.3.6","node_modules/miniflare":"5.20261019.2-beta","node_modules/mkdirp":"3.0.1","node_modules/negotiator":"1.1.0","node_modules/on-finished":"2.4.2","node_modules/path-scurry/node_modules/lru-cache":"11.5.3","node_modules/proxy-addr":"2.0.8","node_modules/qs":"6.16.1","node_modules/signal-exit":"4.1.0","node_modules/string-width":"8.3.0","node_modules/string-width/node_modules/ansi-regex":"6.4.0","node_modules/terser":"5.36.0","node_modules/undici":"6.29.1","node_modules/workerd":"1.20261019.1","node_modules/wrangler":"4.152.0","node_modules/wrap-ansi/node_modules/ansi-regex":"6.4.0","node_modules/yaml":"2.9.1","node_modules/yargs":"18.2.0","node_modules/@dotenvx/primitives":"3.3.1","node_modules/@dotenvx/providers":"0.3.11","node_modules/@dotenvx/tooling":"1.0.6","node_modules/@isaacs/cliui/node_modules/ansi-regex":"6.4.0","node_modules/@isaacs/cliui/node_modules/emoji-regex":"9.2.2","node_modules/@isaacs/cliui/node_modules/string-width":"5.1.2","node_modules/@isaacs/cliui/node_modules/strip-ansi":"7.2.0","node_modules/@isaacs/cliui/node_modules/wrap-ansi":"8.1.0","node_modules/@pkgjs/parseargs":"0.11.0","node_modules/cliui/node_modules/emoji-regex":"10.6.0","node_modules/color-convert":"2.0.1","node_modules/color-name":"1.1.4","node_modules/eastasianwidth":"0.2.0","node_modules/imurmurhash":"0.1.4","node_modules/is-fullwidth-code-point":"3.0.0","node_modules/miniflare/node_modules/undici":"7.29.1","node_modules/string-width-cjs":"4.2.3","node_modules/strip-ansi-cjs":"6.0.1","node_modules/wrap-ansi-cjs":"7.0.0","node_modules/wrap-ansi-cjs/node_modules/ansi-styles":"4.3.0","node_modules/wrap-ansi-cjs/node_modules/string-width":"4.2.3","node_modules/wrap-ansi/node_modules/emoji-regex":"10.6.0","node_modules/write-file-atomic":"5.0.1","node_modules/yocto-spinner":"1.2.2","node_modules/yoctocolors":"2.2.0"})) {
      expect(current.packages[path].version, path).toBe(version);
      expect(current.packages[path].resolved, path).toMatch(/^https:\/\/registry\.npmjs\.org\//u);
      expect(current.packages[path].integrity, path).toMatch(/^sha512-/u);
    }
  });

  it('rejects changed tarball provenance and exposes unrelated manifest drift through the complete chain', () => {
    const lockPath = 'package-lock.json', lock = read(lockPath);
    for (const delta of packet.projections.filter(entry => entry.path === lockPath && entry.after.includes('"integrity"'))) {
      for (const field of ['integrity', 'resolved']) {
        const changed = delta.after.replace(new RegExp(`("${field}": ")[^"]+`, 'u'), '$1unreviewed');
        expect(changed).not.toBe(delta.after);
        expect(() => project(lockPath, lock.replace(delta.after, changed))).toThrow(failure);
      }
    }
    const path = 'apps/admin/package.json', current = read(path);
    const altered = current.replace('"react": "^18.3.1"', '"react": "999.0.0"');
    expect(altered).not.toBe(current);
    for (const adapter of [project, projectReviewedNewsRuntimeDependencySecurity, projectReviewedNextBuilderFollowup]) {
      const expected = adapter(path, current).replace('"react": "^18.3.1"', '"react": "999.0.0"');
      expect(adapter(path, altered)).toBe(expected);
      expect(sha(adapter(path, altered))).not.toBe(sha(adapter(path, current)));
    }
  });

  it('pins the unconditional workerd gate before any deployment credentials or provider operation', () => {
    const current = read(workflow), delta = packet.projections.find(entry => entry.path === workflow);
    expect(delta).toBeDefined();
    const step = "      - name: Smoke-test built Worker in local workerd\n        timeout-minutes: 3\n        run: node scripts/smoke-admin-workerd.mjs\n\n";
    expect(current.split(step)).toHaveLength(2);
    expect(step).toContain('node scripts/smoke-admin-workerd.mjs');
    expect(step).not.toContain('if:'); expect(step).not.toContain('continue-on-error:'); expect(step).not.toContain('secrets.');
    expect(current.indexOf(step)).toBeGreaterThan(current.indexOf('npm run cf:size --workspace @probpera/admin'));
    expect(current.indexOf(step)).toBeLessThan(current.indexOf('- name: Inspect premium translation secret'));
    expect(current.indexOf(step)).toBeLessThan(current.indexOf('- name: Deploy to Cloudflare Workers'));
    for (const path of ['scripts/smoke-admin-workerd.mjs', 'scripts/smoke-admin-workerd.test.mjs'])
      expect(current.split('"' + path + '"')).toHaveLength(3);
    for (const changed of [current + step, current.replace(step, '') + step,
      current.replace(step, step.replace('        run:', '        continue-on-error: true\n        run:')),
      current.replace(step, step.replace('        run:', '        if: false\n        run:')),
      current.replace(step, step.replace('smoke-admin-workerd.mjs', 'check-admin-worker-size.mjs'))]) {
      if (packet.markers[workflow].some(marker => changed.includes(marker.text))) expect(() => project(workflow, changed)).toThrow(failure);
      else expect(sha(changed)).not.toBe(packet.reviewedSources[workflow]);
    }
  });

  it('retains every prior governance assertion and binds only its outer reader integration', () => {
    expect(packet.testReadBoundaries).toHaveLength(1);
    const integration = packet.testReadBoundaries[0];
    expect(integration.path).toBe('scripts/lib/reviewed-news-runtime-dependency-security.test.mjs');
    expect(integration.deltas).toHaveLength(2);
    let previous = read(integration.path); expect(sha(previous)).toBe(integration.reviewedSource);
    for (const delta of integration.deltas) {
      expect(delta.path).toBe(integration.path); expect(previous.split(delta.after)).toHaveLength(2);
      expect(sha(delta.before)).toBe(delta.beforeSha256Lf); expect(sha(delta.after)).toBe(delta.afterSha256Lf);
      previous = previous.replace(delta.after, delta.before);
    }
    expect(previous).toBe(historical(integration.path)); expect(sha(previous)).toBe(integration.sourceBaseline);
    expect(previous).toContain("toBe('3adc05cdd427637af55adf3c1fa4c0c13d828e345eabf54ecdb483408b95ff0c')");
    for (const delta of packet.projections.filter(entry => entry.path === helper))
      expect(() => project(helper, read(helper).replace(delta.after, delta.before))).toThrow(failure);
  });

  it('pins new smoke sources and preserves all12 earlier packets and mandatory audit workflows', () => {
    expect(packet.additions.map(entry => entry.path)).toEqual(["scripts/lib/reviewed-admin-worker-compatibility.mjs","scripts/smoke-admin-workerd.mjs","scripts/smoke-admin-workerd.test.mjs"]);
    for (const entry of packet.additions) expect(sha(read(entry.path))).toBe(entry.sha256Lf);
    expect(packet.supportingSources).toEqual([]);
    expect(read('scripts/admin-deploy-workflow.source.test.mjs')).toBe(historical('scripts/admin-deploy-workflow.source.test.mjs'));
    expect(packet.foundations).toHaveLength(12);
    for (const entry of packet.foundations) {
      const source = read(entry.path); expect(source).toBe(historical(entry.path));
      expect(sha(source)).toBe(entry.sha256Lf); expect(sha(JSON.stringify(JSON.parse(source)))).toBe(entry.jsonSha256);
      expect(project(entry.path, source)).toBe(source);
    }
    for (const path of ['.github/workflows/quality.yml', '.github/workflows/deploy-pages.yml']) expect(read(path)).toBe(historical(path));
    expect(read('.github/workflows/quality.yml').split('run: npm audit --omit=dev --audit-level=high')).toHaveLength(2);
    for (const path of ['src/App.tsx', 'src/data/bookArchive.ts', 'unknown.json']) expect(project(path, 'unknown\r\n')).toBe('unknown\n');
  });
});
