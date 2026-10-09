import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { preparePostgresTestImage, runPreparePostgresTestImageCli } from './prepare-postgres-test-image.mjs';

const PRIMARY = 'public.ecr.aws/docker/library/postgres:17-alpine', FALLBACK = 'postgres:17-alpine';
const ID = 'sha256:' + 'a'.repeat(64), ENV_ROOT = '/home/runner/work/_temp/_runner_file_commands/';
const ENV_NAME = 'set_env_01234567-89ab-cdef-0123-456789abcdef', ENV_PATH = ENV_ROOT + ENV_NAME;
const APPEND_FLAGS = constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW;
const SECRET = 'provider-secret-must-not-appear';
const validInspection = () => JSON.stringify({ imageId: ID, environment: ['PATH=/usr/bin', 'PG_MAJOR=17', 'PG_VERSION=17.6'] });

function boundary({ pulls = [{ status: 0 }], inspection = { status: 0, stdout: validInspection() },
  env = { GITHUB_ENV: ENV_PATH }, appendFailure, waitFailure,
  realpathImpl = path => path, lstatImpl = () => ({ isFile: () => true }) } = {}) {
  const calls = [], writes = [], waits = [], diagnostics = [], resolutions = [], stats = []; let index = 0;
  return { calls, writes, waits, diagnostics, resolutions, stats,
    options: { env,
      realpathImpl: path => { resolutions.push(path); return realpathImpl(path); },
      lstatImpl: path => { stats.push(path); return lstatImpl(path); },
      runImpl: async (args, timeout) => {
        calls.push({ args, timeout });
        const response = args[0] === 'pull' ? pulls[index++] : inspection;
        if (response instanceof Error) throw response;
        return response;
      },
      waitImpl: async milliseconds => { waits.push(milliseconds); if (waitFailure) throw waitFailure; },
      appendEnvImpl: async (...args) => { writes.push(args); if (appendFailure) throw appendFailure; },
      onDiagnostic: message => diagnostics.push(message),
    },
  };
}

