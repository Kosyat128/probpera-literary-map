import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'admin-workerd-smoke-';
const CHILD_DIRECTORY = /^admin-workerd-smoke-[A-Za-z0-9]{6}$/u;
const CHILD_TOKEN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const fail = code => { throw Error(code); };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function adminSmokeEnvironment(source, directory, token) {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR']);
  const result = Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.has(key.toUpperCase()) && typeof value === 'string'));
  return { ...result, CI: '1', WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
    ADMIN_WORKER_SMOKE_DIRECTORY: directory, ADMIN_WORKER_SMOKE_TOKEN: token };
}

export function adminSmokeConfig(root, source) {
  if (source.main !== '.open-next/worker.js' || source.assets?.directory !== '.open-next/assets'
    || source.assets.binding !== 'ASSETS' || !/^\d{4}-\d{2}-\d{2}$/u.test(source.compatibility_date || '')
    || !Array.isArray(source.compatibility_flags) || !source.compatibility_flags.every(flag => typeof flag === 'string')
    || !source.compatibility_flags.includes('nodejs_compat')) fail('admin_smoke_config_invalid');
  return { name: 'probpera-admin-runtime-smoke', main: path.join(root, 'apps/admin/.open-next/worker.js'),
    compatibility_date: source.compatibility_date, compatibility_flags: [...source.compatibility_flags],
    minify: source.minify === true, workers_dev: false,
    assets: { directory: path.join(root, 'apps/admin/.open-next/assets'), binding: 'ASSETS', run_worker_first: source.assets.run_worker_first === true },
    kv_namespaces: [{ binding: 'ADMIN_CATALOGS', id: '0'.repeat(32), remote: false }],
    vars: { ADMIN_BASE_PATH: '/', ADMIN_ALLOWED_ORIGINS: 'admin.probpera.ru',
      NEXT_PUBLIC_ADMIN_URL: 'https://admin.probpera.ru', NEXT_PUBLIC_SITE_URL: 'https://probpera.ru',
      NEXT_PUBLIC_SUPABASE_URL: 'https://ci-placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci_placeholder',
      PREMIUM_TRANSLATION_PROVIDER: 'cloudflare', OPENAI_AUTO_TRANSLATE_PROFILES: 'false' } };
}

export function assertAdminSmokeScratch(root, directory) {
  const absolute = path.resolve(directory), base = path.resolve(root, '.tmp');
  if (path.dirname(absolute) !== base || !CHILD_DIRECTORY.test(path.basename(absolute))) fail('admin_smoke_cleanup_path_rejected');
  return absolute;
}

export async function checkAdminSmokeResponses(origin, { fetchImpl = fetch, signal, now = () => new Date() } = {}) {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port || parsed.pathname !== '/'
    || parsed.search || parsed.hash || parsed.username || parsed.password) fail('admin_smoke_origin_rejected');
  const options = { method: 'GET', redirect: 'manual', signal, headers: { Accept: '*/*' } };
  const root = await fetchImpl(new URL('/', parsed), options);
  try {
    if (root.status !== 307) fail('admin_smoke_root_status_' + root.status);
    if (root.headers.get('location') !== '/dashboard') fail('admin_smoke_root_redirect_invalid');
  } finally { await root.body?.cancel().catch(() => {}); }
  const security = await fetchImpl(new URL('/.well-known/security.txt', parsed), options);
  let text = '';
  try {
    if (security.status !== 200) fail('admin_smoke_security_status_' + security.status);
    if (!/^text\/plain(?:\s*;|$)/iu.test(security.headers.get('content-type') || '')) fail('admin_smoke_security_content_type');
    if (security.headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff') fail('admin_smoke_security_nosniff');
    if (Number(security.headers.get('content-length')) > 8192 || !security.body) fail('admin_smoke_security_body_invalid');
    const reader = security.body.getReader(), chunks = []; let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength; if (length > 8192) fail('admin_smoke_security_body_invalid'); chunks.push(value);
      }
      text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, length));
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } finally { if (!security.bodyUsed) await security.body?.cancel().catch(() => {}); }
  const lines = text.split(/\r?\n/u);
  for (const required of ['Contact: mailto:probperasite@yandex.ru', 'Preferred-Languages: ru, en',
    'Canonical: https://admin.probpera.ru/.well-known/security.txt'])
    if (lines.filter(line => line === required).length !== 1) fail('admin_smoke_security_fields_invalid');
  const expires = lines.filter(line => line.startsWith('Expires: '));
  const expiry = expires.length === 1 ? Date.parse(expires[0].slice(9)) : NaN;
  const current = now().getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(current) || expiry <= current || expiry - current > 370 * 86400000)
    fail('admin_smoke_security_expiry_invalid');
  return { rootStatus: root.status, rootLocation: '/dashboard', securityStatus: security.status, securityDocumentValid: true };
}

