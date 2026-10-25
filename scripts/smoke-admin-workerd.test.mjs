import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { adminSmokeConfig, adminSmokeEnvironment, assertAdminSmokeScratch, checkAdminSmokeResponses,
  runAdminWorkerdSmoke, stopAdminSmokeChild } from './smoke-admin-workerd.mjs';

const current = new Date('2026-10-25T12:00:00Z');
const document = ['Contact: mailto:probperasite@yandex.ru', 'Expires: 2027-04-23T12:00:00.000Z',
  'Preferred-Languages: ru, en', 'Canonical: https://admin.probpera.ru/.well-known/security.txt', ''].join('\n');
const source = { main: '.open-next/worker.js', compatibility_date: '2026-08-08',
  compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'], minify: true,
  assets: { directory: '.open-next/assets', binding: 'ASSETS', run_worker_first: false },
  ai: { binding: 'AI' }, kv_namespaces: [{ binding: 'ADMIN_CATALOGS', id: 'production-namespace' }],
  routes: [{ pattern: 'admin.probpera.ru', custom_domain: true }], vars: { PRIVATE_FIXTURE: 'do-not-copy' } };
const text = (body = document, headers = {}) => new Response(body, { headers: {
  'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers } });
const redirect = location => new Response('PUBLIC REDIRECT', { status: 307, headers: { location: location || '/dashboard' } });
const transport = security => vi.fn().mockResolvedValueOnce(redirect()).mockResolvedValueOnce(security || text());
const check = fetchImpl => checkAdminSmokeResponses('http://127.0.0.1:43210/', { fetchImpl, now: () => current });
const fixtureRoots = [];
afterEach(async () => {
  for (const root of fixtureRoots.splice(0)) {
    const base = path.resolve('.tmp');
    if (path.dirname(root) !== base || !path.basename(root).startsWith('admin-smoke-unit-')) throw Error('Unsafe unit fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('secret-free built admin Worker runtime smoke', () => {
  it('copies only OS/tool essentials and overrides unsafe parent configuration', () => {
    const result = adminSmokeEnvironment({ Path: 'tools', SystemRoot: 'windows', TEMP: 'temp',
      CLOUDFLARE_API_TOKEN: 'private', SUPABASE_SERVICE_ROLE_KEY: 'private', OPENAI_API_KEY: 'private',
      NODE_OPTIONS: '--require=untrusted', GITHUB_TOKEN: 'private', NEXT_PUBLIC_SUPABASE_URL: 'https://real.example',
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'true', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', WRANGLER_SEND_METRICS: 'true' }, 'directory', 'token');
    expect(result).toEqual({ Path: 'tools', SystemRoot: 'windows', TEMP: 'temp', CI: '1',
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
      WRANGLER_SEND_METRICS: 'false', ADMIN_WORKER_SMOKE_DIRECTORY: 'directory', ADMIN_WORKER_SMOKE_TOKEN: 'token' });
  });
  it('uses the actual artifact and compatibility with no AI, production namespace, routes or private vars', () => {
    const root = path.resolve('.tmp/fixture'), result = adminSmokeConfig(root, source);
    expect(result.main).toBe(path.join(root, 'apps/admin/.open-next/worker.js'));
    expect(result.assets.directory).toBe(path.join(root, 'apps/admin/.open-next/assets'));
    expect(result.compatibility_flags).toEqual(source.compatibility_flags);
    expect(result.compatibility_date).toBe(source.compatibility_date);
    expect(result.kv_namespaces).toEqual([{ binding: 'ADMIN_CATALOGS', id: '0'.repeat(32), remote: false }]);
    expect(result.ai).toBeUndefined(); expect(result.routes).toBeUndefined(); expect(result.vars.PRIVATE_FIXTURE).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/production-namespace|do-not-copy/);
  });
  it.each([
    { ...source, main: '../another-worker.js' }, { ...source, assets: { ...source.assets, directory: '../private' } },
    { ...source, compatibility_flags: ['global_fetch_strictly_public'] },
  ])('rejects a changed artifact contract', value => {
    expect(() => adminSmokeConfig(path.resolve('.'), value)).toThrow('admin_smoke_config_invalid');
  });
  it.each(['https://admin.probpera.ru/', 'http://127.0.0.1:43210/private', 'http://localhost:43210/', 'http://127.0.0.1/'])
    ('never sends smoke requests to an unexpected origin: %s', async origin => {
      const fetchImpl = vi.fn();
      await expect(checkAdminSmokeResponses(origin, { fetchImpl })).rejects.toThrow('admin_smoke_origin_rejected');
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  it('checks only the anonymous redirect and bounded public security document without reading the redirect body', async () => {
    const cancel = vi.fn(), root = new Response(new ReadableStream({ cancel }), { status: 307, headers: { location: '/dashboard' } });
    const fetchImpl = vi.fn().mockResolvedValueOnce(root).mockResolvedValueOnce(text());
    expect(await check(fetchImpl)).toEqual({ rootStatus: 307, rootLocation: '/dashboard', securityStatus: 200, securityDocumentValid: true });
    expect(cancel).toHaveBeenCalledOnce(); expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map(([url]) => url.pathname)).toEqual(['/', '/.well-known/security.txt']);
    for (const [, options] of fetchImpl.mock.calls) {
      expect(options).toMatchObject({ method: 'GET', redirect: 'manual', headers: { Accept: '*/*' } });
      expect(options.headers.Cookie).toBeUndefined(); expect(options.headers.Authorization).toBeUndefined(); expect(options.body).toBeUndefined();
    }
  });
  it('fails on the real missing-manifest symptom and never follows a private route', async () => {
    const cancel = vi.fn(), fetchImpl = vi.fn(async () => new Response(new ReadableStream({ cancel }), { status: 500 }));
    await expect(check(fetchImpl)).rejects.toThrow('admin_smoke_root_status_500');
    expect(cancel).toHaveBeenCalledOnce(); expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('refuses an external redirect instead of following it', async () => {
    const fetchImpl = vi.fn(async () => redirect('https://admin.probpera.ru/dashboard'));
    await expect(check(fetchImpl)).rejects.toThrow('admin_smoke_root_redirect_invalid'); expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it.each([
    ['Contact: mailto:probperasite@yandex.ru', 'Contact: mailto:someone@example.org'],
    ['Preferred-Languages: ru, en', 'Preferred-Languages: en'],
    ['Canonical: https://admin.probpera.ru/.well-known/security.txt', 'Canonical: https://wrong.example/.well-known/security.txt'],
  ])('rejects altered public security fields: %s', async (before, after) => {
    await expect(check(transport(text(document.replace(before, after))))).rejects.toThrow('admin_smoke_security_fields_invalid');
  });
  it.each(['2020-01-01T00:00:00Z', '2030-01-01T00:00:00Z', 'not-a-date'])('rejects stale, excessively distant or invalid expiry: %s', async expiry => {
    await expect(check(transport(text(document.replace('2027-04-23T12:00:00.000Z', expiry))))).rejects.toThrow('admin_smoke_security_expiry_invalid');
  });
  it.each([
    [{ 'content-type': 'text/html' }, 'admin_smoke_security_content_type'],
    [{ 'x-content-type-options': 'unsafe' }, 'admin_smoke_security_nosniff'],
    [{ 'content-length': '9000' }, 'admin_smoke_security_body_invalid'],
  ])('enforces response metadata and size: %j', async (headers, code) => {
    await expect(check(transport(text(document, headers)))).rejects.toThrow(code);
  });
  it('bounds a chunked security response even without Content-Length', async () => {
    await expect(check(transport(text('x'.repeat(8193))))).rejects.toThrow('admin_smoke_security_body_invalid');
  });
  it('limits recursive cleanup to the exact owned workspace scratch directory', () => {
    const root = path.resolve('.tmp/fixture');
    expect(assertAdminSmokeScratch(root, path.join(root, '.tmp/admin-workerd-smoke-aB12cD'))).toBe(path.join(root, '.tmp/admin-workerd-smoke-aB12cD'));
    for (const value of [root, path.join(root, '.tmp'), path.join(root, '.tmp/admin-workerd-smoke-aB12cD/child'),
      path.join(root, '../admin-workerd-smoke-aB12cD')]) expect(() => assertAdminSmokeScratch(root, value)).toThrow('admin_smoke_cleanup_path_rejected');
  });
  it('kills only the exact tracked Windows child and its descendants after cooperative shutdown fails', async () => {
    const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, connected: true, send: vi.fn() });
    const spawnSyncImpl = vi.fn(() => ({ status: 0 }));
    await stopAdminSmokeChild(child, { platform: 'win32', spawnSyncImpl, graceMilliseconds: 0 });
    expect(child.send).toHaveBeenCalledWith({ type: 'shutdown' });
    expect(spawnSyncImpl).toHaveBeenCalledWith('taskkill', ['/PID', '12345', '/T', '/F'], expect.objectContaining({ windowsHide: true, timeout: 10000 }));
  });
  it('cleans only the dedicated Linux process group when teardown stalls', async () => {
    const child = Object.assign(new EventEmitter(), { pid: 54321, exitCode: null, connected: false });
    const killImpl = vi.fn();
    await stopAdminSmokeChild(child, { platform: 'linux', killImpl, waitImpl: async () => {}, graceMilliseconds: 0 });
    expect(killImpl.mock.calls).toEqual([[-54321, 'SIGTERM'], [-54321, 'SIGKILL']]);
  });
  it('uses managed runtime teardown before attempting any forced process termination', async () => {
    const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, connected: true,
      send: vi.fn(() => queueMicrotask(() => child.emit('exit', 0))) });
    const spawnSyncImpl = vi.fn(), killImpl = vi.fn();
    await stopAdminSmokeChild(child, { platform: 'win32', spawnSyncImpl, killImpl });
    expect(child.send).toHaveBeenCalledWith({ type: 'shutdown' });
    expect(spawnSyncImpl).not.toHaveBeenCalled(); expect(killImpl).not.toHaveBeenCalled();
  });
  it('reports cleanup failure and never claims the gate passed', async () => {
    const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, connected: false });
    await expect(stopAdminSmokeChild(child, { platform: 'win32', spawnSyncImpl: () => ({ status: 1 }), graceMilliseconds: 0 }))
      .rejects.toThrow('admin_smoke_child_cleanup_failed');
  });
  it.each(['pass', 'http500', 'startup-timeout', 'wrong-address'])('always disposes its owned runtime and scratch after %s', async scenario => {
    const base = path.resolve('.tmp'); await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, 'admin-smoke-unit-')); fixtureRoots.push(root);
    await mkdir(path.join(root, 'apps/admin/.open-next/assets'), { recursive: true });
    await writeFile(path.join(root, 'apps/admin/.open-next/worker.js'), 'export default {};\n');
    await writeFile(path.join(root, 'apps/admin/wrangler.jsonc'), JSON.stringify(source));
    const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, connected: true, stderr: new EventEmitter(), send: vi.fn() });
    const spawnImpl = vi.fn((command, args, options) => {
      expect(command).toBe(process.execPath); expect(args.at(-1)).toBe('--runtime-child');
      expect(options.env.CLOUDFLARE_API_TOKEN).toBeUndefined(); expect(options.env.NODE_OPTIONS).toBeUndefined();
      if (scenario !== 'startup-timeout') setImmediate(() => child.emit('message', { type: 'ready',
        address: scenario === 'wrong-address' ? '0.0.0.0' : '127.0.0.1', port: 43210, token: options.env.ADMIN_WORKER_SMOKE_TOKEN }));
      return child;
    });
    const stopImpl = vi.fn(async () => {}), fetchImpl = scenario === 'http500' ? vi.fn(async () => new Response(null, { status: 500 })) : transport();
    const operation = runAdminWorkerdSmoke({ root, spawnImpl, stopImpl, fetchImpl, startupMilliseconds: 50,
      env: { CLOUDFLARE_API_TOKEN: 'never-copy', NODE_OPTIONS: '--require=bad' }, now: () => current });
    if (scenario === 'pass') expect(await operation).toMatchObject({ passed: true, externalWrites: 0, inferenceCalls: 0 });
    else await expect(operation).rejects.toThrow(/^admin_smoke_/u);
    expect(stopImpl).toHaveBeenCalledOnce(); expect(stopImpl).toHaveBeenCalledWith(child);
    expect(await readdir(path.join(root, '.tmp'))).toEqual([]);
  });
  it('makes the built-runtime gate mandatory for PR and production before private checks or deployment', async () => {
    const workflow = parse(await readFile(new URL('../.github/workflows/deploy-admin.yml', import.meta.url), 'utf8'));
    for (const trigger of ['push', 'pull_request'])
      for (const file of ['scripts/smoke-admin-workerd.mjs', 'scripts/smoke-admin-workerd.test.mjs']) expect(workflow.on[trigger].paths).toContain(file);
    const steps = workflow.jobs.deploy.steps, matches = steps.filter(step => step.name === 'Smoke-test built Worker in local workerd');
    expect(matches).toEqual([{ name: 'Smoke-test built Worker in local workerd', 'timeout-minutes': 3, run: 'node scripts/smoke-admin-workerd.mjs' }]);
    const index = steps.indexOf(matches[0]);
    expect(steps[index - 1].name).toBe('Build and verify Cloudflare Worker');
    expect(steps[index + 1].name).toBe('Verify preseeded private admin catalogs');
    expect(steps.findIndex(step => step.name === 'Deploy to Cloudflare Workers')).toBeGreaterThan(index);
  });
});
