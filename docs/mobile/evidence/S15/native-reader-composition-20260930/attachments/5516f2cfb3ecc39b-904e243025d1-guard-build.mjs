import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function guardBuild(args) {
  const [expectedSource, manifestPath, manifestSha256, ...extra] = args;
  assert.match(expectedSource, /^[a-f0-9]{40}$/u); assert.match(manifestSha256, /^[a-f0-9]{64}$/u); assert.equal(extra.length, 0);
  const root = 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work';
  assert.equal(await fs.realpath('.'), await fs.realpath(root), 'Canonical checkout realpath');
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const git = args => execFileSync('git', ['-c','safe.directory='+root,'-c','safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work',...args], {cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}).trim();
  const roots = ['src','scripts','tests','apps','public','data','index.html','native.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts','capacitor.config.json'];
  const manifestBytes = await fs.readFile(manifestPath); assert.equal(sha(manifestBytes), manifestSha256);
  const manifest = JSON.parse(manifestBytes); assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.files.length, 1665);
  assert.match(manifest.checkpoint, /^[a-f0-9]{40}$/u); git(['merge-base','--is-ancestor',manifest.checkpoint,expectedSource]);
  assert.equal(new Set(manifest.files.map(p=>p.path)).size,1665);
  for (const p of manifest.files) {
    assert.match(p.sha256,/^[a-f0-9]{64}$/u); assert.ok(!path.isAbsolute(p.path) && !p.path.split(/[\\/]/u).includes('..'));
  }
  const predecessor='787902fbc84322879592cca26d53d36a46148a24';
  git(['merge-base','--is-ancestor',predecessor,expectedSource]);
  const baselinePath=root+'/docs/mobile/evidence/S15/booky-globe-canvas-gestures-20260930/source-manifests/e8d98066ca4f368c.json';
  const baselineBytes=await fs.readFile(baselinePath);assert.equal(sha(baselineBytes),'e8d98066ca4f368cb753404dcfdfa1e59509d0ce157a933bb1ea14436be62fbe');
  const original=JSON.parse(baselineBytes).files;
  assert.equal(original.length,1665);assert.deepEqual(manifest.files.map(p=>p.path),original.map(p=>p.path));
  const changedPaths=['src/App.tsx','src/host/PlanetMascotControls.tsx','src/host/planetMascot.test.ts','src/host/planetMascot.ts','tests/pwa/booky-writer-filter-recovery.spec.mjs'].sort();
  assert.deepEqual(manifest.files.filter((p,i)=>p.sha256!==original[i].sha256).map(p=>p.path).sort(),changedPaths,'Only five reader-entry changes; 1660 protected');
  assert.deepEqual(git(['diff','--name-only',predecessor,expectedSource,'--',...roots]).split(/\r?\n/u).filter(Boolean).sort(),changedPaths);
  const verifySource = async () => {
    assert.equal(git(['rev-parse','HEAD']),expectedSource); assert.equal(git(['diff','--cached','--name-only']),'','Empty staging');
    assert.equal(git(['status','--porcelain','--untracked-files=all','--',...roots]),'','Build source clean');
    assert.equal(sha(await fs.readFile(manifestPath)),manifestSha256);
    for (const p of manifest.files) assert.equal(sha(await fs.readFile(p.path)),p.sha256,p.path);
  };
  await verifySource();
  return {root,expectedSource,sourceManifest:{path:manifestPath,sha256:manifestSha256,fileCount:1665},verifySource};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bound = await guardBuild(process.argv.slice(2));
  console.log(JSON.stringify({sourceCommit:bound.expectedSource,sourceManifest:bound.sourceManifest,sourceBound:true,checksRun:false,buildsRun:false},null,2));
}
