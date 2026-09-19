import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// A close-up art inspection, separate from actual-App interaction evidence.
// Uses the production factories, one renderer, no downloaded/reference images.
const [attempt = 'a1', mode = 'draft'] = process.argv.slice(2);
assert.ok(['draft','final','tiers'].includes(mode));
assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = await fs.realpath('.');
const out = 'D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-sr/art-' + attempt;
await assert.rejects(fs.stat(out), { code: 'ENOENT' }); await fs.mkdir(out, { recursive: true });
const inputs = ['src/components/globeCraftMaterials.ts', 'src/components/globeStandGeometry.ts',
  'src/components/globeLibraryBookGeometry.ts','src/components/globeTurnedWoodAtlas.ts','src/components/globeLibraryGeometry.ts', 'docs/mobile/evidence/S13/surface-realism-20260919/capture-library.mjs'];
const snapshot = () => Promise.all(inputs.map(async file => ({ path: file,
  sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const before = await snapshot();
const compiled = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser',
  stdin: { resolveDir: root, sourcefile: 'craft-inspection.ts', contents: `
import * as THREE from 'three';
import { createIncludedGlobeStand } from './src/components/globeStandGeometry';
import { createGlobeLibrary } from './src/components/globeLibraryGeometry';
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1.5); renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color('#17151b');
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,80);
scene.add(new THREE.AmbientLight('#f7d29a',.66));
scene.add(new THREE.HemisphereLight('#ffe2ab','#170620',1.12));
const sun=new THREE.DirectionalLight('#ffd6a0',2.35);sun.position.set(4.5,3.4,4);scene.add(sun);
for(const [color,intensity,distance,position] of [['#c45b24',13,7,[-3.5,-.7,2]],['#e89a5d',9.5,4.8,[0,-1.55,2.35]],
 ['#7b3c91',6.5,4.6,[0,-1.2,-2.4]],['#6f2b8d',8,7,[0,3.5,-3]]]) {
 const light=new THREE.PointLight(color,intensity,distance);light.position.set(...position);scene.add(light);
}
let resource;
window.captureCraft=async(kind,tier='high',angle=0)=>{
 if(resource){scene.remove(resource.group);resource.dispose();}
 resource=kind.startsWith('library')?createGlobeLibrary(tier):createIncludedGlobeStand('stand.base.'+kind,tier);
 scene.add(resource.group);
 if(kind==='library-detail'){camera.position.set(0,1.65,-7.1);camera.lookAt(0,1.7,-9.3);camera.fov=52;}
 else if(kind==='library'){camera.position.set(Math.sin(angle)*3.2,.6,Math.cos(angle)*3.2);camera.lookAt(0,.35,0);camera.fov=58;}
 else {camera.position.set(Math.sin(angle+.4)*1.45,-.73,Math.cos(angle+.4)*1.45);camera.lookAt(0,-1.235,0);camera.fov=36;}
 camera.updateProjectionMatrix();
 renderer.compile(scene,camera);
 for(let index=0;index<3;index++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
 const frames=[];
 for(let index=0;index<3;index++){const start=performance.now();renderer.render(scene,camera);frames.push(performance.now()-start);await new Promise(requestAnimationFrame);}
 const geometry=new Set(),materials=new Set(),textures=new Set();let meshes=0,instances=0;
 resource.group.traverse(object=>{if(!object.isMesh)return;meshes++;instances+=object.isInstancedMesh?object.count:1;geometry.add(object.geometry);
 for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 return {kind,tier,angle,meshes,instances,geometries:geometry.size,materials:materials.size,textures:textures.size,
  drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuMemory:{...renderer.info.memory},
  cpuRenderMs:{median:frames.sort((a,b)=>a-b)[1],max:Math.max(...frames)},devicePerformanceAccepted:false};
};
` } });
const errors = [], frames = [], startedAt = new Date().toISOString();
const context = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'chrome', headless: true,
  viewport: { width: 1280, height: 900 } });
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('https://craft-inspection.test/', route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}canvas{display:block}</style></head><body></body></html>' }));
  await page.goto('https://craft-inspection.test/'); await page.addScriptTag({ content: compiled.outputFiles[0].text });
  const wideAndDetail = [['library','high',0],['library','high',.65],['library-detail','high',0],
    ['wood','high',0],['museum','high',0],['book-stack','high',0],['book-stack','high',2.4]];
  const tiers = [['library','balanced',0],['library','economy',0],['wood','balanced',0],['wood','economy',0],['book-stack','economy',0]];
  for (const [kind, tier, angle] of mode==='tiers'?tiers:mode==='final'?[...wideAndDetail,...tiers]:wideAndDetail) {
    const record = await page.evaluate(args => window.captureCraft(...args), [kind,tier,angle]);
    record.path = path.join(out, kind + '-' + tier + '-' + String(angle).replace('.','_') + '.png');
    await page.screenshot({ path: record.path }); frames.push(record);
  }
} finally { await context.close(); }
const after = await snapshot();
const result = { startedAt, endedAt:new Date().toISOString(), sourceInputs:before,
  sourceInputsUnchanged:JSON.stringify(before)===JSON.stringify(after), frames, errors,
  inspectionOnly:true, actualApp:false, devicePerformanceAccepted:false, artAccepted:false, releaseReady:false };
await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
assert.deepEqual(errors,[]);assert.equal(result.sourceInputsUnchanged,true);
