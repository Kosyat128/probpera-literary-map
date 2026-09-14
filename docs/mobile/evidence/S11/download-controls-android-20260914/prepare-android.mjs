import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
let source = await fs.readFile('.tmp/s10-opposite-locale-search-20260914/verify-android.mjs', 'utf8');
function replace(before, after) { assert.equal(source.split(before).length, 2); source = source.replace(before, after); }
replace("const reportDirectory='.tmp/s10-opposite-locale-android-20260914';", "const reportDirectory='docs/mobile/evidence/S11/download-controls-android-20260914';");
replace("for(const name of ['Lru/probpera/literaryplanet/MainActivity;','Lcom/getcapacitor/BridgeActivity;'])", "for(const name of ['Lru/probpera/literaryplanet/MainActivity;','Lcom/getcapacitor/BridgeActivity;','Lru/probpera/literaryplanet/PlanetContentStorePlugin;','Landroidx/core/util/AtomicFile;'])");
replace('report.bundledAssets.capacitorCoreBridge=', "report.dex.localContentStore={descriptor:'Lru/probpera/literaryplanet/PlanetContentStorePlugin;',dex:classDefinitions.get('Lru/probpera/literaryplanet/PlanetContentStorePlugin;'),registration:'MainActivity registers before BridgeActivity.onCreate',installedExecutionVerified:false};\nreport.bundledAssets.capacitorCoreBridge=");
await fs.writeFile('.tmp/s11-download-controls-20260914/verify-android.mjs', source, { flag: 'wx' });
console.log('Prepared exact APK verifier with local plugin and AndroidX class checks.');
