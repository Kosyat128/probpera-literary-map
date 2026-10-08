import {afterEach, expect, it} from 'vitest';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {nativeProtectedFixtureSourcePaths, nativeRuntimeSources} from './native-install-runtime.mjs';
import {validateAndroidResumeSources} from './prepare-local-release.mjs';

const generator = 'scripts/mobile/native-child-package-assets.mjs';
const generatorBytes = "export const synthetic = 'unchanged';\r\n";
const owned = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

afterEach(async () => {
  for (const {root, parent} of owned.splice(0)) {
    expect(path.dirname(root)).toBe(parent);
    expect(path.basename(root).startsWith('planet-resume-source-test-')).toBe(true);
    expect(await fs.realpath(root)).toBe(root);
    await fs.rm(root, {recursive:true, force:true});
  }
});

async function fixture() {
  const parent = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(parent, 'planet-resume-source-test-'));
  owned.push({root, parent});
  execFileSync('git', ['-c','core.autocrlf=false','-c','init.templateDir=','init',
    '--initial-branch=codex/resume-source-fixture'], {cwd:root, stdio:['ignore','pipe','pipe']});
  const inputs = new Map([
    ['src/work.ts', 'export const work = 1;\n'],
    ['src/work.test.ts', '// synthetic excluded unit fixture\n'],
    [generator, generatorBytes],
    ['scripts/mobile/unrelated-release-helper.mjs', '// broader preparation input\n'],
    ...nativeProtectedFixtureSourcePaths.map(file => [file, '// synthetic required native fixture\n']),
  ]);
  const write = async (file, bytes) => {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), {recursive:true});
    await fs.writeFile(target, bytes);
  };
  for (const [file, bytes] of inputs) await write(file, bytes);
  // Model the broader prior preparation from independently declared raw fixtures.
  const previous = [...inputs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([file, bytes]) => ({path:file, sha256:hash(bytes)}));
  return {root, write, previous};
}

it('resumes an unchanged real native source capture containing the package asset generator', async () => {
  const f = await fixture(), before = structuredClone(f.previous);
  const current = await nativeRuntimeSources(f.root);
  expect(current.files).toContainEqual({path:generator, sha256:hash(generatorBytes)});
  expect(current.files.some(file => file.path === 'src/work.test.ts')).toBe(false);
  expect(validateAndroidResumeSources(f.previous, current)).toBe(true);
  await f.write('src/work.test.ts', '// only excluded unit source changed\n');
  expect(validateAndroidResumeSources(f.previous, await nativeRuntimeSources(f.root))).toBe(true);
  expect(f.previous).toEqual(before);
});

it('refuses a raw-byte-only change to the package asset generator', async () => {
  const f = await fixture();
  await f.write(generator, generatorBytes.replace('\r\n', '\n'));
  const current = await nativeRuntimeSources(f.root);
  expect(() => validateAndroidResumeSources(f.previous, current)).toThrow(/raw bytes changed/u);
});

it('does not invent the generator hash for an older receipt that omitted the input', async () => {
  const f = await fixture(), current = await nativeRuntimeSources(f.root);
  const older = f.previous.filter(file => file.path !== generator);
  expect(() => validateAndroidResumeSources(older, current)).toThrow(/raw bytes changed/u);
});

it('refuses a newly added native source even when every historical raw hash still matches', async () => {
  const f = await fixture();
  await f.write('apps/mobile/android/app/src/main/java/Extra.java', '// newly added native input\n');
  const current = await nativeRuntimeSources(f.root);
  expect(() => validateAndroidResumeSources(f.previous, current)).toThrow(/raw bytes changed/u);
});
