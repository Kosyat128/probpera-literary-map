import fs from 'node:fs/promises';
const folder='.tmp/s10-opposite-locale-search-20260914',out='docs/mobile/evidence/S10/opposite-locale-search-20260914';
await fs.mkdir(out,{recursive:true});
let checks=await fs.readFile('.tmp/s09-archive-header-20260914/run-checks.mjs','utf8');
checks=checks.replaceAll('evidence/S09/archive-header-20260914','evidence/S10/opposite-locale-search-20260914')
 .replace("const unitFiles = ['scripts/mobile/pwa-portrait-selection.test.mjs', 'src/pwa/registerPwaWorker.test.ts', 'src/pwa/serviceWorkerRuntime.test.mjs'];","const unitFiles = ['src/components/GlobalSearch.test.ts', 'src/search/globalSearchIndex.test.ts', 'src/data/bookAuthorSearch.test.ts'];");
await fs.writeFile(folder+'/run-checks.mjs',checks,{flag:'wx'});
let browser=await fs.readFile('.tmp/s09-archive-header-20260914/run-browser.mjs','utf8');
browser=browser.replaceAll('s09-archive-header-20260914','s10-opposite-locale-search-20260914').replaceAll('evidence/S09/archive-header-20260914','evidence/S10/opposite-locale-search-20260914')
 .replaceAll('native book author navigation closes the reader and reveals the canonical writer across RU and EN on the retained globe','mobile globe search resolves canonical opposite-locale author names and patronymics in RU and EN on the retained scene')
 .replaceAll('native-book-author-return-','native-author-search-');
await fs.writeFile(folder+'/run-browser.mjs',browser,{flag:'wx'});
await fs.writeFile(out+'/entry.json',JSON.stringify({schemaVersion:1,recordedAt:new Date().toISOString(),stage:'S10',status:'IN_PROGRESS',checkpoint:'d56904c079483c269d2b47852b86e748c98f7c43',route:'S03-S10',basis:'S10 already entered as parallel-safe; BIL-036/037 hidden canonical name fields can be corrected while final owner archives and other stage gates remain open.',scope:['Current-language label eligibility remains authoritative; opposite-language supported names enrich existing shared search fields.','Globe search, global search/suggestions and book-author search resolve the same canonical IDs without relabeling results.','Preserve UTF-8 fixture and integrated card/header/cover changes from S09; one combined exact-source artifact refresh follows validation.'],noFactualCatalogChanges:true,stageAccepted:false,releaseReady:false},null,2)+'\n',{flag:'wx'});
