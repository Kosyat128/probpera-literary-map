import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'vitest';
import { buildDayStatusBoundedFixture } from '../check-literary-news-day-status-bounded.mjs';

const image = process.env.POSTGRES_RLS_TEST_IMAGE || 'postgres:17-alpine';
const probe = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'],
  { encoding: 'utf8', timeout: 10000, windowsHide: true });
const available = probe.status === 0;
// A missing Docker daemon fails CI; local Windows uses the isolated PGlite CLI.
const integration = available || process.env.CI ? it : it.skip;
const wait = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const docker = (args, options = {}) => spawnSync('docker', args, {
  encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 10000, windowsHide: true, ...options,
});
const failed = (label, result) => new Error(label + ' failed (' + result.status + '): '
  + String(result.stderr || result.stdout || result.error?.message || '').slice(0, 4000));

describe('bounded literary news daily metrics on actual PostgreSQL', () => {
  integration('preserves the historical results, cached plans, ACL, RLS and immutable journal', async () => {
    if (!available) throw Error('Docker is required for the CI daily metrics SQL regression.');
    const fixture = await buildDayStatusBoundedFixture();
    const name = 'probpera-day-metrics-' + process.pid + '-' + randomUUID().replaceAll('-', '').slice(0, 12);
    let started = false;
    try {
      const launch = docker(['run', '--detach', '--rm', '--network', 'none', '--name', name,
        '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'POSTGRES_DB=probpera_metrics', image], { timeout: 60000 });
      if (launch.status !== 0) throw failed('Disposable PostgreSQL start', launch);
      started = true;
      const deadline = Date.now() + 45000;
      let consecutive = 0;
      while (Date.now() < deadline && consecutive < 3) {
        const ready = docker(['exec', name, 'psql', '--username=postgres', '--dbname=probpera_metrics',
          '--no-psqlrc', '--tuples-only', '--no-align', '--command', 'select current_database();'], { timeout: 3000 });
        consecutive = ready.status === 0 && ready.stdout.trim() === 'probpera_metrics' ? consecutive + 1 : 0;
        if (consecutive < 3) wait(250);
      }
      if (consecutive < 3) throw Error('Disposable PostgreSQL did not finish initialization.');
      const checked = docker(['exec', '--interactive', name, 'psql', '--username=postgres', '--dbname=probpera_metrics',
        '--no-psqlrc', '--set', 'ON_ERROR_STOP=1'], { input: fixture, timeout: 45000 });
      if (checked.status !== 0) throw failed('Daily metrics SQL differential contract', checked);
      if (!checked.stdout.includes('day_status_bounded_differential_passed'))
        throw Error('PostgreSQL did not confirm the complete differential contract.');
    } finally {
      if (started) {
        const removed = docker(['rm', '--force', name]);
        if (removed.status !== 0) throw failed('Disposable PostgreSQL cleanup', removed);
      }
    }
  }, 180000);
});