describe('one bounded and verified PostgreSQL 17 image for all CI integration suites', () => {
  it('pulls the official ECR image once, verifies it, and exports only its immutable ID to both SQL suite families', async () => {
    const b = boundary({ env: { GITHUB_ENV: ENV_PATH, POSTGRES_RLS_TEST_IMAGE: 'untrusted.example/changed:18',
      POSTGRES_EVIDENCE_V2_TEST_IMAGE: 'untrusted.example/changed:18' } });
    expect(await preparePostgresTestImage(b.options)).toEqual({ imageId: ID });
    expect(b.calls.map(call => call.args.slice(0, 2))).toEqual([['pull', PRIMARY], ['image', 'inspect']]);
    expect(b.calls.map(call => call.timeout)).toEqual([60000, 10000]);
    expect(b.calls[1].args.at(-1)).toBe(PRIMARY);
    expect(b.waits).toEqual([]);
    expect(b.resolutions).toEqual([ENV_PATH]); expect(b.stats).toEqual([ENV_PATH]);
    expect(b.writes).toEqual([[ENV_PATH, `POSTGRES_RLS_TEST_IMAGE=${ID}\nPOSTGRES_EVIDENCE_V2_TEST_IMAGE=${ID}\n`,
      { encoding: 'utf8', flag: APPEND_FLAGS }]]);
    expect(b.diagnostics.at(-1)).toBe('PostgreSQL 17 test image validated and pinned for all integration suites.');
  });

  it('retries a thrown pull timeout once before using the same PostgreSQL tag from Docker Hub', async () => {
    const b = boundary({ pulls: [Error(SECRET), { status: 125, stderr: SECRET }, { status: 0 }] });
    await preparePostgresTestImage(b.options);
    expect(b.calls.filter(call => call.args[0] === 'pull').map(call => call.args[1])).toEqual([PRIMARY, PRIMARY, FALLBACK]);
    expect(b.calls.at(-1).args.at(-1)).toBe(FALLBACK);
    expect(b.waits).toEqual([5000]); expect(b.writes).toHaveLength(1);
    expect(b.diagnostics.join('\n')).not.toContain(SECRET);
  });

  it('retains the primary registry when its bounded second attempt succeeds', async () => {
    const b = boundary({ pulls: [{ status: null, error: Error(SECRET) }, { status: 0 }] });
    await preparePostgresTestImage(b.options);
    expect(b.calls.filter(call => call.args[0] === 'pull').map(call => call.args[1])).toEqual([PRIMARY, PRIMARY]);
    expect(b.waits).toEqual([5000]); expect(b.writes).toHaveLength(1);
  });

  it('fails closed after exactly four failed pulls without inspection or environment writes', async () => {
    const b = boundary({ pulls: Array.from({ length: 4 }, () => ({ status: 125, stdout: SECRET, stderr: SECRET })) });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_pull_failed');
    expect(b.calls.map(call => call.args)).toEqual([['pull', PRIMARY], ['pull', PRIMARY], ['pull', FALLBACK], ['pull', FALLBACK]]);
    expect(b.calls.every(call => call.timeout === 60000)).toBe(true);
    expect(b.waits).toEqual([5000, 5000]); expect(b.writes).toEqual([]);
    expect(b.diagnostics.join('\n')).not.toContain(SECRET);
  });

  it.each([
    ['wrong major', { imageId: ID, environment: ['PG_MAJOR=18'] }],
    ['missing major', { imageId: ID, environment: ['PG_VERSION=17.6'] }],
    ['duplicate major', { imageId: ID, environment: ['PG_MAJOR=17', 'PG_MAJOR=18'] }],
    ['major newline injection', { imageId: ID, environment: ['PG_MAJOR=17\nUNEXPECTED=1'] }],
    ['noncanonical ID', { imageId: 'sha256:' + 'A'.repeat(64), environment: ['PG_MAJOR=17'] }],
    ['ID newline injection', { imageId: ID + '\nUNEXPECTED=' + SECRET, environment: ['PG_MAJOR=17'] }],
    ['tag rather than immutable ID', { imageId: FALLBACK, environment: ['PG_MAJOR=17'] }],
    ['missing environment', { imageId: ID }],
    ['non-string environment entry', { imageId: ID, environment: ['PG_MAJOR=17', { arbitrary: SECRET }] }],
  ])('rejects %s before exporting anything, without masking validation failure with a fallback', async (_label, inspection) => {
    const b = boundary({ inspection: { status: 0, stdout: JSON.stringify(inspection) } });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_invalid');
    expect(b.calls).toHaveLength(2); expect(b.writes).toEqual([]);
    expect(b.diagnostics.join('\n')).not.toContain(SECRET);
  });

  it('rejects malformed inspect output without exposing its bytes or writing environment variables', async () => {
    const b = boundary({ inspection: { status: 0, stdout: SECRET } });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_invalid');
    expect(b.writes).toEqual([]); expect(b.diagnostics.join('\n')).not.toContain(SECRET);
  });

  it.each([Error(SECRET), { status: 1, stderr: SECRET }])('fails closed on an inspect transport failure', async inspection => {
    const b = boundary({ inspection });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_inspect_failed');
    expect(b.writes).toEqual([]); expect(b.diagnostics.join('\n')).not.toContain(SECRET);
  });

  it.each([{}, { GITHUB_ENV: '' }, { GITHUB_ENV: 'relative-env-file' }, { GITHUB_ENV: '/etc/environment' },
    { GITHUB_ENV: '/tmp/' + ENV_NAME }, { GITHUB_ENV: ENV_ROOT.slice(0, -1) + '-evil/' + ENV_NAME },
    { GITHUB_ENV: ENV_ROOT + 'nested/' + ENV_NAME }, { GITHUB_ENV: ENV_ROOT + '../_runner_file_commands/' + ENV_NAME },
    { GITHUB_ENV: ENV_ROOT + './' + ENV_NAME }, { GITHUB_ENV: ENV_ROOT + '/' + ENV_NAME },
    { GITHUB_ENV: ENV_ROOT + ENV_NAME.replace('set_env_', 'set_output_') },
    { GITHUB_ENV: ENV_PATH + '\nUNEXPECTED=1' }, { GITHUB_ENV: ENV_PATH + '\0' }])
    ('requires a valid GitHub environment path before contacting a registry', async env => {
      const b = boundary({ env });
      await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_invalid');
      expect(b.resolutions).toEqual([]); expect(b.calls).toEqual([]); expect(b.writes).toEqual([]);
    });

  it.each(['/etc/environment', ENV_ROOT.slice(0, -1) + '-evil/' + ENV_NAME,
    ENV_ROOT + 'nested/' + ENV_NAME, ENV_ROOT + ENV_NAME.replace('01234567', '12345678')])
    ('rejects escaped or redirected canonical files before Docker', async canonical => {
      const b = boundary({ realpathImpl: () => canonical });
      await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_invalid');
      expect(b.resolutions).toEqual([ENV_PATH]); expect(b.stats).toEqual([]);
      expect(b.calls).toEqual([]); expect(b.writes).toEqual([]);
    });

  it('does not trust RUNNER_TEMP to redefine the allowed write root', async () => {
    const b = boundary({ env: { RUNNER_TEMP: '/etc', GITHUB_ENV: '/etc/_runner_file_commands/' + ENV_NAME } });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_invalid');
    expect(b.resolutions).toEqual([]); expect(b.calls).toEqual([]); expect(b.writes).toEqual([]);
  });

  it('rejects a missing environment file without exposing realpath errors', async () => {
    const b = boundary({ realpathImpl: () => { throw Error(SECRET); } });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_invalid');
    expect(b.calls).toEqual([]); expect(b.writes).toEqual([]); expect(b.diagnostics).toEqual([]);
  });

  it.each([() => ({ isFile: () => false }), () => { throw Error(SECRET); }])
    ('requires an existing regular runner file before Docker', async lstatImpl => {
      const b = boundary({ lstatImpl });
      await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_invalid');
      expect(b.stats).toEqual([ENV_PATH]); expect(b.calls).toEqual([]); expect(b.writes).toEqual([]);
    });

  it.runIf(process.platform === 'linux' && existsSync(ENV_ROOT))
    ('rejects a real symlink escape from the runner command directory without changing its target', async () => {
      const scratchRoot = join(process.cwd(), '.tmp'); mkdirSync(scratchRoot, { recursive: true });
      const scratch = mkdtempSync(join(scratchRoot, 'postgres-env-path-'));
      const target = join(scratch, 'untouched-env'), commandFile = ENV_ROOT + 'set_env_' + randomUUID();
      let linked = false;
      try {
        writeFileSync(target, 'unchanged\n'); symlinkSync(target, commandFile); linked = true;
        const b = boundary({ env: { GITHUB_ENV: commandFile }, realpathImpl: realpathSync, lstatImpl: lstatSync });
        await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_invalid');
        expect(b.calls).toEqual([]); expect(b.writes).toEqual([]);
        expect(readFileSync(target, 'utf8')).toBe('unchanged\n');
      } finally {
        if (linked) unlinkSync(commandFile);
        rmSync(scratch, { recursive: true, force: true });
      }
    });

  it('stops on a failed retry delay instead of continuing an unbounded or immediate registry loop', async () => {
    const b = boundary({ pulls: [{ status: 1 }], waitFailure: Error(SECRET) });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_retry_failed');
    expect(b.calls).toHaveLength(1); expect(b.writes).toEqual([]);
  });

  it('reports a failed environment append without claiming readiness or exposing the filesystem error', async () => {
    const b = boundary({ appendFailure: Error(SECRET) });
    await expect(preparePostgresTestImage(b.options)).rejects.toThrow('postgres_test_image_env_write_failed');
    expect(b.writes).toHaveLength(1);
    expect(b.diagnostics).toEqual(['Validating the preloaded PostgreSQL 17 test image.']);
  });

  it('keeps unexpected CLI errors private and returns a failed exit status', async () => {
    const output = [], errors = [];
    expect(await runPreparePostgresTestImageCli({ prepareImpl: async () => { throw Error(SECRET); },
      stdoutImpl: value => output.push(value), stderrImpl: value => errors.push(value) })).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual(['::error::PostgreSQL test image preparation failed. CI remains blocked.']);
  });

  it('executes the actual CLI entrypoint and fails before Docker when GITHUB_ENV is absent', () => {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-postgres-test-image.mjs', import.meta.url))],
      { env: { ...process.env, GITHUB_ENV: '' }, encoding: 'utf8', timeout: 10000, windowsHide: true });
    expect(child.status).toBe(1); expect(child.stdout).toBe('');
    expect(child.stderr.trim()).toBe('::error::The GitHub environment file is unavailable or invalid. CI remains blocked.');
  });

  it('reports an allowlisted actionable CLI diagnostic and returns success only after preparation finishes', async () => {
    const errors = [];
    expect(await runPreparePostgresTestImageCli({ prepareImpl: async () => { throw Error('postgres_test_image_invalid'); },
      stderrImpl: value => errors.push(value) })).toBe(1);
    expect(errors).toEqual(['::error::The preloaded image did not have a canonical image ID and exactly PG_MAJOR=17. CI remains blocked.']);
    expect(await runPreparePostgresTestImageCli({ prepareImpl: async () => ({ imageId: ID }),
      stderrImpl: () => { throw Error('Unexpected failure diagnostic'); } })).toBe(0);
  });
});
