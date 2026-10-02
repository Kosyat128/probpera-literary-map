import assert from 'node:assert/strict';
import path from 'node:path';
import {realpath,readdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [root,output,cache,report]=process.argv.slice(2);assert.equal(process.argv.length,6);
for(const value of [root,output,cache,path.dirname(report)])assert.equal(await realpath(value),value);
assert.equal(await realpath(process.cwd()),cache);assert.deepEqual(await readdir(cache),[]);assert.ok(path.relative(root,output).startsWith('.tmp'+path.sep));assert.deepEqual(await readdir(output),[]);
const require=createRequire(path.join(root,'package.json'));assert.equal(require('vite/package.json').version,'7.3.6');
const vite=await import(pathToFileURL(require.resolve('vite')));const records=new Map();let resolved;
globalThis.fetch=async()=>{throw new Error('External network unavailable in local compile');};
await vite.build({root,configFile:path.join(root,'vite.config.ts'),configLoader:'runner',envDir:false,cacheDir:cache,build:{outDir:output,emptyOutDir:false},plugins:[{
 name:'d262-current-public-input-witness',
 configResolved(config){assert.equal(config.root,root.replaceAll('\\','/'));assert.equal(config.base,'/');assert.equal(config.define.__LITERARY_PLANET_EDITION__,JSON.stringify('site'));assert.equal(config.define.__LITERARY_PLANET_LICENSE_AUTHORITY__,'null');assert.equal(config.define.__LITERARY_PLANET_LOCAL_QA__,'false');assert.equal(config.define.__YANDEX_METRIKA_COUNTER_ID__,JSON.stringify(''));assert.equal(config.envDir,false);assert.equal(path.resolve(config.build.outDir),output);resolved={base:config.base,edition:config.define.__LITERARY_PLANET_EDITION__,localQa:config.define.__LITERARY_PLANET_LOCAL_QA__,licenseAuthority:config.define.__LITERARY_PLANET_LICENSE_AUTHORITY__,configFile:config.configFile,configFileDependencies:config.configFileDependencies};},
 generateBundle(_options,bundle){for(const id of this.getModuleIds()){const info=this.getModuleInfo(id);records.set(id,{id,importedIds:info?.importedIds??[],dynamicallyImportedIds:info?.dynamicallyImportedIds??[]});}resolved.outputs=Object.values(bundle).map(item=>({type:item.type,fileName:item.fileName,...item.type==='chunk'?{imports:item.imports,dynamicImports:item.dynamicImports,modules:Object.keys(item.modules)}:{}}));}
}]});assert.ok(resolved&&records.size);
await writeFile(report,JSON.stringify({schemaVersion:1,kind:'current-public-vite-compile',nodeVersion:process.version,environmentFilesRead:false,semanticCompilerOverrides:false,resolved,modules:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id,'en'))},null,2)+'\n',{flag:'wx'});
