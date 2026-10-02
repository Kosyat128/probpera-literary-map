import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work'),sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const git=a=>execFileSync('git',['-c','safe.directory='+ROOT,'-c','core.autocrlf=false','-c','core.whitespace=cr-at-eol,-blank-at-eof',...a],{cwd:ROOT,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const prior=JSON.parse(await fs.readFile(path.join(HERE,'source-commit.json')));assert.equal(git(['rev-parse','HEAD']),prior.sourceCommit);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
const owners=['src/host/PlanetMascotControls.tsx','tests/pwa/controlled-pwa.spec.mjs'],rows=[];
await fs.mkdir(path.join(HERE,'repair-originals'));
for(const owner of owners){const original=await fs.readFile(path.join(ROOT,owner));await fs.writeFile(path.join(HERE,'repair-originals',path.basename(owner)),original,{flag:'wx'});let text=original.toString();
if(owner===owners[0]){assert.equal(sha(original),'b75661b835ffdd295a13cb8119cb46dfd77b3fee22311d95b21b61dcda7cf949');const target=".native-planet-app [data-atlas-search-listbox]';";assert.equal(text.split(target).length,2);text=text.replace(target,".native-planet-app [data-atlas-search-listbox], .native-planet-app .product-notice-host';");}
else{assert.equal(sha(original),prior.sourceSha256);const needle='test("saved Booky size survives a full persistent browser restart offline through the real Web preference port"';const i=text.indexOf(needle);assert.ok(i>0);const prefix=Buffer.from(text.slice(0,i));let tail=text.slice(i);const guard='    evidence.persistentLaunches++; if (evidence.persistentLaunches > 1) evidence.restarts++;';assert.equal(tail.split(guard).length,2);tail=tail.replace(guard,'    context.setDefaultTimeout(15_000);\n'+guard);
const show=`    if (await pet.getAttribute("data-planet-mascot-active") !== "true") await pet.locator('[data-planet-mascot-toggle]').tap();`;assert.equal(tail.split(show).length,2);
tail=tail.replace(show,`    if (await pet.getAttribute("data-planet-mascot-active") !== "true") {
      const toggle = pet.locator('[data-planet-mascot-toggle]');
      await expect(toggle).toBeVisible();
      await expect.poll(() => toggle.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return Boolean(hit && element.contains(hit));
      })).toBe(true);
      await toggle.tap();
    }`);text=text.slice(0,i)+tail;assert.equal(prefix.equals(original.subarray(0,prefix.length)),true);}
const bytes=Buffer.from(text);await fs.writeFile(path.join(ROOT,owner),bytes);rows.push({path:owner,beforeSha256:sha(original),afterSha256:sha(bytes)});}
assert.deepEqual(git(['diff','--name-only']).split('\n').sort(),owners.slice().sort());git(['diff','--check']);git(['add','--',...owners]);git(['commit','-m','fix(mobile): keep Booky controls clear of offline notices']);assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
const sourceCommit=git(['rev-parse','HEAD']);await fs.writeFile(path.join(HERE,'repair-source-commit.json'),json({schemaVersion:1,decision:'D268',sourceCommit,featureSourceCommit:prior.featureSourceCommit,initialAttemptSourceCommit:prior.sourceCommit,sourceOnlyTestAppend:false,sizeFeatureUnchanged:true,pwaNoticePlacementFix:true,files:rows,testsPending:true,qualification:'Initial offline case reached cached authorized globe but timed out with hidden Booky return control behind the status layer. Existing native-app obstacle measurement now includes the actual product notice host; unchanged finite placement handles expanded/collapsed notice bounds without raising layers or changing canonical globe. Default action timeout now yields a bounded call log; overall test timeout unchanged. Follow-up runtime and actual captures remain pending.'}),{flag:'wx'});console.log(json({sourceCommit,files:rows}));
