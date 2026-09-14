import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const folder='.tmp/s10-opposite-locale-search-20260914';
let source=await fs.readFile(folder+'/preserve-pwa.mjs','utf8');
source=source.replaceAll('fs.writeFileSync(', 'writeVerified(')
 .replace('assert.equal(exists(destination), false); assert.equal(exists(archive), false);','assert.equal(exists(destination), true); assert.equal(exists(archive), true); assert.equal(exists(destination + "/result.json"), false);')
 .replace('fs.mkdirSync(safe(destination, false));','if (!exists(destination)) fs.mkdirSync(safe(destination, false));')
 .replace("fs.mkdirSync(safe(destination + '/helpers', false));","if (!exists(destination + '/helpers')) fs.mkdirSync(safe(destination + '/helpers', false));")
 .replace('fs.mkdirSync(safe(archive, false));','if (!exists(archive)) fs.mkdirSync(safe(archive, false));');
const marker='function save(filename, value)';assert.ok(source.includes(marker));
source=source.replace(marker,`const recoveredWrites = [];
function writeVerified(filename, value, options) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  if (!fs.existsSync(filename)) { fs.writeFileSync(filename, bytes, options); return; }
  assert.equal(fs.realpathSync(filename), filename); assert.equal(fs.lstatSync(filename).isSymbolicLink(), false);
  const existing = fs.readFileSync(filename); if (existing.equals(bytes)) return;
  const archiveRoot = safe(archive) + path.sep;
  assert.ok(filename.startsWith(archiveRoot), 'Only the interrupted runtime archive may contain a partial write');
  assert.ok(existing.length < bytes.length && existing.equals(bytes.subarray(0, existing.length)), 'Existing bytes must be an exact short prefix from interrupted ENOSPC copy');
  recoveredWrites.push({path:path.relative(root, filename).replaceAll('\\\\','/'),previousBytes:existing.length,expectedBytes:bytes.length,previousSha256:sha(existing),expectedSha256:sha(bytes)});
  fs.writeFileSync(filename, bytes, {flag:'w'});
}
${marker}`);
const anchor='  archivedRuntime = { path: archive';assert.ok(source.includes(anchor));
source=source.replace(anchor,`  const wanted = new Set(original.map(file => file.path));
  let archivedCount = 0; walk(archive, relative => { assert.ok(wanted.has(relative), 'Unexpected interrupted archive entry'); archivedCount++; });
  assert.equal(archivedCount, original.length);
${anchor}`);
source=source.replace("save(destination + '/result.json', result);",`save(destination + '/preservation-recovery.json', {schemaVersion:1,recordedAt:new Date().toISOString(),reason:'ENOSPC during extra runtime copy; completed source build/audit/browser were not repeated',recoveredWrites,generatedIntermediatesRemovedBytes:150308463,finalApksRetained:true,buildsRepeated:false,testsRepeated:false});
save(destination + '/result.json', result);`);
await fs.writeFile(folder+'/resume-pwa-preservation.mjs',source,{flag:'wx'});
