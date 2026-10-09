import { spawnSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const IMAGES = ['public.ecr.aws/docker/library/postgres:17-alpine', 'postgres:17-alpine'];
const PULL_ATTEMPTS = 2, PULL_TIMEOUT_MS = 60000, INSPECT_TIMEOUT_MS = 10000, RETRY_DELAY_MS = 5000;
const INSPECT_FORMAT = '{"imageId":{{json .Id}},"environment":{{json .Config.Env}}}';
const DIAGNOSTICS = {
  pullFailed: 'PostgreSQL test image pull failed; the bounded registry retry policy remains active.',
  inspect: 'Validating the preloaded PostgreSQL 17 test image.',
  ready: 'PostgreSQL 17 test image validated and pinned for all integration suites.',
};
const ERROR_MESSAGES = {
  postgres_test_image_env_invalid: 'The GitHub environment file is unavailable or invalid.',
  postgres_test_image_pull_failed: 'Neither allowed registry supplied the PostgreSQL 17 test image within the bounded pull policy.',
  postgres_test_image_retry_failed: 'The bounded image pull retry could not continue.',
  postgres_test_image_inspect_failed: 'The preloaded PostgreSQL test image could not be inspected.',
  postgres_test_image_invalid: 'The preloaded image did not have a canonical image ID and exactly PG_MAJOR=17.',
  postgres_test_image_env_write_failed: 'The validated PostgreSQL test image could not be exported to the GitHub environment file.',
};

function runDocker(args, timeout) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout, maxBuffer: 64 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

export function parsePostgresTestImageInspection(output) {
  let inspection;
  try { inspection = JSON.parse(output); } catch { throw Error('postgres_test_image_invalid'); }
  if (!inspection || typeof inspection !== 'object' || Array.isArray(inspection)
    || typeof inspection.imageId !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(inspection.imageId)
    || !Array.isArray(inspection.environment) || !inspection.environment.every(value => typeof value === 'string'))
    throw Error('postgres_test_image_invalid');
  const major = inspection.environment.filter(value => value.startsWith('PG_MAJOR='));
  if (major.length !== 1 || major[0] !== 'PG_MAJOR=17') throw Error('postgres_test_image_invalid');
  return inspection.imageId;
}

/** Prepare one local image before parallel SQL suites. They all use its immutable
 * image ID, so docker run cannot independently re-pull a mutable registry tag. */
export async function preparePostgresTestImage({ env = process.env, runImpl = runDocker,
  waitImpl = delay, appendEnvImpl = appendFile, onDiagnostic = () => {} } = {}) {
  const envPath = env.GITHUB_ENV;
  if (typeof envPath !== 'string' || !isAbsolute(envPath) || /[\r\n\0]/u.test(envPath))
    throw Error('postgres_test_image_env_invalid');
  let image;
  for (const candidate of IMAGES) {
    for (let attempt = 0; attempt < PULL_ATTEMPTS; attempt++) {
      let result;
      try { result = await runImpl(['pull', candidate], PULL_TIMEOUT_MS); } catch { /* Never expose registry errors. */ }
      if (result?.status === 0) { image = candidate; break; }
      onDiagnostic(DIAGNOSTICS.pullFailed);
      if (attempt + 1 < PULL_ATTEMPTS) {
        try { await waitImpl(RETRY_DELAY_MS); } catch { throw Error('postgres_test_image_retry_failed'); }
      }
    }
    if (image) break;
  }
  if (!image) throw Error('postgres_test_image_pull_failed');
  onDiagnostic(DIAGNOSTICS.inspect);
  let inspected;
  try { inspected = await runImpl(['image', 'inspect', '--format', INSPECT_FORMAT, image], INSPECT_TIMEOUT_MS); }
  catch { throw Error('postgres_test_image_inspect_failed'); }
  if (inspected?.status !== 0) throw Error('postgres_test_image_inspect_failed');
  const imageId = parsePostgresTestImageInspection(inspected.stdout);
  const exported = `POSTGRES_RLS_TEST_IMAGE=${imageId}\nPOSTGRES_EVIDENCE_V2_TEST_IMAGE=${imageId}\n`;
  try { await appendEnvImpl(envPath, exported, { encoding: 'utf8' }); }
  catch { throw Error('postgres_test_image_env_write_failed'); }
  onDiagnostic(DIAGNOSTICS.ready);
  return { imageId };
}

export async function runPreparePostgresTestImageCli({ prepareImpl = preparePostgresTestImage,
  stdoutImpl = console.log, stderrImpl = console.error } = {}) {
  try { await prepareImpl({ onDiagnostic: stdoutImpl }); return 0; }
  catch (error) {
    const message = Object.hasOwn(ERROR_MESSAGES, error?.message) ? ERROR_MESSAGES[error.message]
      : 'PostgreSQL test image preparation failed.';
    stderrImpl(`::error::${message} CI remains blocked.`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await runPreparePostgresTestImageCli();