export async function stopAdminSmokeChild(child, { platform = process.platform, spawnSyncImpl = spawnSync,
  killImpl = process.kill, waitImpl = pause, graceMilliseconds = 5000 } = {}) {
  if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0) return;
  let exited = child.exitCode !== null && child.exitCode !== undefined;
  const onExit = () => { exited = true; };
  child.once('exit', onExit);
  try {
    if (!exited && child.connected) child.send({ type: 'shutdown' });
    const deadline = Date.now() + graceMilliseconds;
    while (!exited && Date.now() < deadline) await waitImpl(25);
    if (exited) return;
    if (platform === 'win32') {
      const result = spawnSyncImpl('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
      if (result.status !== 0) fail('admin_smoke_child_cleanup_failed');
    } else {
      // This process group was created exclusively for this child and workerd.
      try { killImpl(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      await waitImpl(250);
      try { killImpl(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  } finally { child.removeListener('exit', onExit); }
}

export async function runAdminWorkerdSmoke({ root = REPOSITORY, env = process.env, spawnImpl = spawn,
  fetchImpl = fetch, stopImpl = stopAdminSmokeChild, startupMilliseconds = 70000, requestMilliseconds = 10000,
  signal, now = () => new Date() } = {}) {
  root = await realpath(root);
  const source = JSON.parse(await readFile(path.join(root, 'apps/admin/wrangler.jsonc'), 'utf8'));
  const config = adminSmokeConfig(root, source);
  if (!(await lstat(config.main)).isFile() || !(await lstat(config.assets.directory)).isDirectory()) fail('admin_smoke_build_missing');
  const base = path.join(root, '.tmp'); await mkdir(base, { recursive: true });
  if ((await lstat(base)).isSymbolicLink() || await realpath(base) !== base) fail('admin_smoke_scratch_root_rejected');
  const directory = await mkdtemp(path.join(base, PREFIX)), token = randomUUID(); let child;
  try {
    await writeFile(path.join(directory, 'wrangler.json'), JSON.stringify(config) + '\n', { flag: 'wx' });
    await writeFile(path.join(directory, 'empty.env'), '', { flag: 'wx' });
    child = spawnImpl(process.execPath, [fileURLToPath(import.meta.url), '--runtime-child'], {
      cwd: root, env: adminSmokeEnvironment(env, path.basename(directory), token), windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    // Runtime logs are intentionally not echoed: these checks inspect only the
    // anonymous redirect and public security document, never private page bodies.
    child.stderr?.on('data', () => {});
    const ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(Error('admin_smoke_startup_timeout')), startupMilliseconds);
      const abort = () => finish(Error('admin_smoke_aborted'));
      const error = () => finish(Error('admin_smoke_child_start_failed'));
      const exit = () => finish(Error('admin_smoke_child_exited'));
      const message = value => {
        if (value?.token !== token) return;
        if (value.type === 'failed') return finish(Error('admin_smoke_runtime_start_failed'));
        if (value.type !== 'ready') return;
        if (value.address !== '127.0.0.1' || !Number.isSafeInteger(value.port) || value.port < 1 || value.port > 65535)
          return finish(Error('admin_smoke_listener_rejected'));
        finish(null, value);
      };
      function finish(failure, value) {
        clearTimeout(timeout); child.removeListener('message', message); child.removeListener('error', error);
        child.removeListener('exit', exit); signal?.removeEventListener('abort', abort);
        if (failure) reject(failure); else resolve(value);
      }
      child.on('message', message); child.once('error', error); child.once('exit', exit);
      signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
    });
    const requestSignal = AbortSignal.any([AbortSignal.timeout(requestMilliseconds), ...(signal ? [signal] : [])]);
    const checked = await checkAdminSmokeResponses('http://127.0.0.1:' + ready.port + '/', { fetchImpl, signal: requestSignal, now });
    return { passed: true, runtime: 'local workerd through Wrangler', ...checked, externalWrites: 0, inferenceCalls: 0 };
  } finally {
    try { if (child) await stopImpl(child); }
    finally {
      const target = assertAdminSmokeScratch(root, directory);
      const info = await lstat(target);
      if (info.isSymbolicLink() || await realpath(target) !== target) fail('admin_smoke_cleanup_path_rejected');
      await rm(target, { recursive: true, force: true });
    }
  }
}

async function runtimeChild() {
  const name = process.env.ADMIN_WORKER_SMOKE_DIRECTORY, token = process.env.ADMIN_WORKER_SMOKE_TOKEN;
  if (!process.send || !CHILD_DIRECTORY.test(name || '') || !CHILD_TOKEN.test(token || '')) fail('admin_smoke_child_invocation_rejected');
  const directory = assertAdminSmokeScratch(REPOSITORY, path.join(REPOSITORY, '.tmp', name));
  let worker, stopping = false;
  const stop = async () => {
    stopping = true;
    if (worker) { await worker.stop(); process.disconnect?.(); process.exit(0); }
  };
  process.on('message', value => { if (value?.type === 'shutdown') void stop().catch(() => process.exit(1)); });
  try {
    const { unstable_dev } = await import('wrangler');
    worker = await unstable_dev(path.join(REPOSITORY, 'apps/admin/.open-next/worker.js'), {
      config: path.join(directory, 'wrangler.json'), envFiles: [path.join(directory, 'empty.env')],
      local: true, ip: '127.0.0.1', port: 0, inspectorPort: 0, persist: false, logLevel: 'none',
      experimental: { disableDevRegistry: true, disableExperimentalWarning: true, forceLocal: true,
        showInteractiveDevSession: false, watch: false, enableIpc: false, enableContainers: false },
    });
    if (stopping) await stop();
    else process.send({ type: 'ready', address: worker.address, port: worker.port, token });
  } catch { process.send({ type: 'failed', token }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === '--runtime-child') await runtimeChild();
  else {
    const controller = new AbortController(), abort = () => controller.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {
      if (process.argv.length !== 2) fail('admin_smoke_arguments_rejected');
      console.log(JSON.stringify(await runAdminWorkerdSmoke({ signal: controller.signal })));
    } catch (error) {
      console.error(/^admin_smoke_[a-z0-9_]+$/u.test(error?.message || '') ? error.message : 'admin_smoke_failed');
      process.exitCode = 1;
    } finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
  }
}
