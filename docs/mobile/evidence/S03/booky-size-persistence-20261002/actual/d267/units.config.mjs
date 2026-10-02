import path from 'node:path';import{createRequire}from'node:module';import{pathToFileURL,fileURLToPath}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=process.env.D267_ROOT;
if(!root)throw Error('Missing owned D267 root');
const require=createRequire(path.join(root,'package.json')),{defineConfig}=await import(pathToFileURL(require.resolve('vitest/config')));
export default defineConfig({root,envDir:false,cacheDir:path.join(here,'actual-a1/cache'),test:{include:['src/host/bookySizePreference.test.ts','src/host/HostPlatformServices.test.ts','src/platform/adapters/web/WebPlatformAdapter.test.ts'],testNamePattern:/Booky (size|motion)/,reporters:['json'],outputFile:path.join(here,'actual-a1/vitest.json')}});
