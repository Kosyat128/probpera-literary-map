import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Isolated art inspection, not actual-App, release or device acceptance. The
// renderer/material/light pipeline matches the preceding surface inspection.
// One renderer/camera serves every view; no downloaded assets or panorama.
const [attempt = 'a1'] = process.argv.slice(2);
assert.match(attempt, /^a[1-9][0-9]*$/u);
const root = await fs.realpath('.');
const out = path.join('D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-wh', 'art-' + attempt);
await assert.rejects(fs.stat(out), { code: 'ENOENT' });
await fs.mkdir(out, { recursive: true });
const inputs = ['src/components/globeWhaleStandGeometry.ts', 'src/components/globeAntiqueGeometry.ts',
  'src/components/globeCraftMaterials.ts', 'src/components/globeQuality.ts', 'src/components/LiteraryGlobe.tsx',
  'docs/mobile/evidence/S13/three-whales-20260919/capture-whales.mjs'];
const snapshot = () => Promise.all(inputs.map(async file => ({ path: file,
  sha256: createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex') })));
const before = await snapshot();
// Original contour factories are extracted verbatim, not independently redrawn.
// The reference excludes the meridian, globe and crown: this is a support-only
// comparison using the original BronzeWhale numeric transforms/material props.
const literaryGlobe = (await fs.readFile(path.join(root, 'src/components/LiteraryGlobe.tsx'), 'utf8')).replaceAll('\r\n', '\n');
const helpersStart = literaryGlobe.indexOf('function createWhaleTailGeometry()');
const helpersEnd = literaryGlobe.indexOf('function WhaleBronzeMaterial()', helpersStart);
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart, 'Canonical whale helper boundaries changed');
const canonicalHelpers = literaryGlobe.slice(helpersStart, helpersEnd);
assert.ok(canonicalHelpers.includes('function createWhaleFinGeometry(') && canonicalHelpers.includes('function createWhaleMouthGeometry()'));
const compiled = await build({ absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser',
  stdin: { resolveDir: root, loader: 'ts', sourcefile: 'whales-inspection.ts', contents: `
import * as THREE from 'three';
import { createWhaleStandGeometry } from './src/components/globeWhaleStandGeometry';
import { createAntiqueWhaleBodyGeometry } from './src/components/globeAntiqueGeometry';
import { resolveGlobeQualityProfile } from './src/components/globeQuality';
${canonicalHelpers}
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1.5);renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#17151b');
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.01,80);
scene.add(new THREE.AmbientLight('#f7d29a',.66));
scene.add(new THREE.HemisphereLight('#ffe2ab','#170620',1.12));
const sun=new THREE.DirectionalLight('#ffd6a0',2.35);sun.position.set(4.5,3.4,4);scene.add(sun);
for(const [color,intensity,distance,position] of [['#c45b24',13,7,[-3.5,-.7,2]],['#e89a5d',9.5,4.8,[0,-1.55,2.35]],
 ['#7b3c91',6.5,4.6,[0,-1.2,-2.4]],['#6f2b8d',8,7,[0,3.5,-3]]]) {
 const light=new THREE.PointLight(color,intensity,distance);light.position.set(...position);scene.add(light);
}
function canonicalReference(){
 const group=new THREE.Group(),geometry=new Set(),materials=new Set();
 const own=g=>{geometry.add(g);return g}, material=m=>{materials.add(m);return m};
 const profile=resolveGlobeQualityProfile('high');
 const body=own(createAntiqueWhaleBodyGeometry({longitudinalSegments:profile.antiqueWhaleLongitudinalSegments,radialSegments:profile.antiqueWhaleRadialSegments}));
 const tail=own(createWhaleTailGeometry()),left=own(createWhaleFinGeometry(-1)),right=own(createWhaleFinGeometry(1)),mouth=own(createWhaleMouthGeometry());
 const bronze=material(new THREE.MeshPhysicalMaterial({color:'#795035',emissive:'#36140d',emissiveIntensity:.34,
  metalness:.8,roughness:.34,clearcoat:.38,clearcoatRoughness:.4,side:THREE.DoubleSide}));
 const seam=material(new THREE.LineBasicMaterial({color:'#230b09',transparent:true,opacity:.82,toneMapped:false}));
 const eyeMaterial=material(new THREE.MeshPhysicalMaterial({color:'#0d0708',emissive:'#d77930',emissiveIntensity:.48,metalness:.28,roughness:.2}));
 const cone=own(new THREE.ConeGeometry(1,1.5,22)),eye=own(new THREE.SphereGeometry(1,16,12));
 for(let index=0;index<3;index++){
  const whale=new THREE.Group();whale.rotation.y=index*Math.PI*2/3;group.add(whale);
  for(const geometry of [body,tail,left,right])whale.add(new THREE.Mesh(geometry,bronze));
  const dorsal=new THREE.Mesh(cone,bronze);dorsal.position.set(0,-.94,.35);dorsal.rotation.x=.12;dorsal.scale.set(.085,.17,.16);whale.add(dorsal);
  whale.add(new THREE.LineSegments(mouth,seam));
  for(const side of [-1,1]){const object=new THREE.Mesh(eye,eyeMaterial);object.position.set(side*.205,-1.055,.86);object.scale.set(.018,.018,.011);whale.add(object);}
 }
 for(const [index,radius] of [.62,1.02,1.38].entries()){
  const ring=new THREE.Mesh(own(new THREE.TorusGeometry(radius,.0035,6,profile.antiqueBaseSegments)),material(new THREE.MeshBasicMaterial({
   color:index===0?'#f29548':'#8b4ba5',transparent:true,opacity:.2-index*.035,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})));
  ring.position.y=-1.31-index*.012;ring.rotation.x=Math.PI/2;group.add(ring);
 }
 let disposed=false;
 return{group,dispose(){if(disposed)return;disposed=true;for(const g of geometry)g.dispose();for(const m of materials)m.dispose();group.clear();}};
}
function textureBytes(texture){
 const seen=new Set();let bytes=0;
 if(texture.mipmaps?.some(m=>m.data)){
  for(const mip of texture.mipmaps){if(mip.data&&!seen.has(mip.data.buffer)){seen.add(mip.data.buffer);bytes+=mip.data.buffer.byteLength;}}
  return bytes;
 }
 const image=texture.image;if(!image?.data)return 0;
 bytes=image.data.byteLength;
 if(texture.generateMipmaps){let w=image.width,h=image.height;const bytesPerPixel=bytes/(w*h);
  while(w>1||h>1){w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));bytes+=w*h*bytesPerPixel;}}
 return bytes;
}
const retired=[];let resource=null,resourceKey=null,creationMs=0;
function retire(){
 if(!resource)return;
 scene.remove(resource.group);
 const textures=new Map(),geometry=new Map(),materials=new Map();
 const originalTexture=THREE.Texture.prototype.dispose,originalGeometry=THREE.BufferGeometry.prototype.dispose,originalMaterial=THREE.Material.prototype.dispose;
 THREE.Texture.prototype.dispose=function(){const item=textures.get(this)||{name:this.name,bytesIncludingMips:textureBytes(this),calls:0};item.calls++;textures.set(this,item);return originalTexture.call(this);};
 THREE.BufferGeometry.prototype.dispose=function(){geometry.set(this,(geometry.get(this)||0)+1);return originalGeometry.call(this);};
 THREE.Material.prototype.dispose=function(){materials.set(this,(materials.get(this)||0)+1);return originalMaterial.call(this);};
 try{resource.dispose();resource.dispose();}
 finally{THREE.Texture.prototype.dispose=originalTexture;THREE.BufferGeometry.prototype.dispose=originalGeometry;THREE.Material.prototype.dispose=originalMaterial;}
 retired.push({key:resourceKey,ownedTextures:[...textures.values()],ownedTextureBytesIncludingMips:[...textures.values()].reduce((s,t)=>s+t.bytesIncludingMips,0),
  geometryCount:geometry.size,materialCount:materials.size,exactOnce:[...textures.values()].every(t=>t.calls===1)&&[...geometry.values(),...materials.values()].every(n=>n===1)});
 resource=null;resourceKey=null;
}
window.captureWhales=async(tier,view,reference=false)=>{
 const key=reference?'canonical-reference':tier;
 if(resourceKey!==key){retire();const started=performance.now();resource=reference?canonicalReference():createWhaleStandGeometry(tier);creationMs=performance.now()-started;
  resourceKey=key;scene.add(resource.group);}
 if(view==='three-quarter'){camera.position.set(2.48,-.64,2.96);camera.lookAt(0,-1.10,0);camera.fov=42;}
 else if(view==='underside'){camera.position.set(.65,-2.12,3.32);camera.lookAt(0,-1.10,.06);camera.fov=43;}
 else if(view==='head-detail'){camera.position.set(.67,-1.015,1.75);camera.lookAt(.025,-1.035,.84);camera.fov=33;}
 else{camera.position.set(0,-.69,3.86);camera.lookAt(0,-1.10,0);camera.fov=42;}
 camera.updateProjectionMatrix();resource.group.updateMatrixWorld(true);
 renderer.compile(scene,camera);
 for(let index=0;index<3;index++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
 const frames=[];for(let index=0;index<3;index++){const start=performance.now();renderer.render(scene,camera);frames.push(performance.now()-start);await new Promise(requestAnimationFrame);}
 const geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set(),world=new THREE.Vector3(),bounds=new THREE.Box3();
 let meshes=0,lines=0,instances=0,triangles=0,drawGroups=0,geometryBytes=0,maxRadius=0,vertices=0,finite=true;
 resource.group.traverse(object=>{
  if(!object.isMesh&&!object.isLine)return;
  if(object.isMesh){meshes++;instances+=object.isInstancedMesh?object.count:1;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;
   drawGroups+=Array.isArray(object.material)?object.geometry.groups.length:1;}else lines++;
  geometries.add(object.geometry);const positions=object.geometry.getAttribute('position');
  for(let index=0;index<positions.count;index++){world.fromBufferAttribute(positions,index).applyMatrix4(object.matrixWorld);vertices++;
   finite=finite&&Number.isFinite(world.x)&&Number.isFinite(world.y)&&Number.isFinite(world.z);bounds.expandByPoint(world);maxRadius=Math.max(maxRadius,Math.hypot(world.x,world.z));}
  for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
 });
 for(const geometry of geometries){for(const attribute of [...Object.values(geometry.attributes),geometry.index].filter(Boolean)){
  const buffer=attribute.array?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);geometryBytes+=buffer.byteLength;}}}
 return{tier,view,reference,creationMs,meshes,lines,instances,totalTriangles:triangles,theoreticalDrawGroups:drawGroups,
  geometryCount:geometries.size,geometryBytes,materialCount:materials.size,referencedTextureCount:textures.size,
  referencedTextureBytesIncludingMips:[...textures].reduce((sum,t)=>sum+textureBytes(t),0),
  transformedBounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),maxRadius,vertices,finite},
  render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuMemory:{...renderer.info.memory}},
  cpuRenderMs:{median:[...frames].sort((a,b)=>a-b)[1],max:Math.max(...frames)},camera:{position:camera.position.toArray(),fov:camera.fov},devicePerformanceAccepted:false};
};
window.finishWhalesInspection=()=>{retire();renderer.render(scene,camera);return{retired,gpuMemoryAfterOwnerDisposal:{...renderer.info.memory},
 globalGpuLeakClaim:false};};
` } });
const errors = [], frames = [], startedAt = new Date().toISOString();
let disposal = null;
const context = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'chrome', headless: true,
  viewport: { width: 1280, height: 900 } });
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('https://whales-inspection.test/', route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}canvas{display:block}</style></head><body></body></html>' }));
  await page.goto('https://whales-inspection.test/');
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  for (const [tier, view, reference] of [['high','front',true],['high','front',false],['high','three-quarter',false],
    ['high','underside',false],['high','head-detail',false],['balanced','front',false],['economy','front',false]]) {
    const record = await page.evaluate(args => window.captureWhales(...args), [tier,view,reference]);
    record.path = path.join(out, (reference ? 'canonical-reference' : 'three-whales') + '-' + tier + '-' + view + '.png');
    await page.screenshot({ path: record.path });
    record.sha256 = createHash('sha256').update(await fs.readFile(record.path)).digest('hex');
    frames.push(record);
  }
  disposal = await page.evaluate(() => window.finishWhalesInspection());
} finally { await context.close(); }
const after = await snapshot();
const result = { startedAt, endedAt: new Date().toISOString(), sourceInputs: before,
  sourceInputsUnchanged: JSON.stringify(before) === JSON.stringify(after), frames, disposal, errors,
  canonicalReference: 'Original contour functions extracted verbatim; original stand transforms/materials reconstructed from LiteraryGlobe; body uses existing generator and high quality profile. Globe/meridians excluded.',
  inspectionOnly: true, actualApp: false, devicePerformanceAccepted: false, artAccepted: false, releaseReady: false };
await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
assert.deepEqual(errors, []);
assert.equal(result.sourceInputsUnchanged, true);
assert.ok(frames.every(frame => frame.transformedBounds.finite));
assert.ok(disposal.retired.every(owner => owner.exactOnce));
for (const [index, tier] of ['high','balanced','economy'].entries()) {
  const frame = frames.find(frame => !frame.reference && frame.tier === tier);
  const owner = disposal.retired.find(owner => owner.key === tier);
  assert.ok(frame.meshes <= 70 && frame.totalTriangles <= 70_000, tier + ' geometry budget');
  assert.ok(owner.ownedTextureBytesIncludingMips <= 5.5 * 1024 * 1024 / 4 ** index, tier + ' full owned texture budget');
}
